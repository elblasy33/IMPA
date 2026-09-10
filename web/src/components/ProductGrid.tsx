"use client";

import React from "react";
import { Package, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { ImpaProduct } from "@/lib/types";

interface ProductGridProps {
  products: ImpaProduct[];
  loading: boolean;
  onSelectProduct: (p: ImpaProduct) => void;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading,
  onSelectProduct,
  page,
  totalPages,
  onPageChange,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-72 bg-slate-900/70 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {products.map((product) => (
          <div
            key={product.impa_code}
            onClick={() => onSelectProduct(product)}
            className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 backdrop-blur-md overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-cyan-950/30 cursor-pointer flex flex-col justify-between"
          >
            <div>
              {/* Product Image Banner */}
              <div className="relative aspect-video w-full bg-slate-800 overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={product.image_url}
                    alt={product.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <Package className="w-8 h-8 mb-1" />
                    <span className="text-[10px]">No image</span>
                  </div>
                )}

                {/* Floating IMPA badge on image */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-slate-950/85 text-cyan-400 border border-cyan-700/80 text-xs font-mono font-bold shadow-md backdrop-blur-sm">
                    {product.impa_code}
                  </span>
                </div>

                {/* UOM badge on image */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/85 text-emerald-400 border border-emerald-700/80 text-[11px] font-semibold shadow-md backdrop-blur-sm">
                    {product.uom}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 space-y-2">
                <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider truncate">
                  Category {product.category_code} • {product.category_name}
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                  {product.product_name}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">ERP Ready (Odoo)</span>
              <span className="flex items-center space-x-1 text-cyan-400 group-hover:underline font-medium">
                <span>Inspect</span>
                <Eye className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Page <span className="font-semibold text-white">{page}</span> of{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
