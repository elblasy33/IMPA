"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MetricsBar } from "@/components/MetricsBar";
import { SearchAndFilters } from "@/components/SearchAndFilters";
import { ProductTable } from "@/components/ProductTable";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductModal } from "@/components/ProductModal";
import { ScraperControlModal } from "@/components/ScraperControlModal";
import { CampaignSchedulerModal } from "@/components/CampaignSchedulerModal";
import { ImpaProduct, DashboardStats } from "@/lib/types";

export default function Home() {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<ImpaProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedUom, setSelectedUom] = useState("all");
  const [reviewStatus, setReviewStatus] = useState<"all" | "active" | "verified" | "needs_review" | "missing_images" | "not_found">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState<ImpaProduct | null>(null);
  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("query", debouncedQuery.trim());
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedUom !== "all") params.set("uom", selectedUom);
      if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
      params.set("page", page.toString());
      params.set("limit", viewMode === "grid" ? "24" : "20");

      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedCategory, selectedUom, reviewStatus, page, viewMode]);

  // Load initial data
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchProducts()]);
    setRefreshing(false);
  };

  // Reset filters handler
  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedCategory("all");
    setSelectedUom("all");
    setReviewStatus("all");
    setPage(1);
  };

  // Product updated callback
  const handleProductUpdated = (updated: ImpaProduct) => {
    setSelectedProduct(updated);
    setProducts((prev) =>
      prev.map((p) => (p.impa_code === updated.impa_code ? updated : p))
    );
    fetchStats();
  };

  // Product deleted callback
  const handleProductDeleted = (impaCode: string) => {
    setSelectedProduct(null);
    setProducts((prev) => prev.filter((p) => p.impa_code !== impaCode));
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navbar */}
      <Header
        onRefresh={handleRefresh}
        onOpenScraperModal={() => setIsScraperModalOpen(true)}
        onOpenCampaignModal={() => setIsCampaignModalOpen(true)}
        isRefreshing={refreshing}
        totalProducts={stats?.total_products || 0}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards */}
        <MetricsBar stats={stats} loading={refreshing} />

        {/* Search, Filters & View Toggle */}
        <SearchAndFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={(cat) => {
            setSelectedCategory(cat);
            setPage(1);
          }}
          selectedUom={selectedUom}
          onUomChange={(uom) => {
            setSelectedUom(uom);
            setPage(1);
          }}
          reviewStatus={reviewStatus}
          onReviewStatusChange={(status) => {
            setReviewStatus(status);
            setPage(1);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onReset={handleResetFilters}
          totalResults={totalProducts}
        />

        {/* Product Catalog Display (Table or Grid) */}
        {viewMode === "table" ? (
          <ProductTable
            products={products}
            loading={loading}
            onSelectProduct={setSelectedProduct}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : (
          <ProductGrid
            products={products}
            loading={loading}
            onSelectProduct={setSelectedProduct}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </main>

      {/* Modal Inspector & Quality Review Editor */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onProductUpdated={handleProductUpdated}
        onProductDeleted={handleProductDeleted}
      />

      {/* Scraper Control Center Modal */}
      <ScraperControlModal
        isOpen={isScraperModalOpen}
        onClose={() => setIsScraperModalOpen(false)}
        onDataUpdated={handleRefresh}
      />

      {/* Anti-Ban Campaign Scheduler Modal */}
      <CampaignSchedulerModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        onDataUpdated={handleRefresh}
      />


      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>IMPA Marine Stores Guide Data Engine</span> • ShipServ Live Pipeline & Odoo ERP Integration
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-cyan-400/80 font-mono">SQLite WAL Engine</span>
            <span>Next.js 15 & Docker Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
