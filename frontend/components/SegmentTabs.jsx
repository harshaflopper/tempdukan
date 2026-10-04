import React from 'react';
import { PackagePlus, Receipt, Package, UserCheck, TrendingUp } from 'lucide-react';

export default function SegmentTabs({ activeTab, setActiveTab }) {
  return (
    <nav className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 gap-1">
      <button
        type="button"
        onClick={() => setActiveTab('add_inventory')}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all ${
          activeTab === 'add_inventory'
            ? 'bg-blue-900 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 font-bold'
        }`}
      >
        <PackagePlus className="w-4 h-4" />
        <span>Add Inventory</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('ai_bill')}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all ${
          activeTab === 'ai_bill'
            ? 'bg-blue-900 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 font-bold'
        }`}
      >
        <Receipt className="w-4 h-4" />
        <span>AI Bill</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('inventory')}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all ${
          activeTab === 'inventory'
            ? 'bg-blue-900 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 font-bold'
        }`}
      >
        <Package className="w-4 h-4" />
        <span>Inventory</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('udhaar')}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all ${
          activeTab === 'udhaar'
            ? 'bg-blue-900 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 font-bold'
        }`}
      >
        <UserCheck className="w-4 h-4" />
        <span>Udhaar Khata</span>
      </button>
    </nav>
  );
}
