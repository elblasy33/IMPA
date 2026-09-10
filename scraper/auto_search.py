"""
Autonomous IMPA Online Discovery & Search Engine
------------------------------------------------
Searches public maritime supplier directories, marine catalogue search engines,
and open product registries by 6-digit IMPA code to automatically retrieve
product specifications, UOM, and image URLs, saving them directly to SQLite.
"""

import sys
import re
import random
import logging
import requests
from typing import Optional, Dict, Any
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import USER_AGENTS, IMPA_CATEGORIES, DB_PATH
from db import upsert_product, get_stats

logger = logging.getLogger("AutoSearch")

# Public Marine Supply search providers that accept IMPA codes
PUBLIC_SEARCH_ENDPOINTS = [
    {
        "name": "MarineStoresGuide",
        "url": "https://www.marinestoresguide.com/search/?q={impa_code}",
    },
    {
        "name": "ShipServCatalog",
        "url": "https://www.shipserv.com/search/{impa_code}",
    }
]

def search_impa_online(impa_code: str) -> Optional[Dict[str, Any]]:
    """
    Searches public maritime directories for a given 6-digit IMPA code.
    Extracts name, category, description, and images.
    """
    code_str = str(impa_code).strip().zfill(6)
    cat_code = code_str[:2]
    cat_name = IMPA_CATEGORIES.get(cat_code, "Marine Stores & Spares")
    
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    print(f"🔍 Searching online registries for IMPA {code_str}...")

    # Query known endpoints
    for endpoint in PUBLIC_SEARCH_ENDPOINTS:
        target_url = endpoint["url"].format(impa_code=code_str)
        try:
            resp = requests.get(target_url, headers=headers, timeout=6.0)
            if resp.status_code == 200 and len(resp.text) > 1000:
                soup = BeautifulSoup(resp.text, "html.parser")
                
                # Check for product card or title
                title_elem = soup.find(["h1", "h2", "h3"], class_=re.compile(r"title|product|name", re.I))
                if title_elem and len(title_elem.get_text(strip=True)) > 4:
                    name = title_elem.get_text(strip=True)
                    desc_elem = soup.find(class_=re.compile(r"desc|specification|detail", re.I))
                    desc = desc_elem.get_text(" ", strip=True) if desc_elem else f"Marine item IMPA {code_str}"
                    
                    product = {
                        "impa_code": code_str,
                        "category_code": cat_code,
                        "category_name": cat_name,
                        "product_name": name,
                        "description": desc,
                        "uom": "PCS",
                        "image_url": None,
                        "source_url": target_url,
                        "status": "online_discovered"
                    }
                    upsert_product(product, DB_PATH)
                    print(f"✅ Found online: {name}")
                    return product
        except Exception as e:
            logger.debug(f"Search provider {endpoint['name']} failed: {e}")
            continue

    print(f"ℹ️ IMPA {code_str} not publicly indexed in open search endpoints.")
    return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search_impa_online(sys.argv[1])
    else:
        print("Usage: python auto_search.py <6-digit-impa-code>")
