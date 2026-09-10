"""
Odoo ERP Product CSV Exporter
-----------------------------
Exports IMPA products from the SQLite database to a clean, standard CSV file
ready for 1-click import into Odoo ERP (Odoo 14 / 15 / 16 / 17 / 18)
under the 'product.template' model.
"""

import csv
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from config import EXPORTS_DIR, DB_PATH
from db import get_all_products

logger = logging.getLogger("OdooExporter")

# Mapping marine UOMs to standard Odoo default UOM names
ODOO_UOM_MAPPING = {
    "PCS": "Units",
    "SET": "Units",
    "PAIR": "Pairs",
    "MTR": "m",
    "ROLL": "Units",
    "BOX": "Units",
    "PKT": "Units",
    "KG": "kg",
    "LTR": "L",
    "DRUM": "Units",
    "CAN": "Units",
    "BAG": "Units",
}

def clean_text_for_csv(text: Optional[str]) -> str:
    """Removes stray tabs, invalid control characters, and cleans whitespace."""
    if not text:
        return ""
    # Replace carriage returns and excessive whitespace
    return " ".join(text.replace("\r\n", " ").replace("\n", " ").split())

def export_to_odoo_csv(
    output_filepath: Optional[Path] = None,
    db_path: Path = DB_PATH,
    include_image_url: bool = True
) -> Path:
    """
    Exports all scraped IMPA products to an Odoo-compliant CSV file.
    
    Fields exported:
    - id: External unique XML ID for idempotent Odoo re-imports
    - default_code: IMPA 6-digit Code (Internal Reference)
    - name: Product Name
    - description_sale: Full description displayed on quotes/sales orders
    - description_purchase: Full description displayed on RFQs/Purchase Orders
    - categ_id: Hierarchy category, e.g. "Marine Stores / 23 Rigging Equipment"
    - uom_id: Unit of Measure mapped to Odoo standards
    - uom_po_id: Purchase Unit of Measure
    - type: Product Type ("consu" or "product" for storable inventory)
    - sale_ok: Enabled for sales (True)
    - purchase_ok: Enabled for maritime procurement purchases (True)
    - tracking: Serial/Lot tracking mode ("none")
    - image_1920: Product Image URL (if enabled)
    """
    if output_filepath is None:
        output_filepath = EXPORTS_DIR / "odoo_impa_products.csv"
    else:
        output_filepath = Path(output_filepath)
        output_filepath.parent.mkdir(parents=True, exist_ok=True)

    products = get_all_products(db_path)
    if not products:
        logger.warning("No products found in SQLite database to export.")

    # Standard Odoo product.template headers
    headers = [
        "id",
        "default_code",
        "name",
        "description_sale",
        "description_purchase",
        "categ_id",
        "uom_id",
        "uom_po_id",
        "type",
        "sale_ok",
        "purchase_ok",
        "tracking",
    ]
    if include_image_url:
        headers.append("image_1920")

    # Write UTF-8 with BOM (utf-8-sig) so Microsoft Excel opens it without character corruption
    with open(output_filepath, "w", newline="", encoding="utf-8-sig") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()

        for p in products:
            impa_code = str(p["impa_code"]).zfill(6)
            cat_name = p.get("category_name") or "General Marine Equipment"
            cat_code = p.get("category_code") or impa_code[:2]
            uom_raw = (p.get("uom") or "PCS").upper()
            odoo_uom = ODOO_UOM_MAPPING.get(uom_raw, "Units")

            desc = clean_text_for_csv(p.get("description"))

            row = {
                "id": f"impa_product_{impa_code}",
                "default_code": impa_code,
                "name": p["product_name"].strip(),
                "description_sale": desc,
                "description_purchase": f"IMPA Code: {impa_code} - {desc}",
                "categ_id": f"All / Marine Stores / {cat_code} - {cat_name}",
                "uom_id": odoo_uom,
                "uom_po_id": odoo_uom,
                "type": "consu",  # Storable consumable in Odoo standard
                "sale_ok": "True",
                "purchase_ok": "True",
                "tracking": "none",
            }

            if include_image_url:
                row["image_1920"] = p.get("image_url") or ""

            writer.writerow(row)

    logger.info(f"✨ Successfully exported {len(products)} products to Odoo CSV: {output_filepath}")
    return output_filepath

if __name__ == "__main__":
    export_to_odoo_csv()
