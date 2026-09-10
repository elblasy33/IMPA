#!/usr/bin/env python3
"""
=============================================================================
IMPA Marine Stores Guide - Fast Missing Images Recovery & Enrichment Utility
=============================================================================
Purpose:
Scans SQLite products table for existing marine items where image_url is NULL or empty.
Queries ShipServ subcategories to locate the authentic product/family image and updates
the database in-place without resetting product data or consuming the daily scraping budget.
=============================================================================
"""

import sys
import os
import time
import random
import json
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional
import requests
from bs4 import BeautifulSoup

# Ensure scraper dir in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import DB_PATH, USER_AGENTS, IMPA_CATEGORIES
from db import get_connection, init_db, update_product_image
from shipserv_scraper import BASE_URL, IMAGE_CDN_BASE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("ImageEnricher")

def get_products_missing_images(db_path: Path = DB_PATH) -> Dict[str, List[str]]:
    """
    Returns dict of {category_code: [list of impa_codes missing images]}
    """
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("""
            SELECT category_code, impa_code 
            FROM products 
            WHERE (image_url IS NULL OR image_url = '') 
              AND status != 'not_found'
            ORDER BY category_code ASC, impa_code ASC
        """).fetchall()
        
        result: Dict[str, List[str]] = {}
        for cat, code in rows:
            clean_code = str(code).zfill(6)
            result.setdefault(cat, []).append(clean_code)
        return result

def get_category_slug_map(db_path: Path = DB_PATH) -> Dict[str, str]:
    """
    Returns mapping of category_code -> slug (e.g., '11' -> '11-welfare-items')
    """
    with get_connection(db_path) as conn:
        try:
            rows = conn.execute("SELECT category_code, slug FROM category_queue").fetchall()
            return {r[0]: r[1] for r in rows if r[1]}
        except Exception:
            return {}

def enrich_images(db_path: Path = DB_PATH, delay: float = 1.0) -> None:
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    missing_map = get_products_missing_images(db_path)
    total_missing = sum(len(codes) for codes in missing_map.values())
    logger.info(f"🔍 Found {total_missing} products with missing images across {len(missing_map)} categories.")

    if total_missing == 0:
        logger.info("🎉 All products already have images! Nothing to enrich.")
        return

    slug_map = get_category_slug_map(db_path)
    # Default fallback slug map for official IMPA categories
    if not slug_map:
        for cat in IMPA_CATEGORIES:
            slug = cat.lower().replace(" ", "-").replace("&", "").replace(",", "")
            slug = "-".join([s for s in slug.split("-") if s])
            code = cat.split(".")[0].strip()
            slug_map[code] = slug

    total_enriched = 0

    for cat_code, codes in missing_map.items():
        cat_slug = slug_map.get(cat_code)
        if not cat_slug:
            # Look up in IMPA_CATEGORIES
            for c in IMPA_CATEGORIES:
                if c.startswith(f"{cat_code}."):
                    clean = c.lower().replace("&", "").replace(",", "")
                    parts = [p.strip() for p in clean.split(" ") if p.strip()]
                    cat_slug = "-".join(parts)
                    break
        
        if not cat_slug:
            logger.warning(f"⚠️ No slug found for category [{cat_code}]. Skipping.")
            continue

        cat_url = f"{BASE_URL}/{cat_slug}"
        logger.info(f"📂 Category [{cat_code}] ({len(codes)} items missing images). Fetching: {cat_url}")

        try:
            r = session.get(cat_url, timeout=12)
            if r.status_code != 200:
                logger.warning(f"HTTP {r.status_code} on {cat_url}. Skipping category.")
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            subcat_links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith(f"/{cat_slug}/") and href.count("/") >= 3:
                    if href not in subcat_links:
                        subcat_links.append(href)
        except Exception as e:
            logger.error(f"Error reading subcategories for {cat_code}: {e}")
            continue

        unresolved_codes = set(codes)

        for subcat_path in subcat_links:
            if not unresolved_codes:
                break

            sub_url = f"{BASE_URL}{subcat_path}"
            time.sleep(delay)

            try:
                sub_r = session.get(sub_url, timeout=12)
                if sub_r.status_code != 200:
                    continue
                sub_soup = BeautifulSoup(sub_r.text, "html.parser")
                next_data = sub_soup.find("script", id="__NEXT_DATA__")
                if not next_data or not next_data.string:
                    continue

                page_json = json.loads(next_data.string)
                apollo = page_json.get("props", {}).get("pageProps", {}).get("apolloState", {})

                for v in apollo.values():
                    if isinstance(v, dict) and v.get("__typename") == "IMPAProduct":
                        part_num = str(v.get("partNumber", "")).strip().zfill(6)
                        if part_num in unresolved_codes:
                            pic_file = v.get("pictureFileName")
                            if pic_file:
                                img_url = f"{IMAGE_CDN_BASE}{pic_file}"
                                update_product_image(part_num, img_url, db_path)
                                total_enriched += 1
                                unresolved_codes.remove(part_num)
                                logger.info(f"   🖼️ IMPA [{part_num}]: Enriched image -> {pic_file}")
                            else:
                                # No image available on ShipServ for this product family
                                unresolved_codes.remove(part_num)
                                logger.info(f"   ℹ️ IMPA [{part_num}]: No image provided by ShipServ")
            except Exception as sub_err:
                logger.debug(f"Subcategory check error on {sub_url}: {sub_err}")

        logger.info(f"Category [{cat_code}] pass complete. Remaining unresolved: {len(unresolved_codes)}")

    logger.info("=================================================================")
    logger.info(f"✅ Image Enrichment Complete: Successfully updated {total_enriched} products.")
    logger.info("=================================================================")

if __name__ == "__main__":
    enrich_images()
