import React from 'react';
import { Receipt, Package, UserCheck } from 'lucide-react';

export default function SegmentTabs({ activeTab, setActiveTab }) {
  return (
    <nav className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
      <button
        type="button"
        onClick={() => setActiveTab('onboard')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
          activeTab === 'onboard'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900 font-bold'
        }`}
      >
        <Receipt className="w-4 h-4" />
        <span>AI Bill & Snap</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('inventory')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
          activeTab === 'inventory'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900 font-bold'
        }`}
      >
        <Package className="w-4 h-4" />
        <span>Inventory</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('udhaar')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
          activeTab === 'udhaar'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900 font-bold'
        }`}
      >
        <UserCheck className="w-4 h-4" />
        <span>Udhaar Khata</span>
      </button>
    </nav>
  );
}
