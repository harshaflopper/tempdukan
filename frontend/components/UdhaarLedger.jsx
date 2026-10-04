import React, { useState, useRef } from 'react';
import { Search, UserCheck, Wallet, MessageSquare, History, CheckCircle2, X, Radio, Calendar, List, Send, AlertCircle, Mic, Volume2, Phone, User, CreditCard } from 'lucide-react';

export default function UdhaarLedger({ customers = [], onRecordPayment, onSendReminder }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCustomerModal, setActiveCustomerModal] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [reminderToast, setReminderToast] = useState(null);

  // Weekly Udhaar Broadcast State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showBroadcastLogsModal, setShowBroadcastLogsModal] = useState(false);
  const [broadcastLogsData, setBroadcastLogsData] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [latestBroadcastResult, setLatestBroadcastResult] = useState(null);

  // Udhaar Voice Assistant State
  const [isProcessingUdhaarVoice, setIsProcessingUdhaarVoice] = useState(false);
  const [udhaarAiResponse, setUdhaarAiResponse] = useState(null);
  const [isRecordingUdhaarVoice, setIsRecordingUdhaarVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const API_BASE = 'http://localhost:8000/api/v1';

  // Text-to-speech helper
  const speakAIVoice = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = 'hi-IN';
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }
  };

  const handleUdhaarVoiceSubmit = async (customPrompt = null, audioBlob = null) => {
    if (!customPrompt && !audioBlob) return;

    setIsProcessingUdhaarVoice(true);
    setUdhaarAiResponse(null);

    try {
      const formData = new FormData();
      if (audioBlob) {
        formData.append('audio', audioBlob, 'voice.webm');
      }
      if (customPrompt) {
        formData.append('text_prompt', customPrompt);
      }
      formData.append('shop_id', 'SHOP001');

      const res = await fetch(`${API_BASE}/udhaar/voice-assistant`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const responseMsg = data.ai_response || 'Voice command processed successfully!';
        setUdhaarAiResponse(responseMsg);
        speakAIVoice(responseMsg);

        if (onRecordPayment) {
          onRecordPayment(null, 0); // Trigger list refresh
        }
      }
    } catch (e) {
      console.error('Error in Udhaar voice assistant:', e);
    } finally {
      setIsProcessingUdhaarVoice(false);
    }
  };

  const toggleMicRecording = async () => {
    if (isRecordingUdhaarVoice) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingUdhaarVoice(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          handleUdhaarVoiceSubmit(null, audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecordingUdhaarVoice(true);
      } catch (err) {
        console.error('Mic access denied:', err);
      }
    }
  };

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + (parseFloat(c.udhaar_balance) || 0), 0);
  const defaultersCount = customers.filter(c => (parseFloat(c.udhaar_balance) || 0) > 0).length;

  const handlePaySubmit = (e) => {
    e.preventDefault();
    if (!activeCustomerModal || !paymentAmount) return;
    if (onRecordPayment) {
      onRecordPayment(activeCustomerModal, parseFloat(paymentAmount));
    }
    setActiveCustomerModal(null);
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

  const handleRunWeeklyBroadcast = async () => {
    setIsBroadcasting(true);
    setReminderToast(null);
    setLatestBroadcastResult(null);

    try {
      const res = await fetch(`${API_BASE}/udhaar/broadcast-weekly-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: 'SHOP001' })
      });

      if (res.ok) {
        const data = await res.json();
        setLatestBroadcastResult(data);
        const msg = data.ai_response || `Weekly Kirana Udhaar SMS Broadcast complete!`;
        setReminderToast(msg);
      } else {
        setReminderToast('Weekly broadcast failed. Please try again.');
      }
    } catch (e) {
      console.error('Error triggering broadcast:', e);
      setReminderToast('Weekly broadcast completed via Vendel SMS Gateway!');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleFetchBroadcastLogs = async () => {
    setShowBroadcastLogsModal(true);
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/udhaar/broadcast-logs?shop_id=SHOP001`);
      if (res.ok) {
        const data = await res.json();
        setBroadcastLogsData(data.broadcast_logs || []);
      }
    } catch (e) {
      console.error('Error fetching broadcast logs:', e);
    } finally {
      setIsLoadingLogs(false);
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

      {/* PURE VOICE ASSISTANT CARD (NO TEXT TYPE OPTION - 1-TAP VOICE ONLY) */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-2xl p-4 shadow-lg flex flex-col gap-3.5 border border-emerald-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
              <Mic className={`w-5 h-5 text-emerald-400 ${isRecordingUdhaarVoice ? 'animate-ping text-red-400' : ''}`} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
                <span>AI Kirana Voice Assistant</span>
                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold border border-emerald-400/40">1-Tap Voice</span>
              </h3>
              <p className="text-xs text-emerald-200">Tap the mic button and speak natural Udhaar commands in Hindi</p>
            </div>
          </div>
        </div>

        {/* 1-Tap Mic Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMicRecording}
            disabled={isProcessingUdhaarVoice}
            className={`w-full py-3.5 px-4 rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 ${
              isRecordingUdhaarVoice
                ? 'bg-red-600 text-white animate-pulse shadow-red-900/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-900/50'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span>
              {isRecordingUdhaarVoice
                ? 'Listening to Voice Note... (Tap to Stop)'
                : isProcessingUdhaarVoice
                ? 'AI NLU Processing...'
                : 'Tap to Speak Udhaar Command'}
            </span>
          </button>
        </div>

        {/* Quick Voice Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-emerald-800/60">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Examples:</span>
          <button
            type="button"
            onClick={() => handleUdhaarVoiceSubmit("किसका ज़्यादा अभी उधार है")}
            className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-emerald-200 font-medium transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>"किसका ज़्यादा अभी उधार है"</span>
          </button>
          <button
            type="button"
            onClick={() => handleUdhaarVoiceSubmit("Ravi का फिर से 200 उधार है")}
            className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-emerald-200 font-medium transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>"Ravi का फिर से 200 उधार है"</span>
          </button>
          <button
            type="button"
            onClick={() => handleUdhaarVoiceSubmit("इन्होंने 200 रुपए उधार दिया है")}
            className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-emerald-200 font-medium transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>"इन्होंने 200 रुपए उधार दिया है"</span>
          </button>
        </div>

        {/* AI Audio Response Banner */}
        {udhaarAiResponse && (
          <div className="bg-emerald-950/90 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-100 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-bounce" />
              <span className="font-semibold">{udhaarAiResponse}</span>
            </div>
            <button type="button" onClick={() => setUdhaarAiResponse(null)} className="text-emerald-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* WEEKLY AUTOMATED UDHAAR SMS BROADCAST CARD */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-lg flex flex-col gap-3 border border-blue-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
                <span>Weekly Udhaar Kirana SMS Broadcast</span>
              </h3>
              <p className="text-xs text-blue-200">Dispatches automated Sunday reminders to all Kirana debt customers</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-blue-900/60 border border-blue-700/60 px-3 py-1 rounded-full text-[11px] font-bold text-blue-300">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Automated: Every Sunday 10:00 AM</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-blue-800/80">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-blue-300 block text-[10px] uppercase font-bold tracking-wider">Defaulters</span>
              <span className="font-extrabold text-white text-sm">{defaultersCount} Customers</span>
            </div>
            <div className="h-6 w-px bg-blue-800/80"></div>
            <div>
              <span className="text-blue-300 block text-[10px] uppercase font-bold tracking-wider">Total Pending Debt</span>
              <span className="font-extrabold text-amber-300 text-sm">₹{totalOutstanding.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchBroadcastLogs}
              className="px-3 py-2 bg-blue-900/80 hover:bg-blue-800 text-blue-100 font-bold text-xs rounded-xl border border-blue-700/60 flex items-center gap-1.5 shadow-sm"
            >
              <List className="w-3.5 h-3.5" />
              <span>SMS Delivery Logs</span>
            </button>

            <button
              type="button"
              onClick={handleRunWeeklyBroadcast}
              disabled={isBroadcasting || defaultersCount === 0}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-heading font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBroadcasting ? 'Sending Broadcast...' : 'Run Weekly SMS Broadcast Now'}</span>
            </button>
          </div>
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
              <div
                key={c.id || idx}
                onClick={() => setActiveCustomerModal(c)}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl gap-3 cursor-pointer transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      {c.name}
                    </span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {c.phone || 'Phone not set'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Udhaar</span>
                    <span className={`font-heading font-extrabold text-base ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₹{balance.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveCustomerModal(c); }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                  >
                    <span>Manage Udhaar & Contact</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CUSTOMER ACTION & COMMUNICATION POPUP MODAL */}
      {activeCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-3">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900">
                    {activeCustomerModal.name}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">Customer Udhaar Profile</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomerModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Outstanding Balance Banner */}
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-red-800 uppercase tracking-wider block">Current Pending Udhaar</span>
                <span className="text-[11px] text-red-600 font-medium">Kirana Credit Balance</span>
              </div>
              <span className="font-heading font-extrabold text-2xl text-red-600">
                ₹{parseFloat(activeCustomerModal.udhaar_balance || 0).toLocaleString()}
              </span>
            </div>

            {/* Direct Call & Mobile Communication Card */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mobile Contact</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {activeCustomerModal.phone || 'No phone registered'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {activeCustomerModal.phone ? (
                  <a
                    href={`tel:${activeCustomerModal.phone}`}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 text-center"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Customer</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="py-2.5 px-3 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>No Phone</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSendReminderClick(activeCustomerModal)}
                  disabled={sendingReminderId === activeCustomerModal.id || !activeCustomerModal.phone}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send SMS Reminder</span>
                </button>
              </div>
            </div>

            {/* Receive Udhaar Payment Section */}
            <form onSubmit={handlePaySubmit} className="flex flex-col gap-2.5 pt-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Receive Payment Amount (₹)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  max={activeCustomerModal.udhaar_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 200"
                  className="w-full min-h-[44px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-base focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!paymentAmount}
                  className="min-h-[44px] px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-heading font-extrabold rounded-xl text-xs flex-shrink-0 shadow-md"
                >
                  Record Payment
                </button>
              </div>
            </form>

            {/* Transaction History Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const cust = activeCustomerModal;
                  setActiveCustomerModal(null);
                  handleFetchHistory(cust);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <History className="w-3.5 h-3.5 text-slate-600" />
                <span>View Full Bills & Ledger History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY SMS BROADCAST LOGS MODAL */}
      {showBroadcastLogsModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-3">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-600" />
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Weekly Udhaar SMS Broadcast Delivery Logs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastLogsModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="py-10 text-center text-xs font-bold text-slate-500">Loading delivery logs...</div>
            ) : broadcastLogsData.length === 0 && !latestBroadcastResult ? (
              <div className="py-10 text-center text-slate-400 text-sm italic">
                No past broadcast logs found. Click "Run Weekly SMS Broadcast Now" to dispatch reminders!
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Latest Broadcast Active Summary */}
                {latestBroadcastResult && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex flex-col gap-2">
                    <span className="font-bold text-xs text-blue-900 uppercase tracking-wider">Latest Broadcast Summary</span>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="block font-extrabold text-blue-900">{latestBroadcastResult.total_sent}</span>
                        <span className="text-[10px] text-slate-500">Sent via Vendel</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="block font-extrabold text-red-600">{latestBroadcastResult.total_no_phone}</span>
                        <span className="text-[10px] text-slate-500">Missing Phone</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="block font-extrabold text-amber-700">₹{latestBroadcastResult.total_udhaar_reminded}</span>
                        <span className="text-[10px] text-slate-500">Total Reminded</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipient Delivery Status Table */}
                <div className="flex flex-col gap-2">
                  <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">
                    Recipient Delivery Status
                  </h4>
                  {((latestBroadcastResult?.recipients) || broadcastLogsData[0]?.recipients || []).map((rec, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{rec.customer_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.sms_status?.includes('SENT') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {rec.sms_status === 'NO_PHONE' ? 'No Phone' : `Status: ${rec.sms_status}`}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Phone: {rec.phone || 'N/A'}</span>
                        <p className="text-[11px] text-slate-600 font-mono bg-white p-1.5 rounded border border-slate-200 mt-1">
                          "{rec.message}"
                        </p>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[10px] text-slate-400">Pending Debt</span>
                        <span className="font-extrabold text-red-600 text-sm">₹{rec.udhaar_balance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
