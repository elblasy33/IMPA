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
