'use client';

import React from 'react';
import { Calendar, ShieldAlert, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function ExpiryAlertBanner({ expiryData, onOpenExpiryModal }) {
  if (!expiryData) return null;

  const { status, banner_message, critical_count, soon_count, expired_count } = expiryData;
  const isDanger = status === 'CRITICAL' || expired_count > 0;
  const isWarning = status === 'WARNING';
  const isSafe = status === 'SAFE';

  return (
    <div
      onClick={onOpenExpiryModal}
      className={`cursor-pointer rounded-2xl p-4 border shadow-sm transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        isDanger
          ? 'bg-rose-50 border-rose-200 hover:border-rose-400 hover:shadow-md'
          : isWarning
          ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md'
          : 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
            isDanger
              ? 'bg-rose-600 text-white'
              : isWarning
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {isDanger ? (
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          ) : isWarning ? (
            <Calendar className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                isDanger
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : isWarning
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {isDanger ? 'Critical Expiry Alert' : isWarning ? 'Expiry Strategy Warning' : 'Inventory Fresh'}
            </span>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> AI Expiry Tracker
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800 mt-1">
            {banner_message || 'Smart Expiry Tracking Active'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenExpiryModal();
          }}
          className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
            isDanger
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : isWarning
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <span>AI Clearance Strategy</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
