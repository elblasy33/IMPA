"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Play,
  Pause,
  RefreshCw,
  RotateCcw,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Image as ImageIcon,
  Sliders,
} from "lucide-react";
import { CampaignStatus, CategoryQueueItem, QualityAudit } from "@/lib/types";

interface CampaignSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated: () => void;
}

export const CampaignSchedulerModal: React.FC<CampaignSchedulerModalProps> = ({
  isOpen,
  onClose,
  onDataUpdated,
}) => {
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null);
  const [queue, setQueue] = useState<CategoryQueueItem[]>([]);
  const [audit, setAudit] = useState<QualityAudit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<"stealth" | "balanced" | "turbo">("stealth");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [batchLimit, setBatchLimit] = useState<number>(35);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch campaign and queue status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const [campRes, auditRes] = await Promise.all([
        fetch("/api/campaign", { cache: "no-store" }),
        fetch("/api/audit", { cache: "no-store" }),
      ]);

      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaign(campData.campaign);
        setQueue(campData.queue || []);
        if (campData.campaign?.delay_profile) {
          setSelectedProfile(campData.campaign.delay_profile);
        }
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAudit(auditData);
      }
    } catch (err) {
      console.error("Failed to load campaign info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleStartCampaign = async () => {
    setIsTriggering(true);
    setMessage(null);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          delay_profile: selectedProfile,
          current_category: selectedCategory === "all" ? undefined : selectedCategory,
          limit: batchLimit,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✅ تم إطلاق دفعة السحب الآمنة بنجاح في الخلفية!");
        fetchStatus();
        onDataUpdated();
      } else {
        setMessage(`❌ خطأ: ${data.error || "تعذر بدء السحب"}`);
      }
    } catch (err: any) {
      setMessage(`❌ فشل الاتصال: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePauseCampaign = async () => {
    setIsTriggering(true);
    try {
      await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      setMessage("⏸️ تم إيقاف السحب مؤقتاً بأمان.");
      fetchStatus();
    } catch (err: any) {
      setMessage(`❌ فشل الإيقاف: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleResetBudget = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_budget" }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ تم تصفير ميزانية اليوم بنجاح وفتح السحب فوراً!");
        fetchStatus();
        onDataUpdated();
      }
    } catch {
      setMessage("❌ حدث خطأ أثناء تصفير الميزانية.");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("هل أنت متأكد من إعادة ضبط الحملة بالكامل للبدء من الفئة 11 وتصفير الميزانية؟")) return;
    setIsTriggering(true);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_all" }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ تم تصفير الحملة بالكامل والبدء من الفئة 11!");
        fetchStatus();
        onDataUpdated();
      }
    } catch {
      setMessage("❌ حدث خطأ أثناء إعادة ضبط الحملة.");
    } finally {
      setIsTriggering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>جدولة سحب الكتالوج ومقاومة الحظر (Anti-Ban Campaign)</span>
                {campaign?.status === "running" && (
                  <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>سحب نشط الآن</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                المصدر الرسمي: ShipServ IMPA Marine Stores Guide (جمع تدريجي ذكي بدون حظر IP)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Anti-Ban Safety Meter Banner */}
          <div className="p-4 rounded-xl border border-emerald-800/60 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300">مستوى الأمان من الحظر:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-700">
                    {campaign?.ban_risk || "Low (Safe Mode)"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  توليد فواصل زمنية عشوائية ذكية (Human Jitter 2.5s-5.0s) + تبريد 12 ثانية بين الأقسام لحماية آي بي السيرفر من Cloudflare.
                </p>
              </div>
            </div>

            {/* Quality Summary Chip */}
            {audit && (
              <div className="flex items-center space-x-4 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs shrink-0">
                <div>
                  <div className="text-slate-400 text-[10px]">معدل الجودة العام</div>
                  <div className="font-bold text-cyan-400 text-sm">{audit.average_quality_score}%</div>
                </div>
                <div className="h-7 w-px bg-slate-800"></div>
                <div>
                  <div className="text-slate-400 text-[10px]">المعتمدة رسمياً</div>
                  <div className="font-bold text-emerald-400 text-sm">{audit.verified_products} منتج</div>
                </div>
              </div>
            )}
          </div>

          {/* Speed & Safety Profiles */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>نمط سرعة وحماية السحب (Anti-Ban Stealth Profile):</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Profile 1: Ultra Stealth */}
              <div
                onClick={() => setSelectedProfile("stealth")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedProfile === "stealth"
                    ? "bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/50"
                    : "bg-slate-800/50 border-slate-700/70 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Ultra-Stealth Safe
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    موصى به
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  تأخير بشري عشوائي (2.5s - 5.0s) + تبريد 12s. حماية 100% من الحظر للسيرفر.
                </p>
              </div>

              {/* Profile 2: Balanced */}
              <div
                onClick={() => setSelectedProfile("balanced")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedProfile === "balanced"
                    ? "bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/50"
                    : "bg-slate-800/50 border-slate-700/70 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Balanced Speed
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                    متوازن
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  تأخير (1.5s - 3.2s) + تبريد 7s. معدل سحب أسرع بمرتين مع مراقبة الأمان.
                </p>
              </div>

              {/* Profile 3: Turbo */}
              <div
                onClick={() => setSelectedProfile("turbo")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedProfile === "turbo"
                    ? "bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/50"
                    : "bg-slate-800/50 border-slate-700/70 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Turbo Stage
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                    أسرع - حذر
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  فواصل قصيرة (0.8s - 1.8s). مفيد عند سحب فئات صغيرة محددة.
                </p>
              </div>
            </div>
          </div>

          {/* Campaign Controls & Batch Targeting */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Target Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                الفئة المستهدفة للدفعة القادمة:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
              >
                <option value="all">التلقائي: الفئة التالية في طابور الانتظار</option>
                {queue.map((q) => (
                  <option key={q.category_code} value={q.category_code}>
                    [{q.category_code}] {q.category_name} ({q.status === "completed" ? "مكتمل" : q.status === "in_progress" ? "قيد السحب" : "في الانتظار"})
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                الحد الأقصى للدفعة (منتج):
              </label>
              <select
                value={batchLimit}
                onChange={(e) => setBatchLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
              >
                <option value={20}>20 منتج (دفعة سريعة)</option>
                <option value={35}>35 منتج (دفعة متوازنة)</option>
                <option value={60}>60 منتج (دفعة متوسطة)</option>
                <option value={120}>120 منتج (دفعة ليلية كبرى)</option>
              </select>
            </div>

            {/* Execution Buttons */}
            <div className="flex items-center gap-2">
              {campaign?.status === "running" ? (
                <button
                  onClick={handlePauseCampaign}
                  disabled={isTriggering}
                  className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>إيقاف مؤقت للحملة</span>
                </button>
              ) : (
                <button
                  onClick={handleStartCampaign}
                  disabled={isTriggering}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>بدء دفعة سحب آمنة</span>
                </button>
              )}
            </div>
          </div>

          {/* Budget & Reset Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">سقف السحب اليومي:</span>
              <span className="font-bold text-cyan-400 font-mono text-sm">{campaign?.today_count || 0} / {campaign?.daily_cap || 300}</span>
              <span className="text-slate-500 text-[11px]">منتج</span>
              {campaign && campaign.today_count >= campaign.daily_cap && (
                <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800 text-[10px] font-bold">
                  السقف مكتمل (متوقف مؤقتاً)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetBudget}
                disabled={isTriggering}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تصفير ميزانية اليوم فوراً</span>
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                disabled={isTriggering}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة البدء من الفئة 11</span>
              </button>
            </div>
          </div>

          {/* Feedback Message */}
          {message && (
            <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-cyan-300 font-medium">
              {message}
            </div>
          )}

          {/* Category Queue Table (34 Official IMPA Categories) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>طابور فئات الكتالوج (34 فئة رسمية معتمدة من IMPA):</span>
              </span>
              <span className="text-[11px] text-slate-400">
                تم إكمال: <span className="text-emerald-400 font-bold">{campaign?.categories_completed || 0}</span> من أصل <span className="text-white font-bold">{queue.length}</span> فئة
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden max-h-[260px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900/95 text-slate-400 border-b border-slate-800 font-medium z-10">
                  <tr>
                    <th className="p-2.5">الكود</th>
                    <th className="p-2.5">اسم الفئة الرسمية (IMPA MSG)</th>
                    <th className="p-2.5">المنتجات المسحوبة</th>
                    <th className="p-2.5">الأقسام الفرعية</th>
                    <th className="p-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        جاري تحميل قائمة الفئات المعتمدة...
                      </td>
                    </tr>
                  ) : (
                    queue.map((q) => {
                      const isTarget = campaign?.current_category === q.category_code;
                      return (
                        <tr
                          key={q.category_code}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isTarget ? "bg-cyan-950/30 font-medium" : ""
                          }`}
                        >
                          <td className="p-2.5 font-mono text-cyan-400 font-bold">
                            {q.category_code}
                          </td>
                          <td className="p-2.5 text-slate-200">
                            {q.category_name}
                          </td>
                          <td className="p-2.5 font-mono text-emerald-400">
                            {q.items_found} منتج
                          </td>
                          <td className="p-2.5 text-slate-400">
                            {q.subcategories_done} / {q.subcategories_total || "-"}
                          </td>
                          <td className="p-2.5">
                            {q.status === "completed" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                مكتمل
                              </span>
                            ) : q.status === "in_progress" || isTarget ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                                قيد المعالجة
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                                في الانتظار
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              آخر عملية سحب: {campaign?.last_run_at ? new Date(campaign.last_run_at).toLocaleString() : "لم تبدأ بعد"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
