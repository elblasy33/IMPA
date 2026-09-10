export interface ImpaProduct {
  impa_code: string;
  category_code: string;
  category_name: string;
  product_name: string;
  description: string;
  uom: string;
  image_url: string | null;
  local_image_path: string | null;
  source_url: string | null;
  scraped_at: string;
  status: string;
  quality_score?: number;
  review_status?: string;
}

export interface DashboardStats {
  total_products: number;
  categories_count: number;
  uom_count: number;
  with_images: number;
  category_breakdown: {
    category_code: string;
    category_name: string;
    count: number;
  }[];
}

export interface ProductsQueryParams {
  query?: string;
  category?: string;
  uom?: string;
  reviewStatus?: "all" | "verified" | "needs_review" | "missing_images";
  page?: number;
  limit?: number;
  sortBy?: "impa_code" | "product_name" | "scraped_at";
  sortOrder?: "asc" | "desc";
}

export interface ProductsResponse {
  products: ImpaProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CategoryQueueItem {
  category_code: string;
  category_name: string;
  slug: string;
  subcategories_total: number;
  subcategories_done: number;
  items_found: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  last_scraped_at: string | null;
}

export interface CampaignStatus {
  id: number;
  name: string;
  status: "idle" | "running" | "paused" | "paused_cooldown" | "completed";
  daily_cap: number;
  today_count: number;
  delay_profile: "stealth" | "balanced" | "turbo";
  current_category: string;
  last_run_at: string;
  created_at: string;
  ban_risk: "Low (Safe Mode)" | "Moderate" | "High";
  total_categories_queued: number;
  categories_completed: number;
  overall_progress_percentage: number;
}

export interface QualityAudit {
  total_products: number;
  verified_products: number;
  flagged_products: number;
  missing_images: number;
  short_descriptions: number;
  average_quality_score: number;
  high_quality_percentage: number;
}
