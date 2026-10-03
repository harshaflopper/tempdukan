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
import AddInventoryWindow from '../components/AddInventoryWindow';

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
  const [activeTab, setActiveTab] = useState('add_inventory');
  const [shopId] = useState('SHOP001');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Customer Profile, Discount, Udhaar & SMS State for Billing
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [customUdhaarAmount, setCustomUdhaarAmount] = useState('');
  const [sendSms, setSendSms] = useState(true);

  // Dukandar Quick Mode for Stock Add: 'RESTOCK' (Maal Aaya) | 'DAMAGE' (Kharab) | 'CORRECTION' (Ginti)
  const [quickMode, setQuickMode] = useState('RESTOCK');

  // Quick Bill Creator State
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Workflow Steps: 'camera' -> 'snapped' -> 'analyzing' -> 'results'
  const [workflowStep, setWorkflowStep] = useState('camera');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [generatedBill, setGeneratedBill] = useState(null);

  // Result & Form State for Product Confirmation
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
    action_type: 'RESTOCK',
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

  // STEP 2: PROCESS & ANALYZE PRODUCT FOR ADDING TO INVENTORY (/api/v1/onboard)
  const handleAnalyzeProductOnboard = async () => {
    setWorkflowStep('analyzing');
    setSuccessToast(null);

    try {
      const formData = new FormData();
      if (photoBlob) formData.append('image', photoBlob, 'photo.jpg');
      if (recordedAudioBlob) formData.append('audio', recordedAudioBlob, 'voice.webm');
      formData.append('shop_id', shopId);
      formData.append('mode', quickMode);

      const res = await fetch(`${API_BASE}/onboard`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data);
        setManualForm({
          is_existing: data.is_existing || false,
          id: data.existing_product?.id || null,
          name: data.product_name || 'New Item',
          selling_price: data.printed_mrp || 10,
          current_quantity: data.existing_product?.quantity || 0,
          add_quantity: 1,
          quantity: (data.existing_product?.quantity || 0) + 1,
          unit: data.existing_product?.unit || 'packet',
          expiry_date: data.expiry_date || '',
          action_type: quickMode,
        });

        const msg = data.ai_response || `Recognized ${data.product_name}`;
        setSuccessToast(msg);
        speakAIVoicePrompt(msg);

        setWorkflowStep('results');
        await fetchInventory();
        return;
      }
    } catch (err) {
      console.error('Error onboarding product:', err);
    }
    setWorkflowStep('camera');
  };

  // SAVE CONFIRMED PRODUCT TO DB INVENTORY
  const handleSaveConfirmedProduct = async () => {
    try {
      const res = await fetch(`${API_BASE}/confirm-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          product: {
            name: manualForm.name,
            selling_price: parseFloat(manualForm.selling_price) || 10,
            quantity: parseFloat(manualForm.add_quantity) || 1,
            unit: manualForm.unit || 'packet',
            expiry_date: manualForm.expiry_date || null
          }
        })
      });

      if (res.ok) {
        const msg = `Saved '${manualForm.name}' to shop inventory!`;
        setSuccessToast(msg);
        speakAIVoicePrompt(msg);
        await fetchInventory();
        handleResetToCamera();
      }
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  // PROCESS BILL FROM PHOTO SNAP AND/OR VOICE IN AI BILL TAB
  const handleAnalyzeBill = async () => {
    setWorkflowStep('analyzing');
    setSuccessToast(null);
    setGeneratedBill(null);
    setIsSubmittingBill(true);

    try {
      const formData = new FormData();
      if (photoBlob) formData.append('image', photoBlob, 'photo.jpg');
      if (recordedAudioBlob) formData.append('audio', recordedAudioBlob, 'voice.webm');
      formData.append('shop_id', shopId);
      formData.append('mode', 'BILL');
      if (customerName.trim()) formData.append('customer_name', customerName.trim());
      if (customerPhone.trim()) formData.append('customer_phone', customerPhone.trim());
      if (discountAmount) formData.append('discount_amount', discountAmount);
      if (customUdhaarAmount) formData.append('custom_udhaar_amount', customUdhaarAmount);
      formData.append('send_sms', sendSms ? 'true' : 'false');

      const res = await fetch(`${API_BASE}/create-bill`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const billData = await res.json();
        const toastMsg = billData.ai_response || `Bill created successfully!`;
        setSuccessToast(toastMsg);
        speakAIVoicePrompt(toastMsg);

        if (billData.customer_name && !customerName) {
          setCustomerName(billData.customer_name);
        }

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
      const toastMsg = "Processed billing transaction.";
      setSuccessToast(toastMsg);
      speakAIVoicePrompt(toastMsg);
      await fetchInventory();
      await fetchCustomers();
      setWorkflowStep('camera');
      setCapturedPhotoUrl(null);
      setPhotoBlob(null);
      setRecordedAudioBlob(null);
    } finally {
      setIsSubmittingBill(false);
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
          send_sms: sendSms
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

  // Reset to Camera Viewport
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

      {activeTab === 'add_inventory' && (
        <main className="flex flex-col gap-4">
          <AddInventoryWindow
            videoRef={videoRef}
            canvasRef={canvasRef}
            workflowStep={workflowStep}
            capturedPhotoUrl={capturedPhotoUrl}
            recordedAudioBlob={recordedAudioBlob}
            setRecordedAudioBlob={setRecordedAudioBlob}
            handleTakeSnap={handleTakeSnap}
            handleAnalyzeProductOnboard={handleAnalyzeProductOnboard}
            handleResetToCamera={handleResetToCamera}
            quickMode={quickMode}
            setQuickMode={setQuickMode}
            aiResult={aiResult}
            manualForm={manualForm}
            setManualForm={setManualForm}
            handleSaveConfirmedProduct={handleSaveConfirmedProduct}
            isSubmitting={isSubmittingBill}
            successToast={successToast}
          />
        </main>
      )}

      {activeTab === 'ai_bill' && (
        <main className="flex flex-col gap-4">
          <AIBillWindow
            videoRef={videoRef}
            canvasRef={canvasRef}
            workflowStep={workflowStep}
            capturedPhotoUrl={capturedPhotoUrl}
            recordedAudioBlob={recordedAudioBlob}
            setRecordedAudioBlob={setRecordedAudioBlob}
            handleTakeSnap={handleTakeSnap}
            handleAnalyzeProduct={handleAnalyzeBill}
            handleResetToCamera={handleResetToCamera}
            successToast={successToast}
            generatedBill={generatedBill}
            setGeneratedBill={setGeneratedBill}
            speakAIVoicePrompt={speakAIVoicePrompt}
            isSubmitting={isSubmittingBill}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            sendSms={sendSms}
            setSendSms={setSendSms}
            discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount}
            customUdhaarAmount={customUdhaarAmount}
            setCustomUdhaarAmount={setCustomUdhaarAmount}
            existingCustomers={customers}
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
