'use client';

import React, { useState, useEffect } from 'react';
import { X, Camera, Check, Tag, Calendar, Barcode } from 'lucide-react';

export default function ConfirmationModal({ isOpen, onClose, onSave, initialData, photoUrl }) {
  const [formData, setFormData] = useState({
    name: '',
    selling_price: 0,
    quantity: 1,
    unit: 'packet',
    expiry_date: '',
    barcode: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        selling_price: initialData.selling_price || 0,
        quantity: initialData.quantity || 1,
        unit: initialData.unit || 'packet',
        expiry_date: initialData.expiry_date || '',
        barcode: initialData.barcode || '',
      });
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handlePriceStep = (delta) => {
    setFormData(prev => ({
      ...prev,
      selling_price: Math.max(0, parseFloat((prev.selling_price + delta).toFixed(2)))
    }));
  };

  const handleQtyStep = (delta) => {
    setFormData(prev => ({
      ...prev,
      quantity: Math.max(1, prev.quantity + delta)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-3">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-heading font-bold text-lg text-slate-900">AI Product Extraction Result</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          <div className="relative w-full h-44 bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Captured Product Photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Camera className="w-8 h-8" />
                <span className="text-xs font-semibold">Product Photo Captured</span>
              </div>
            )}
            <div className="absolute bottom-2.5 left-2.5 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              AI Match Confidence
            </div>
          </div>

          <form id="confirm-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-50 border-1.5 border-slate-200 rounded-lg text-base font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                placeholder="e.g. Tic-Tac Intense Mint"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Price (INR)</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handlePriceStep(-1)}
                    className="w-11 min-h-[48px] bg-slate-100 border-1.5 border-slate-200 border-r-0 rounded-l-lg font-bold text-lg text-slate-800"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[48px] text-center bg-slate-50 border-1.5 border-slate-200 font-bold text-base text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handlePriceStep(1)}
                    className="w-11 min-h-[48px] bg-slate-100 border-1.5 border-slate-200 border-l-0 rounded-r-lg font-bold text-lg text-slate-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleQtyStep(-1)}
                    className="w-11 min-h-[48px] bg-slate-100 border-1.5 border-slate-200 border-r-0 rounded-l-lg font-bold text-lg text-slate-800"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full min-h-[48px] text-center bg-slate-50 border-1.5 border-slate-200 font-bold text-base text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleQtyStep(1)}
                    className="w-11 min-h-[48px] bg-slate-100 border-1.5 border-slate-200 border-l-0 rounded-r-lg font-bold text-lg text-slate-800"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full min-h-[48px] px-3.5 bg-slate-50 border-1.5 border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                >
                  <option value="packet">Packet</option>
                  <option value="piece">Piece</option>
                  <option value="box">Box</option>
                  <option value="kg">Kg</option>
                  <option value="bottle">Bottle</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiry</label>
                <input
                  type="text"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  placeholder="Dec 2026"
                  className="w-full min-h-[48px] px-3.5 bg-slate-50 border-1.5 border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {formData.barcode && formData.barcode !== 'No barcode scanned' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Barcode</label>
                <input
                  type="text"
                  readOnly
                  value={formData.barcode}
                  className="w-full min-h-[44px] px-3.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600"
                />
              </div>
            )}
          </form>
        </div>

        <div className="flex gap-3 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[50px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-heading font-bold text-base"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="confirm-form"
            className="flex-1 min-h-[50px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-heading font-bold text-base shadow-emerald-glow flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            <span>Confirm & Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
