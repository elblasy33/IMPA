"use client";

import React from "react";
import { Eye, ExternalLink, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { ImpaProduct } from "@/lib/types";

interface ProductTableProps {
  products: ImpaProduct[];
  loading: boolean;
  onSelectProduct: (p: ImpaProduct) => void;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  loading,
  onSelectProduct,
  page,
  totalPages,
  onPageChange,
}) => {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-800/60 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center backdrop-blur-md">
        <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-lg font-semibold text-white">No marine products found</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Try adjusting your search keywords or clearing category/UOM filters.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700/80 font-semibold tracking-wider">
            <tr>
              <th scope="col" className="px-5 py-3.5 w-16">Image</th>
              <th scope="col" className="px-5 py-3.5">IMPA Code</th>
              <th scope="col" className="px-5 py-3.5">Product Name & Specifications</th>
              <th scope="col" className="px-5 py-3.5">Category</th>
              <th scope="col" className="px-5 py-3.5 text-center">UOM</th>
              <th scope="col" className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {products.map((product) => (
              <tr
                key={product.impa_code}
                onClick={() => onSelectProduct(product)}
                className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                {/* Thumbnail */}
                <td className="px-5 py-3.5">
                  <div className="relative w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {product.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image_url}
                          alt={product.product_name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                        <div
                          style={{ display: "none" }}
                          className="w-full h-full items-center justify-center text-slate-500"
                        >
                          <Package className="w-5 h-5 text-slate-500" />
                        </div>
                      </>
                    ) : (
                      <Package className="w-5 h-5 text-slate-500" />
                    )}
                    {product.image_url && !product.image_url.includes(product.impa_code) && (
                      <span
                        title="صورة تمثيلية للمجموعة من ShipServ (IMPA Family Image)"
                        className="absolute bottom-0 right-0 px-1 py-0.5 bg-amber-500/30 text-amber-300 border-t border-l border-amber-500/50 text-[8px] font-bold rounded-tl leading-none backdrop-blur-sm"
                      >
                        GRP
                      </span>
                    )}
                  </div>
                </td>

                {/* IMPA Code */}
                <td className="px-5 py-3.5 font-mono whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-800 text-xs font-bold tracking-wide">
                    {product.impa_code}
                  </span>
                </td>

                {/* Name & Description snippet */}
                <td className="px-5 py-3.5 max-w-md">
                  <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                    {product.product_name}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {product.description}
                  </div>
                </td>

                {/* Category */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {product.category_code}
                    </span>
                    <span className="text-xs text-slate-300 max-w-[180px] truncate" title={product.category_name}>
                      {product.category_name}
                    </span>
                  </div>
                </td>

                {/* UOM */}
                <td className="px-5 py-3.5 text-center whitespace-nowrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                    {product.uom}
                  </span>
                </td>

                {/* Action */}
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProduct(product);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
                    title="Inspect Product & ERP Fields"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Page <span className="font-semibold text-white">{page}</span> of{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
