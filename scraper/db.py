"""
SQLite Database Layer for IMPA Catalog
---------------------------------------
Handles incremental storage, concurrency settings (WAL mode),
progress checkpoints, and fast lookups.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from config import DB_PATH, IMPA_CATEGORIES

def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """
    Creates an SQLite connection with WAL (Write-Ahead Logging) enabled.
    WAL allows simultaneous readers (e.g., Next.js web dashboard)
    and writers (e.g., the Python scraper) without database locked errors.
    """
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Concurrency and performance pragmas
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db(db_path: Path = DB_PATH) -> None:
    """
    Initializes the database schema if not already created.
    """
    with get_connection(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS products (
                impa_code TEXT PRIMARY KEY,
                category_code TEXT NOT NULL,
                category_name TEXT NOT NULL,
                product_name TEXT NOT NULL,
                description TEXT,
                uom TEXT DEFAULT 'PCS',
                image_url TEXT,
                local_image_path TEXT,
                source_url TEXT,
                scraped_at TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                quality_score INTEGER DEFAULT 80,
                review_status TEXT DEFAULT 'auto_scraped'
            );

            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_code);
            CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
            CREATE INDEX IF NOT EXISTS idx_products_uom ON products(uom);

            CREATE TABLE IF NOT EXISTS scrape_progress (
                category_code TEXT PRIMARY KEY,
                last_code_checked TEXT,
                consecutive_404s INTEGER DEFAULT 0,
                total_scraped INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scrape_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'idle',
                daily_cap INTEGER DEFAULT 300,
                today_count INTEGER DEFAULT 0,
                delay_profile TEXT DEFAULT 'stealth',
                current_category TEXT,
                last_run_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS category_queue (
                category_code TEXT PRIMARY KEY,
                category_name TEXT NOT NULL,
                slug TEXT NOT NULL,
                subcategories_total INTEGER DEFAULT 0,
                subcategories_done INTEGER DEFAULT 0,
                items_found INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                last_scraped_at TEXT
            );
        """)
        # Migrations for existing products table
        try:
            conn.execute("ALTER TABLE products ADD COLUMN quality_score INTEGER DEFAULT 80;")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE products ADD COLUMN review_status TEXT DEFAULT 'auto_scraped';")
        except Exception:
            pass
        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_products_review ON products(review_status);")
        except Exception:
            pass
        conn.commit()

def calculate_quality_score(name: str, desc: str, uom: str, img: Optional[str]) -> int:
    score = 0
    if name and len(name.strip()) > 3:
        score += 30
    if desc and len(desc.strip()) > 25:
        score += 30
    elif desc and len(desc.strip()) > 5:
        score += 15
    if uom and len(uom.strip()) >= 2:
        score += 20
    if img and len(img.strip()) > 10:
        score += 20
    return min(100, max(0, score))

def upsert_product(product: Dict[str, Any], db_path: Path = DB_PATH) -> bool:
    """
    Inserts or updates a product record incrementally with automated quality scoring.
    """
    category_code = product.get("category_code") or str(product["impa_code"])[:2]
    category_name = product.get("category_name") or IMPA_CATEGORIES.get(category_code, "Marine Equipment")
    
    scraped_at = product.get("scraped_at") or datetime.utcnow().isoformat()
    uom = (product.get("uom") or "PCS").upper()
    name = product["product_name"].strip()
    desc = product.get("description", "").strip()
    img = product.get("image_url")
    
    quality_score = calculate_quality_score(name, desc, uom, img)
    review_status = product.get("review_status") or ("verified" if quality_score >= 90 else "auto_scraped")

    with get_connection(db_path) as conn:
        conn.execute("""
            INSERT INTO products (
                impa_code, category_code, category_name, product_name,
                description, uom, image_url, local_image_path,
                source_url, scraped_at, status, quality_score, review_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(impa_code) DO UPDATE SET
                product_name = excluded.product_name,
                category_code = excluded.category_code,
                category_name = excluded.category_name,
                description = excluded.description,
                uom = excluded.uom,
                image_url = COALESCE(excluded.image_url, products.image_url),
                local_image_path = COALESCE(excluded.local_image_path, products.local_image_path),
                source_url = excluded.source_url,
                scraped_at = excluded.scraped_at,
                status = excluded.status,
                quality_score = excluded.quality_score,
                review_status = CASE 
                    WHEN products.review_status = 'verified' THEN 'verified'
                    ELSE excluded.review_status 
                END
        """, (
            str(product["impa_code"]).zfill(6),
            category_code,
            category_name,
            name,
            desc,
            uom,
            img,
            product.get("local_image_path"),
            product.get("source_url"),
            scraped_at,
            product.get("status", "active"),
            quality_score,
            review_status
        ))
        conn.commit()
    return True

def upsert_batch(products: List[Dict[str, Any]], db_path: Path = DB_PATH) -> int:
    """
    Inserts or updates multiple products in a single database transaction.
    """
    count = 0
    with get_connection(db_path) as conn:
        for p in products:
            cat_code = p.get("category_code") or str(p["impa_code"])[:2]
            cat_name = p.get("category_name") or IMPA_CATEGORIES.get(cat_code, "Marine Equipment")
            name = p["product_name"].strip()
            desc = p.get("description", "").strip()
            uom = (p.get("uom") or "PCS").upper()
            img = p.get("image_url")
            q_score = calculate_quality_score(name, desc, uom, img)
            r_status = p.get("review_status") or ("verified" if q_score >= 90 else "auto_scraped")

            conn.execute("""
                INSERT INTO products (
                    impa_code, category_code, category_name, product_name,
                    description, uom, image_url, local_image_path,
                    source_url, scraped_at, status, quality_score, review_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(impa_code) DO UPDATE SET
                    product_name = excluded.product_name,
                    category_code = excluded.category_code,
                    category_name = excluded.category_name,
                    description = excluded.description,
                    uom = excluded.uom,
                    image_url = COALESCE(excluded.image_url, products.image_url),
                    local_image_path = COALESCE(excluded.local_image_path, products.local_image_path),
                    source_url = excluded.source_url,
                    scraped_at = excluded.scraped_at,
                    status = excluded.status,
                    quality_score = excluded.quality_score,
                    review_status = CASE 
                        WHEN products.review_status = 'verified' THEN 'verified'
                        ELSE excluded.review_status 
                    END
            """, (
                str(p["impa_code"]).zfill(6),
                cat_code,
                cat_name,
                name,
                desc,
                uom,
                img,
                p.get("local_image_path"),
                p.get("source_url"),
                p.get("scraped_at") or datetime.utcnow().isoformat(),
                p.get("status", "active"),
                q_score,
                r_status
            ))
            count += 1
        conn.commit()
    return count

def update_progress(
    category_code: str,
    last_code: str,
    consecutive_404s: int,
    found_increment: int = 0,
    db_path: Path = DB_PATH
) -> None:
    """
    Saves category progress so the scraper can resume without repeating already scanned sequences.
    """
    now = datetime.utcnow().isoformat()
    with get_connection(db_path) as conn:
        conn.execute("""
            INSERT INTO scrape_progress (category_code, last_code_checked, consecutive_404s, total_scraped, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(category_code) DO UPDATE SET
                last_code_checked = excluded.last_code_checked,
                consecutive_404s = excluded.consecutive_404s,
                total_scraped = scrape_progress.total_scraped + ?,
                updated_at = excluded.updated_at
        """, (category_code, last_code, consecutive_404s, found_increment, now, found_increment))
        conn.commit()

def get_progress(category_code: str, db_path: Path = DB_PATH) -> Optional[Dict[str, Any]]:
    """
    Retrieves the checkpoint for a given category.
    """
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM scrape_progress WHERE category_code = ?", (category_code,)
        ).fetchone()
        if row:
            return dict(row)
    return None

def get_stats(db_path: Path = DB_PATH) -> Dict[str, Any]:
    """
    Returns aggregated metrics for console and web UI.
    """
    with get_connection(db_path) as conn:
        total_products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        categories_count = conn.execute("SELECT COUNT(DISTINCT category_code) FROM products").fetchone()[0]
        uom_count = conn.execute("SELECT COUNT(DISTINCT uom) FROM products").fetchone()[0]
        with_images = conn.execute("SELECT COUNT(*) FROM products WHERE image_url IS NOT NULL OR local_image_path IS NOT NULL").fetchone()[0]
        
        # Category breakdown
        cat_rows = conn.execute("""
            SELECT category_code, category_name, COUNT(*) as count 
            FROM products 
            GROUP BY category_code, category_name 
            ORDER BY count DESC
        """).fetchall()

        return {
            "total_products": total_products,
            "categories_count": categories_count,
            "uom_count": uom_count,
            "with_images": with_images,
            "category_breakdown": [dict(r) for r in cat_rows]
        }

def get_all_products(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """
    Retrieves all products for export.
    """
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM products ORDER BY impa_code ASC").fetchall()
        return [dict(r) for r in rows]

# =====================================================================
# Campaign, Queue & Quality Audit Layer
# =====================================================================

def get_or_create_campaign(name: str = "ShipServ Scheduled Collection", db_path: Path = DB_PATH) -> Dict[str, Any]:
    """Retrieves active campaign or initializes default configuration."""
    init_db(db_path)
    now = datetime.utcnow().isoformat()
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM scrape_campaigns ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            conn.execute("""
                INSERT INTO scrape_campaigns (name, status, daily_cap, today_count, delay_profile, current_category, last_run_at, created_at)
                VALUES (?, 'idle', 300, 0, 'stealth', '23', ?, ?)
            """, (name, now, now))
            conn.commit()
            row = conn.execute("SELECT * FROM scrape_campaigns ORDER BY id DESC LIMIT 1").fetchone()
        return dict(row)

def update_campaign(data: Dict[str, Any], db_path: Path = DB_PATH) -> Dict[str, Any]:
    """Updates campaign parameters and status."""
    camp = get_or_create_campaign(db_path=db_path)
    status = data.get("status", camp["status"])
    daily_cap = data.get("daily_cap", camp["daily_cap"])
    delay_profile = data.get("delay_profile", camp["delay_profile"])
    current_cat = data.get("current_category", camp["current_category"])
    today_count = data.get("today_count", camp["today_count"])
    now = datetime.utcnow().isoformat()

    with get_connection(db_path) as conn:
        conn.execute("""
            UPDATE scrape_campaigns
            SET status = ?, daily_cap = ?, delay_profile = ?, current_category = ?, today_count = ?, last_run_at = ?
            WHERE id = ?
        """, (status, daily_cap, delay_profile, current_cat, today_count, now, camp["id"]))
        conn.commit()
    return get_or_create_campaign(db_path=db_path)

def get_category_queue(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieves status of all categories in the queue."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM category_queue ORDER BY category_code ASC").fetchall()
        return [dict(r) for r in rows]

def upsert_category_queue_items(items: List[Dict[str, Any]], db_path: Path = DB_PATH) -> None:
    """Populates or updates the category queue list."""
    with get_connection(db_path) as conn:
        for it in items:
            conn.execute("""
                INSERT INTO category_queue (category_code, category_name, slug, subcategories_total, subcategories_done, items_found, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(category_code) DO UPDATE SET
                    category_name = excluded.category_name,
                    slug = excluded.slug,
                    subcategories_total = CASE WHEN category_queue.subcategories_total = 0 THEN excluded.subcategories_total ELSE category_queue.subcategories_total END
            """, (
                it["code"],
                it["name"],
                it["slug"],
                it.get("subcategories_total", 0),
                it.get("subcategories_done", 0),
                it.get("items_found", 0),
                it.get("status", "pending")
            ))
        conn.commit()

def update_queue_category_progress(
    category_code: str,
    subcategories_done: int,
    subcategories_total: int,
    items_increment: int,
    status: str,
    db_path: Path = DB_PATH
) -> None:
    """Updates progress for a category in queue."""
    now = datetime.utcnow().isoformat()
    with get_connection(db_path) as conn:
        conn.execute("""
            UPDATE category_queue
            SET subcategories_done = ?,
                subcategories_total = MAX(subcategories_total, ?),
                items_found = items_found + ?,
                status = ?,
                last_scraped_at = ?
            WHERE category_code = ?
        """, (subcategories_done, subcategories_total, items_increment, status, now, category_code))
        conn.commit()

def get_quality_audit(db_path: Path = DB_PATH) -> Dict[str, Any]:
    """Provides quality audit breakdown for products."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        verified = conn.execute("SELECT COUNT(*) FROM products WHERE review_status = 'verified'").fetchone()[0]
        flagged = conn.execute("SELECT COUNT(*) FROM products WHERE review_status = 'flagged'").fetchone()[0]
        missing_images = conn.execute("SELECT COUNT(*) FROM products WHERE image_url IS NULL OR image_url = ''").fetchone()[0]
        short_desc = conn.execute("SELECT COUNT(*) FROM products WHERE LENGTH(COALESCE(description, '')) < 30").fetchone()[0]
        avg_score_row = conn.execute("SELECT AVG(COALESCE(quality_score, 80)) FROM products").fetchone()[0]
        avg_score = round(avg_score_row or 80)

        return {
            "total_products": total,
            "verified_products": verified,
            "flagged_products": flagged,
            "missing_images": missing_images,
            "short_descriptions": short_desc,
            "average_quality_score": avg_score,
            "high_quality_percentage": round((verified / total * 100)) if total > 0 else 0
        }
