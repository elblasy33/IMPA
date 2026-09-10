"use client";

import React from "react";
import { Package, Layers, Scale, Image as ImageIcon, TrendingUp } from "lucide-react";
import { DashboardStats } from "@/lib/types";

interface MetricsBarProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ stats, loading = false }) => {
  const total = stats?.total_products ?? 0;
  const categories = stats?.categories_count ?? 0;
  const uoms = stats?.uom_count ?? 0;
  const withImages = stats?.with_images ?? 0;
  const imagePct = total > 0 ? Math.round((withImages / total) * 100) : 0;

  const cards = [
    {
      label: "Total Products Scraped",
      value: total.toLocaleString(),
      subtext: "Incremental SQLite records",
      icon: Package,
      gradient: "from-blue-600/20 to-cyan-600/20",
      border: "border-cyan-500/30",
      iconColor: "text-cyan-400",
      badge: "Live DB",
      badgeColor: "bg-cyan-950 text-cyan-400 border-cyan-800",
    },
    {
      label: "Active IMPA Categories",
      value: categories.toString(),
      subtext: "IMPA Range 11 – 89",
      icon: Layers,
      gradient: "from-indigo-600/20 to-purple-600/20",
      border: "border-indigo-500/30",
      iconColor: "text-indigo-400",
      badge: `${Math.round((categories / 34) * 100)}% coverage`,
      badgeColor: "bg-indigo-950 text-indigo-400 border-indigo-800",
    },
    {
      label: "Units of Measure (UOM)",
      value: uoms.toString(),
      subtext: "PCS, MTR, SET, KG, BOX...",
      icon: Scale,
      gradient: "from-emerald-600/20 to-teal-600/20",
      border: "border-emerald-500/30",
      iconColor: "text-emerald-400",
      badge: "ERP Standard",
      badgeColor: "bg-emerald-950 text-emerald-400 border-emerald-800",
    },
    {
      label: "Verified Image Previews",
      value: `${imagePct}%`,
      subtext: `${withImages.toLocaleString()} of ${total.toLocaleString()} products`,
      icon: ImageIcon,
      gradient: "from-amber-600/20 to-orange-600/20",
      border: "border-amber-500/30",
      iconColor: "text-amber-400",
      badge: "Visual Catalog",
      badgeColor: "bg-amber-950 text-amber-400 border-amber-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} bg-slate-900/60 p-5 border ${card.border} backdrop-blur-md shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-cyan-950/20`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
                <IconComponent className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${card.badgeColor}`}>
                {card.badge}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                {card.label}
              </p>
              <div className="mt-1 flex items-baseline space-x-2">
                {loading ? (
                  <div className="h-8 w-24 bg-slate-800 animate-pulse rounded"></div>
                ) : (
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {card.value}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400/90 truncate">{card.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
