'use client';

import React, { useState } from 'react';
import CameraScanner from './CameraScanner';
import VoiceRecorder from './VoiceRecorder';
import { Sparkles, Camera, Receipt, Volume2, CheckCircle2, Check, Send, User, Phone, MessageSquare, Tag, Wallet, AlertCircle, ArrowRight } from 'lucide-react';

export default function AIBillWindow({
  videoRef,
  canvasRef,
  workflowStep,
  capturedPhotoUrl,
  recordedAudioBlob,
  setRecordedAudioBlob,
  handleTakeSnap,
  handleAnalyzeProduct,
  handleResetToCamera,
  successToast,
  generatedBill,
  setGeneratedBill,
  speakAIVoicePrompt,
  isSubmitting,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  sendSms,
  setSendSms,
  discountAmount,
  setDiscountAmount,
  customUdhaarAmount,
  setCustomUdhaarAmount,
  existingCustomers = []
}) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showUdhaarInput, setShowUdhaarInput] = useState(false);

  const isCustomerInDb = existingCustomers.some(c =>
    (c.name || '').toLowerCase() === (customerName || '').trim().toLowerCase() ||
    (c.phone && c.phone === customerPhone)
  );

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {/* Window Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-4 rounded-2xl border border-emerald-700 shadow-md flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading font-extrabold text-base">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span>AI Voice Billing & Vendal SMS Window</span>
          </div>
          <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-700">
            Vendal Automated SMS
          </span>
        </div>
        <p className="text-xs text-emerald-200 font-medium">
          Record voice note (e.g. "Ravi ji das box tiktak") or snap photo to automatically generate bill, update stock & sync Udhaar.
        </p>
      </div>

      {/* VOICE RECORDING SECTION (NO TYPING FOR DUKANDAR) */}
      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-soft-lg flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
            Speak Spoken Bill (Voice Only)
          </span>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Hindi / Hinglish Voice LLM
          </span>
        </div>

        <VoiceRecorder onAudioRecorded={(blob) => setRecordedAudioBlob(blob)} />

        {recordedAudioBlob && (
          <button
            type="button"
            onClick={handleAnalyzeProduct}
            disabled={isSubmitting}
            className="w-full min-h-[50px] mt-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2 shadow-emerald-glow disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI Matching Inventory & Products...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>Process Spoken Voice Bill</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* NEW CUSTOMER MOBILE NUMBER PROMPT BANNER */}
      {customerName && customerName.trim() && !isCustomerInDb && (!customerPhone || !customerPhone.trim()) && (
        <div className="bg-amber-50 border-2 border-amber-400 p-3.5 rounded-2xl flex flex-col gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>New Customer Detected: '{customerName}'</span>
          </div>
          <p className="text-xs text-amber-800 font-medium">
            Enter mobile number for {customerName} to send Vendal SMS bill & save Udhaar profile:
          </p>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="tel"
              value={customerPhone || ''}
              onChange={(e) => setCustomerPhone && setCustomerPhone(e.target.value)}
              placeholder="Enter Mobile Number (e.g. 9876543210)"
              className="w-full pl-8 pr-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>
      )}

      {/* BIG ACTION BUTTONS: DISCOUNT & UDHAAR ADJUSTERS */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between px-1">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
            Billing & Settlement Options
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-800 select-none">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-600 rounded"
            />
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Send Vendal SMS</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className={`py-3 px-3 rounded-xl border font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
              discountAmount || showDiscountInput
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>{discountAmount ? `Discount: ₹${discountAmount}` : 'Add Discount (Chhut)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUdhaarInput(!showUdhaarInput)}
            className={`py-3 px-3 rounded-xl border font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
              customUdhaarAmount || showUdhaarInput
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{customUdhaarAmount ? `Udhaar: ₹${customUdhaarAmount}` : 'Mark Udhaar (Khata)'}</span>
          </button>
        </div>

        {/* Conditional Discount Input Box */}
        {showDiscountInput && (
          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 animate-in fade-in">
            <Tag className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <input
              type="number"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount && setDiscountAmount(e.target.value)}
              placeholder="Enter Discount Amount (₹)"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>
        )}

        {/* Conditional Udhaar Input Box */}
        {showUdhaarInput && (
          <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center gap-2 animate-in fade-in">
            <Wallet className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <input
              type="number"
              value={customUdhaarAmount || ''}
              onChange={(e) => setCustomUdhaarAmount && setCustomUdhaarAmount(e.target.value)}
              placeholder="Enter Udhaar Amount (₹)"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-amber-600"
            />
          </div>
        )}
      </div>

      {/* CAMERA SNAP SECTION FOR VISUAL BILLING */}
      {workflowStep === 'camera' && (
        <div className="flex flex-col gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-slate-700">Camera Product Snap</span>
            <span className="text-[10px] font-bold text-slate-400">Point at item</span>
          </div>

          <CameraScanner videoRef={videoRef} canvasRef={canvasRef} />

          <button
            type="button"
            onClick={handleTakeSnap}
            className="w-full min-h-[54px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-emerald-glow transition-all active:scale-[0.99]"
          >
            <Camera className="w-5 h-5 text-white" />
            <span>Snap Photo for AI Bill</span>
          </button>
        </div>
      )}

      {/* PHOTO SNAPPED PREVIEW & AI PROCESS BUTTON */}
      {(workflowStep === 'snapped' || workflowStep === 'analyzing') && (
        <div className="flex flex-col gap-3 bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-md">
          {capturedPhotoUrl && (
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex-shrink-0">
                <img src={capturedPhotoUrl} alt="Snapped Product" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center gap-0.5">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Product Frame Captured</span>
                <span className="text-xs text-slate-600 font-medium">Ready for AI Vision Matching & Billing</span>
                <button
                  type="button"
                  onClick={handleResetToCamera}
                  className="text-xs font-bold text-slate-500 hover:text-emerald-700 text-left underline mt-1"
                >
                  Retake Photo
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyzeProduct}
            disabled={workflowStep === 'analyzing'}
            className="w-full min-h-[54px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2 shadow-emerald-glow disabled:opacity-50 transition-all active:scale-[0.99]"
          >
            {workflowStep === 'analyzing' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing AI Bill & Deducting Stock...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>{recordedAudioBlob ? 'Process Photo + Spoken Voice Bill' : 'Analyze Photo & Generate Bill'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* LIVE SUCCESS TOAST */}
      {successToast && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 font-bold text-sm shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* DIGITAL BILL RECEIPT CARD */}
      {generatedBill && (
        <div className="bg-white rounded-2xl border-2 border-emerald-600 p-4 shadow-md flex flex-col gap-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold font-heading text-base">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <span>Kirana Digital Receipt</span>
            </div>
            <div className="flex items-center gap-2">
              {generatedBill.sms_status && (
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>Vendal SMS: {generatedBill.sms_status}</span>
                </span>
              )}
              <span className="text-xs font-bold text-slate-500 font-mono">
                {generatedBill.bill_id || 'BILL-NEW'}
              </span>
            </div>
          </div>

          {(generatedBill.customer || generatedBill.customer_name) && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-slate-800">
                  {generatedBill.customer?.name || generatedBill.customer_name}
                </span>
                {(generatedBill.customer?.phone || customerPhone) && (
                  <span className="text-slate-500 ml-2">
                    ({generatedBill.customer?.phone || customerPhone})
                  </span>
                )}
              </div>
              <div className="font-bold text-emerald-700">
                {generatedBill.udhaar_amount > 0 ? (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Udhaar Added: ₹{generatedBill.udhaar_amount}
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Paid in Full (Nagad)
                  </span>
                )}
              </div>
            </div>
          )}

          {generatedBill.items && generatedBill.items.length > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              <div className="grid grid-cols-12 font-bold text-slate-500 border-b border-slate-100 pb-1">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {generatedBill.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 font-medium text-slate-800 py-1 border-b border-slate-50">
                  <span className="col-span-6 font-bold truncate">{item.product_name || item.name}</span>
                  <span className="col-span-2 text-center text-slate-600">{item.quantity} {item.unit || 'pkt'}</span>
                  <span className="col-span-2 text-right text-slate-600">₹{item.unit_price || item.rate || 0}</span>
                  <span className="col-span-2 text-right font-extrabold text-slate-900">₹{item.total_price || item.item_total || 0}</span>
                </div>
              ))}
            </div>
          )}

          {generatedBill.discount_amount > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
              <span>Discount Applied</span>
              <span>- ₹{generatedBill.discount_amount}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-extrabold text-slate-900 text-sm">
            <span>Grand Total (Net Amount)</span>
            <span className="text-emerald-700 text-lg">₹{generatedBill.total_amount || 0}</span>
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setGeneratedBill(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Close Receipt</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
