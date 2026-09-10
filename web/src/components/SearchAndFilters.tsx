"use client";

import React from "react";
import { Search, X, LayoutGrid, List, SlidersHorizontal, RotateCcw } from "lucide-react";

export const IMPA_CATEGORIES_LIST = [
  { code: "all", name: "All Categories (11 - 89)" },
  { code: "11", name: "11 - Provisions & Catering Supplies" },
  { code: "15", name: "15 - Cabin Stores (Galley & Bedding)" },
  { code: "17", name: "17 - Tableware & Galley Utensils" },
  { code: "19", name: "19 - Clothing, Uniforms & Footwear" },
  { code: "21", name: "21 - Rope, Cordage & Hawser" },
  { code: "23", name: "23 - Rigging Equipment & Deck Items" },
  { code: "25", name: "25 - Marine Paint & Equipment" },
  { code: "27", name: "27 - Nautical Publications & Instruments" },
  { code: "31", name: "31 - Safety Protective Gear & Lifeboats" },
  { code: "33", name: "33 - Fire Fighting & Safety Equipment" },
  { code: "35", name: "35 - Hoses & Couplings" },
  { code: "37", name: "37 - Marine Nautical Valves & Cocks" },
  { code: "39", name: "39 - Bearings & Bushings" },
  { code: "45", name: "45 - Lubricants & Greases" },
  { code: "47", name: "47 - Stationery & Office Supplies" },
  { code: "49", name: "49 - Medical & First Aid Supplies" },
  { code: "51", name: "51 - Hardware & Mechanical Seals" },
  { code: "53", name: "53 - Brushes & Mats" },
  { code: "55", name: "55 - Lavatory & Bathroom Equipment" },
  { code: "59", name: "59 - Hand Tools & Measuring Instruments" },
  { code: "61", name: "61 - Cutting Tools & Machine Shop" },
  { code: "63", name: "63 - Power Tools & Pneumatic Equipment" },
  { code: "65", name: "65 - Welding & Soldering Equipment" },
  { code: "67", name: "67 - Steel Products & Non-Ferrous Metals" },
  { code: "69", name: "69 - Fasteners, Bolts, Nuts & Washers" },
  { code: "71", name: "71 - Pipe & Tube Fittings" },
  { code: "73", name: "73 - Valves & Cocks - Engine Room" },
  { code: "75", name: "75 - Packing & Jointing Materials" },
  { code: "77", name: "77 - Electrical Equipment & Lighting" },
  { code: "79", name: "79 - Electrical Lamps & Torches" },
  { code: "81", name: "81 - Marine Electronics & Radar" },
  { code: "83", name: "83 - Instruments, Gauges & Control" },
  { code: "85", name: "85 - Internal Combustion Engine Parts" },
  { code: "87", name: "87 - Pumps & Air Compressors" },
  { code: "89", name: "89 - Deck Machinery & Winch Spares" },
];

export const UOM_OPTIONS = [
  { value: "all", label: "All Units (UOM)" },
  { value: "PCS", label: "PCS (Pieces)" },
  { value: "SET", label: "SET (Sets)" },
  { value: "MTR", label: "MTR (Meters)" },
  { value: "ROLL", label: "ROLL (Rolls)" },
  { value: "BOX", label: "BOX (Boxes)" },
  { value: "KG", label: "KG (Kilograms)" },
  { value: "LTR", label: "LTR (Liters)" },
  { value: "PAIR", label: "PAIR (Pairs)" },
];

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedUom: string;
  onUomChange: (uom: string) => void;
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
  onReset: () => void;
  totalResults: number;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedUom,
  onUomChange,
  viewMode,
  onViewModeChange,
  onReset,
  totalResults,
}) => {
  const hasActiveFilters = searchQuery !== "" || selectedCategory !== "all" || selectedUom !== "all";

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl mb-6 space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-cyan-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by 6-digit IMPA Code (e.g. 232001) or Product Name..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-800/90 border border-slate-700 rounded-xl self-end md:self-auto">
          <button
            onClick={() => onViewModeChange("table")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === "table"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === "grid"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Filter Dropdowns & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filter:</span>
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer max-w-[260px] truncate"
          >
            {IMPA_CATEGORIES_LIST.map((cat) => (
              <option key={cat.code} value={cat.code} className="bg-slate-900 text-white">
                {cat.name}
              </option>
            ))}
          </select>

          {/* UOM Dropdown */}
          <select
            value={selectedUom}
            onChange={(e) => onUomChange(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
          >
            {UOM_OPTIONS.map((uom) => (
              <option key={uom.value} value={uom.value} className="bg-slate-900 text-white">
                {uom.label}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs flex items-center space-x-1 transition-all"
              title="Reset all search queries and filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Found Result Count */}
        <div className="text-xs text-slate-400">
          Showing <span className="font-bold text-cyan-400">{totalResults}</span> items matching criteria
        </div>
      </div>
    </div>
  );
};
