'use client';

import React, { useState } from 'react';
import CameraScanner from './CameraScanner';
import VoiceRecorder from './VoiceRecorder';
import ExpiryAlertBanner from './ExpiryAlertBanner';
import { Camera, Sparkles, CheckCircle2, PackagePlus, RefreshCw, AlertTriangle, Check, BookOpen, Calendar } from 'lucide-react';

export default function AddInventoryWindow({
  videoRef,
  canvasRef,
  workflowStep,
  capturedPhotoUrl,
  recordedAudioBlob,
  setRecordedAudioBlob,
  handleTakeSnap,
  handleAnalyzeProductOnboard,
  handleResetToCamera,
  quickMode,
  setQuickMode,
  aiResult,
  manualForm,
  setManualForm,
  handleSaveConfirmedProduct,
  isSubmitting,
  successToast,
  onOpenSalesModal,
  expiryData,
  onOpenExpiryModal
}) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-4 rounded-2xl border border-emerald-700 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-heading font-extrabold text-base">
            <PackagePlus className="w-5 h-5 text-emerald-400" />
            <span>Add Inventory & Scan Stock</span>
          </div>
          <p className="text-xs text-emerald-200 font-medium">
            Point camera at product to automatically detect name, printed MRP, and add or update shop inventory.
          </p>
        </div>

        {onOpenExpiryModal && (
          <button
            type="button"
            onClick={onOpenExpiryModal}
            className="w-full sm:w-auto px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
          >
            <Calendar className="w-4 h-4 text-slate-950" />
            <span>AI Expiry Clearance</span>
          </button>
        )}
      </div>

      {/* Expiry Alert Notification Banner */}
      {expiryData && (
        <ExpiryAlertBanner expiryData={expiryData} onOpenExpiryModal={onOpenExpiryModal} />
      )}

      {/* Quick Action Selection Pills */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-extrabold gap-1">
        <button
          type="button"
          onClick={() => setQuickMode('RESTOCK')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            quickMode === 'RESTOCK'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Maal Aaya (Restock)
        </button>
        <button
          type="button"
          onClick={() => setQuickMode('DAMAGE')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            quickMode === 'DAMAGE'
              ? 'bg-red-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Kharab (Damage)
        </button>
        <button
          type="button"
          onClick={() => setQuickMode('CORRECTION')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            quickMode === 'CORRECTION'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Stock Audit (Ginti)
        </button>
      </div>

      {/* STEP 1: CAMERA SCANNER */}
      {workflowStep === 'camera' && (
        <div className="flex flex-col gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Camera Product Viewport
            </span>
            <span className="text-[10px] font-bold text-slate-400">Point at product wrapper</span>
          </div>

          <CameraScanner videoRef={videoRef} canvasRef={canvasRef} />

          <div className="border-t border-slate-100 pt-2">
            <VoiceRecorder onAudioRecorded={(blob) => setRecordedAudioBlob(blob)} />
          </div>

          <button
            type="button"
            onClick={handleTakeSnap}
            className="w-full min-h-[54px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-emerald-glow transition-all active:scale-[0.99]"
          >
            <Camera className="w-5 h-5 text-white" />
            <span>Snap Photo to Add Item</span>
          </button>
        </div>
      )}

      {/* STEP 2: PHOTO SNAPPED PREVIEW & PROCESS */}
      {(workflowStep === 'snapped' || workflowStep === 'analyzing') && (
        <div className="flex flex-col gap-3 bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-md">
          {capturedPhotoUrl && (
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex-shrink-0">
                <img src={capturedPhotoUrl} alt="Snapped Item" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center gap-0.5">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Product Photo Ready</span>
                <span className="text-xs text-slate-600 font-medium">Ready to extract MRP, name & update stock</span>
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
            onClick={handleAnalyzeProductOnboard}
            disabled={workflowStep === 'analyzing'}
            className="w-full min-h-[54px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2 shadow-emerald-glow disabled:opacity-50 transition-all active:scale-[0.99]"
          >
            {workflowStep === 'analyzing' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI Extracting MRP & Matching Inventory...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>Analyze & Save to Inventory</span>
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

      {/* CONFIRMATION / FORM CARD FOR MANUALLY ADJUSTING DETECTED ITEM */}
      {workflowStep === 'results' && manualForm && (
        <div className="bg-white rounded-2xl border-2 border-emerald-600 p-4 shadow-md flex flex-col gap-3.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
              {manualForm.is_existing ? 'Update Existing Inventory Item' : 'New Item Detected'}
            </span>
            <button
              type="button"
              onClick={handleResetToCamera}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Product Name</label>
              <input
                type="text"
                value={manualForm.name}
                onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  value={manualForm.selling_price}
                  onChange={(e) => setManualForm(prev => ({ ...prev, selling_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  {manualForm.is_existing ? 'Add Quantity' : 'Initial Stock Qty'}
                </label>
                <input
                  type="number"
                  value={manualForm.add_quantity}
                  onChange={(e) => setManualForm(prev => ({ ...prev, add_quantity: parseFloat(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Unit</label>
                <select
                  value={manualForm.unit}
                  onChange={(e) => setManualForm(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="packet">packet</option>
                  <option value="kg">kg</option>
                  <option value="liter">liter</option>
                  <option value="piece">piece</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={manualForm.expiry_date || ''}
                  onChange={(e) => setManualForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveConfirmedProduct}
            disabled={isSubmitting}
            className="w-full min-h-[48px] mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-emerald-glow disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Save Item to Inventory</span>
          </button>
        </div>
      )}
    </div>
  );
}
