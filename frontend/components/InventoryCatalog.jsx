'use client';

import React, { useState } from 'react';
import { Search, Plus, Minus, Package, AlertTriangle, Calendar, Sparkles } from 'lucide-react';
import ExpiryAlertBanner from './ExpiryAlertBanner';

export default function InventoryCatalog({ products = [], onUpdateStock, expiryData, onOpenExpiryModal }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode || '').includes(searchQuery)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-4">
      {/* Expiry Alert Banner */}
      {expiryData && (
        <ExpiryAlertBanner expiryData={expiryData} onOpenExpiryModal={onOpenExpiryModal} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-slate-900 font-heading font-bold text-lg">
          <Package className="w-5 h-5 text-emerald-600" />
          <h2>Shop Inventory Catalog</h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenExpiryModal && (
            <button
              type="button"
              onClick={onOpenExpiryModal}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs flex items-center gap-1.5 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Expiry Clearance</span>
            </button>
          )}
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-extrabold">
            {products.length} Items Sync Live
          </span>
        </div>
      </div>

          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name..."
              className="w-full min-h-[44px] pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm italic">
                No items in shop inventory catalog yet. Take a snap in the AI Camera tab!
              </div>
            ) : (
              filteredProducts.map((p, idx) => {
                const isLowStock = parseFloat(p.quantity) <= 3;
                return (
                  <div key={p.id || idx} className={`flex items-center justify-between p-3.5 bg-slate-50 border rounded-xl transition-all ${
                    isLowStock ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                  }`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{p.name}</span>
                        {isLowStock && (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock ({p.quantity})
                          </span>
                        )}
                        {p.expiry_date && (
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">
                            Exp: {p.expiry_date}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        Stock: <strong className="text-slate-900">{p.quantity} {p.unit || 'units'}</strong> | Price: <strong className="text-emerald-700">₹{p.selling_price}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {/* Quick Sale (-1) */}
                        <button
                          type="button"
                          title="Quick Bikri (-1)"
                          onClick={() => onUpdateStock && onUpdateStock(p.id, Math.max(0, parseFloat(p.quantity) - 1))}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-extrabold flex items-center justify-center text-sm border border-red-200"
                        >
                          -1
                        </button>

                        <span className="text-xs font-extrabold text-slate-900 px-1 text-center min-w-[24px]">
                          {p.quantity}
                        </span>

                        {/* Quick Restock (+1) */}
                        <button
                          type="button"
                          title="Quick Restock (+1)"
                          onClick={() => onUpdateStock && onUpdateStock(p.id, parseFloat(p.quantity) + 1)}
                          className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-sm border border-emerald-200"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
    </div>
  );
}
