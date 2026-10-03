'use client';

import React, { useState } from 'react';
import { Search, UserCheck, Wallet, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function UdhaarLedger({ customers = [], onRecordPayment }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + (parseFloat(c.udhaar_balance) || 0), 0);

  const handlePaySubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    if (onRecordPayment) {
      onRecordPayment(selectedCustomer, parseFloat(paymentAmount));
    }
    setSelectedCustomer(null);
    setPaymentAmount('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-4">
      {/* Header Summary */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-heading font-extrabold text-lg text-slate-900">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <span>Udhaar & Customer Ledger</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</span>
          <span className="font-heading font-extrabold text-base text-red-600">₹{totalOutstanding.toLocaleString()}</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customer by name or phone..."
          className="w-full min-h-[44px] pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Customer List */}
      <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
        {filteredCustomers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm italic">
            No customer Udhaar records found. Customers will be added automatically when billing!
          </div>
        ) : (
          filteredCustomers.map((c, idx) => {
            const balance = parseFloat(c.udhaar_balance || 0);
            return (
              <div key={c.id || idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm text-slate-900">{c.name}</span>
                  <span className="text-xs text-slate-500 font-medium">
                    Phone: {c.phone || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Udhaar</span>
                    <span className={`font-heading font-extrabold text-base ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹{balance.toLocaleString()}
                    </span>
                  </div>

                  {balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(c)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
                    >
                      Receive Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Receive Payment Modal / Modal Sheet */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-3">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-heading font-bold text-base text-slate-900">
                Receive Udhaar Payment
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-900">Customer: {selectedCustomer.name}</span>
              <span className="text-xs text-amber-800">
                Current Udhaar Balance: <strong>₹{selectedCustomer.udhaar_balance}</strong>
              </span>
            </div>

            <form onSubmit={handlePaySubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Amount Received (₹)</label>
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  max={selectedCustomer.udhaar_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount e.g. 500"
                  className="w-full min-h-[44px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-base"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold rounded-xl text-base shadow-emerald-glow"
              >
                Record Payment Received
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
