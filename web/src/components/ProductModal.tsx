"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Package,
  Tag,
  FileText,
  CheckCircle2,
  Edit3,
  Trash2,
  Save,
  Undo2,
  AlertCircle,
  Layers
} from "lucide-react";
import { ImpaProduct } from "@/lib/types";

interface ProductModalProps {
  product: ImpaProduct | null;
  onClose: () => void;
  onProductUpdated?: (updatedProduct: ImpaProduct) => void;
  onProductDeleted?: (impaCode: string) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onProductUpdated,
  onProductDeleted,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUom, setEditUom] = useState("PCS");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (product) {
      setEditName(product.product_name || "");
      setEditDescription(product.description || "");
      setEditUom(product.uom || "PCS");
      setEditImageUrl(product.image_url || "");
      setIsVerified(product.status === "verified" || product.status === "shipserv_verified");
      setIsEditing(false);
      setErrorMsg("");
    }
  }, [product]);

  if (!product) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(product.impa_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/products/${product.impa_code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: editName,
          description: editDescription,
          uom: editUom,
          image_url: editImageUrl.trim() || null,
          status: isVerified ? "verified" : "active",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update product");
      }

      const data = await res.json();
      setIsEditing(false);
      if (onProductUpdated && data.product) {
        onProductUpdated(data.product);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete IMPA ${product.impa_code} (${product.product_name})?`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.impa_code}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (onProductDeleted) {
          onProductDeleted(product.impa_code);
        }
        onClose();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  const formattedCategory = `All / Marine Stores / ${product.category_code} - ${product.category_name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-white my-8 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-700 text-sm font-mono font-bold tracking-wider">
              IMPA {product.impa_code}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium">
              UOM: {isEditing ? editUom : product.uom}
            </span>
            {(product.status === "verified" || product.status === "shipserv_verified") && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-400 hover:text-cyan-300 border border-slate-700 flex items-center space-x-1.5 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit / تعديل</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-1.5 transition-all"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-400 hover:text-red-300 transition-colors"
              title="Delete product"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-red-950/80 border-b border-red-800 text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {isEditing ? (
            /* ================= EDIT MODE ================= */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Product Name / اسم المنتج:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Unit of Measure (UOM) / وحدة القياس:
                  </label>
                  <select
                    value={editUom}
                    onChange={(e) => setEditUom(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="SET">SET (Sets)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="ROLL">ROLL (Rolls)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="BAG">BAG (Bags)</option>
                    <option value="CAN">CAN (Cans)</option>
                    <option value="DRUM">DRUM (Drums)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="KGS">KGS (Kilograms)</option>
                    <option value="LTR">LTR (Liters)</option>
                    <option value="PAIR">PAIR (Pairs)</option>
                    <option value="PRS">PRS (Pairs)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Quality Verification / اعتماد البيانات:
                  </label>
                  <label className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVerified}
                      onChange={(e) => setIsVerified(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-cyan-500"
                    />
                    <span className="text-xs text-slate-200">
                      Mark as Verified (تمت مراجعة ومطابقة البيانات)
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Image URL / رابط صورة المنتج:
                </label>
                <input
                  type="text"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Technical Specifications & Description / الوصف الفني:
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                />
              </div>
            </div>
          ) : (
            /* ================= VIEW MODE ================= */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Image */}
                <div className="relative aspect-square rounded-xl bg-slate-800/80 border border-slate-700/80 overflow-hidden flex items-center justify-center group">
                  {product.image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div
                        style={{ display: "none" }}
                        className="flex-col items-center justify-center text-slate-500 p-6 text-center"
                      >
                        <Package className="w-12 h-12 mb-2 text-slate-600" />
                        <span className="text-xs">Image unavailable</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <Package className="w-12 h-12 mb-2 text-slate-600" />
                      <span className="text-xs">No direct image URL captured</span>
                    </div>
                  )}

                  {/* Image Context Tag */}
                  {product.image_url && !product.image_url.includes(product.impa_code) ? (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/90 border border-amber-500/50 rounded-lg px-3 py-1.5 backdrop-blur-md text-center shadow-lg">
                      <span className="text-xs text-amber-300 font-semibold flex items-center justify-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        صورة تمثيلية للمجموعة (ShipServ Group Photo)
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Official IMPA catalogue family image for this item group
                      </span>
                    </div>
                  ) : product.image_url ? (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/90 border border-emerald-500/50 rounded-lg px-3 py-1.5 backdrop-blur-md text-center shadow-lg">
                      <span className="text-xs text-emerald-300 font-semibold">
                        صورة المنتج الأصلية المطابقة لكود IMPA
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Product Core Specs */}
                <div className="flex flex-col justify-between space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Category {product.category_code}
                    </div>
                    <h2 className="text-xl font-bold text-white leading-snug">
                      {product.product_name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {product.category_name}
                    </p>

                    {/* Quick copy IMPA action */}
                    <div className="mt-4 flex items-center space-x-2">
                      <button
                        onClick={handleCopyCode}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium flex items-center space-x-1.5 transition-all active:scale-95"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied IMPA</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Copy IMPA Code</span>
                          </>
                        )}
                      </button>

                      {product.source_url && (
                        <a
                          href={product.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium flex items-center space-x-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Verify on ShipServ</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Description preview */}
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      Technical Description
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto">
                      {product.description || "No full description provided."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Odoo ERP Ready Fields Mapping */}
              <div className="rounded-xl bg-slate-950/80 border border-cyan-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Odoo ERP Import Mapping Preview</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Model: product.template
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Internal Reference:</span>
                    <span className="font-mono font-bold text-white">{product.impa_code}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Unit of Measure:</span>
                    <span className="font-semibold text-emerald-400">{product.uom}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Product Type:</span>
                    <span className="font-semibold text-cyan-400">Consumable / Storable</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Sale & Purchase:</span>
                    <span className="font-semibold text-indigo-400">Enabled (True)</span>
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 block">Odoo Hierarchy Category:</span>
                  <span className="font-medium text-slate-200">{formattedCategory}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Scraped at: {new Date(product.scraped_at).toLocaleString()}</span>
          <div className="flex items-center space-x-3">
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold flex items-center space-x-1.5 transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Changes / حفظ التعديلات"}</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
