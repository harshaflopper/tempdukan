'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Camera,
  Mic,
  MapPin,
  Store,
  Phone,
  Navigation,
  CheckCircle2,
  XCircle,
  Package,
  ArrowRight,
  X,
  Map,
  ListFilter,
  BadgeCheck
} from 'lucide-react';
import RealShopMap from './RealShopMap';
import SimulatedNavigation from './SimulatedNavigation';

export default function CustomerPortal({ customerInfo, speakAIVoicePrompt }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'map'
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [navigatingToShop, setNavigatingToShop] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0); // 0, 1, 2 for search loading phases

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Default search on mount
  useEffect(() => {
    handleExecuteSearch('Tic Tac');
  }, []);

  // Camera Stream Lifecycle
  useEffect(() => {
    if (showCameraModal) {
      async function startCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          cameraStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('Camera access fallback:', err);
        }
      }
      startCamera();
    } else {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    }

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCameraModal]);

  const handleExecuteSearch = async (textQuery, category = 'ALL') => {
    setIsSearching(true);
    setLoadingStep(0);
    
    // Cycle through loading steps to simulate complex analysis
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => (prev < 2 ? prev + 1 : prev));
    }, 900);

    try {
      const targetQuery = textQuery !== undefined ? textQuery : searchQuery;
      let url = `http://localhost:8000/api/v1/customer/search?q=${encodeURIComponent(targetQuery || '')}`;
      if (category && category !== 'ALL') {
        url += `&category=${encodeURIComponent(category)}`;
      }
      
      // LOG DEMAND SIGNAL
      if (targetQuery && targetQuery.trim()) {
        fetch('http://localhost:8000/api/v1/search/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: 'SHOP001', query: targetQuery.trim() })
        }).catch(e => console.warn('Demand log failed', e));
      }
      
      const res = await fetch(url);
      
      // Artificial delay to guarantee the user sees the cool UI loading steps
      await new Promise(r => setTimeout(r, 2800));

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (e) {
      console.warn('Backend offline mode for customer search');
    } finally {
      clearInterval(stepInterval);
      setIsSearching(false);
    }
  };

  // Direct Google Maps Route Launcher (Now replaced with In-App Simulated Navigation)
  const handleLaunchDirectNavigation = (shop) => {
    setNavigatingToShop(shop);
    if (speakAIVoicePrompt) {
      speakAIVoicePrompt(`Opening turn by turn directions to ${shop.shop_name}`);
    }
  };

  // Voice Search (Web Speech API)
  const handleStartVoiceSearch = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);
      if (speakAIVoicePrompt) speakAIVoicePrompt('Bolie, kya dhoondhna hai?');

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsListeningVoice(false);
        handleExecuteSearch(transcript);
        if (speakAIVoicePrompt) speakAIVoicePrompt(`Searching for ${transcript}`);
      };

      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  // Snap Photo Search
  const handleSnapPhotoSearch = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        setIsSearching(true);
        try {
          const formData = new FormData();
          formData.append('image', blob, 'snap.jpg');
          formData.append('query_text', searchQuery);

          const res = await fetch('http://localhost:8000/api/v1/customer/search-image', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
            if (data.searched_query) {
              setSearchQuery(data.searched_query);
              const msg = `Found ${data.searched_query} in local stores!`;
              if (speakAIVoicePrompt) speakAIVoicePrompt(msg);
            }
          }
        } catch (err) {
          console.error('Error performing snap search:', err);
        } finally {
          setIsSearching(false);
          setShowCameraModal(false);
        }
      }
    }, 'image/jpeg', 0.90);
  };

  const categories = [
    { id: 'ALL', label: 'All Items' },
    { id: 'Kirana', label: 'Kirana & Grocery' },
    { id: 'Hardware', label: 'Hardware & Electricals' },
    { id: 'Snacks', label: 'Snacks' },
    { id: 'Personal Care', label: 'Pharmacy' },
  ];

  return (
    <div className="flex flex-col gap-4 animate-in fade-in text-slate-900 pb-20 font-sans bg-slate-50 min-h-screen">
      
      {navigatingToShop && (
        <SimulatedNavigation targetShop={navigatingToShop} onExit={() => setNavigatingToShop(null)} />
      )}

      {/* MOBILE SEARCH HEADER (PREMIUM GLASSMORPHISM) */}
      <div className="bg-slate-950 text-white p-5 rounded-b-[2.5rem] border-b border-slate-800 shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col gap-4 relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* LOCATION HEADER */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 relative z-10">
          <div className="flex items-center gap-2 max-w-[240px]">
            <div className="w-8 h-8 rounded-xl bg-emerald-900/80 text-emerald-400 flex items-center justify-center font-bold shrink-0 border border-emerald-700/60">
              <MapPin className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Live Local Stock Search
              </span>
              <span className="text-xs font-extrabold text-white truncate">
                {customerInfo?.location || 'Ward 4, Bhopalgarh Village'}
              </span>
            </div>
          </div>
          
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2 py-1 rounded-lg border border-emerald-800 truncate">
            {customerInfo?.name || 'Customer'}
          </span>
        </div>

        {/* SEARCH INPUT */}
        <div className="flex flex-col gap-2.5 relative z-10">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch(searchQuery, 'ALL')}
              placeholder="Search 'Tic Tac', 'tictac', 'Maggi', 'Switch'..."
              className="w-full min-h-[44px] pl-10 pr-28 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />

            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={handleStartVoiceSearch}
                className={`p-2 rounded-lg font-bold transition-all ${
                  isListeningVoice ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Voice Search"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowCameraModal(true)}
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all"
                title="Snap Photo Search"
              >
                <Camera className="w-4 h-4 text-slate-950" />
              </button>

              <button
                type="button"
                onClick={() => handleExecuteSearch(searchQuery, 'ALL')}
                className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all flex items-center gap-1"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CATEGORY CHIPS */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  handleExecuteSearch(searchQuery, cat.id);
                }}
                className={`px-3 py-1 rounded-xl shrink-0 transition-all text-[11px] border ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                    : 'bg-slate-900 text-slate-300 border-slate-700/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RESULTS & PRICE COMPARISON ENGINE */}
      <div className="flex flex-col gap-4 px-3 -mt-2 relative z-20">
        {isSearching ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            
            <div className="h-10 flex items-center justify-center">
              {loadingStep === 0 && (
                <span className="font-extrabold text-slate-700 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  Finding nearest stores...
                </span>
              )}
              {loadingStep === 1 && (
                <span className="font-extrabold text-slate-700 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  Scanning product across nearby stores...
                </span>
              )}
              {loadingStep === 2 && (
                <span className="font-extrabold text-emerald-700 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  Analyzing best price & DB sync...
                </span>
              )}
            </div>
          </div>
        ) : searchResults ? (
          <div className="flex flex-col gap-3">
            
            {/* SEARCH BANNER SUMMARY & TOGGLE */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <h3 className="font-heading font-extrabold text-xs text-slate-900 truncate">
                      Results for "{searchResults.searched_query}"
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Where can I find this product nearby right now?
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                      viewMode === 'table' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <ListFilter className="w-3 h-3" />
                    <span>Compare</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                      viewMode === 'map' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <Map className="w-3 h-3" />
                    <span>GIS Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* REAL OPENSTREETMAP MAP VIEW */}
            {viewMode === 'map' && (
              <RealShopMap
                shopResults={searchResults.shop_results}
                onSelectNavigate={(shop) => handleLaunchDirectNavigation(shop)}
              />
            )}

            {/* PRODUCT PRICE & AVAILABILITY COMPARISON TABLE */}
            {viewMode === 'table' && (
              <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col relative z-20">
                
                {/* TABLE HEADER */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3.5 flex items-center justify-between text-[11px] font-extrabold shadow-md">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Nearby Stores</span>
                  </span>
                  <span className="text-slate-400 font-medium">Sorted by Distance & DB Truth</span>
                </div>

                {/* TABLE CONTENT ROWS */}
                <div className="divide-y divide-slate-100">
                  {searchResults.shop_results && searchResults.shop_results.length > 0 ? (
                    searchResults.shop_results.map((item, idx) => {
                      const { shop, matched_products = [] } = item;
                      const firstProd = matched_products[0] || {};
                      const isInStock = firstProd.is_in_stock;
                      const isPrimaryShop = shop.is_primary || shop.shop_id === 'SHOP001';

                      return (
                        <div
                          key={idx}
                          className={`p-4 flex flex-col gap-3 transition-all ${
                            isPrimaryShop 
                              ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/30 border-l-4 border-l-emerald-500 shadow-sm relative overflow-hidden' 
                              : 'hover:bg-slate-50/80 hover:shadow-md border-l-4 border-l-transparent'
                          }`}
                        >
                          {isPrimaryShop && (
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
                          )}
                          
                          {/* STORE NAME & BADGES LINE */}
                          <div className="flex items-start justify-between gap-3 relative z-10">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-heading font-extrabold text-xs text-slate-900">
                                  {shop.shop_name}
                                </span>
                                {isPrimaryShop && (
                                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <BadgeCheck className="w-3 h-3" />
                                    <span>Verified DB Store</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {shop.address} • <strong>{shop.distance_km} km away</strong>
                              </span>
                            </div>

                            {/* PRICE TAG */}
                            <div className="flex flex-col items-end">
                              <span className="font-black text-lg text-emerald-700 bg-emerald-50/50 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-emerald-100/50 shadow-sm shrink-0">
                                ₹{firstProd.selling_price}
                              </span>
                            </div>
                          </div>

                          {/* PRODUCT & STOCK STATUS */}
                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                            <span className="font-extrabold text-slate-800 truncate max-w-[180px]">
                              {firstProd.product_name}
                            </span>

                            <span
                              className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${
                                isInStock
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {isInStock ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{firstProd.stock_badge}</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Out of Stock</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* ACTION BUTTONS: DIRECT NAVIGATE & CALL */}
                          <div className="flex items-center gap-3 pt-2 font-sans">
                            <button
                              type="button"
                              onClick={() => handleLaunchDirectNavigation(shop)}
                              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all border border-emerald-400/20"
                            >
                              <Navigation className="w-3.5 h-3.5 text-white" />
                              <span>Get Directions →</span>
                            </button>

                            {shop.phone && (
                              <a
                                href={`tel:${shop.phone}`}
                                className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm transition-all"
                              >
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                <span>Call</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-xs italic">
                      No nearby local shops carry this product right now.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* CAMERA SNAP MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-[400px] w-full p-4 border-2 border-amber-500 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-heading font-extrabold text-sm text-slate-900">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>Snap Photo Search</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                className="p-1 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-300 min-h-[220px] flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button
              type="button"
              onClick={handleSnapPhotoSearch}
              className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-heading font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Camera className="w-4 h-4 text-slate-950" />
              <span>Snap & Find Nearby</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
