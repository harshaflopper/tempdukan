'use client';

import React, { useState } from 'react';
import {
  Newspaper,
  Volume2,
  Tag,
  Check,
  X,
  Phone,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Coins,
  ShieldAlert,
  ShoppingBag,
  Sparkles
} from 'lucide-react';

export default function ShopNewspaperModal({
  newspaperData,
  onClose,
  onApplyDiscount,
  onUpdateStock,
  speakAIVoicePrompt
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [appliedItemIds, setAppliedItemIds] = useState([]);

  if (!newspaperData) return null;

  const {
    edition_name = 'दैनिक दुकान समाचार',
    tagline = 'LastDukan Daily Edition - SHOP001',
    date_str = 'रविवार, 4 अक्टूबर 2026',
    shop_id = 'SHOP001',
    stories = {},
    bulletin_audio_script = ''
  } = newspaperData;

  const expiryStory = stories.expiry_headline || {};
  const fastStory = stories.fast_movers_headline || {};
  const slowStory = stories.slow_movers_headline || {};
  const udhaarStory = stories.udhaar_headline || {};

  const handlePlayBulletin = () => {
    if (bulletin_audio_script && speakAIVoicePrompt) {
      speakAIVoicePrompt(bulletin_audio_script);
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 8000);
    }
  };

  const handleApplyDiscountClick = async (productId, suggestedPrice) => {
    if (onApplyDiscount) {
      await onApplyDiscount(productId, suggestedPrice);
      setAppliedItemIds((prev) => [...prev, productId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in font-serif">
      <div className="bg-[#fbf8f1] rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border-4 border-amber-950/50 shadow-2xl text-amber-950">
        
        {/* NEWSPAPER TOP HEADER & MASTHEAD */}
        <div className="bg-[#f4efe4] p-4 sm:p-6 border-b-4 border-amber-950 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-amber-900/30 pb-2 font-sans text-xs font-bold text-amber-900">
            <div className="flex items-center gap-3">
              <span>दिनांक: {date_str}</span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">संस्करण: {shop_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-900 text-amber-50 px-2 py-0.5 rounded text-[10px] uppercase font-extrabold">
                दुकान समाचार विशेषांक
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-amber-900/10 hover:bg-amber-900/20 text-amber-950 transition-all font-sans"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN MASTHEAD TITLE */}
          <div className="flex flex-col items-center justify-center text-center my-1">
            <h1 className="font-serif font-black text-3xl sm:text-5xl tracking-tight text-amber-950 uppercase border-b-2 border-amber-950 pb-1 w-full max-w-2xl">
              {edition_name}
            </h1>
            <p className="text-xs sm:text-sm font-sans font-bold text-amber-900/80 mt-1 uppercase tracking-wider">
              {tagline} — AI संचालित दैनिक दुकान ब्रीफिंग
            </p>
          </div>

          {/* NEWS ANCHOR AUDIO PLAYER BAR */}
          {bulletin_audio_script && (
            <div className="bg-amber-900 text-amber-50 p-3 rounded-2xl flex items-center justify-between gap-3 font-sans shadow-md border border-amber-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-950 flex items-center justify-center font-bold shrink-0">
                  <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-amber-200">
                    समाचार वाचक (AI Daily Voice Bulletin)
                  </span>
                  <span className="text-xs font-medium text-amber-100 line-clamp-1">
                    आज का पूरा दुकान समाचार बोल के सुनें
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePlayBulletin}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all shrink-0"
              >
                <Volume2 className="w-4 h-4 text-amber-950" />
                <span>{isPlayingAudio ? 'ब्रीफिंग चालू है...' : 'पूरा समाचार सुनें'}</span>
              </button>
            </div>
          )}
        </div>

        {/* NEWSPAPER FRONT PAGE STORIES GRID */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#fbf8f1]">
          
          {/* COLUMN 1: मुख्य समाचार (CRITICAL EXPIRY & CLEARANCE) */}
          <div className="bg-[#f5efdf] rounded-2xl p-4 sm:p-5 border-2 border-amber-950/40 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-amber-950/30 pb-2 font-sans">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-300 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {expiryStory.category || 'मुख्य समाचार'}
                </span>
                <span className="text-[11px] font-bold text-amber-900/70">पेज 1 - प्राथमिकता</span>
              </div>

              <h2 className="font-serif font-black text-xl text-amber-950 leading-tight">
                {expiryStory.title || 'स्टॉक तरोताजा है'}
              </h2>

              <p className="text-sm font-serif leading-relaxed text-amber-900 font-medium">
                {expiryStory.body || 'आपकी दुकान का पूरा स्टॉक सुरक्षित है।'}
              </p>

              {/* PRODUCT ACTION LIST */}
              {expiryStory.items && expiryStory.items.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 font-sans">
                  {expiryStory.items.map((item) => {
                    const isApplied = appliedItemIds.includes(item.id);
                    return (
                      <div key={item.id} className="bg-[#fbf8f1] p-3 rounded-xl border border-amber-900/30 flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-amber-950">{item.name}</span>
                          <span className="text-[11px] font-semibold text-rose-800">
                            Exp: {item.expiry_date} | Stock: {item.quantity} {item.unit}
                          </span>
                        </div>

                        {item.suggested_clearance_price && (
                          <button
                            type="button"
                            disabled={isApplied}
                            onClick={() => handleApplyDiscountClick(item.id, item.suggested_clearance_price)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all ${
                              isApplied
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> ₹{item.suggested_clearance_price}
                              </>
                            ) : (
                              <>
                                <Tag className="w-3.5 h-3.5" /> ₹{item.suggested_clearance_price} लगाएं
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: बाज़ार हलचल (FAST MOVERS & LOW STOCK) */}
          <div className="bg-[#f5efdf] rounded-2xl p-4 sm:p-5 border-2 border-amber-950/40 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-amber-950/30 pb-2 font-sans">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {fastStory.category || 'बाज़ार हलचल'}
                </span>
                <span className="text-[11px] font-bold text-amber-900/70">पेज 2 - बिक्री समाचार</span>
              </div>

              <h2 className="font-serif font-black text-xl text-amber-950 leading-tight">
                {fastStory.title || 'बिक्री सामान्य गति से जारी'}
              </h2>

              <p className="text-sm font-serif leading-relaxed text-amber-900 font-medium">
                {fastStory.body || 'मुख्य सामानों की मात्रा पर्याप्त है।'}
              </p>

              {/* FAST MOVER ACTION LIST */}
              {fastStory.items && fastStory.items.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 font-sans">
                  {fastStory.items.map((item) => (
                    <div key={item.id} className="bg-[#fbf8f1] p-3 rounded-xl border border-amber-900/30 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-amber-950">{item.name}</span>
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Stock: केवल {item.quantity} {item.unit} | ₹{item.selling_price}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onUpdateStock && onUpdateStock(item.id, parseFloat(item.quantity) + 10)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center gap-1 transition-all shadow-2xs"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>+10 री-ऑर्डर</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: धीमी बिक्री चेतावनी (DEAD STOCK & DO NOT RESTOCK) */}
          <div className="bg-[#f5efdf] rounded-2xl p-4 sm:p-5 border-2 border-amber-950/40 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-amber-950/30 pb-2 font-sans">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-md border border-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {slowStory.category || 'धीमी बिक्री चेतावनी'}
                </span>
                <span className="text-[11px] font-bold text-amber-900/70">पेज 3 - गल्ला सलाह</span>
              </div>

              <h2 className="font-serif font-black text-xl text-amber-950 leading-tight">
                {slowStory.title || 'बिक्री चक्र सुचारू है'}
              </h2>

              <p className="text-sm font-serif leading-relaxed text-amber-900 font-medium">
                {slowStory.body || 'कोई सामान रुका हुआ नहीं है।'}
              </p>

              {/* SLOW MOVER GUIDANCE */}
              {slowStory.items && slowStory.items.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 font-sans">
                  {slowStory.items.map((item) => (
                    <div key={item.id} className="bg-[#fbf8f1] p-3 rounded-xl border border-amber-900/30 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-amber-950">{item.name}</span>
                        <span className="text-[11px] font-semibold text-amber-900">
                          Stock: {item.quantity} {item.unit} | 20+ दिन से रुका
                        </span>
                      </div>

                      <span className="text-[11px] font-extrabold text-amber-950 bg-amber-200 px-2 py-1 rounded-md border border-amber-400 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3 text-amber-900" />
                        दोबारा न मंगाएं
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 4: उधार वसूली समाचार (UDHAAR RECOVERY BRIEFING) */}
          <div className="bg-[#f5efdf] rounded-2xl p-4 sm:p-5 border-2 border-amber-950/40 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-amber-950/30 pb-2 font-sans">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 bg-amber-300 px-2.5 py-0.5 rounded-md border border-amber-500 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  {udhaarStory.category || 'उधार वसूली'}
                </span>
                <span className="text-[11px] font-bold text-amber-900/70">पेज 4 - गल्ला रिकवरी</span>
              </div>

              <h2 className="font-serif font-black text-xl text-amber-950 leading-tight">
                {udhaarStory.title || 'उधार खाता संतुलित है'}
              </h2>

              <p className="text-sm font-serif leading-relaxed text-amber-900 font-medium">
                {udhaarStory.body || 'किसी ग्राहक का भारी बकाया नहीं है।'}
              </p>

              {/* UDHAAR CUSTOMER LIST */}
              {udhaarStory.customers && udhaarStory.customers.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 font-sans">
                  {udhaarStory.customers.map((c) => (
                    <div key={c.id} className="bg-[#fbf8f1] p-3 rounded-xl border border-amber-900/30 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-amber-950">{c.name}</span>
                        <span className="text-[11px] font-extrabold text-rose-900">
                          बकाया: ₹{c.udhaar_balance}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="p-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-all"
                            title="Call Customer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => speakAIVoicePrompt && speakAIVoicePrompt(`${c.name} को ₹${c.udhaar_balance} का SMS भेज दिया गया है`)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-900 text-amber-50 font-bold text-xs flex items-center gap-1 hover:bg-amber-950 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS रिमाइंडर</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* FOOTER BAR */}
        <div className="p-4 bg-[#f4efe4] border-t-2 border-amber-950 text-center font-sans text-xs font-bold text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>दैनिक दुकान समाचार — AI संचालित किराना व्यापार पत्रिका</span>
          <span>LastDukan Express - Smart Shop Assistant</span>
        </div>
      </div>
    </div>
  );
}
