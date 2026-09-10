"""
IMPA Product Data Extractor
---------------------------
Parses HTML responses using multiple complementary strategies:
1. Schema.org JSON-LD structured product data
2. OpenGraph and standard HTML meta tags
3. Standard e-commerce DOM selectors (headings, breadcrumbs, spec tables)
4. Heuristic regex extraction for IMPA codes and Units of Measure (UOM)
"""

import re
import json
from urllib.parse import urljoin
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup
from config import IMPA_CATEGORIES, VALID_UOMS

# Regex to match a 6-digit IMPA code
IMPA_REGEX = re.compile(r"\b([1-8][0-9]\d{4})\b")

# Regex to identify UOM patterns (e.g. "Unit: PCS", "UOM: MTR", "Sold per SET")
UOM_REGEX = re.compile(r"(?:Unit|UOM|Packing|Per|Sold\s+by)[:\s]+([A-Za-z]+)", re.IGNORECASE)

def extract_from_json_ld(soup: BeautifulSoup, base_url: str) -> Optional[Dict[str, Any]]:
    """
    Attempts to extract product specifications from Schema.org JSON-LD.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            if not script.string:
                continue
            data = json.loads(script.string.strip())
            
            # Handle list of items or single item
            item = data[0] if isinstance(data, list) and len(data) > 0 else data
            
            if isinstance(item, dict) and item.get("@type") in ("Product", "IndividualProduct", "ItemPage"):
                name = item.get("name", "").strip()
                description = item.get("description", "").strip()
                
                # Image can be string or list
                image = item.get("image")
                if isinstance(image, list) and image:
                    image_url = image[0]
                elif isinstance(image, dict):
                    image_url = image.get("url")
                else:
                    image_url = image

                if image_url:
                    image_url = urljoin(base_url, image_url)

                # Look for SKU / identifier
                sku = item.get("sku") or item.get("productID") or item.get("identifier") or ""
                impa_match = IMPA_REGEX.search(str(sku) + " " + name)
                impa_code = impa_match.group(1) if impa_match else None

                return {
                    "impa_code": impa_code,
                    "product_name": name,
                    "description": description,
                    "image_url": image_url,
                }
        except Exception:
            continue
    return None

def extract_uom(soup: BeautifulSoup, text_content: str) -> str:
    """
    Detects the unit of measure from specification tables, tags, or raw text.
    Defaults to 'PCS' if unstated.
    """
    # 1. Search in tables / key-value specs
    for row in soup.select("tr, dl, .spec-item, .attribute, .product-attribute"):
        text = row.get_text(" ", strip=True)
        match = UOM_REGEX.search(text)
        if match:
            candidate = match.group(1).upper()
            if candidate in VALID_UOMS:
                return candidate

    # 2. Search anywhere in text content for explicit "UOM: XXX"
    match = UOM_REGEX.search(text_content)
    if match:
        candidate = match.group(1).upper()
        if candidate in VALID_UOMS:
            return candidate

    # 3. Check for standalone keywords
    for word in re.findall(r"\b[A-Z]{2,4}\b", text_content.upper()):
        if word in ("PCS", "MTR", "SET", "ROLL", "BOX", "PAIR", "DRUM", "CAN"):
            return word

    return "PCS"

def parse_product_page(html_content: str, source_url: str, expected_impa: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Parses an HTML response and extracts all product attributes.
    Returns a dictionary or None if the page is invalid or a 404 soft-error.
    """
    if not html_content or len(html_content) < 150:
        return None

    soup = BeautifulSoup(html_content, "html.parser")

    # Fast check for soft 404 / 'Product Not Found' pages
    page_text = soup.get_text(" ", strip=True).lower()
    soft_404_markers = [
        "page not found", "product not found", "item not found",
        "404 not found", "no product found", "we couldn't find the page",
        "item does not exist", "error 404"
    ]
    for marker in soft_404_markers:
        if marker in page_text[:500]:
            return None

    # Step 1: Try structured data (JSON-LD)
    json_data = extract_from_json_ld(soup, source_url)

    # Step 2: Determine IMPA code
    impa_code = expected_impa
    if not impa_code:
        if json_data and json_data.get("impa_code"):
            impa_code = json_data["impa_code"]
        else:
            match = IMPA_REGEX.search(source_url) or IMPA_REGEX.search(page_text[:1000])
            if match:
                impa_code = match.group(1)

    if not impa_code or len(impa_code) != 6:
        # Cannot associate with an IMPA code
        return None

    category_code = impa_code[:2]
    category_name = IMPA_CATEGORIES.get(category_code, "Marine Equipment & Spares")

    # Step 3: Product Name
    product_name = None
    if json_data and json_data.get("product_name"):
        product_name = json_data["product_name"]
    else:
        # HTML Selectors
        name_elem = (
            soup.find("h1", class_=re.compile(r"product.*title|title|name", re.I))
            or soup.find("h1")
            or soup.find("meta", property="og:title")
        )
        if name_elem:
            if name_elem.name == "meta":
                product_name = name_elem.get("content", "")
            else:
                product_name = name_elem.get_text(strip=True)

    if not product_name:
        # Fallback to page title tag
        if soup.title and soup.title.string:
            product_name = soup.title.string.split("|")[0].split("-")[0].strip()

    if not product_name:
        return None

    # Clean up name (remove duplicated IMPA code prefix if any)
    product_name = re.sub(r"^(?:IMPA\s*)?" + impa_code + r"\s*[-–:]*\s*", "", product_name, flags=re.I).strip()
    if not product_name:
        product_name = f"IMPA {impa_code} Marine Item"

    # Step 4: Full Description
    description = ""
    if json_data and json_data.get("description"):
        description = json_data["description"]
    else:
        desc_elem = (
            soup.select_one(".product-description, .description, #tab-description, [itemprop='description'], .product-details")
            or soup.find("meta", property="og:description")
            or soup.find("meta", attrs={"name": "description"})
        )
        if desc_elem:
            if desc_elem.name == "meta":
                description = desc_elem.get("content", "")
            else:
                description = desc_elem.get_text("\n", strip=True)

    # Step 5: Unit of Measure (UOM)
    uom = extract_uom(soup, page_text)

    # Step 6: Image URL
    image_url = None
    if json_data and json_data.get("image_url"):
        image_url = json_data["image_url"]
    else:
        img_elem = (
            soup.select_one(".product-image img, .main-image img, [itemprop='image'], .gallery-top img, img#main-image")
            or soup.find("meta", property="og:image")
        )
        if img_elem:
            if img_elem.name == "meta":
                raw_src = img_elem.get("content")
            else:
                raw_src = img_elem.get("data-src") or img_elem.get("data-lazy") or img_elem.get("src")
            
            if raw_src:
                image_url = urljoin(source_url, raw_src)

    # Breadcrumb category override if available
    breadcrumb = soup.select_one(".breadcrumb, nav.breadcrumbs, .breadcrumbs")
    if breadcrumb:
        crumbs = [c.get_text(strip=True) for c in breadcrumb.find_all(["a", "span", "li"]) if c.get_text(strip=True)]
        if len(crumbs) > 1 and "home" not in crumbs[-2].lower():
            # Keep official category as primary, but append subcategory if helpful
            pass

    return {
        "impa_code": impa_code,
        "category_code": category_code,
        "category_name": category_name,
        "product_name": product_name,
        "description": description or f"Standard marine specification item conforming to IMPA {impa_code}.",
        "uom": uom,
        "image_url": image_url,
        "source_url": source_url,
    }
