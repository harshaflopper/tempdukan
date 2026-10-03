'use client';

import React, { useState } from 'react';
import { Search, Plus, Minus, Package, Trash2 } from 'lucide-react';

export default function InventoryCatalog({ products = [], onUpdateStock, onDeleteProduct }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode || '').includes(searchQuery)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 font-heading font-bold text-lg">
          <Package className="w-5 h-5 text-emerald-600" />
          <h2>Shop Inventory Catalog</h2>
        </div>
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
          {products.length} Items
        </span>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by product name, barcode..."
          className="w-full min-h-[44px] pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {filteredProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm italic">
            No items in catalog yet. Scan a product using the AI Camera tab!
          </div>
        ) : (
          filteredProducts.map((p, idx) => (
            <div key={p.id || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900">{p.name}</span>
                  {p.expiry_date && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      Exp: {p.expiry_date}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Barcode: <code className="font-mono text-slate-700">{p.barcode || 'N/A'}</code>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-heading font-extrabold text-base text-emerald-700">₹{p.selling_price}</span>

                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => onUpdateStock && onUpdateStock(p.id, Math.max(0, p.quantity - 1))}
                    className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-700"
                  >
                    -
                  </button>
                  <span className="text-xs font-bold text-slate-900 w-6 text-center">{p.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateStock && onUpdateStock(p.id, p.quantity + 1)}
                    className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
