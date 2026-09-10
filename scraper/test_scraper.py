#!/usr/bin/env python3
"""
=============================================================================
IMPA Marine Stores Guide - Scraper Dry-Run Test Script
=============================================================================
Purpose:
- Safely tests ShipServ Next.js __NEXT_DATA__ Apollo State extraction.
- Does NOT trigger background daemons, write to DB, or blast the website.
- Targets ONE specific category (Category 11 - Welfare Items / Galley).
- Prints extracted product JSON objects directly to console for field verification.
=============================================================================
"""

import sys
import json
import random
import logging
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# Ensure scraper package is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import USER_AGENTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TestScraper")

BASE_URL = "https://impa-catalogue.shipserv.com"
IMAGE_CDN_BASE = "https://www.shipserv.com/Shipserv/pages/profiles/231092/images/"

def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://impa-catalogue.shipserv.com/",
    }

def dry_run_test_category(category_slug: str = "11-welfare-items"):
    logger.info(f"🔍 Starting Dry-Run extraction test on category: {category_slug}")
    session = requests.Session()

    cat_url = f"{BASE_URL}/{category_slug}"
    logger.info(f"🌐 Fetching category page: {cat_url}")
    
    resp = session.get(cat_url, headers=get_headers(), timeout=15)
    if resp.status_code != 200:
        logger.error(f"Failed to load category page: HTTP {resp.status_code}")
        return False

    soup = BeautifulSoup(resp.text, "html.parser")
    
    # 1. Discover subcategory links
    prefix = f"/{category_slug}/"
    subcat_links = list(set([
        a["href"] for a in soup.find_all("a", href=True)
        if a["href"].startswith(prefix)
    ]))

    if not subcat_links:
        logger.warning(f"No subcategory links found with prefix '{prefix}'. Checking for products on root page...")
        subcat_url = cat_url
    else:
        # Pick the first subcategory for a focused, single-page test
        first_subcat = sorted(subcat_links)[0]
        subcat_url = f"{BASE_URL}{first_subcat}"
        logger.info(f"📂 Selected 1st Subcategory to test: {subcat_url}")

    logger.info(f"🌐 Fetching subcategory: {subcat_url}")
    sub_resp = session.get(subcat_url, headers=get_headers(), timeout=15)
    if sub_resp.status_code != 200:
        logger.error(f"Failed to load subcategory: HTTP {sub_resp.status_code}")
        return False

    # 2. Extract __NEXT_DATA__
    ssoup = BeautifulSoup(sub_resp.text, "html.parser")
    next_data_tag = ssoup.find("script", id="__NEXT_DATA__")
    
    if not next_data_tag or not next_data_tag.string:
        logger.error("❌ __NEXT_DATA__ script tag not found in HTML response!")
        return False

    logger.info("✅ Found __NEXT_DATA__ JSON script tag! Parsing Apollo state...")
    try:
        page_data = json.loads(next_data_tag.string)
        apollo_state = page_data.get("props", {}).get("pageProps", {}).get("apolloState", {})
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        return False

    # 3. Filter for IMPAProduct entities
    extracted_products = []
    for key, val in apollo_state.items():
        if isinstance(val, dict) and val.get("__typename") == "IMPAProduct":
            part_number = val.get("partNumber")
            if not part_number:
                continue

            clean_code = str(part_number).strip().zfill(6)
            name = (val.get("name") or "").strip() or f"IMPA {clean_code}"
            desc = (val.get("description") or "").strip()
            uom = (val.get("unitOfMeasure") or "PCS").strip().upper()
            pic_file = val.get("pictureFileName")
            image_url = f"{IMAGE_CDN_BASE}{pic_file}" if pic_file else None
            slug = val.get("urlSlug")
            source_url = f"{BASE_URL}/{slug}" if slug else subcat_url

            extracted_products.append({
                "impa_code": clean_code,
                "name": name,
                "description": desc,
                "uom": uom,
                "image_url": image_url,
                "source_url": source_url,
                "raw_apollo_key": key
            })

    # 4. Print results to console
    print("\n" + "=" * 75)
    print(f"⚓ IMPA DRY-RUN TEST RESULTS: Found {len(extracted_products)} products")
    print("=" * 75)

    for i, prod in enumerate(extracted_products[:5], 1):
        print(f"\n--- [Product #{i}] ---")
        print(json.dumps(prod, indent=2, ensure_ascii=False))

    if len(extracted_products) > 5:
        print(f"\n... and {len(extracted_products) - 5} more products successfully parsed in this subcategory.")

    print("\n" + "=" * 75)
    print("✅ Field Verification Summary:")
    print(f"- Alphanumeric IMPA Code Extracted: {bool(extracted_products and extracted_products[0]['impa_code'])}")
    print(f"- Product Name Extracted:          {bool(extracted_products and extracted_products[0]['name'])}")
    print(f"- UOM Extracted:                   {bool(extracted_products and extracted_products[0]['uom'])}")
    print(f"- Technical Description Extracted: {bool(extracted_products and extracted_products[0]['description'])}")
    print("=" * 75 + "\n")

    return True

if __name__ == "__main__":
    cat = sys.argv[1] if len(sys.argv) > 1 else "11-welfare-items"
    dry_run_test_category(cat)
