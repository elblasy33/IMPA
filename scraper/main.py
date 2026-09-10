"""
IMPA Marine Scraper CLI Entrypoint
----------------------------------
Command-line interface to orchestrate scraping, seeding, Odoo ERP export,
and viewing catalog statistics.

Usage Examples:
  python main.py --seed
  python main.py --stats
  python main.py --export data/exports/odoo_products.csv
  python main.py --category 23 --max-items 50
  python main.py --start 232001 --end 232050 --delay-min 1.5 --delay-max 3.0
"""

import sys
import argparse
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    IMPA_CATEGORIES,
    DB_PATH,
    EXPORTS_DIR,
    DEFAULT_DELAY_MIN,
    DEFAULT_DELAY_MAX,
    DEFAULT_TARGET_TEMPLATE
)
from db import init_db, get_stats, get_all_products
from scraper import ImpaScraper
from odoo_exporter import export_to_odoo_csv
from seed_data import seed_database
from master_catalog import load_master_catalog
from import_catalog import import_csv_catalog
from auto_search import search_impa_online
from shipserv_scraper import ShipServImpaScraper

def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║             ⚓ IMPA MARINE PRODUCT SCRAPER & ERP EXPORT              ║
║         International Marine Purchasing Association Data Engine       ║
╚══════════════════════════════════════════════════════════════════════╝
""")

def handle_stats():
    stats = get_stats(DB_PATH)
    print(f"\n📦 IMPA CATALOG DATABASE METRICS")
    print(f"─" * 45)
    print(f"  • Total Products Scraped  : {stats['total_products']:,}")
    print(f"  • Unique Categories       : {stats['categories_count']}")
    print(f"  • Units of Measure (UOMs) : {stats['uom_count']}")
    print(f"  • Products with Images    : {stats['with_images']}")
    print(f"\n📂 Top Categories Breakdown:")
    for cat in stats["category_breakdown"][:8]:
        print(f"  [{cat['category_code']}] {cat['category_name'][:30]:<30} : {cat['count']} items")
    print(f"─" * 45 + "\n")

def main():
    print_banner()
    init_db(DB_PATH)

    parser = argparse.ArgumentParser(
        description="IMPA Marine Product Scraper & Odoo ERP Integration Suite",
        formatter_class=argparse.RawTextHelpFormatter
    )

    # Operational Commands
    parser.add_argument("--seed", action="store_true", help="Seed database with authentic marine products for testing")
    parser.add_argument("--expand", action="store_true", help="Expand database with comprehensive catalog across ALL 34 IMPA categories")
    parser.add_argument("--shipserv", type=str, help="Scrape live products directly from ShipServ IMPA Catalogue for a category (e.g. 23, 31, 33, 61, 75)")
    parser.add_argument("--shipserv-categories", action="store_true", help="List all categories available on ShipServ IMPA Catalogue")
    parser.add_argument("--limit", type=int, default=50, help="Maximum products to fetch when scraping ShipServ (default: 50)")
    parser.add_argument("--search", type=str, help="Search for a specific 6-digit IMPA code online and add to database")
    parser.add_argument("--import-file", type=str, help="Import an external CSV catalog file into SQLite database")
    parser.add_argument("--stats", action="store_true", help="Display current database metrics and category distribution")
    parser.add_argument("--export", nargs="?", const="default", help="Export products to Odoo ERP CSV format")

    # Scraping Targets
    parser.add_argument("--category", type=str, help="2-digit category code to scrape (e.g. 23, 31, 33, 59, 73)")
    parser.add_argument("--start", type=int, help="Starting 6-digit IMPA code (e.g. 232001)")
    parser.add_argument("--end", type=int, help="Ending 6-digit IMPA code (e.g. 232050)")
    parser.add_argument("--max-items", type=int, default=None, help="Maximum number of items to scrape in this run")

    # Anti-Scraping & Resilience Parameters
    parser.add_argument("--delay-min", type=float, default=DEFAULT_DELAY_MIN, help=f"Minimum delay jitter in seconds (default: {DEFAULT_DELAY_MIN})")
    parser.add_argument("--delay-max", type=float, default=DEFAULT_DELAY_MAX, help=f"Maximum delay jitter in seconds (default: {DEFAULT_DELAY_MAX})")
    parser.add_argument("--no-images", action="store_true", help="Disable downloading images locally")
    parser.add_argument("--target-template", type=str, default=DEFAULT_TARGET_TEMPLATE, help="URL template with {impa_code}")
    parser.add_argument("--skip-threshold", type=int, default=25, help="Consecutive 404s before fast-skipping ahead")

    args = parser.parse_args()

    # Seed
    if args.seed:
        seed_database()
        return

    # Expand with full category catalog
    if args.expand:
        load_master_catalog()
        handle_stats()
        return

    # ShipServ categories listing
    if args.shipserv_categories:
        shipserv = ShipServImpaScraper()
        cats = shipserv.get_categories()
        print("\n⚓ ShipServ IMPA Catalogue Available Categories:")
        print("─" * 50)
        for c in cats:
            print(f"  [{c['code']}] {c['name']} (Slug: {c['slug']})")
        print("─" * 50 + "\n")
        return

    # Scrape ShipServ
    if args.shipserv:
        shipserv = ShipServImpaScraper()
        shipserv.scrape_category(args.shipserv, limit=args.limit)
        handle_stats()
        return

    # Search online for an IMPA code
    if args.search:
        search_impa_online(args.search)
        handle_stats()
        return

    # Import external file
    if args.import_file:
        import_csv_catalog(Path(args.import_file))
        handle_stats()
        return

    # Stats
    if args.stats:
        handle_stats()
        return

    # Export
    if args.export:
        export_path = None if args.export == "default" else Path(args.export)
        out_file = export_to_odoo_csv(export_path, DB_PATH)
        print(f"\n✅ Odoo ERP CSV exported successfully to: {out_file}\n")
        return

    # Scraper Run
    if args.category or (args.start and args.end):
        scraper = ImpaScraper(
            delay_min=args.delay_min,
            delay_max=args.delay_max,
            download_images=not args.no_images,
            target_template=args.target_template,
            consecutive_404_skip=args.skip_threshold,
        )

        try:
            if args.category:
                cat_code = args.category.zfill(2)
                cat_name = IMPA_CATEGORIES.get(cat_code, "Unknown Category")
                print(f"🎯 Target Category: [{cat_code}] {cat_name}")
                count = scraper.scrape_category(cat_code, max_items=args.max_items)
                print(f"\n🎉 Finished scraping category {cat_code}. Found {count} items.")
            else:
                count = 0
                for _ in scraper.scrape_range(args.start, args.end):
                    count += 1
                    if args.max_items and count >= args.max_items:
                        break
                print(f"\n🎉 Finished scraping range {args.start} to {args.end}. Found {count} items.")
        except KeyboardInterrupt:
            print("\n⚠️ Scraping paused by user. Progress saved safely to SQLite database.")
        
        handle_stats()
    else:
        # Default: if no action specified, show stats or help
        handle_stats()
        print("💡 Tip: Run `python main.py --help` to see all available scraping and export commands.")

if __name__ == "__main__":
    main()
