import React from 'react';
import { Camera, Package } from 'lucide-react';

export default function SegmentTabs({ activeTab, setActiveTab }) {
  return (
    <nav className="flex bg-slate-150 p-1.5 rounded-xl border border-slate-200 bg-slate-100">
      <button
        type="button"
        onClick={() => setActiveTab('onboard')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
          activeTab === 'onboard'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Camera className="w-4 h-4" />
        <span>AI Camera</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('inventory')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
          activeTab === 'inventory'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Package className="w-4 h-4" />
        <span>Shop Inventory</span>
      </button>
    </nav>
  );
}
