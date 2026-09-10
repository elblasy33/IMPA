"""
IMPA Scraper Configuration Module
---------------------------------
Contains the official IMPA 2-digit category catalog, User-Agent pool for anti-detection,
header generation, default timeouts, and filesystem paths.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "impa_catalog.db"
IMAGES_DIR = DATA_DIR / "images"
EXPORTS_DIR = DATA_DIR / "exports"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Official IMPA 2-Digit Category Mapping (11 to 89)
# The first 2 digits of any 6-digit IMPA code designate its general category.
IMPA_CATEGORIES = {
    "11": "Provisions & Catering Supplies",
    "15": "Cabin Stores (Bedding, Curtains, Galley)",
    "17": "Tableware & Galley Utensils",
    "19": "Clothing, Uniforms & Footwear",
    "21": "Rope, Cordage & Hawser",
    "23": "Rigging Equipment & General Deck Items",
    "25": "Marine Paint & Painting Equipment",
    "27": "Nautical Publications & Navigation Instruments",
    "31": "Safety Protective Gear & Lifeboat Equipment",
    "33": "Fire Fighting & Safety Equipment",
    "35": "Hoses & Couplings",
    "37": "Marine Nautical Valves & Cocks",
    "39": "Bearings & Bushings",
    "45": "Petroleum Products, Lubricants & Greases",
    "47": "Stationery, Computer & Office Supplies",
    "49": "Medical Equipment & First Aid Supplies",
    "51": "Hardware, Fasteners & Mechanical Seals",
    "53": "Brushes & Mats",
    "55": "Lavatory & Bathroom Equipment",
    "59": "Hand Tools & Measuring Instruments",
    "61": "Cutting Tools & Machine Shop Items",
    "63": "Power Tools & Pneumatic Equipment",
    "65": "Welding & Soldering Equipment",
    "67": "Steel Products & Non-Ferrous Metals",
    "69": "Fasteners, Bolts, Nuts, Studs & Washers",
    "71": "Pipe & Tube Fittings",
    "73": "Valves & Cocks - Engine Room",
    "75": "Packing & Jointing Materials",
    "77": "Electrical Equipment, Cables & Lighting",
    "79": "Electrical Lamps, Bulbs & Torches",
    "81": "Marine Electronics, Radar & Communication",
    "83": "Instruments, Gauges & Control Systems",
    "85": "Internal Combustion Engine Parts",
    "87": "Pumps & Air Compressors",
    "89": "Deck Machinery & Winch Spares",
}

# Standard Units of Measure (UOM) used in Marine Supply & ERP
VALID_UOMS = [
    "PCS", "SET", "MTR", "ROLL", "BOX", "PKT", "KG", "LTR", "PAIR", "DRUM", "CAN", "BAG"
]

# Curated pool of realistic desktop User-Agents across Windows, macOS, and Linux
USER_AGENTS = [
    # Chrome on Windows 11
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # Chrome on macOS Sonoma
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    # Firefox on Windows 11
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    # Safari on macOS Sonoma
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    # Edge on Windows 11
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    # Chrome on Linux Ubuntu
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    # Firefox on Linux
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0"
]

# Default Scraping Parameters
DEFAULT_DELAY_MIN = 0.8        # Minimum seconds between requests (jitter)
DEFAULT_DELAY_MAX = 2.2        # Maximum seconds between requests
REQUEST_TIMEOUT = 7.0          # Seconds to wait for server response before fast-failing
MAX_RETRIES = 2                # Retries for non-404 transient network errors
FAST_FAIL_404_THRESHOLD = 30   # Consecutive 404s before skipping ahead in code block

# Public Target URLs / Search Endpoints Template
# You can override this via CLI or environment variable TARGET_BASE_URL
DEFAULT_TARGET_TEMPLATE = "https://www.marine-stores.com/impa/{impa_code}"
SEARCH_TARGET_TEMPLATE = "https://www.marine-stores.com/search?q={impa_code}"
