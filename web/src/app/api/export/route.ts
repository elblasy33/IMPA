import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

const ODOO_UOM_MAPPING: Record<string, string> = {
  PCS: "Units",
  SET: "Units",
  PAIR: "Pairs",
  MTR: "m",
  ROLL: "Units",
  BOX: "Units",
  PKT: "Units",
  KG: "kg",
  LTR: "L",
  DRUM: "Units",
  CAN: "Units",
  BAG: "Units",
};

function escapeCsv(field: any): string {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET() {
  try {
    const products = getAllProducts();

    const headers = [
      "id",
      "default_code",
      "name",
      "description_sale",
      "description_purchase",
      "categ_id",
      "uom_id",
      "uom_po_id",
      "type",
      "sale_ok",
      "purchase_ok",
      "tracking",
      "image_1920",
    ];

    const lines: string[] = [headers.join(",")];

    for (const p of products) {
      const impaCode = String(p.impa_code).padStart(6, "0");
      const catCode = p.category_code || impaCode.substring(0, 2);
      const catName = p.category_name || "General Marine Equipment";
      const uomRaw = (p.uom || "PCS").toUpperCase();
      const odooUom = ODOO_UOM_MAPPING[uomRaw] || "Units";

      const row = [
        escapeCsv(`impa_product_${impaCode}`),
        escapeCsv(impaCode),
        escapeCsv(p.product_name),
        escapeCsv(p.description || ""),
        escapeCsv(`IMPA Code: ${impaCode} - ${p.description || ""}`),
        escapeCsv(`All / Marine Stores / ${catCode} - ${catName}`),
        escapeCsv(odooUom),
        escapeCsv(odooUom),
        escapeCsv("consu"),
        escapeCsv("True"),
        escapeCsv("True"),
        escapeCsv("none"),
        escapeCsv(p.image_url || ""),
      ];

      lines.push(row.join(","));
    }

    // Include UTF-8 BOM so Excel opens cleanly
    const csvContent = "\uFEFF" + lines.join("\n");
    const filename = `odoo_impa_catalog_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error in /api/export:", error);
    return NextResponse.json(
      { error: "Failed to generate export", details: error.message },
      { status: 500 }
    );
  }
}
