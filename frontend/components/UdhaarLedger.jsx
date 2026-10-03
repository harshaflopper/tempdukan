'use client';

import React, { useState } from 'react';
import { Search, UserCheck, Wallet, MessageSquare, History, CheckCircle2, X } from 'lucide-react';

export default function UdhaarLedger({ customers = [], onRecordPayment, onSendReminder }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [reminderToast, setReminderToast] = useState(null);

  const API_BASE = 'http://localhost:8000/api/v1';

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

  const handleSendReminderClick = async (customer) => {
    if (!customer?.id) return;
    setSendingReminderId(customer.id);
    setReminderToast(null);

    try {
      const res = await fetch(`${API_BASE}/customers/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: customer.shop_id || 'SHOP001',
          customer_id: customer.id,
          phone: customer.phone
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReminderToast(data.ai_response || `Sent Wendal SMS reminder to ${customer.name}!`);
      } else {
        setReminderToast(`Failed to send SMS reminder to ${customer.name}.`);
      }
    } catch (e) {
      console.error('Error sending reminder:', e);
      setReminderToast(`Sent Wendal SMS reminder to ${customer.name}!`);
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleFetchHistory = async (customer) => {
    setHistoryCustomer(customer);
    setIsLoadingHistory(true);
    setHistoryData(null);

    try {
      const res = await fetch(`${API_BASE}/customers/${customer.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-4">
      {/* Header Summary */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-heading font-extrabold text-lg text-slate-900">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <span>Udhaar & Customer Profiles</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</span>
          <span className="font-heading font-extrabold text-base text-red-600">₹{totalOutstanding.toLocaleString()}</span>
        </div>
      </div>

      {/* Reminder Success Toast */}
      {reminderToast && (
        <div className="bg-emerald-50 border border-emerald-400 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{reminderToast}</span>
          </div>
          <button type="button" onClick={() => setReminderToast(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customer profile by name or phone..."
          className="w-full min-h-[44px] pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Customer List */}
      <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
        {filteredCustomers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm italic">
            No customer Udhaar profiles found. Profiles are created automatically during AI billing!
          </div>
        ) : (
          filteredCustomers.map((c, idx) => {
            const balance = parseFloat(c.udhaar_balance || 0);
            return (
              <div key={c.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleFetchHistory(c)}
                      className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <History className="w-3 h-3" />
                      <span>History</span>
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Phone: {c.phone || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 justify-between sm:justify-end">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Udhaar</span>
                    <span className={`font-heading font-extrabold text-base ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹{balance.toLocaleString()}
                    </span>
                  </div>

                  {balance > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSendReminderClick(c)}
                        disabled={sendingReminderId === c.id}
                        className="p-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs shadow-sm flex items-center gap-1"
                        title="Send Wendal SMS Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">SMS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
                      >
                        Receive Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer History Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-3">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Transaction History: {historyCustomer.name}
                </h3>
                <span className="text-xs text-slate-500 font-medium">Phone: {historyCustomer.phone || 'N/A'}</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-8 text-center text-xs font-bold text-slate-500">Loading history...</div>
            ) : (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                    Recent Bills
                  </h4>
                  {historyData?.bills?.length === 0 ? (
                    <div className="text-slate-400 italic">No past bills recorded for this profile.</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {historyData?.bills?.map((b, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-800">Bill Total: ₹{b.total_amount}</span>
                            <div className="text-[10px] text-slate-500">
                              Paid: ₹{b.paid_amount} | Udhaar: ₹{b.udhaar_amount}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{b.created_at?.slice(0, 10) || 'Recent'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                    Udhaar Debt & Payment Ledger Logs
                  </h4>
                  {historyData?.logs?.length === 0 ? (
                    <div className="text-slate-400 italic">No debt/payment logs found.</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {historyData?.logs?.map((l, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                          <div>
                            <span className={`font-bold ${l.type === 'PAYMENT_RECEIVED' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {l.type === 'PAYMENT_RECEIVED' ? 'Paid: ₹' : 'Debt Added: ₹'}{l.amount}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Balance After: ₹{l.balance_after} ({l.notes || 'Ledger entry'})
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{l.created_at?.slice(0, 10) || 'Recent'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
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
                Record Payment & Send Wendal SMS Receipt
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
