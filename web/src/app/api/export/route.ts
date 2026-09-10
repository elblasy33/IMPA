import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Standard RFC-4180 CSV field escape function.
 * Wraps in quotes and escapes internal quotes with double-quotes ("").
 */
function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  // If the field contains commas, double quotes, or newlines, wrap in quotes and escape quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  try {
    // Only exports valid active/verified products (skips 'not_found' sequence gaps)
    const products = getAllProducts();

    // Exactly the 5 columns requested for Odoo 18/19 product import:
    // default_code, name, description, uom_id, categ_id
    const headers = [
      "default_code",
      "name",
      "description",
      "uom_id",
      "categ_id",
    ];

    const lines: string[] = [headers.join(",")];

    for (const p of products) {
      const impaCode = String(p.impa_code).padStart(6, "0");
      const name = p.product_name || `IMPA Product ${impaCode}`;
      const description = p.description || "";
      const rawUom = p.uom || "PCS";
      const categoryName = p.category_name || "General Marine Stores";

      const row = [
        escapeCsvField(impaCode),
        escapeCsvField(name),
        escapeCsvField(description),
        escapeCsvField(rawUom),
        escapeCsvField(categoryName),
      ];

      lines.push(row.join(","));
    }

    // Prepend UTF-8 BOM (\uFEFF) so Excel and text editors handle international chars properly
    const csvContent = "\uFEFF" + lines.join("\r\n");
    const filename = `odoo_impa_import_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error generating Odoo CSV export:", error);
    return NextResponse.json(
      { error: "Failed to generate export", details: error.message },
      { status: 500 }
    );
  }
}
