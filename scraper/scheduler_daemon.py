#!/usr/bin/env python3
"""
=============================================================================
IMPA Marine Stores Guide - Stateful Scraper Worker Daemon
=============================================================================
Architecture:
- Background daemon process designed for containerized execution.
- Extracts product data directly from ShipServ Next.js __NEXT_DATA__ apolloState JSON.
- Respects active campaign parameters: status, daily caps, and stealth jitter.
- Anti-Ban Circuit Breaker: auto-pauses on HTTP 429 / 403 for 15 minutes.
- Sequence Gap Bypass: saves 404 items as status='not_found' to prevent duplicate checks.
- Graceful Shutdown: intercepts SIGINT/SIGTERM to flush transactions before exiting.
=============================================================================
"""

import sys
import os
import signal
import time
import random
import json
import logging
from typing import Dict, Any, Optional, List, Set
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# Ensure current directory is in Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import USER_AGENTS, DB_PATH, IMPA_CATEGORIES
from db import (
    init_db,
    get_connection,
    upsert_product,
    record_not_found_code,
    get_existing_codes_for_category,
    get_or_create_campaign,
    update_campaign,
    get_category_queue,
    upsert_category_queue_items,
    update_queue_category_progress,
)
from shipserv_scraper import BASE_URL, IMAGE_CDN_BASE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [WorkerDaemon] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("SchedulerDaemon")

# Anti-Ban Profiles configuration
STEALTH_PROFILES = {
    "stealth": {
        "name": "Ultra-Stealth Safe",
        "delay_min": 2.5,
        "delay_max": 5.0,
        "batch_cooldown": 12.0,
        "circuit_breaker_cooldown": 900,  # 15 minutes
    },
    "balanced": {
        "name": "Balanced Speed",
        "delay_min": 1.5,
        "delay_max": 3.2,
        "batch_cooldown": 7.0,
        "circuit_breaker_cooldown": 600,  # 10 minutes
    },
    "turbo": {
        "name": "Turbo Stage",
        "delay_min": 0.8,
        "delay_max": 1.8,
        "batch_cooldown": 3.0,
        "circuit_breaker_cooldown": 300,
    }
}

class ImpaSchedulerDaemon:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.running = True
        self.session = requests.Session()
        self.active_category_code: Optional[str] = None
        
        # Initialize SQLite database and tables in WAL mode
        init_db(self.db_path)

        # Register OS signals for graceful termination
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        logger.info("⚓ IMPA Stateful Worker Daemon initialized. Signal handlers registered.")

    def _handle_shutdown(self, signum, frame):
        """Intercepts SIGINT/SIGTERM to cleanly stop processing."""
        sig_name = signal.Signals(signum).name
        logger.warning(f"🛑 Received {sig_name}. Preparing graceful shutdown...")
        self.running = False

    def _get_headers(self) -> Dict[str, str]:
        """Generates authentic browser headers with rotating User-Agents."""
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://impa-catalogue.shipserv.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
        }

    def _sleep_jitter(self, profile: Dict[str, Any]):
        """Injects human-simulated randomized delay between requests."""
        jitter = random.uniform(profile["delay_min"], profile["delay_max"])
        logger.debug(f"Human jitter: sleeping {jitter:.2f}s")
        time.sleep(jitter)

    def ensure_queue_populated(self) -> List[Dict[str, Any]]:
        """Ensures all official IMPA categories (11 through 89) are loaded into category_queue."""
        queue = get_category_queue(self.db_path)
        if not queue:
            logger.info("Populating initial category queue from IMPA MSG catalog directory...")
            try:
                resp = self.session.get(BASE_URL, headers=self._get_headers(), timeout=15)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    next_data = soup.find("script", id="__NEXT_DATA__")
                    items = []
                    if next_data and next_data.string:
                        data = json.loads(next_data.string)
                        categories = (
                            data.get("props", {})
                            .get("pageProps", {})
                            .get("initialCategories", [])
                        )
                        for c in categories:
                            cat_num = str(c.get("categoryNumber", "")).strip().zfill(2)
                            cat_name = c.get("name", "").strip()
                            slug = c.get("urlSlug") or f"{cat_num}-{cat_name.lower().replace(' ', '-')}"
                            items.append({
                                "code": cat_num,
                                "name": cat_name,
                                "slug": slug,
                                "status": "pending",
                            })
                    if items:
                        upsert_category_queue_items(items, self.db_path)
                        queue = get_category_queue(self.db_path)
            except Exception as e:
                logger.error(f"Failed to fetch category listing from ShipServ: {e}")

        # Fallback to predefined official catalog list if network discovery returned empty
        if not queue:
            fallback_items = []
            for code, name in sorted(IMPA_CATEGORIES.items()):
                slug_name = name.lower().replace(" & ", "-").replace(" ", "-").replace(",", "")
                fallback_items.append({
                    "code": code,
                    "name": name,
                    "slug": f"{code}-{slug_name}",
                    "status": "pending",
                })
            upsert_category_queue_items(fallback_items, self.db_path)
            queue = get_category_queue(self.db_path)

        return queue

    def process_subcategory_page(
        self,
        subcat_url: str,
        cat_code: str,
        cat_name: str,
        existing_codes: Set[str],
        profile: Dict[str, Any]
    ) -> int:
        """
        Fetches a subcategory page and extracts IMPAProduct items from __NEXT_DATA__ JSON.
        Returns the count of newly scraped items.
        """
        self._sleep_jitter(profile)

        try:
            resp = self.session.get(subcat_url, headers=self._get_headers(), timeout=12)
        except Exception as e:
            logger.error(f"Network error requesting {subcat_url}: {e}")
            return 0

        # Circuit Breaker check
        if resp.status_code in (429, 403):
            logger.warning(f"🚨 Circuit Breaker triggered (HTTP {resp.status_code}) on {subcat_url}!")
            update_campaign({"status": "paused_cooldown"}, db_path=self.db_path)
            return -1  # Indicates circuit breaker triggered

        if resp.status_code == 404:
            logger.info(f"Subcategory returned 404: {subcat_url}")
            return 0

        if resp.status_code != 200:
            logger.warning(f"Non-200 status {resp.status_code} for {subcat_url}")
            return 0

        soup = BeautifulSoup(resp.text, "html.parser")
        next_data_tag = soup.find("script", id="__NEXT_DATA__")
        if not next_data_tag or not next_data_tag.string:
            return 0

        try:
            page_data = json.loads(next_data_tag.string)
            apollo_state = page_data.get("props", {}).get("pageProps", {}).get("apolloState", {})
        except Exception as e:
            logger.error(f"Error parsing __NEXT_DATA__ JSON: {e}")
            return 0

        scraped_count = 0
        for entry in apollo_state.values():
            if not isinstance(entry, dict):
                continue

            if entry.get("__typename") == "IMPAProduct" and entry.get("partNumber"):
                part_num = str(entry.get("partNumber")).strip().zfill(6)
                if part_num in existing_codes:
                    continue  # Already extracted or logged

                name = entry.get("name", "").strip()
                desc = entry.get("description", "").strip() or f"IMPA {part_num} {name}"
                uom = (entry.get("unitOfMeasure") or "PCS").strip().upper()
                pic_file = entry.get("pictureFileName")
                image_url = f"{IMAGE_CDN_BASE}{pic_file}" if pic_file else None
                slug = entry.get("urlSlug")
                source_url = f"{BASE_URL}/{slug}" if slug else subcat_url

                record = {
                    "impa_code": part_num,
                    "category_code": cat_code,
                    "category_name": cat_name,
                    "product_name": name,
                    "description": desc,
                    "uom": uom,
                    "image_url": image_url,
                    "source_url": source_url,
                    "status": "active"
                }

                upsert_product(record, self.db_path)
                existing_codes.add(part_num)
                scraped_count += 1
                logger.info(f"✅ IMPA [{part_num}]: {name[:35]} [{uom}]")

        return scraped_count

    def run_cycle(self) -> None:
        """Single stateful cycle executed by the daemon loop."""
        campaign = get_or_create_campaign(db_path=self.db_path)
        status = campaign.get("status", "idle")
        profile_key = campaign.get("delay_profile", "stealth")
        profile = STEALTH_PROFILES.get(profile_key, STEALTH_PROFILES["stealth"])
        daily_cap = campaign.get("daily_cap", 300)
        today_count = campaign.get("today_count", 0)

        # 1. Handle Cooldown status (Circuit Breaker active)
        if status == "paused_cooldown":
            cooldown_secs = profile["circuit_breaker_cooldown"]
            logger.warning(f"⏳ System is in cooldown (HTTP 429/403 protection). Waiting {cooldown_secs}s...")
            for _ in range(int(cooldown_secs / 10)):
                if not self.running:
                    return
                time.sleep(10)
            update_campaign({"status": "running"}, db_path=self.db_path)
            logger.info("🟢 Circuit breaker cooldown expired. Resuming campaign.")
            return

        # 2. Check if user explicitly paused campaign
        if status == "paused":
            time.sleep(5)
            return

        # 3. Check if Daily Cap was reached
        if today_count >= daily_cap:
            logger.info(f"🛑 Daily budget cap reached ({today_count}/{daily_cap} items). Sleeping for 60s...")
            time.sleep(60)
            return

        # 4. Pick next target category from queue
        queue = self.ensure_queue_populated()
        target_cat = None
        for c in queue:
            if c["status"] in ("pending", "in_progress"):
                target_cat = c
                break

        if not target_cat:
            logger.info("🎉 All 34 categories in queue completed! Campaign idle.")
            update_campaign({"status": "completed"}, db_path=self.db_path)
            time.sleep(30)
            return

        cat_code = target_cat["category_code"]
        cat_name = target_cat["category_name"]
        cat_slug = target_cat["slug"]
        self.active_category_code = cat_code

        logger.info(f"🚀 Processing Category [{cat_code}] {cat_name} (Status: {target_cat['status']})")
        update_campaign({"status": "running", "current_category": cat_code}, db_path=self.db_path)

        # Load existing codes to skip duplicates
        existing_codes = get_existing_codes_for_category(cat_code, self.db_path)

        # Discover subcategories
        cat_url = f"{BASE_URL}/{cat_slug}"
        subcat_links: List[str] = []
        try:
            resp = self.session.get(cat_url, headers=self._get_headers(), timeout=12)
            if resp.status_code in (429, 403):
                logger.warning(f"Circuit breaker on category page {cat_url}")
                update_campaign({"status": "paused_cooldown"}, db_path=self.db_path)
                return
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                prefix = f"/{cat_slug}/"
                subcat_links = list(set([
                    a["href"] for a in soup.find_all("a", href=True)
                    if a["href"].startswith(prefix)
                ]))
        except Exception as e:
            logger.error(f"Error fetching category index {cat_url}: {e}")

        total_subs = len(subcat_links)
        done_subs = target_cat.get("subcategories_done", 0)
        items_scraped_stage = 0

        for sub_index, subcat_path in enumerate(subcat_links):
            if not self.running:
                break

            if sub_index < done_subs:
                continue

            # Check if campaign was paused or daily cap reached while running
            fresh_campaign = get_or_create_campaign(db_path=self.db_path)
            if fresh_campaign.get("status") == "paused":
                logger.info("Campaign paused by user. Breaking stage.")
                break
            if fresh_campaign.get("today_count", 0) >= daily_cap:
                logger.info("Daily cap reached mid-category. Pausing stage.")
                break

            sub_url = f"{BASE_URL}{subcat_path}"
            logger.info(f"Inspecting subcategory ({sub_index + 1}/{total_subs}): {subcat_path.split('/')[-1]}")

            new_items = self.process_subcategory_page(
                sub_url, cat_code, cat_name, existing_codes, profile
            )

            # Check if circuit breaker triggered
            if new_items == -1:
                break

            items_scraped_stage += new_items
            done_subs += 1

            # Update progress checkpoint
            new_status = "completed" if done_subs >= total_subs else "in_progress"
            update_queue_category_progress(
                cat_code, done_subs, total_subs, new_items, new_status, self.db_path
            )

            # Update campaign today_count
            update_campaign({
                "today_count": fresh_campaign.get("today_count", 0) + new_items
            }, db_path=self.db_path)

            # Subcategory cooldown
            if self.running and sub_index + 1 < total_subs:
                cooldown = random.uniform(
                    profile["batch_cooldown"] * 0.8,
                    profile["batch_cooldown"] * 1.2
                )
                logger.debug(f"Subcategory cooldown: sleeping {cooldown:.1f}s...")
                time.sleep(cooldown)

        logger.info(
            f"Stage completed for Category [{cat_code}]: +{items_scraped_stage} items. "
            f"Progress: {done_subs}/{total_subs} subcategories."
        )

    def start(self) -> None:
        """Main daemon loop."""
        logger.info("🏁 Starting IMPA Stateful Scraper Worker Daemon Loop...")
        while self.running:
            try:
                self.run_cycle()
            except Exception as e:
                logger.error(f"Unexpected error in daemon cycle: {e}", exc_info=True)
                time.sleep(10)
        logger.info("🛑 IMPA Scraper Worker Daemon cleanly stopped. Good day!")

if __name__ == "__main__":
    daemon = ImpaSchedulerDaemon()
    daemon.start()
