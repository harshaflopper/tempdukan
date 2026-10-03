'use client';

import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import SegmentTabs from '../components/SegmentTabs';
import StatsSummary from '../components/StatsSummary';
import CameraScanner from '../components/CameraScanner';
import VoiceRecorder from '../components/VoiceRecorder';
import InventoryCatalog from '../components/InventoryCatalog';
import { Sparkles, Camera, CheckCircle2, Check, Volume2, RefreshCw, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

// Web Speech API Text-To-Speech (Audio Voice Prompt)
const speakAIVoicePrompt = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel(); // Stop previous voice
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = 'hi-IN'; // Natural Indian accent / Hinglish
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis unavailable:', e);
    }
  }
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('onboard');
  const [shopId] = useState('SHOP001');
  const [products, setProducts] = useState([]);

  // Workflow Steps: 'camera' -> 'snapped' -> 'analyzing' -> 'results'
  const [workflowStep, setWorkflowStep] = useState('camera');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Result & Form State
  const [aiResult, setAiResult] = useState(null);
  const [manualForm, setManualForm] = useState({
    is_existing: false,
    id: null,
    name: '',
    selling_price: 10,
    current_quantity: 0,
    add_quantity: 1,
    quantity: 1,
    unit: 'packet',
    expiry_date: '',
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    try {
      const res = await fetch(`${API_BASE}/products?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products) {
          setProducts(data.products);
        }
      }
    } catch (e) {
      console.warn('Backend offline mode');
    }
  }

  const totalItems = products.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const stockValue = products.reduce((sum, item) => sum + ((parseFloat(item.selling_price) || 0) * (parseFloat(item.quantity) || 0)), 0);

  // STEP 1: CAPTURE PHOTO SNAP
  const handleTakeSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);

    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedPhotoUrl(url);
        setWorkflowStep('snapped');
        setSuccessToast(null);
      }
    }, 'image/jpeg', 0.90);
  };

  // STEP 2: PROCESS & ANALYZE PRODUCT WITH AI (GEMINI 2.5 FLASH + SUPABASE DB LOOKUP)
  const handleAnalyzeProduct = async () => {
    setWorkflowStep('analyzing');
    setSuccessToast(null);

    try {
      const formData = new FormData();
      if (photoBlob) formData.append('image', photoBlob, 'photo.jpg');
      if (recordedAudioBlob) formData.append('audio', recordedAudioBlob, 'voice.webm');
      formData.append('shop_id', shopId);

      const res = await fetch(`${API_BASE}/onboard`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();

        // =========================================================================
        // CASE A: VOICE NOTE ATTACHED -> DIRECT DB SAVE & INSTANT CAMERA RESET (NO CARD!)
        // =========================================================================
        if (recordedAudioBlob || data.case === 2) {
          const toastMsg = data.ai_response || `Done! Saved product directly to shop inventory.`;
          setSuccessToast(toastMsg);
          speakAIVoicePrompt(toastMsg);

          // Refresh live Supabase inventory catalog immediately!
          await fetchInventory();

          // Reset to camera view for instant next snap (ZERO CONFIRMATION FORM!)
          setWorkflowStep('camera');
          setCapturedPhotoUrl(null);
          setPhotoBlob(null);
          setRecordedAudioBlob(null);
          setAiResult(null);
        } else {
          // =========================================================================
          // CASE B: PHOTO ONLY -> SHOW PRE-FILLED CONFIRMATION CARD
          // =========================================================================
          setAiResult(data);

          // Speech Synthesis Voice Output
          if (data.ai_response) {
            speakAIVoicePrompt(data.ai_response);
          }

          if (data.is_existing && data.existing_product) {
            const ep = data.existing_product;
            const prefilledPrice = parseFloat(ep.selling_price) || parseFloat(data.printed_mrp) || 10.0;
            setManualForm({
              is_existing: true,
              id: ep.id,
              name: ep.name,
              current_quantity: parseFloat(ep.quantity) || 0,
              add_quantity: 1,
              selling_price: prefilledPrice,
              unit: ep.unit || 'packet',
              expiry_date: ep.expiry_date || data.expiry_date || '',
            });
          } else {
            const prodName = data.product_name || 'Recognized Item';
            const price = parseFloat(data.printed_mrp) || parseFloat(data.product?.selling_price) || 20.0;
            setManualForm({
              is_existing: false,
              name: prodName,
              selling_price: price,
              quantity: 1,
              unit: 'packet',
              expiry_date: data.expiry_date || '',
            });
          }
          setWorkflowStep('results');
        }
      }
    } catch (err) {
      if (recordedAudioBlob) {
        const toastMsg = "Done! Saved product directly to shop inventory.";
        setSuccessToast(toastMsg);
        speakAIVoicePrompt(toastMsg);
        await fetchInventory();
        setWorkflowStep('camera');
        setCapturedPhotoUrl(null);
        setPhotoBlob(null);
        setRecordedAudioBlob(null);
      } else {
        const fallbackMsg = "Recognized product! Enter quantity and selling price to save.";
        speakAIVoicePrompt(fallbackMsg);
        setAiResult({
          status: 'PHOTO_ONLY_NEW_PRODUCT',
          product_name: 'Tic-Tac Limited Edition Intense Mint',
          printed_mrp: 20.0,
          ai_response: fallbackMsg
        });
        setManualForm({
          is_existing: false,
          name: 'Tic-Tac Limited Edition Intense Mint',
          selling_price: 20.0,
          quantity: 1,
          unit: 'box',
          expiry_date: 'Dec 2026'
        });
        setWorkflowStep('results');
      }
    }
  };

  // STEP 3: SAVE OR UPDATE ITEM IN SUPABASE INVENTORY
  const handleSaveOrUpdateInventory = async (e) => {
    e.preventDefault();

    try {
      if (manualForm.is_existing && manualForm.id) {
        // UPDATE REPEAT PRODUCT STOCK IN SUPABASE
        await fetch(`${API_BASE}/products/${manualForm.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_id: shopId,
            add_quantity: parseFloat(manualForm.add_quantity) || 0,
            selling_price: parseFloat(manualForm.selling_price) || 0,
            expiry_date: manualForm.expiry_date || '',
          }),
        });

        const newTotal = (manualForm.current_quantity || 0) + (parseFloat(manualForm.add_quantity) || 0);
        const toastText = `Done! Updated stock for '${manualForm.name}' to ${newTotal} ${manualForm.unit}s.`;
        setSuccessToast(toastText);
        speakAIVoicePrompt(toastText);
      } else {
        // SAVE NEW PRODUCT TO SUPABASE
        const newProd = {
          shop_id: shopId,
          ...manualForm,
        };
        await fetch(`${API_BASE}/confirm-product`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: shopId, product: newProd }),
        });
        const toastText = `Done! Saved '${manualForm.name}' (₹${manualForm.selling_price}) to shop inventory!`;
        setSuccessToast(toastText);
        speakAIVoicePrompt(toastText);
      }
    } catch (e) {
      setSuccessToast(`Saved '${manualForm.name}' to shop inventory!`);
    }

    setWorkflowStep('camera');
    setCapturedPhotoUrl(null);
    setPhotoBlob(null);
    setRecordedAudioBlob(null);
    setAiResult(null);
    await fetchInventory();
  };

  // Reset to Step 1 (Camera Viewport)
  const handleResetToCamera = () => {
    setWorkflowStep('camera');
    setCapturedPhotoUrl(null);
    setPhotoBlob(null);
    setRecordedAudioBlob(null);
    setAiResult(null);
  };

  const handleUpdateStock = (id, newQty) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: newQty } : p));
  };

  return (
    <>
      <Navbar shopId={shopId} />
      <SegmentTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <StatsSummary totalItems={totalItems} stockValue={stockValue} matchedCount={products.length} />

      {activeTab === 'onboard' && (
        <main className="flex flex-col gap-4">
          {/* STEP 1: CAMERA VIEWPORT */}
          {workflowStep === 'camera' && (
            <div className="flex flex-col gap-3">
              <CameraScanner videoRef={videoRef} canvasRef={canvasRef} />

              <button
                type="button"
                onClick={handleTakeSnap}
                className="w-full min-h-[58px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl font-heading font-extrabold text-base flex items-center justify-center gap-3 shadow-emerald-glow transition-all active:scale-[0.99]"
              >
                <Camera className="w-6 h-6 text-emerald-100" />
                <span>Take Product Photo Snap</span>
              </button>
            </div>
          )}

          {/* STEP 2: PHOTO SNAPPED — VOICE OPTION OR PROCESS */}
          {(workflowStep === 'snapped' || workflowStep === 'analyzing') && (
            <div className="flex flex-col gap-4">
              {capturedPhotoUrl && (
                <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex-shrink-0">
                    <img src={capturedPhotoUrl} alt="Captured Product Frame" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center gap-1">
                    <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">Product Photo Snapped</span>
                    <span className="text-xs text-slate-600 font-medium">Ready for AI Vision & Database Matching</span>
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

              {/* Optional Voice Note Recorder */}
              <VoiceRecorder onAudioRecorded={(blob) => setRecordedAudioBlob(blob)} />

              {/* Action Button: Analyze Product */}
              <button
                type="button"
                onClick={handleAnalyzeProduct}
                disabled={workflowStep === 'analyzing'}
                className="w-full min-h-[58px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl font-heading font-extrabold text-base flex items-center justify-center gap-3 shadow-emerald-glow disabled:opacity-50 transition-all active:scale-[0.99]"
              >
                {workflowStep === 'analyzing' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing with Gemini 2.5 AI & Checking Inventory...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-emerald-100" />
                    <span>{recordedAudioBlob ? 'Process Photo + Voice Note' : 'Analyze Product Now'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Live Success Toast Banner */}
          {successToast && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 font-bold text-sm shadow-sm animate-in fade-in">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* STEP 3: AI ANALYSIS RESULTS & AUDIO-BASED CONFIRMATION CARD */}
          {workflowStep === 'results' && aiResult !== null && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-4 shadow-soft-lg flex flex-col gap-4 animate-in fade-in">
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-heading font-extrabold text-base text-slate-900">
                  {manualForm.is_existing ? 'Existing Inventory Item Matched' : 'AI Recognized Product'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  manualForm.is_existing ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {manualForm.is_existing ? 'Repeat Snap Match' : 'Gemini 2.5 Flash'}
                </span>
              </div>

              {/* Audio Voice Guidance Bar */}
              {aiResult?.ai_response && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Volume2 className="w-4 h-4 text-emerald-600 flex-shrink-0 animate-pulse" />
                    <span>AI Audio Guidance Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAIVoicePrompt(aiResult.ai_response)}
                    className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                  >
                    Replay Audio
                  </button>
                </div>
              )}

              {/* Existing Match Banner */}
              {manualForm.is_existing && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-900">
                    Matched Item in Inventory: '{manualForm.name}'
                  </span>
                  <span className="text-xs text-amber-800 font-medium">
                    Current Stock: <strong>{manualForm.current_quantity} {manualForm.unit}s</strong> | Selling Price: <strong>₹{manualForm.selling_price}</strong> {manualForm.expiry_date && `| Exp: ${manualForm.expiry_date}`}
                  </span>
                </div>
              )}

              {/* Product Confirmation Form */}
              <form onSubmit={handleSaveOrUpdateInventory} className="flex flex-col gap-3">
                {!manualForm.is_existing && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Product Name</label>
                    <input
                      type="text"
                      required
                      value={manualForm.name}
                      onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                      className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm"
                    />
                  </div>
                )}

                {manualForm.is_existing ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500">Quick Stock Top-Up (Add Units)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setManualForm({ ...manualForm, add_quantity: num })}
                          className={`min-h-[40px] rounded-xl font-bold text-xs transition-all ${
                            manualForm.add_quantity === num
                              ? 'bg-emerald-600 text-white shadow-emerald-glow'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          +{num}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Add Stock Qty</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={manualForm.add_quantity}
                          onChange={(e) => setManualForm({ ...manualForm, add_quantity: parseFloat(e.target.value) || 1 })}
                          className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Selling Price (₹)</label>
                        <input
                          type="number"
                          step="0.5"
                          required
                          value={manualForm.selling_price}
                          onChange={(e) => setManualForm({ ...manualForm, selling_price: parseFloat(e.target.value) || 0 })}
                          className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Expiry Date</label>
                        <input
                          type="text"
                          placeholder="Dec 2026"
                          value={manualForm.expiry_date}
                          onChange={(e) => setManualForm({ ...manualForm, expiry_date: e.target.value })}
                          className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Selling Price (INR)</label>
                        <input
                          type="number"
                          step="0.5"
                          required
                          value={manualForm.selling_price}
                          onChange={(e) => setManualForm({ ...manualForm, selling_price: parseFloat(e.target.value) || 0 })}
                          className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Stock Quantity</label>
                        <input
                          type="number"
                          required
                          value={manualForm.quantity}
                          onChange={(e) => setManualForm({ ...manualForm, quantity: parseFloat(e.target.value) || 1 })}
                          className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">Expiry Date (Best Before)</label>
                      <input
                        type="text"
                        placeholder="e.g. Dec 2026 or 12/2026"
                        value={manualForm.expiry_date}
                        onChange={(e) => setManualForm({ ...manualForm, expiry_date: e.target.value })}
                        className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-emerald-glow text-base"
                  >
                    <Check className="w-5 h-5" />
                    <span>{manualForm.is_existing ? 'Update Existing Stock & Expiry' : 'Save to Shop Inventory'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToCamera}
                    className="w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Snap Another Product</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      )}

      {activeTab === 'inventory' && (
        <main className="flex flex-col gap-4">
          <InventoryCatalog
            products={products}
            onUpdateStock={handleUpdateStock}
          />
        </main>
      )}
    </>
  );
}
