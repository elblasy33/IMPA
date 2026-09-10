"""
IMPA Web Scraper Core Engine
----------------------------
Implements stealth web scraping for 6-digit marine IMPA codes with:
- Random User-Agent rotation
- Randomized jitter intervals
- Fast-fail on 404s (zero wait, sequence skipping)
- Incremental SQLite updates
- Automatic image downloading
"""

import time
import random
import logging
import requests
from typing import Optional, Dict, Any, Generator
from pathlib import Path
from urllib.parse import urlparse

from config import (
    USER_AGENTS,
    DEFAULT_DELAY_MIN,
    DEFAULT_DELAY_MAX,
    REQUEST_TIMEOUT,
    FAST_FAIL_404_THRESHOLD,
    IMAGES_DIR,
    DEFAULT_TARGET_TEMPLATE,
)
from db import upsert_product, update_progress, get_progress
from extractor import parse_product_page

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("ImpaScraper")

class ImpaScraper:
    def __init__(
        self,
        delay_min: float = DEFAULT_DELAY_MIN,
        delay_max: float = DEFAULT_DELAY_MAX,
        download_images: bool = True,
        target_template: str = DEFAULT_TARGET_TEMPLATE,
        consecutive_404_skip: int = FAST_FAIL_404_THRESHOLD,
    ):
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.download_images = download_images
        self.target_template = target_template
        self.consecutive_404_skip = consecutive_404_skip
        
        # Requests session
        self.session = requests.Session()
        self.consecutive_404_count = 0
        self.total_scraped_session = 0

    def _get_headers(self) -> Dict[str, str]:
        """
        Generates genuine browser headers with a randomly rotated User-Agent.
        """
        ua = random.choice(USER_AGENTS)
        return {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
        }

    def _sleep_jitter(self) -> None:
        """
        Random sleep between requests to avoid robotic timing patterns.
        """
        delay = random.uniform(self.delay_min, self.delay_max)
        time.sleep(delay)

    def download_product_image(self, impa_code: str, image_url: str) -> Optional[str]:
        """
        Downloads the product image to local storage.
        Returns the relative filepath or None if download failed.
        """
        if not image_url or not self.download_images:
            return None

        try:
            parsed = urlparse(image_url)
            ext = Path(parsed.path).suffix.lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
                ext = ".jpg"

            filename = f"{impa_code}{ext}"
            file_path = IMAGES_DIR / filename

            # Skip if already exists
            if file_path.exists() and file_path.stat().st_size > 0:
                return f"images/{filename}"

            resp = self.session.get(
                image_url,
                headers={"User-Agent": random.choice(USER_AGENTS)},
                timeout=6.0,
                stream=True
            )
            if resp.status_code == 200:
                with open(file_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                return f"images/{filename}"
        except Exception as e:
            logger.debug(f"Image download failed for IMPA {impa_code} ({image_url}): {e}")
        return None

    def fetch_product(self, impa_code: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to scrape a single IMPA code.
        Applies fast-fail on 404 without waiting.
        """
        target_url = self.target_template.format(impa_code=impa_code)
        headers = self._get_headers()

        try:
            resp = self.session.get(
                target_url,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True
            )

            # Fast-fail on 404: Skip immediately without sleeping
            if resp.status_code == 404:
                self.consecutive_404_count += 1
                logger.debug(f"IMPA {impa_code}: 404 Not Found (consecutive: {self.consecutive_404_count})")
                return None

            # Handle rate limiting / Cloudflare challenges
            if resp.status_code in (429, 403, 503):
                logger.warning(f"Rate limited or challenged (HTTP {resp.status_code}) on IMPA {impa_code}. Backing off...")
                time.sleep(random.uniform(5.0, 10.0))
                return None

            if resp.status_code == 200:
                # Reset 404 counter on successful HTTP response
                parsed = parse_product_page(resp.text, target_url, expected_impa=impa_code)
                if parsed:
                    self.consecutive_404_count = 0
                    
                    # Download image if found
                    if parsed.get("image_url"):
                        local_img = self.download_product_image(impa_code, parsed["image_url"])
                        parsed["local_image_path"] = local_img

                    # Incremental SQLite storage
                    upsert_product(parsed)
                    self.total_scraped_session += 1
                    logger.info(f"✅ Scraped IMPA {impa_code}: {parsed['product_name'][:40]} ({parsed['uom']})")
                    return parsed
                else:
                    # Soft 404 / empty page
                    self.consecutive_404_count += 1
                    return None

        except requests.exceptions.Timeout:
            logger.debug(f"Timeout on IMPA {impa_code}, skipping quickly.")
            self.consecutive_404_count += 1
            return None
        except requests.exceptions.RequestException as e:
            logger.debug(f"Network error on IMPA {impa_code}: {e}")
            return None

        return None

    def scrape_range(
        self,
        start_code: int,
        end_code: int,
        step: int = 1
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Scrapes a continuous range of 6-digit codes.
        Implements fast-fail sequence skipping when large gaps occur.
        """
        current = start_code
        category_code = str(start_code).zfill(6)[:2]
        logger.info(f"🚀 Starting scraper for range {str(start_code).zfill(6)} to {str(end_code).zfill(6)}...")

        while current <= end_code:
            code_str = str(current).zfill(6)
            curr_cat = code_str[:2]

            # Execute scrape
            product = self.fetch_product(code_str)
            
            if product:
                # Found item: update progress & polite jitter
                update_progress(curr_cat, code_str, self.consecutive_404_count, found_increment=1)
                yield product
                self._sleep_jitter()
            else:
                # 404 or empty: update progress without long delay
                update_progress(curr_cat, code_str, self.consecutive_404_count, found_increment=0)
                
                # Check fast-fail skip threshold
                if self.consecutive_404_count >= self.consecutive_404_skip:
                    skip_jump = 10
                    logger.info(f"⚡ Fast-fail threshold reached ({self.consecutive_404_count} consecutive 404s). Skipping {skip_jump} codes ahead...")
                    current += skip_jump
                    self.consecutive_404_count = 0
                    continue

                # Very short delay for empty/404 queries
                time.sleep(random.uniform(0.15, 0.4))

            current += step

        logger.info(f"🏁 Completed range scan. Total items scraped in this session: {self.total_scraped_session}")

    def scrape_category(self, category_code: str, max_items: Optional[int] = None) -> int:
        """
        Scrapes items in a specific IMPA category (e.g. '23' -> 230000 to 239999).
        Resumes from last checkpoint if available.
        """
        category_code = str(category_code).zfill(2)
        progress = get_progress(category_code)
        
        start_num = int(f"{category_code}0001")
        if progress and progress.get("last_code_checked"):
            last_checked = int(progress["last_code_checked"])
            if last_checked > start_num:
                start_num = last_checked + 1
                logger.info(f"Resuming category {category_code} from IMPA {str(start_num).zfill(6)}")

        end_num = int(f"{category_code}9999")
        if max_items:
            end_num = min(end_num, start_num + max_items)

        found = 0
        for _ in self.scrape_range(start_num, end_num):
            found += 1
            if max_items and found >= max_items:
                break
        return found
