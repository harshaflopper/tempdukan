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
import SalesAnalytics from '../components/SalesAnalytics';
import ExpiryTrackerModal from '../components/ExpiryTrackerModal';
import ShopNewspaperModal from '../components/ShopNewspaperModal';
import CustomerPortal from '../components/CustomerPortal';
import RoleSelectionModal from '../components/RoleSelectionModal';
import DemandSignals from '../components/DemandSignals';

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
  // Role & Login Portal State ('CUSTOMER' | 'DUKANDAR')
  const [currentRole, setCurrentRole] = useState('CUSTOMER');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  
  // User Session Details
  const [customerInfo, setCustomerInfo] = useState({ name: 'Rahul Sharma', location: 'Ward 4, Bhopalgarh Village, Rajasthan' });
  const [dukandarInfo, setDukandarInfo] = useState({ shopId: 'SHOP001', ownerName: 'Ramji Sharma' });

  const [activeTab, setActiveTab] = useState('add_inventory');
  const [shopId, setShopId] = useState('SHOP001');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Daily AI Shop Newspaper State ('दैनिक दुकान समाचार')
  const [newspaperData, setNewspaperData] = useState(null);
  const [showNewspaperModal, setShowNewspaperModal] = useState(false);

  // AI Expiry Tracking & Clearance State
  const [expiryData, setExpiryData] = useState(null);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [isExpiryLoading, setIsExpiryLoading] = useState(false);

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
  const [trendingProductsAlert, setTrendingProductsAlert] = useState(null);
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

  // Check saved session in localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('lastdukan_role');
      if (savedRole) {
        setCurrentRole(savedRole);
      } else {
        setIsRoleModalOpen(true);
      }

      const savedCust = localStorage.getItem('lastdukan_customer');
      if (savedCust) {
        try { setCustomerInfo(JSON.parse(savedCust)); } catch (e) {}
      }

      const savedDukan = localStorage.getItem('lastdukan_dukandar');
      if (savedDukan) {
        try {
          const parsed = JSON.parse(savedDukan);
          setDukandarInfo(parsed);
          if (parsed.shopId) setShopId(parsed.shopId);
        } catch (e) {}
      }
    }

    fetchInventory();
    fetchCustomers();
    fetchExpiryAnalysis();
    fetchNewspaperEdition();
  }, []);

  const handleSelectCustomerRole = (data) => {
    setCurrentRole('CUSTOMER');
    setCustomerInfo(data);
    setIsRoleModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastdukan_role', 'CUSTOMER');
      localStorage.setItem('lastdukan_customer', JSON.stringify(data));
    }
  };

  const handleSelectDukandarRole = (data) => {
    setCurrentRole('DUKANDAR');
    setDukandarInfo(data);
    if (data.shopId) setShopId(data.shopId);
    setIsRoleModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastdukan_role', 'DUKANDAR');
      localStorage.setItem('lastdukan_dukandar', JSON.stringify(data));
    }
    fetchInventory();
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastdukan_role');
      localStorage.removeItem('lastdukan_customer');
      localStorage.removeItem('lastdukan_dukandar');
    }
    setIsRoleModalOpen(true);
  };

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

  async function fetchNewspaperEdition() {
    try {
      const res = await fetch(`${API_BASE}/newspaper/edition?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setNewspaperData(data);
        if (data.trending_signals && data.trending_signals.length > 0) {
          setTrendingProductsAlert(data.trending_signals);
          setTimeout(() => setTrendingProductsAlert(null), 10000); // clear after 10s
        }
      }
    } catch (e) {
      console.warn('Backend offline mode for newspaper');
    }
  }

  async function fetchExpiryAnalysis() {
    setIsExpiryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/expiry/analysis?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setExpiryData(data);
      }
    } catch (e) {
      console.warn('Backend offline mode for expiry');
    } fontally {
      setIsExpiryLoading(false);
    }
  }

  async function handleApplyExpiryDiscount(productId, suggestedPrice) {
    try {
      const res = await fetch(`${API_BASE}/expiry/apply-discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          product_id: productId,
          suggested_price: parseFloat(suggestedPrice)
        })
      });

      if (res.ok) {
        const msg = `Applied AI Clearance Price ₹${suggestedPrice}!`;
        setSuccessToast(msg);
        speakAIVoicePrompt(msg);
        await fetchInventory();
        await fetchExpiryAnalysis();
      }
    } catch (e) {
      console.error('Error applying clearance price:', e);
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
        await fetchExpiryAnalysis();
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
        await fetchExpiryAnalysis();
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
        await fetchExpiryAnalysis();

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
      await fetchExpiryAnalysis();
      setWorkflowStep('camera');
      setCapturedPhotoUrl(null);
      setPhotoBlob(null);
      setRecordedAudioBlob(null);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // 1-Tap Loose Micro-Item Quick Cash Sale Handler
  const handleQuickLooseSale = async (itemName, price) => {
    setIsSubmittingBill(true);
    setSuccessToast(null);
    setGeneratedBill(null);

    try {
      const res = await fetch(`${API_BASE}/create-bill-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: customerName || 'Walk-in Cash Customer',
          customer_phone: customerPhone || null,
          items: [{
            product_name: itemName,
            quantity: 1.0,
            unit: 'piece',
            selling_price: parseFloat(price)
          }],
          is_udhaar: false,
          discount_amount: parseFloat(discountAmount) || 0,
          custom_udhaar_amount: parseFloat(customUdhaarAmount) || 0,
          send_sms: false
        })
      });

      if (res.ok) {
        const billData = await res.json();
        const toastMsg = billData.ai_response || `Cash Sale: ${itemName} (₹${price}) completed!`;
        setSuccessToast(toastMsg);
        speakAIVoicePrompt(toastMsg);
        setGeneratedBill(billData);
        await fetchInventory();
        await fetchCustomers();
        await fetchExpiryAnalysis();
      }
    } catch (e) {
      console.error('Error creating quick loose bill:', e);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Direct Udhaar payment handler
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

  const [showSalesModal, setShowSalesModal] = useState(false);

  return (
    <>
      {/* NAVBAR WITH ACCOUNT BADGE AND LOGOUT BUTTON */}
      <Navbar
        currentRole={currentRole}
        shopId={shopId}
        userInfo={currentRole === 'CUSTOMER' ? customerInfo : dukandarInfo}
        onLogout={handleLogout}
      />

      {/* INITIAL ROLE SELECTION & LOGIN PORTAL */}
      <RoleSelectionModal
        isOpen={isRoleModalOpen}
        onSelectCustomer={handleSelectCustomerRole}
        onSelectDukandar={handleSelectDukandarRole}
        onClose={() => setIsRoleModalOpen(false)}
      />

      {/* GLOBAL TRENDING PRODUCTS POPUP */}
      {trendingProductsAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 fade-in duration-500 ease-out pointer-events-none w-full max-w-sm px-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-blue-100 p-4 flex flex-col gap-3 pointer-events-auto ring-1 ring-black/5">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="animate-bounce text-lg">🔥</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-extrabold text-blue-900 text-sm tracking-tight leading-none">इलाके में भारी मांग!</h3>
                <p className="text-[10px] text-gray-500 font-medium mt-1">आपकी दुकान के आस-पास लोग ये खोज रहे हैं</p>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5">
              {trendingProductsAlert.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center text-xs font-bold text-gray-800">
                  <span className="truncate pr-2">{item.query}</span>
                  <span className="bg-orange-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex-shrink-0 shadow-sm">
                    {item.count} Searches
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 pt-2 border-t border-gray-50 text-center">
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                दैनिक समाचार में पूरी रिपोर्ट देखें
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT VIEW BASED ON ACTIVE ROLE */}
      {currentRole === 'CUSTOMER' ? (
        <main className="mt-4">
          <CustomerPortal
            customerInfo={customerInfo}
            speakAIVoicePrompt={speakAIVoicePrompt}
          />
        </main>
      ) : (
        <>
          <SegmentTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          <StatsSummary totalItems={totalItems} stockValue={stockValue} matchedCount={products.length} onOpenSalesModal={() => setShowSalesModal(true)} />

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
                expiryData={expiryData}
                onOpenExpiryModal={() => setShowExpiryModal(true)}
                newspaperData={newspaperData}
                onOpenNewspaperModal={() => setShowNewspaperModal(true)}
                speakAIVoicePrompt={speakAIVoicePrompt}
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
                handleQuickLooseSale={handleQuickLooseSale}
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
                shopId={shopId}
                expiryData={expiryData}
                onOpenExpiryModal={() => setShowExpiryModal(true)}
                newspaperData={newspaperData}
                onOpenNewspaperModal={() => setShowNewspaperModal(true)}
                speakAIVoicePrompt={speakAIVoicePrompt}
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
      )}

      {/* DUKANDAR SALES REGISTER MODAL */}
      {showSalesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 border-2 border-emerald-600 shadow-2xl">
            <SalesAnalytics shopId={shopId} products={products} onClose={() => setShowSalesModal(false)} />
          </div>
        </div>
      )}

      {/* AI EXPIRY CLEARANCE TRACKER MODAL */}
      {showExpiryModal && (
        <ExpiryTrackerModal
          expiryData={expiryData}
          onClose={() => setShowExpiryModal(false)}
          onApplyDiscount={handleApplyExpiryDiscount}
          onUpdateStock={handleUpdateStock}
          onRefreshStrategies={fetchExpiryAnalysis}
          speakAIVoicePrompt={speakAIVoicePrompt}
          isLoading={isExpiryLoading}
        />
      )}

      {/* DAILY AI SHOP NEWSPAPER MODAL */}
      {showNewspaperModal && (
        <ShopNewspaperModal
          newspaperData={newspaperData}
          onClose={() => setShowNewspaperModal(false)}
          onApplyDiscount={handleApplyExpiryDiscount}
          onUpdateStock={handleUpdateStock}
          speakAIVoicePrompt={speakAIVoicePrompt}
        />
      )}
    </>
  );
}
