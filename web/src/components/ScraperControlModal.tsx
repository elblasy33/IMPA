"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Play, Square, Terminal, RefreshCw, Layers, ShieldCheck, CheckCircle2 } from "lucide-react";
import { IMPA_CATEGORIES_LIST } from "./SearchAndFilters";

interface ScraperControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated: () => void;
}

export const ScraperControlModal: React.FC<ScraperControlModalProps> = ({
  isOpen,
  onClose,
  onDataUpdated,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("23");
  const [batchLimit, setBatchLimit] = useState(50);
  const [isScraping, setIsScraping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Poll status when open or scraping
  useEffect(() => {
    if (!isOpen) return;

    let intervalId: any;

    const pollStatus = async () => {
      try {
        const res = await fetch("/api/scrape", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const wasScraping = isScraping;
          setIsScraping(data.isScraping);
          setLogs(data.logs || []);
          setActiveCategory(data.activeCategory || "");

          // If scraper just finished, trigger dashboard data update
          if (wasScraping && !data.isScraping) {
            onDataUpdated();
          }
        }
      } catch (err) {
        console.error("Error polling scraper status:", err);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 1500);

    return () => clearInterval(intervalId);
  }, [isOpen, isScraping, onDataUpdated]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStartScrape = async () => {
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, limit: batchLimit }),
      });
      if (res.ok) {
        setIsScraping(true);
      }
    } catch (err) {
      console.error("Failed to start scraper:", err);
    }
  };

  const handleStopScrape = async () => {
    try {
      await fetch("/api/scrape", { method: "DELETE" });
      setIsScraping(false);
      onDataUpdated();
    } catch (err) {
      console.error("Failed to stop scraper:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>ShipServ IMPA Scraper Control Center</span>
                {isScraping && (
                  <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Scraping Active</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Stage-by-stage data gathering directly from https://impa-catalogue.shipserv.com
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Category Dropdown */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Target Category to Scrape:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={isScraping}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer disabled:opacity-50"
            >
              {IMPA_CATEGORIES_LIST.filter(c => c.code !== "all").map((cat) => (
                <option key={cat.code} value={cat.code} className="bg-slate-900">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Items Limit per Stage:
            </label>
            <select
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value))}
              disabled={isScraping}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer disabled:opacity-50"
            >
              <option value={20}>20 items (Quick)</option>
              <option value={50}>50 items (Recommended)</option>
              <option value={100}>100 items (Deep)</option>
              <option value={200}>200 items (Large batch)</option>
            </select>
          </div>
        </div>

        {/* Live Terminal Logs */}
        <div className="flex-1 p-4 bg-slate-950 flex flex-col min-h-[260px] overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block"></span>
              <span className="font-mono text-slate-300 font-semibold pl-1">Console Output</span>
            </div>
            {isScraping && (
              <span className="text-[11px] text-cyan-400 animate-pulse">
                Running Category [{activeCategory}]...
              </span>
            )}
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 pr-2 max-h-[300px]"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No activity yet. Click "Start Scraping" to begin.</div>
            ) : (
              logs.map((log, index) => {
                const isSuccess = log.includes("✅") || log.includes("Successfully");
                const isError = log.includes("❌") || log.includes("error") || log.includes("STDERR");
                const isInfo = log.includes("🚀") || log.includes("⚓") || log.includes("Found");

                return (
                  <div
                    key={index}
                    className={`leading-relaxed ${
                      isSuccess
                        ? "text-emerald-400"
                        : isError
                        ? "text-rose-400"
                        : isInfo
                        ? "text-cyan-400"
                        : "text-slate-300"
                    }`}
                  >
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Data is saved incrementally to <span className="font-mono text-cyan-400">impa_catalog.db</span>
          </div>

          <div className="flex items-center space-x-3">
            {isScraping ? (
              <button
                onClick={handleStopScrape}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-lg shadow-red-900/30"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Job</span>
              </button>
            ) : (
              <button
                onClick={handleStartScrape}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/25 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Scraping Category {selectedCategory}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
