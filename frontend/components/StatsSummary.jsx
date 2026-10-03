import React from 'react';

export default function StatsSummary({ totalItems = 0, stockValue = 0, matchedCount = 0 }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Items</span>
        <span className="font-heading font-extrabold text-lg text-slate-900 mt-0.5">{totalItems}</span>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock Value</span>
        <span className="font-heading font-extrabold text-lg text-emerald-700 mt-0.5">₹{stockValue.toLocaleString()}</span>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Matched</span>
        <span className="font-heading font-extrabold text-lg text-slate-900 mt-0.5">{matchedCount}</span>
      </div>
    </div>
  );
}
