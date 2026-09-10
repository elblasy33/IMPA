"""
Autonomous Staged Anti-Ban Campaign Runner
------------------------------------------
Executes gradual, stealthy data extraction against ShipServ IMPA Catalogue:
- Human-simulated jitter intervals (2.5s - 5.0s)
- Batch cooldowns (10s - 15s pause after each subcategory)
- Automatic queue progression through all 34 categories
- Built-in circuit breaker against rate limits (HTTP 429/403)
- Product data quality scoring & review tagging
"""

import sys
import os
import json
import time
import random
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from bs4 import BeautifulSoup
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import USER_AGENTS, DB_PATH
from db import (
    init_db,
    upsert_product,
    get_or_create_campaign,
    update_campaign,
    get_category_queue,
    upsert_category_queue_items,
    update_queue_category_progress,
    get_quality_audit,
)
from shipserv_scraper import ShipServImpaScraper, BASE_URL, IMAGE_CDN_BASE

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CampaignRunner")

# Anti-Ban Profiles
STEALTH_PROFILES = {
    "stealth": {
        "name": "Ultra-Stealth Safe",
        "delay_min": 2.5,
        "delay_max": 5.0,
        "batch_cooldown": 12.0,
        "circuit_breaker_cooldown": 900,  # 15 minutes
        "risk_level": "Low (Safe Mode)",
    },
    "balanced": {
        "name": "Balanced Speed",
        "delay_min": 1.5,
        "delay_max": 3.2,
        "batch_cooldown": 7.0,
        "circuit_breaker_cooldown": 600,  # 10 minutes
        "risk_level": "Moderate",
    },
    "turbo": {
        "name": "Turbo (Higher Risk)",
        "delay_min": 0.8,
        "delay_max": 1.8,
        "batch_cooldown": 3.0,
        "circuit_breaker_cooldown": 300,
        "risk_level": "High",
    }
}

class ImpaCampaignRunner:
    def __init__(self, profile_name: str = "stealth", db_path: Path = DB_PATH):
        self.db_path = db_path
        self.profile = STEALTH_PROFILES.get(profile_name, STEALTH_PROFILES["stealth"])
        self.profile_name = profile_name
        self.session = requests.Session()
        self.shipserv = ShipServImpaScraper()
        init_db(self.db_path)

    def _get_headers(self) -> Dict[str, str]:
        ua = random.choice(USER_AGENTS)
        return {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://impa-catalogue.shipserv.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
        }

    def _sleep_jitter(self):
        delay = random.uniform(self.profile["delay_min"], self.profile["delay_max"])
        time.sleep(delay)

    def init_queue(self) -> List[Dict[str, Any]]:
        """Populates category queue from ShipServ directory if empty."""
        queue = get_category_queue(self.db_path)
        if not queue:
            logger.info("Initializing Category Queue from ShipServ...")
            cats = self.shipserv.get_categories()
            items = []
            for c in cats:
                items.append({
                    "code": c["code"],
                    "name": c["name"],
                    "slug": c["slug"],
                    "status": "pending",
                })
            upsert_category_queue_items(items, self.db_path)
            queue = get_category_queue(self.db_path)
            logger.info(f"✅ Queued {len(queue)} official categories for staged collection.")
        return queue

    def run_staged_batch(self, max_items: int = 50, specific_category: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes a controlled batch of product extraction with anti-ban safeguards.
        """
        queue = self.init_queue()
        camp = get_or_create_campaign(db_path=self.db_path)
        update_campaign({"status": "running"}, db_path=self.db_path)

        # Select category: specific or next pending
        target_cat = None
        if specific_category:
            for c in queue:
                if c["category_code"] == specific_category:
                    target_cat = c
                    break
        else:
            for c in queue:
                if c["status"] in ("pending", "in_progress"):
                    target_cat = c
                    break

        if not target_cat:
            logger.info("🎉 All categories in the queue are completed!")
            update_campaign({"status": "completed"}, db_path=self.db_path)
            return {"status": "all_completed", "items_scraped": 0}

        cat_code = target_cat["category_code"]
        cat_name = target_cat["category_name"]
        cat_slug = target_cat["slug"]

        logger.info(f"🛡️ [Anti-Ban: {self.profile['name']}] Processing Category [{cat_code}] {cat_name}...")
        update_campaign({"current_category": cat_code}, db_path=self.db_path)

        # Fetch subcategories
        cat_url = f"{BASE_URL}/{cat_slug}"
        try:
            resp = self.session.get(cat_url, headers=self._get_headers(), timeout=10)
            if resp.status_code in (429, 403):
                logger.warning(f"🚨 Rate limited (HTTP {resp.status_code}) on {cat_url}! Triggering circuit breaker.")
                update_campaign({"status": "paused_cooldown"}, db_path=self.db_path)
                return {"status": "circuit_breaker", "items_scraped": 0}

            soup = BeautifulSoup(resp.text, "html.parser")
            prefix = f"/{cat_slug}/"
            subcat_links = list(set([
                a["href"] for a in soup.find_all("a", href=True)
                if a["href"].startswith(prefix)
            ]))
        except Exception as e:
            logger.error(f"Failed to load category page: {e}")
            return {"status": "error", "items_scraped": 0, "error": str(e)}

        total_subs = len(subcat_links)
        done_subs = target_cat.get("subcategories_done", 0)
        logger.info(f"Category [{cat_code}] has {total_subs} subcategories (Completed so far: {done_subs}).")

        items_scraped = 0
        new_done_subs = done_subs

        # Process pending subcategories
        for sub_index, subcat_path in enumerate(subcat_links):
            if sub_index < done_subs:
                continue  # already done in previous batch

            if items_scraped >= max_items:
                logger.info(f"Reached batch limit ({max_items} items). Pausing stage cleanly.")
                break

            sub_url = f"{BASE_URL}{subcat_path}"
            logger.info(f"Inspecting subcategory ({sub_index + 1}/{total_subs}): {subcat_path.split('/')[-1]}")

            try:
                self._sleep_jitter()
                sub_resp = self.session.get(sub_url, headers=self._get_headers(), timeout=10)
                
                # Circuit breaker check
                if sub_resp.status_code in (429, 403):
                    logger.warning(f"🚨 Circuit Breaker: HTTP {sub_resp.status_code} received. Cooling down.")
                    update_campaign({"status": "paused_cooldown"}, db_path=self.db_path)
                    break

                if sub_resp.status_code != 200:
                    continue

                ssoup = BeautifulSoup(sub_resp.text, "html.parser")
                snd = ssoup.find("script", id="__NEXT_DATA__")
                if not snd or not snd.string:
                    continue

                sdata = json.loads(snd.string)
                sapollo = sdata.get("props", {}).get("pageProps", {}).get("apolloState", {})

                for v in sapollo.values():
                    if v.get("__typename") == "IMPAProduct" and v.get("partNumber"):
                        part_num = str(v.get("partNumber")).strip().zfill(6)
                        name = v.get("name", "").strip()
                        desc = v.get("description", "").strip() or f"IMPA {part_num} {name}"
                        uom = (v.get("unitOfMeasure") or "PCS").strip().upper()
                        pic_file = v.get("pictureFileName")
                        image_url = f"{IMAGE_CDN_BASE}{pic_file}" if pic_file else None
                        slug = v.get("urlSlug")
                        source_url = f"{BASE_URL}/{slug}" if slug else sub_url

                        product_record = {
                            "impa_code": part_num,
                            "category_code": cat_code,
                            "category_name": cat_name,
                            "product_name": name,
                            "description": desc,
                            "uom": uom,
                            "image_url": image_url,
                            "source_url": source_url,
                            "status": "shipserv_verified"
                        }

                        upsert_product(product_record, self.db_path)
                        items_scraped += 1
                        logger.info(f"✅ IMPA {part_num}: {name[:40]} [{uom}]")

                        if items_scraped >= max_items:
                            break

                new_done_subs += 1
                
                # Subcategory cooldown to prevent robotic patterns
                if items_scraped < max_items:
                    cooldown = random.uniform(
                        self.profile["batch_cooldown"] * 0.8,
                        self.profile["batch_cooldown"] * 1.2
                    )
                    logger.debug(f"☕ Stealth batch cooldown: sleeping {cooldown:.1f}s...")
                    time.sleep(cooldown)

            except Exception as e:
                logger.error(f"Error scraping subcategory {sub_url}: {e}")
                continue

        # Update queue category status
        new_status = "completed" if new_done_subs >= total_subs else "in_progress"
        update_queue_category_progress(
            cat_code,
            new_done_subs,
            total_subs,
            items_scraped,
            new_status,
            self.db_path
        )

        camp = update_campaign({
            "status": "idle",
            "today_count": camp.get("today_count", 0) + items_scraped
        }, db_path=self.db_path)

        logger.info(f"🏁 Stage complete: {items_scraped} items collected safely. Category status: {new_status}")
        return {
            "status": "success",
            "category_code": cat_code,
            "items_scraped": items_scraped,
            "subcategories_done": new_done_subs,
            "subcategories_total": total_subs,
            "category_status": new_status,
        }

if __name__ == "__main__":
    profile = "stealth"
    for arg in sys.argv:
        if arg.startswith("--profile="):
            profile = arg.split("=")[1]

    runner = ImpaCampaignRunner(profile_name=profile)
    if "--init" in sys.argv:
        runner.init_queue()
    elif "--run" in sys.argv:
        limit = 25
        category = None
        for arg in sys.argv:
            if arg.startswith("--limit="):
                limit = int(arg.split("=")[1])
            elif arg.startswith("--category="):
                category = arg.split("=")[1]
        runner.run_staged_batch(max_items=limit, specific_category=category)
    else:
        print("Usage: python campaign_runner.py [--init | --run [--limit=50] [--category=23] [--profile=stealth]]")

