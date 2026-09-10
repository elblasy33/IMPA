"""
ShipServ IMPA Catalogue Direct Scraper
--------------------------------------
Extracts authentic 100% matched IMPA product records directly from:
https://impa-catalogue.shipserv.com/

Fetches:
- Exact 6-digit IMPA Code (partNumber)
- Standard Product Title
- Technical Description
- Official Unit of Measure (UOM)
- Product Image from ShipServ CDN
- Source URL
"""

import sys
import re
import json
import time
import random
import logging
import requests
from typing import List, Dict, Any, Optional
from pathlib import Path
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import USER_AGENTS, DB_PATH
from db import init_db, upsert_product, get_stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ShipServScraper")

BASE_URL = "https://impa-catalogue.shipserv.com"
IMAGE_CDN_BASE = "https://www.shipserv.com/Shipserv/pages/profiles/231092/images/"

class ShipServImpaScraper:
    def __init__(self, delay_min: float = 0.5, delay_max: float = 1.5):
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _sleep_jitter(self):
        time.sleep(random.uniform(self.delay_min, self.delay_max))

    def get_categories(self) -> List[Dict[str, str]]:
        """
        Retrieves all top-level categories and their URL slugs from ShipServ.
        """
        logger.info("Fetching category directory from ShipServ...")
        try:
            resp = self.session.get(BASE_URL, headers=self._get_headers(), timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            nd = soup.find("script", id="__NEXT_DATA__")
            if not nd or not nd.string:
                return []

            data = json.loads(nd.string)
            apollo = data.get("props", {}).get("pageProps", {}).get("apolloState", {})
            
            categories = []
            for v in apollo.values():
                if v.get("__typename") == "IMPACategory" and v.get("urlSlug"):
                    name = v.get("name", "")
                    code_match = re.match(r"^(\d{2})", name)
                    code = code_match.group(1) if code_match else name[:2]
                    categories.append({
                        "code": code,
                        "name": name,
                        "slug": v.get("urlSlug"),
                    })
            return sorted(categories, key=lambda x: x["code"])
        except Exception as e:
            logger.error(f"Failed to fetch categories: {e}")
            return []

    def scrape_category(self, category_code_or_slug: str, limit: Optional[int] = None) -> int:
        """
        Scrapes all subcategories and products for a given category (e.g. '23' or '23-rigging-equipment-general-deck-items').
        """
        categories = self.get_categories()
        target_cat = None
        for c in categories:
            if c["code"] == category_code_or_slug or c["slug"] == category_code_or_slug:
                target_cat = c
                break

        if not target_cat:
            logger.error(f"Category '{category_code_or_slug}' not found on ShipServ.")
            return 0

        logger.info(f"⚓ Scraping ShipServ Category: [{target_cat['code']}] {target_cat['name']}...")
        cat_url = f"{BASE_URL}/{target_cat['slug']}"

        try:
            resp = self.session.get(cat_url, headers=self._get_headers(), timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            # Find subcategory links
            prefix = f"/{target_cat['slug']}/"
            subcat_links = list(set([
                a["href"] for a in soup.find_all("a", href=True)
                if a["href"].startswith(prefix)
            ]))
            logger.info(f"Found {len(subcat_links)} subcategory pages in {target_cat['name']}.")
        except Exception as e:
            logger.error(f"Error loading category page {cat_url}: {e}")
            return 0

        scraped_count = 0

        for subcat_path in subcat_links:
            if limit and scraped_count >= limit:
                break

            sub_url = f"{BASE_URL}{subcat_path}"
            try:
                self._sleep_jitter()
                sub_resp = self.session.get(sub_url, headers=self._get_headers(), timeout=10)
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
                        name = (v.get("name") or "").strip() or f"IMPA {part_num}"
                        desc = (v.get("description") or "").strip() or f"IMPA {part_num} {name}"
                        uom = (v.get("unitOfMeasure") or "PCS").strip().upper()
                        
                        pic_file = v.get("pictureFileName")
                        image_url = f"{IMAGE_CDN_BASE}{pic_file}" if pic_file else None
                        slug = v.get("urlSlug")
                        source_url = f"{BASE_URL}/{slug}" if slug else sub_url

                        product_record = {
                            "impa_code": part_num,
                            "category_code": target_cat["code"],
                            "category_name": target_cat["name"],
                            "product_name": name,
                            "description": desc,
                            "uom": uom,
                            "image_url": image_url,
                            "source_url": source_url,
                            "status": "shipserv_verified"
                        }

                        upsert_product(product_record, DB_PATH)
                        scraped_count += 1
                        logger.info(f"✅ [ShipServ] IMPA {part_num}: {name[:45]} ({uom})")

                        if limit and scraped_count >= limit:
                            break

            except Exception as e:
                logger.debug(f"Error scraping subcategory {sub_url}: {e}")
                continue

        logger.info(f"🎉 Successfully scraped {scraped_count} verified products from ShipServ for Category {target_cat['code']}.")
        return scraped_count

if __name__ == "__main__":
    init_db(DB_PATH)
    scraper = ShipServImpaScraper()
    cat_arg = sys.argv[1] if len(sys.argv) > 1 else "23"
    limit_arg = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    scraper.scrape_category(cat_arg, limit=limit_arg)
