"use client";

import React from "react";
import { Anchor, Download, RefreshCw, Database, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onRefresh: () => void;
  onOpenScraperModal: () => void;
  onOpenCampaignModal: () => void;
  isRefreshing?: boolean;
  isCooldown?: boolean;
  totalProducts?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  onOpenScraperModal,
  onOpenCampaignModal,
  isRefreshing = false,
  isCooldown = false,
  totalProducts = 0,
}) => {
  const handleExport = () => {
    window.location.href = "/api/export";
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-900/90 border-b border-slate-800 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Anchor className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-300">
                IMPA Marine Stores Guide
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                v2.4 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Real-Time Scraper Dashboard & Odoo ERP Integration
            </p>
          </div>
        </div>

        {/* Database Live Status & Actions */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Circuit Breaker Warning Pill (When 429/403 triggered) */}
          {isCooldown ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-500 text-xs text-red-300 animate-pulse font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span>🚨 Circuit Breaker Active (Cooling Down)</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Sync: 5s (WAL)</span>
            </div>
          )}

          {/* Anti-Ban Campaign Planner Button */}
          <button
            onClick={onOpenCampaignModal}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-900 to-teal-900 hover:from-emerald-800 hover:to-teal-800 border border-emerald-500/60 text-emerald-200 hover:text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-950/40 active:scale-95 cursor-pointer"
            title="Open Anti-Ban Campaign Planner & Category Queue"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>خطة السحب الآمنة (Anti-Ban)</span>
          </button>

          {/* Scraper Control Center Button */}
          <button
            onClick={onOpenScraperModal}
            className="px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Open Scraper Control Center"
          >
            <span>Console / مركز السحب</span>
          </button>


          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Odoo CSV Export Button */}
          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer"
            title="Download formatted CSV for Odoo ERP import"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export to Odoo CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
