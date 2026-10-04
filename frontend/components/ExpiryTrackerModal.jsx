'use client';

import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Volume2,
  Tag,
  Check,
  RefreshCw,
  X,
  Package,
  ArrowRight,
  ShoppingBag,
  TrendingDown
} from 'lucide-react';

export default function ExpiryTrackerModal({
  expiryData,
  onClose,
  onApplyDiscount,
  onUpdateStock,
  onRefreshStrategies,
  speakAIVoicePrompt,
  isLoading
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [appliedItemIds, setAppliedItemIds] = useState([]);

  if (!expiryData) return null;

  const { expiring_products = [], critical_count = 0, soon_count = 0, expired_count = 0 } = expiryData;

  const filteredProducts = expiring_products.filter((p) => {
    if (activeFilter === 'CRITICAL') return p.risk_level === 'CRITICAL';
    if (activeFilter === 'SOON') return p.risk_level === 'SOON';
    if (activeFilter === 'EXPIRED') return p.risk_level === 'EXPIRED';
    return true;
  });

  const handleApplyDiscountClick = async (productId, suggestedPrice) => {
    if (onApplyDiscount) {
      await onApplyDiscount(productId, suggestedPrice);
      setAppliedItemIds((prev) => [...prev, productId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border-2 border-amber-500 shadow-2xl">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold border border-white/30">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-xl text-white">
                  AI Expiry Clearance Engine
                </h2>
                <span className="text-[10px] font-bold bg-white text-amber-900 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Gemini Flash 1-Tap
                </span>
              </div>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Clear expiring stock before waste with AI clearance pricing & placement strategies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshStrategies}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-white/20"
              title="Refresh AI Strategies"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh AI</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* METRICS & RISK LEVEL SUMMARY */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-rose-200 shadow-2xs flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Critical (&lt; 7 Days)</span>
              <span className="text-xl font-extrabold text-rose-900">{critical_count} Items</span>
            </div>
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Soon (&lt; 30 Days)</span>
              <span className="text-xl font-extrabold text-amber-900">{soon_count} Items</span>
            </div>
            <Calendar className="w-6 h-6 text-amber-500" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-red-300 shadow-2xs flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-red-700 uppercase">Expired Items</span>
              <span className="text-xl font-extrabold text-red-900">{expired_count} Items</span>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Expiring Stock</span>
              <span className="text-xl font-extrabold text-emerald-900">{expiring_products.length} Total</span>
            </div>
            <Package className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* FILTER CHIPS */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Expiring ({expiring_products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('CRITICAL')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
              activeFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Critical &lt; 7 Days ({critical_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('SOON')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
              activeFilter === 'SOON'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Soon &lt; 30 Days ({soon_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('EXPIRED')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
              activeFilter === 'EXPIRED'
                ? 'bg-red-700 text-white shadow-sm'
                : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
            }`}
          >
            Expired ({expired_count})
          </button>
        </div>

        {/* PRODUCTS CARDS LIST */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">No items matching this filter</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                All other products in your shop inventory have valid expiry dates or are safe.
              </p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isApplied = appliedItemIds.includes(p.id);
              const isCritical = p.risk_level === 'CRITICAL';
              const isExpired = p.risk_level === 'EXPIRED';
              const isSoon = p.risk_level === 'SOON';

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm flex flex-col gap-3.5 transition-all ${
                    isExpired
                      ? 'border-red-300 bg-red-50/20'
                      : isCritical
                      ? 'border-rose-300 bg-rose-50/20'
                      : 'border-amber-200 bg-amber-50/20'
                  }`}
                >
                  {/* CARD HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-base">{p.name}</span>
                      {p.brand && (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.brand}
                        </span>
                      )}

                      {/* DAYS LEFT BADGE */}
                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                          isExpired
                            ? 'bg-red-700 text-white'
                            : isCritical
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {isExpired
                          ? `Expired (${Math.abs(p.days_left)} Days Ago)`
                          : `Expires in ${p.days_left} Days (${p.formatted_expiry})`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                      <span>Stock: <strong className="text-slate-900">{p.quantity} {p.unit || 'units'}</strong></span>
                      <span>MRP Price: <strong className="text-slate-900">₹{p.selling_price}</strong></span>
                    </div>
                  </div>

                  {/* AI STRATEGY RECOMMENDATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>AI Clearance Strategy: {p.action_title || 'Smart Clearance'}</span>
                      </div>

                      {p.suggested_price && p.suggested_price < p.selling_price && (
                        <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5" />
                          Suggested Price: ₹{p.suggested_price} (Save ₹{roundTo1(p.selling_price - p.suggested_price)} off)
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-snug">
                      {p.recommended_action || 'Display item on front counter and offer early clearance discount.'}
                    </p>

                    {p.combo_idea && (
                      <div className="text-xs font-medium text-amber-900 bg-white/70 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Combo / Freebie Idea: <strong>{p.combo_idea}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 1-TAP APPLY SUGGESTED DISCOUNT */}
                      {p.suggested_price && p.suggested_price > 0 && !isExpired && (
                        <button
                          type="button"
                          disabled={isApplied}
                          onClick={() => handleApplyDiscountClick(p.id, p.suggested_price)}
                          className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                            isApplied
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-4 h-4" /> Price Applied (₹{p.suggested_price})
                            </>
                          ) : (
                            <>
                              <Tag className="w-4 h-4" /> Apply Discount Price (₹{p.suggested_price})
                            </>
                          )}
                        </button>
                      )}

                      {/* SPEAK AI VOICE RECOMMENDATION */}
                      {p.spoken_summary && (
                        <button
                          type="button"
                          onClick={() => speakAIVoicePrompt && speakAIVoicePrompt(p.spoken_summary)}
                          className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs flex items-center gap-1.5 border border-amber-300 transition-all"
                        >
                          <Volume2 className="w-4 h-4 text-amber-700" />
                          <span>Bol ke Suno</span>
                        </button>
                      )}
                    </div>

                    {/* QUICK SALE (-1) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateStock && onUpdateStock(p.id, Math.max(0, parseFloat(p.quantity) - 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1 border border-slate-200"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
                        <span>Quick Sale (-1)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function roundTo1(num) {
  return Math.round(num * 10) / 10;
}
