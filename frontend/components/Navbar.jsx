import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function Navbar({ shopId = "SHOP001" }) {
  return (
    <header className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-emerald-glow">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-heading font-extrabold text-xl text-slate-900 leading-tight">LastDukan</h1>
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Gemini 2.5 Flash & Groq AI</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>{shopId}</span>
      </div>
    </header>
  );
}
