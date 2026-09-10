import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/db";
import { ProductsQueryParams } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: ProductsQueryParams = {
      query: searchParams.get("query") || undefined,
      category: searchParams.get("category") || undefined,
      uom: searchParams.get("uom") || undefined,
      reviewStatus: (searchParams.get("reviewStatus") as any) || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 24,
      sortBy: (searchParams.get("sortBy") as any) || "impa_code",
      sortOrder: (searchParams.get("sortOrder") as any) || "asc",
    };

    const result = getProducts(params);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in /api/products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error.message },
      { status: 500 }
    );
  }
}
