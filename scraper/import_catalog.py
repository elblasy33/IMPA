"""
IMPA Catalog File Importer
--------------------------
Allows users to import external IMPA catalogues (from CSV, TSV, or supplier lists)
directly into the SQLite database with automatic column detection, code sanitization,
and category assignment.
"""

import csv
import sys
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DB_PATH, IMPA_CATEGORIES
from db import init_db, upsert_batch, get_stats

IMPA_CLEAN_REGEX = re.compile(r"\D")

def sanitize_impa_code(raw_code: Any) -> Optional[str]:
    """Cleans code, strips spaces/dots (e.g., '23.20.01' or 'IMPA 232001' -> '232001')."""
    if not raw_code:
        return None
    cleaned = IMPA_CLEAN_REGEX.sub("", str(raw_code))
    if len(cleaned) == 6:
        return cleaned
    if len(cleaned) < 6:
        return cleaned.zfill(6)
    return None

def import_csv_catalog(file_path: Path, db_path: Path = DB_PATH) -> int:
    """
    Parses a CSV file with dynamic column mapping and loads products into SQLite.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"❌ Error: File not found at {file_path}")
        return 0

    init_db(db_path)
    products: List[Dict[str, Any]] = []

    # Detect delimiter
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(2048)
        delimiter = ";" if sample.count(";") > sample.count(",") else ","

    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if not reader.fieldnames:
            print("❌ Error: No headers found in CSV.")
            return 0

        # Build column mapping
        field_map = {}
        for h in reader.fieldnames:
            hl = h.lower().strip()
            if any(k in hl for k in ["impa", "code", "article", "part_no", "item_no", "reference"]):
                field_map["code"] = h
            elif any(k in hl for k in ["name", "title", "designation", "product"]):
                field_map["name"] = h
            elif any(k in hl for k in ["desc", "specification", "detail"]):
                field_map["desc"] = h
            elif any(k in hl for k in ["uom", "unit", "measure", "packing"]):
                field_map["uom"] = h
            elif any(k in hl for k in ["cat", "group", "family"]):
                field_map["category"] = h
            elif any(k in hl for k in ["img", "image", "photo", "picture"]):
                field_map["image"] = h

        if "code" not in field_map:
            print("❌ Could not identify an IMPA Code column. Expected 'impa_code', 'code', or 'part_no'.")
            return 0

        for row in reader:
            raw_code = row.get(field_map["code"])
            code = sanitize_impa_code(raw_code)
            if not code:
                continue

            name = (row.get(field_map.get("name", "")) or f"IMPA {code} Marine Item").strip()
            desc = (row.get(field_map.get("desc", "")) or name).strip()
            uom = (row.get(field_map.get("uom", "")) or "PCS").strip().upper()
            cat_code = code[:2]
            cat_name = row.get(field_map.get("category", "")) or IMPA_CATEGORIES.get(cat_code, "Marine Equipment")
            image_url = (row.get(field_map.get("image", "")) or "").strip()

            products.append({
                "impa_code": code,
                "category_code": cat_code,
                "category_name": cat_name,
                "product_name": name,
                "description": desc,
                "uom": uom,
                "image_url": image_url or None,
                "status": "imported",
            })

    if products:
        upsert_batch(products, db_path)
        stats = get_stats(db_path)
        print(f"🎉 Successfully imported {len(products)} products from {file_path.name}!")
        print(f"📊 Total database products now: {stats['total_products']:,}")
        return len(products)
    else:
        print("⚠️ No valid 6-digit IMPA products found in the file.")
        return 0

if __name__ == "__main__":
    if len(sys.argv) > 1:
        import_csv_catalog(Path(sys.argv[1]))
    else:
        print("Usage: python import_catalog.py <path_to_csv_file>")
