import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { ImpaProduct, DashboardStats, ProductsQueryParams, ProductsResponse } from "./types";

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
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
    dbInstance = new DatabaseSync(dbPath);
    try {
      dbInstance.exec("PRAGMA journal_mode = WAL;");
      dbInstance.exec("PRAGMA busy_timeout = 5000;");
    } catch {
      // Pragmas applied
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `SELECT COUNT(*) as count FROM products ${whereClause}`;
  const countStmt = db.prepare(countSql);
  const countResult = countStmt.get(...queryParams) as { count: number } | undefined;
  const total = countResult ? countResult.count : 0;

  // Sorting
  const allowedSortCols = ["impa_code", "product_name", "category_code", "scraped_at"];
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
      status
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
  
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number } | undefined;
  const catRow = db.prepare("SELECT COUNT(DISTINCT category_code) as count FROM products").get() as { count: number } | undefined;
  const uomRow = db.prepare("SELECT COUNT(DISTINCT uom) as count FROM products").get() as { count: number } | undefined;
  const imgRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE image_url IS NOT NULL OR local_image_path IS NOT NULL").get() as { count: number } | undefined;

  const breakdownRows = db.prepare(`
    SELECT category_code, category_name, COUNT(*) as count
    FROM products
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
  const rows = db.prepare("SELECT * FROM products ORDER BY impa_code ASC").all() as unknown as ImpaProduct[];
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
