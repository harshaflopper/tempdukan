'use client';

import React, { useState } from 'react';
import CameraScanner from './CameraScanner';
import VoiceRecorder from './VoiceRecorder';
import { Sparkles, Camera, Receipt, Volume2, CheckCircle2, Check, ArrowRight } from 'lucide-react';

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
  onTextBillSubmit,
  isSubmitting
}) {
  const [spokenText, setSpokenText] = useState('');

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!spokenText.trim() || isSubmitting) return;
    if (onTextBillSubmit) {
      onTextBillSubmit(spokenText.trim());
      setSpokenText('');
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {/* Window Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-4 rounded-2xl border border-emerald-700 shadow-md flex flex-col gap-1">
        <div className="flex items-center gap-2 font-heading font-extrabold text-base">
          <Receipt className="w-5 h-5 text-emerald-400" />
          <span>AI Bill & Voice Window</span>
        </div>
        <p className="text-xs text-emerald-200 font-medium">
          Talk directly to AI or snap product photo to automatically generate customer bills & sync inventory.
        </p>
      </div>

      {/* DIRECT VOICE / TEXT INPUT TO AI */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-emerald-500 shadow-soft-lg flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
            Talk or Type Directly to AI
          </span>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Hindi / Hinglish / English
          </span>
        </div>

        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={spokenText}
            onChange={(e) => setSpokenText(e.target.value)}
            placeholder="e.g. 'Ravi took 2 Maggi packets' or 'Suresh paid ₹500'..."
            className="flex-1 min-h-[46px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs shadow-inner focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!spokenText.trim() || isSubmitting}
            className="px-4 min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-emerald-glow disabled:opacity-50 flex-shrink-0"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Create AI Bill</span>
          </button>
        </form>

        {/* Optional Voice Note Recorder */}
        <div className="border-t border-slate-100 pt-2">
          <VoiceRecorder onAudioRecorded={(blob) => setRecordedAudioBlob(blob)} />
        </div>
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
            <span className="text-xs font-bold text-slate-500 font-mono">
              {generatedBill.bill_id || 'BILL-NEW'}
            </span>
          </div>

          {generatedBill.customer && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-slate-800">{generatedBill.customer.name}</span>
                {generatedBill.customer.phone && <span className="text-slate-500 ml-2">({generatedBill.customer.phone})</span>}
              </div>
              <div className="font-bold text-emerald-700">
                {generatedBill.is_udhaar ? (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Udhaar Credit: ₹{generatedBill.customer.udhaar_balance}
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
                  <span className="col-span-6 font-bold truncate">{item.name}</span>
                  <span className="col-span-2 text-center text-slate-600">{item.quantity} {item.unit || 'pkt'}</span>
                  <span className="col-span-2 text-right text-slate-600">₹{item.rate}</span>
                  <span className="col-span-2 text-right font-extrabold text-slate-900">₹{item.item_total}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-extrabold text-slate-900 text-sm">
            <span>Grand Total (Kool Rashi)</span>
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
