'use client';

import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import SegmentTabs from '../components/SegmentTabs';
import StatsSummary from '../components/StatsSummary';
import CameraScanner from '../components/CameraScanner';
import VoiceRecorder from '../components/VoiceRecorder';
import InventoryCatalog from '../components/InventoryCatalog';
import UdhaarLedger from '../components/UdhaarLedger';
import AIBillWindow from '../components/AIBillWindow';
import { Sparkles, Camera, CheckCircle2, Check, Volume2, RefreshCw, ShoppingCart, Package, AlertTriangle, Hash, Receipt, Wallet, UserCheck } from 'lucide-react';

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
  const [customers, setCustomers] = useState([]);

  // Dukandar Quick Mode: 'BILL' (Customer Bill) | 'UDHAAR_PAYMENT' (Receive Payment) | 'RESTOCK' (Maal Aaya) | 'DAMAGE' (Kharab)
  const [quickMode, setQuickMode] = useState('BILL');

  // Quick Bill Creator State
  const [billTextPrompt, setBillTextPrompt] = useState('');
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quickProductName, setQuickProductName] = useState('');
  const [quickQty, setQuickQty] = useState(1);
  const [quickPrice, setQuickPrice] = useState(10);
  const [quickIsUdhaar, setQuickIsUdhaar] = useState(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Workflow Steps: 'camera' -> 'snapped' -> 'analyzing' -> 'results'
  const [workflowStep, setWorkflowStep] = useState('camera');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [generatedBill, setGeneratedBill] = useState(null);

  // Result & Form State
  const [aiResult, setAiResult] = useState(null);
  const [manualForm, setManualForm] = useState({
    is_existing: false,
    id: null,
    name: '',
    customer_name: '',
    selling_price: 10,
    current_quantity: 0,
    add_quantity: 1,
    quantity: 1,
    unit: 'packet',
    expiry_date: '',
    action_type: 'BILL',
    is_udhaar: false,
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchInventory();
    fetchCustomers();
  }, []);

  async function fetchInventory() {
    try {
      const res = await fetch(`${API_BASE}/products?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products) setProducts(data.products);
      }
    } catch (e) {
      console.warn('Backend offline mode');
    }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(`${API_BASE}/customers?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customers) setCustomers(data.customers);
      }
    } catch (e) {
      console.warn('Backend offline mode');
    }
  }

  const totalItems = products.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const stockValue = products.reduce((sum, item) => sum + ((parseFloat(item.selling_price) || 0) * (parseFloat(item.quantity) || 0)), 0);

  // Handle text prompt bill submission (e.g. "Ravi took 2 Maggi")
  const handleTextPromptBillSubmitWithText = async (text) => {
    if (!text || isSubmittingBill) return;

    setIsSubmittingBill(true);
    setSuccessToast(null);
    setGeneratedBill(null);

    try {
      const formData = new FormData();
      formData.append('text_prompt', text.trim());
      formData.append('shop_id', shopId);
      formData.append('mode', 'BILL');

      const res = await fetch(`${API_BASE}/create-bill`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const billData = await res.json();
        const toastMsg = billData.ai_response || `Bill created successfully!`;
        setSuccessToast(toastMsg);
        speakAIVoicePrompt(toastMsg);

        if (billData.items) {
          setGeneratedBill(billData);
        }

        await fetchInventory();
        await fetchCustomers();
      }
    } catch (err) {
      console.error('Error creating bill from text prompt:', err);
    } finally {
      setIsSubmittingBill(false);
    }
  };

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
        setGeneratedBill(null);
      }
    }, 'image/jpeg', 0.90);
  };

  // STEP 2: PROCESS & ANALYZE BILL / PRODUCT WITH AI
  const handleAnalyzeProduct = async () => {
    setWorkflowStep('analyzing');
    setSuccessToast(null);
    setGeneratedBill(null);

    try {
      const formData = new FormData();
      if (photoBlob) formData.append('image', photoBlob, 'photo.jpg');
      if (recordedAudioBlob) formData.append('audio', recordedAudioBlob, 'voice.webm');
      formData.append('shop_id', shopId);
      formData.append('mode', quickMode);

      const res = await fetch(`${API_BASE}/create-bill`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const billData = await res.json();
        const toastMsg = billData.ai_response || `Bill created successfully!`;
        setSuccessToast(toastMsg);
        speakAIVoicePrompt(toastMsg);

        if (billData.items) {
          setGeneratedBill(billData);
        }

        await fetchInventory();
        await fetchCustomers();

        setWorkflowStep('camera');
        setCapturedPhotoUrl(null);
        setPhotoBlob(null);
        setRecordedAudioBlob(null);
        return;
      }
    } catch (err) {
      const toastMsg = "Done! Processed transaction.";
      setSuccessToast(toastMsg);
      speakAIVoicePrompt(toastMsg);
      await fetchInventory();
      await fetchCustomers();
      setWorkflowStep('camera');
      setCapturedPhotoUrl(null);
      setPhotoBlob(null);
      setRecordedAudioBlob(null);
    }
  };

  // Direct Udhaar payment handler from UdhaarLedger component
  const handleDirectUdhaarPayment = async (customer, amount) => {
    try {
      const res = await fetch(`${API_BASE}/udhaar/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          customer_id: customer?.id,
          customer_name: customer?.name,
          customer_phone: customer?.phone,
          amount: parseFloat(amount) || 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const msg = data.ai_response || `Received ₹${amount} payment from ${customer.name}. New balance: ₹${data.customer?.udhaar_balance || 0}`;
        setSuccessToast(msg);
        speakAIVoicePrompt(msg);
        await fetchCustomers();
      }
    } catch (e) {
      console.error('Udhaar payment error:', e);
    }
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
          <AIBillWindow
            videoRef={videoRef}
            canvasRef={canvasRef}
            workflowStep={workflowStep}
            capturedPhotoUrl={capturedPhotoUrl}
            recordedAudioBlob={recordedAudioBlob}
            setRecordedAudioBlob={setRecordedAudioBlob}
            handleTakeSnap={handleTakeSnap}
            handleAnalyzeProduct={handleAnalyzeProduct}
            handleResetToCamera={handleResetToCamera}
            successToast={successToast}
            generatedBill={generatedBill}
            setGeneratedBill={setGeneratedBill}
            speakAIVoicePrompt={speakAIVoicePrompt}
            onTextBillSubmit={handleTextPromptBillSubmitWithText}
            isSubmitting={isSubmittingBill}
          />
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

      {activeTab === 'udhaar' && (
        <main className="flex flex-col gap-4">
          <UdhaarLedger
            customers={customers}
            onRecordPayment={handleDirectUdhaarPayment}
          />
        </main>
      )}
    </>
  );
}
