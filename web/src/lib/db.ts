import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { ImpaProduct, DashboardStats, ProductsQueryParams, ProductsResponse } from "./types";

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  // Check environment variable first (from Docker or host)
  if (process.env.IMPA_DB_PATH) {
    const customPath = process.env.IMPA_DB_PATH;
    const dir = path.dirname(customPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    return customPath;
  }

  // Check static relative paths
  const parentDb = path.join(process.cwd(), "..", "data", "impa_catalog.db");
  if (fs.existsSync(parentDb)) {
    return parentDb;
  }

  const localDb = path.join(process.cwd(), "data", "impa_catalog.db");
  if (fs.existsSync(localDb)) {
    return localDb;
  }

  // Fallback to absolute workspace location
  const absDb = "/home/beso/IMPA/data/impa_catalog.db";
  if (fs.existsSync(absDb)) {
    return absDb;
  }

  return parentDb;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }

    dbInstance = new DatabaseSync(dbPath);
    try {
      dbInstance.exec("PRAGMA journal_mode = WAL;");
      dbInstance.exec("PRAGMA busy_timeout = 5000;");

      // 1. Ensure products table exists
      dbInstance.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
        CREATE INDEX IF NOT EXISTS idx_products_review ON products(review_status);
      `);

      // 2. Safe Dynamic Migrations: Auto-migrate any existing databases missing new columns
      const tableInfo = dbInstance.prepare("PRAGMA table_info(products);").all() as any[];
      const existingCols = new Set(tableInfo.map((col: any) => col.name));

      if (!existingCols.has("quality_score")) {
        dbInstance.exec("ALTER TABLE products ADD COLUMN quality_score INTEGER DEFAULT 80;");
      }
      if (!existingCols.has("review_status")) {
        dbInstance.exec("ALTER TABLE products ADD COLUMN review_status TEXT DEFAULT 'auto_scraped';");
      }
      if (!existingCols.has("status")) {
        dbInstance.exec("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active';");
      }

      // 3. Ensure campaigns and queue tables exist
      dbInstance.exec(`
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
      `);
    } catch (err) {
      console.error("Database migration error in getDb():", err);
    }
  }
  return dbInstance;
}

export function getProducts(params: ProductsQueryParams = {}): ProductsResponse {
  const db = getDb();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  // Search by code or product name or description
  if (params.query && params.query.trim()) {
    const term = `%${params.query.trim()}%`;
    conditions.push("(impa_code LIKE ? OR product_name LIKE ? OR description LIKE ?)");
    queryParams.push(term, term, term);
  }

  // Filter by category
  if (params.category && params.category !== "all") {
    conditions.push("category_code = ?");
    queryParams.push(params.category);
  }

  // Filter by UOM
  if (params.uom && params.uom !== "all") {
    conditions.push("uom = ?");
    queryParams.push(params.uom.toUpperCase());
  }

  // Filter by Data Quality / Review Status
  if (params.reviewStatus === "verified") {
    conditions.push("(review_status = 'verified' OR status = 'verified' OR status = 'shipserv_verified')");
  } else if (params.reviewStatus === "direct_images") {
    conditions.push("image_url IS NOT NULL AND image_url != '' AND INSTR(image_url, impa_code) > 0 AND status != 'not_found'");
  } else if (params.reviewStatus === "family_images") {
    conditions.push("image_url IS NOT NULL AND image_url != '' AND INSTR(image_url, impa_code) = 0 AND status != 'not_found'");
  } else if (params.reviewStatus === "missing_images") {
    conditions.push("(image_url IS NULL OR image_url = '') AND status != 'not_found'");
  } else if (params.reviewStatus === "needs_review") {
    conditions.push("(review_status = 'flagged' OR image_url IS NULL OR image_url = '' OR LENGTH(COALESCE(description, '')) < 30) AND status != 'not_found'");
  } else if (params.reviewStatus === "active") {
    conditions.push("status IN ('active', 'verified', 'shipserv_verified')");
  } else if (params.reviewStatus === "not_found") {
    conditions.push("status = 'not_found'");
  } else {
    // Default: exclude 404 sequence gaps unless specifically requested
    conditions.push("status != 'not_found'");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `SELECT COUNT(*) as count FROM products ${whereClause}`;
  const countStmt = db.prepare(countSql);
  const countResult = countStmt.get(...queryParams) as { count: number } | undefined;
  const total = countResult ? countResult.count : 0;

  // Sorting
  const allowedSortCols = ["impa_code", "product_name", "category_code", "scraped_at", "quality_score"];
  const sortBy = allowedSortCols.includes(params.sortBy || "") ? params.sortBy : "impa_code";
  const sortOrder = (params.sortOrder || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  // Select items
  const selectSql = `
    SELECT 
      impa_code,
      category_code,
      category_name,
      product_name,
      description,
      uom,
      image_url,
      local_image_path,
      source_url,
      scraped_at,
      status,
      quality_score,
      review_status
    FROM products
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const selectStmt = db.prepare(selectSql);
  const rows = selectStmt.all(...queryParams, limit, offset) as unknown as ImpaProduct[];

  return {
    products: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export function getProductByCode(impaCode: string): ImpaProduct | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM products WHERE impa_code = ?");
  const row = stmt.get(impaCode) as unknown as ImpaProduct | undefined;
  return row || null;
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE status != 'not_found'").get() as { count: number } | undefined;
  const catRow = db.prepare("SELECT COUNT(DISTINCT category_code) as count FROM products WHERE status != 'not_found'").get() as { count: number } | undefined;
  const uomRow = db.prepare("SELECT COUNT(DISTINCT uom) as count FROM products WHERE status != 'not_found'").get() as { count: number } | undefined;
  const imgRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE (image_url IS NOT NULL OR local_image_path IS NOT NULL) AND status != 'not_found'").get() as { count: number } | undefined;

  const breakdownRows = db.prepare(`
    SELECT category_code, category_name, COUNT(*) as count
    FROM products
    WHERE status != 'not_found'
    GROUP BY category_code, category_name
    ORDER BY count DESC
  `).all() as unknown as { category_code: string; category_name: string; count: number }[];

  return {
    total_products: totalRow?.count || 0,
    categories_count: catRow?.count || 0,
    uom_count: uomRow?.count || 0,
    with_images: imgRow?.count || 0,
    category_breakdown: breakdownRows || [],
  };
}

export function getAllProducts(): ImpaProduct[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM products WHERE status != 'not_found' AND status != 'failed' ORDER BY impa_code ASC").all() as unknown as ImpaProduct[];
  return rows;
}

export function updateProduct(
  impaCode: string,
  data: Partial<Pick<ImpaProduct, "product_name" | "description" | "uom" | "category_name" | "image_url" | "status">>
): ImpaProduct | null {
  const db = getDb();
  const existing = getProductByCode(impaCode);
  if (!existing) return null;

  const newName = data.product_name !== undefined ? data.product_name.trim() : existing.product_name;
  const newDesc = data.description !== undefined ? data.description.trim() : existing.description;
  const newUom = data.uom !== undefined ? data.uom.trim().toUpperCase() : existing.uom;
  const newCatName = data.category_name !== undefined ? data.category_name.trim() : existing.category_name;
  const newImg = data.image_url !== undefined ? data.image_url : existing.image_url;
  const newStatus = data.status !== undefined ? data.status : existing.status;

  const stmt = db.prepare(`
    UPDATE products
    SET 
      product_name = ?,
      description = ?,
      uom = ?,
      category_name = ?,
      image_url = ?,
      status = ?
    WHERE impa_code = ?
  `);

  stmt.run(newName, newDesc, newUom, newCatName, newImg, newStatus, impaCode);
  return getProductByCode(impaCode);
}

export function deleteProduct(impaCode: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM products WHERE impa_code = ?");
  const result = stmt.run(impaCode);
  return result.changes > 0;
}

export function getCampaignStatus(): import("./types").CampaignStatus {
  const db = getDb();
  // Ensure tables exist
  db.exec(`
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
  `);

  let camp = db.prepare("SELECT * FROM scrape_campaigns ORDER BY id DESC LIMIT 1").get() as any;
  if (!camp) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO scrape_campaigns (name, status, daily_cap, today_count, delay_profile, current_category, last_run_at, created_at)
      VALUES ('ShipServ Scheduled Campaign', 'idle', 300, 0, 'stealth', '23', ?, ?)
    `).run(now, now);
    camp = db.prepare("SELECT * FROM scrape_campaigns ORDER BY id DESC LIMIT 1").get() as any;
  }

  const queueTotal = (db.prepare("SELECT COUNT(*) as c FROM category_queue").get() as any)?.c || 0;
  const queueDone = (db.prepare("SELECT COUNT(*) as c FROM category_queue WHERE status = 'completed'").get() as any)?.c || 0;
  const subTotal = (db.prepare("SELECT SUM(subcategories_total) as s FROM category_queue").get() as any)?.s || 0;
  const subDone = (db.prepare("SELECT SUM(subcategories_done) as s FROM category_queue").get() as any)?.s || 0;

  const progressPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : (queueTotal > 0 ? Math.round((queueDone / queueTotal) * 100) : 0);

  const delayProfile = (camp.delay_profile || "stealth") as "stealth" | "balanced" | "turbo";
  const banRisk: "Low (Safe Mode)" | "Moderate" | "High" =
    delayProfile === "stealth" ? "Low (Safe Mode)" : delayProfile === "balanced" ? "Moderate" : "High";

  return {
    id: camp.id,
    name: camp.name,
    status: camp.status,
    daily_cap: camp.daily_cap,
    today_count: camp.today_count || 0,
    delay_profile: delayProfile,
    current_category: camp.current_category || "23",
    last_run_at: camp.last_run_at || camp.created_at,
    created_at: camp.created_at,
    ban_risk: banRisk,
    total_categories_queued: queueTotal,
    categories_completed: queueDone,
    overall_progress_percentage: progressPct,
  };
}

export function updateCampaignConfig(data: Partial<import("./types").CampaignStatus>): import("./types").CampaignStatus {
  const db = getDb();
  const current = getCampaignStatus();

  const status = data.status ?? current.status;
  const dailyCap = data.daily_cap ?? current.daily_cap;
  const delayProfile = data.delay_profile ?? current.delay_profile;
  const currentCat = data.current_category ?? current.current_category;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE scrape_campaigns
    SET status = ?, daily_cap = ?, delay_profile = ?, current_category = ?, last_run_at = ?
    WHERE id = ?
  `).run(status, dailyCap, delayProfile, currentCat, now, current.id);

  return getCampaignStatus();
}

export function getCategoryQueue(): import("./types").CategoryQueueItem[] {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT * FROM category_queue ORDER BY category_code ASC").all() as any[];
    return rows.map((r) => ({
      category_code: r.category_code,
      category_name: r.category_name,
      slug: r.slug,
      subcategories_total: r.subcategories_total || 0,
      subcategories_done: r.subcategories_done || 0,
      items_found: r.items_found || 0,
      status: r.status || "pending",
      last_scraped_at: r.last_scraped_at || null,
    }));
  } catch {
    return [];
  }
}

export function getQualityAudit(): import("./types").QualityAudit {
  const db = getDb();
  try {
    const total = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any)?.c || 0;
    const verified = (db.prepare("SELECT COUNT(*) as c FROM products WHERE review_status = 'verified' OR status = 'verified'").get() as any)?.c || 0;
    const flagged = (db.prepare("SELECT COUNT(*) as c FROM products WHERE review_status = 'flagged'").get() as any)?.c || 0;
    const missingImages = (db.prepare("SELECT COUNT(*) as c FROM products WHERE image_url IS NULL OR image_url = ''").get() as any)?.c || 0;
    const shortDesc = (db.prepare("SELECT COUNT(*) as c FROM products WHERE LENGTH(COALESCE(description, '')) < 30").get() as any)?.c || 0;
    const avgScoreRow = (db.prepare("SELECT AVG(COALESCE(quality_score, 80)) as avg FROM products").get() as any)?.avg;
    const avgScore = Math.round(avgScoreRow || 80);

    return {
      total_products: total,
      verified_products: verified,
      flagged_products: flagged,
      missing_images: missingImages,
      short_descriptions: shortDesc,
      average_quality_score: avgScore,
      high_quality_percentage: total > 0 ? Math.round((verified / total) * 100) : 0,
    };
  } catch {
    return {
      total_products: 0,
      verified_products: 0,
      flagged_products: 0,
      missing_images: 0,
      short_descriptions: 0,
      average_quality_score: 80,
      high_quality_percentage: 0,
    };
  }
}

