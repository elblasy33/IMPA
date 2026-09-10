# ⚓ IMPA Marine Product Scraper & Real-Time Next.js Dashboard

A comprehensive, production-ready Full-Stack system designed to scrape, persist, export, and visualize **IMPA (International Marine Purchasing Association)** 6-digit catalog items with an **Odoo ERP** export pipeline and a modern **Next.js 15** web dashboard.

---

## 📁 1. Project Folder Structure

```text
IMPA/
├── README.md                           # Documentation and local setup guide
├── data/                               # Shared data store
│   ├── impa_catalog.db                 # SQLite database (WAL mode enabled)
│   ├── images/                         # Downloaded product images
│   └── exports/                        # Odoo CSV exports
├── scraper/                            # Part 1: Python Scraper Suite
│   ├── requirements.txt                # Python dependencies (requests, bs4, etc.)
│   ├── config.py                       # User-Agents, IMPA categories (11-89), jitter delays
│   ├── db.py                           # SQLite schema, WAL mode, upsert & checkpoints
│   ├── extractor.py                    # Multi-strategy parser (JSON-LD, Microdata, UOM heuristics)
│   ├── scraper.py                      # Crawler engine (Anti-blocking, fast-fail on 404, jitter)
│   ├── odoo_exporter.py                # Odoo ERP CSV formatting engine (product.template)
│   ├── seed_data.py                    # Authentic marine catalogue seed generator
│   └── main.py                         # CLI entrypoint with flexible arguments
└── web/                                # Part 2: Next.js Web Dashboard
    ├── package.json                    # Next.js, React 19, Tailwind CSS v4, Lucide
    ├── tsconfig.json                   # TypeScript configuration
    ├── next.config.ts                  # Remote image patterns configuration
    └── src/
        ├── app/
        │   ├── layout.tsx              # Maritime dark navy theme layout
        │   ├── page.tsx                # Main dashboard page (Metrics, Search, Grid/Table)
        │   ├── globals.css             # Tailwind styling & glassmorphism
        │   └── api/
        │       ├── products/route.ts   # Live search, filter & pagination API
        │       ├── stats/route.ts      # Aggregated metrics API
        │       └── export/route.ts     # In-browser 1-click Odoo CSV stream
        ├── components/
        │   ├── Header.tsx              # Navbar with SQLite WAL indicator & export button
        │   ├── MetricsBar.tsx          # 4 Stat cards (Total, Categories, UOMs, Images)
        │   ├── SearchAndFilters.tsx    # Debounced search bar, category 11-89, UOM dropdown
        │   ├── ProductTable.tsx        # High-density data table with image thumbnails
        │   ├── ProductGrid.tsx         # Visual card grid view with responsive layouts
        │   └── ProductModal.tsx        # Detailed inspection modal with Odoo ERP fields
        ├── lib/
        │   ├── db.ts                   # SQLite query accessor using node:sqlite
        │   └── types.ts                # TypeScript data models
        └── types/
            └── node-sqlite.d.ts        # Type declarations for node:sqlite
```

---

## ⚙️ 2. Core Architecture & Logic

### A. The 6-Digit IMPA Numbering Scheme
- **Digits 1–2 (Category)**: Range `11` through `89` (e.g., `23` = Rigging & Deck Equipment, `31` = Safety & Lifeboats, `33` = Fire Fighting, `59` = Hand Tools, `73` = Engine Valves).
- **Digits 3–6 (Item Number)**: Range `0000` through `9999` uniquely identifying the specific article and dimension.

### B. Python Scraper Resilience & Anti-Detection
1. **User-Agent Rotation**: Every HTTP request randomly selects from a modern pool of realistic desktop browser headers (Chrome, Firefox, Safari, Edge across Windows, macOS, and Linux).
2. **Polite Jitter Delays**: Random delays (`0.8s` to `2.2s`) between requests prevent predictable timing fingerprints.
3. **Fast-Fail 404 Mechanism**: 
   - HTTP 404 responses are discarded immediately without retry delays.
   - If consecutive 404s exceed the threshold (default: 25), the crawler skips ahead to avoid stalling in empty numerical ranges.
4. **Incremental SQLite Storage (WAL Mode)**:
   - Products are committed immediately on discovery using `INSERT OR REPLACE INTO products`.
   - SQLite Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and `PRAGMA busy_timeout = 5000` allow the Next.js web application to read while the Python scraper writes concurrently.

### C. Odoo ERP Export Pipeline
The export generates standard Odoo `product.template` CSV files compliant with Odoo 14, 15, 16, 17, and 18:
- `id`: XML ID for idempotent re-importing (`impa_product_232001`)
- `default_code`: 6-digit IMPA code (Internal Reference)
- `name`: Product Name
- `description_sale`: Sales quote description
- `description_purchase`: RFQ purchase description with IMPA code prefix
- `categ_id`: Hierarchical path (`All / Marine Stores / 23 - Rigging Equipment`)
- `uom_id`: Unit of Measure standard (`Units`, `m`, `kg`, etc.)
- `type`: `consu` (Storable consumable in Odoo)
- `sale_ok` & `purchase_ok`: `True`

---

## 🚀 3. Step-by-Step Installation & Local Execution

### Prerequisites
- **Python 3.10+** (Tested on Python 3.14)
- **Node.js 20+** (Tested on Node.js v26.7 with native `node:sqlite`)
- **npm** or **yarn**

---

### Step 1: Initialize Database & Seed Sample Data
Navigate to the scraper directory and install dependencies:

```bash
cd scraper
pip install -r requirements.txt
```

Populate the database with authentic marine products across official categories for instant testing:

```bash
python main.py --seed
```

View current catalog statistics:

```bash
python main.py --stats
```

---

### Step 2: Running the Scraper (Directly against ShipServ IMPA Catalogue)

الموقع المستهدف المعتمد عالمياً لدليل IMPA هو: **`https://impa-catalogue.shipserv.com/`**

#### 1. عرض كافة الأقسام المتاحة على ShipServ:
```bash
python3 main.py --shipserv-categories
```

#### 2. سحب منتجات حقيقية من ShipServ مباشرة برقم الكود والاسم والصور والـ UOM:
```bash
# سحب قسم 23 (معدات السطح والتجهيزات):
python3 main.py --shipserv 23 --limit 50

# سحب قسم 33 (معدات السلامة وأجهزة الكشف والإنقاذ):
python3 main.py --shipserv 33 --limit 50

# سحب قسم 61 (العدد اليدوية البحرية Hand Tools):
python3 main.py --shipserv 61 --limit 50

# سحب قسم 75 (صمامات غرف المحركات Valves & Cocks):
python3 main.py --shipserv 75 --limit 50
```

#### 3. البحث التلقائي بالإنترنت عن أي كود فردي:
```bash
python3 main.py --search 232015
```

#### 4. استيراد ملف خارجي (CSV):
```bash
python3 main.py --import-file "data/my_impa_list.csv"
```

#### 5. تصدير قاعدة البيانات بالكامل لبرنامج Odoo ERP:
```bash
python3 main.py --export data/exports/odoo_products.csv
```

---

### Step 3: Running the Next.js Web Dashboard

Navigate to the `web` folder:

```bash
cd ../web
npm install
```

#### Development Mode:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Production Build & Run:
```bash
npm run build
npm run start
```

---

## 🐳 4. تشغيل المشروع عبر Docker على السيرفر (VPS Deployment)

المشروع مجهز بالكامل للعمل داخل حاوية Docker موحدة تجمع **Node.js 22** و **Python 3** مع ربط مجلد البيانات كـ Volume دائم (`./data:/app/data`) حتى لا تضيع أي بيانات تم سحبها نهائياً.

### خطوات الرفع والتشغيل على أي سيرفر (Ubuntu / Debian / CentOS):

1. **انسخ ملفات المشروع إلى السيرفر:**
   ```bash
   git clone <YOUR_REPO_URL> /opt/impa
   cd /opt/impa
   ```

2. **تشغيل الحاوية في الخلفية بأمر واحد:**
   ```bash
   docker compose up -d --build
   ```

3. **التحقق من حالة الحاوية وسجلات التشغيل:**
   ```bash
   # فحص الحالة
   docker compose ps

   # متابعة السجلات الحية
   docker compose logs -f
   ```

4. **الوصول للوحة التحكم:**
   افتح المتصفح على: `http://SERVER_IP:3005` (البورت الافتراضي 3005 لتجنب أي تعارض مع خدمات السيرفر الأخرى).

> 💾 **ملاحظة الأمان واستمرارية البيانات:**
> قاعدة بيانات SQLite (`data/impa_catalog.db`) وملفات التصدير والصور محفوظة في المجلد المحلي `./data` على السيرفر، ولن تُمس أو تُحذف حتى لو قمت بإعادة بناء أو إيقاف حاوية الـ Docker.

---

## 🖥️ 5. الميزات المتقدمة المتاحة من واجهة الويب مباشرة

1. **مركز التحكم في السكرابر (Scraper Hub):**
   * اضغط على زر **`Scraper Hub / مركز السحب`** في الشريط العلوي.
   * اختر أي قسم من أقسام ShipServ الرسمية (34 قسماً).
   * اختر حجم الدفعة (مثلاً 50 منتجاً).
   * اضغط **Start Scraping** لمتابعة سحب المنتجات لحظياً من الكونسول داخل الموقع دون الحاجة لفتح الـ Terminal.

2. **فحص ومراجعة وتعديل المنتجات (Quality Control & Editing):**
   * اضغط على أي منتج لفتح نافذة التفاصيل.
   * اضغط على زر **`Edit / تعديل`**.
   * يمكنك تصحيح اسم المنتج، الوصف، وحدة القياس (UOM)، رابط الصورة.
   * تفعيل خيار **`Mark as Verified`** لاعتماد صحة المنتج.
   * اضغط **`Save Changes / حفظ التعديلات`** ليتم التحديث فوراً في قاعدة بيانات SQLite.

3. **تصدير Odoo ERP بنقرة واحدة:**
   * اضغط على زر **`Export to Odoo CSV`** لتحميل ملف المنتجات المحدث فوراً بصيغة متوافقة 100% مع Odoo 14-18.

| Feature | Description |
| :--- | :--- |
| **Real-Time Search** | Search instantly by 6-digit IMPA code or product keyword with a 300ms debounce. |
| **Category Filter** | Full dropdown covering official 11–89 IMPA categories. |
| **UOM Filter** | Filter by Units of Measure (`PCS`, `SET`, `MTR`, `ROLL`, `BOX`, `KG`, etc.). |
| **Dual View Modes** | Switch between high-density **Table View** and responsive **Card Grid**. |
| **Live Metrics Bar** | Real-time counters: Total Products, Active Categories, UOMs, and Image Coverage. |
| **Product Modal** | Full technical specifications, image viewer, and **Odoo ERP mapping preview**. |
| **1-Click Export** | Download the complete catalog directly as an Odoo-compliant CSV from the UI. |

---

## 📦 5. Importing into Odoo ERP

1. Log into your **Odoo Database**.
2. Navigate to **Inventory** > **Products** > **Products** (or **Sales** > **Products**).
3. Click the **Gear icon (⚙️) / Favorites** > **Import Records**.
4. Upload `odoo_impa_products.csv` (generated via CLI or downloaded from the Web Dashboard).
5. Click **Test** — all fields (`default_code`, `name`, `categ_id`, `uom_id`, etc.) will map automatically.
6. Click **Import** to load the complete IMPA catalog into your Odoo inventory!
