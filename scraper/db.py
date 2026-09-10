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
                status TEXT DEFAULT 'active'
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
        """)
        conn.commit()

def upsert_product(product: Dict[str, Any], db_path: Path = DB_PATH) -> bool:
    """
    Inserts or updates a product record incrementally.
    Guarantees zero data loss if the scraper terminates prematurely.
    """
    category_code = product.get("category_code") or str(product["impa_code"])[:2]
    category_name = product.get("category_name") or IMPA_CATEGORIES.get(category_code, "Marine Equipment")
    
    scraped_at = product.get("scraped_at") or datetime.utcnow().isoformat()
    uom = (product.get("uom") or "PCS").upper()

    with get_connection(db_path) as conn:
        conn.execute("""
            INSERT INTO products (
                impa_code, category_code, category_name, product_name,
                description, uom, image_url, local_image_path,
                source_url, scraped_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                status = excluded.status
        """, (
            str(product["impa_code"]).zfill(6),
            category_code,
            category_name,
            product["product_name"].strip(),
            product.get("description", "").strip(),
            uom,
            product.get("image_url"),
            product.get("local_image_path"),
            product.get("source_url"),
            scraped_at,
            product.get("status", "active")
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
            conn.execute("""
                INSERT INTO products (
                    impa_code, category_code, category_name, product_name,
                    description, uom, image_url, local_image_path,
                    source_url, scraped_at, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    status = excluded.status
            """, (
                str(p["impa_code"]).zfill(6),
                cat_code,
                cat_name,
                p["product_name"].strip(),
                p.get("description", "").strip(),
                (p.get("uom") or "PCS").upper(),
                p.get("image_url"),
                p.get("local_image_path"),
                p.get("source_url"),
                p.get("scraped_at") or datetime.utcnow().isoformat(),
                p.get("status", "active")
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
