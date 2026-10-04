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
  Sparkles,
  Calendar,
  CloudSun
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
      setTimeout(() => setIsPlayingAudio(false), 9000);
    }
  };

  const handleApplyDiscountClick = async (productId, suggestedPrice) => {
    if (onApplyDiscount) {
      await onApplyDiscount(productId, suggestedPrice);
      setAppliedItemIds((prev) => [...prev, productId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in font-newspaper-body">
      {/* OUTER NEWSPAPER CONTAINER */}
      <div className="bg-[#f7f3e9] text-[#1a150e] rounded-xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border-4 border-[#1a150e] shadow-2xl relative">
        
        {/* NEWSPAPER MASTHEAD HEADER */}
        <div className="bg-[#f2ece0] p-4 sm:p-6 border-b-4 border-[#1a150e] flex flex-col gap-3 relative">
          
          {/* TOP EAR-PIECES (हिंदी अखबार का कोना / ईयर पीस) */}
          <div className="grid grid-cols-3 items-center border-b border-[#1a150e]/30 pb-2 text-[11px] font-bold text-[#1a150e]">
            {/* Left Ear-piece */}
            <div className="flex items-center gap-1.5 border-r border-[#1a150e]/30 pr-2">
              <CloudSun className="w-4 h-4 text-amber-900 shrink-0" />
              <span>मौसम: 28°C साफ़ | शुभ मुहूर्त आज</span>
            </div>

            {/* Center Tag */}
            <div className="text-center font-newspaper-headline text-xs font-black tracking-wider uppercase text-amber-950">
              भारत का नं. 1 दुकान समाचार पत्र
            </div>

            {/* Right Ear-piece */}
            <div className="text-right border-l border-[#1a150e]/30 pl-2 flex items-center justify-end gap-2">
              <span>मूल्य: निःशुल्क (दुकान संस्करण)</span>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded bg-[#1a150e]/10 hover:bg-[#1a150e]/20 text-[#1a150e] transition-all font-sans"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN NEWSPAPER TITLE (मस्तहेड - मुख्य शीर्षक) */}
          <div className="flex flex-col items-center justify-center text-center my-1">
            <h1 className="font-newspaper-headline font-black text-4xl sm:text-6xl tracking-tight text-[#1a150e] uppercase leading-none py-1">
              {edition_name}
            </h1>
            <div className="w-full border-t border-b border-[#1a150e] py-1 my-1 flex items-center justify-between text-xs font-bold px-4">
              <span>वर्ष 1, अंक 245</span>
              <span className="font-newspaper-headline tracking-widest uppercase">लास्टदुकान दैनिक संस्करण — {shop_id}</span>
              <span>{date_str}</span>
            </div>
          </div>

          {/* NEWS ANCHOR AUDIO PLAYER BAR (समाचार वाचक) */}
          {bulletin_audio_script && (
            <div className="bg-[#1a150e] text-[#f7f3e9] p-3 rounded-lg flex items-center justify-between gap-3 font-sans shadow-md border border-[#1a150e]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-amber-400 font-newspaper-headline">
                    दुकान समाचार वाचक (AI Daily News Bulletin)
                  </span>
                  <span className="text-xs font-medium text-slate-200 line-clamp-1">
                    आज की सभी मुख्य खबरें ऑडियो में बोल के सुनें
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePlayBulletin}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-md flex items-center gap-1.5 shadow-xs transition-all shrink-0 font-sans"
              >
                <Volume2 className="w-4 h-4 text-slate-950" />
                <span>{isPlayingAudio ? 'ब्रीफिंग जारी है...' : 'पूरा समाचार सुनें'}</span>
              </button>
            </div>
          )}
        </div>

        {/* NEWSPAPER 3-COLUMN FRONT PAGE GRID */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#f7f3e9]">
          
          {/* COLUMN 1: मुख्य समाचार (LEAD FRONT-PAGE STORY: EXPIRY & CLEARANCE) */}
          <div className="newspaper-column-rule pr-0 md:pr-4 flex flex-col gap-4">
            <div className="border-b-2 border-[#1a150e] pb-1.5">
              <span className="bg-[#1a150e] text-white px-2 py-0.5 text-[11px] font-extrabold font-sans uppercase tracking-widest">
                {expiryStory.category || 'मुख्य समाचार'}
              </span>
              <span className="text-[10px] font-bold text-slate-600 float-right">पेज 1 - एक्सपायारी अलर्ट</span>
            </div>

            <h2 className="font-newspaper-headline font-extrabold text-2xl text-[#1a150e] leading-snug">
              {expiryStory.title || 'स्टॉक तरोताजा है'}
            </h2>

            {/* PRESS PHOTO FRAME WITH CAPTION */}
            <div className="bg-[#ede7d7] p-2 border border-[#1a150e]/40 shadow-2xs">
              <div className="bg-slate-900 text-amber-100 p-4 rounded text-center flex flex-col items-center justify-center min-h-[100px] border border-amber-900/40">
                <ShieldAlert className="w-8 h-8 text-amber-400 mb-1" />
                <span className="text-xs font-bold font-sans">दुकान शेल्फ फोटो रिपोर्ट</span>
              </div>
              <p className="text-[11px] font-bold text-[#1a150e] italic mt-1.5 text-center">
                चित्र: शेल्फ पर रखे सामान की तुरंत बिक्री आवश्यक है।
              </p>
            </div>

            <p className="text-sm font-newspaper-body text-[#1a150e] leading-relaxed text-justify newspaper-drop-cap">
              {expiryStory.body || 'आपकी दुकान का पूरा स्टॉक सुरक्षित है। सभी सामानों की एक्सपायरी डेट लंबी है।'}
            </p>

            {/* PRODUCT EXPIRY CLEARANCE ACTION ITEMS */}
            {expiryStory.items && expiryStory.items.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 font-sans border-t border-[#1a150e]/20 pt-3">
                <span className="text-xs font-extrabold uppercase text-[#1a150e] block">
                  तुरंत डिस्काउंट लगाएं:
                </span>
                {expiryStory.items.map((item) => {
                  const isApplied = appliedItemIds.includes(item.id);
                  return (
                    <div key={item.id} className="bg-[#eee8d8] p-2.5 rounded border border-[#1a150e]/30 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-[#1a150e]">{item.name}</span>
                        <span className="text-[11px] font-semibold text-rose-900">
                          Exp: {item.expiry_date} | Qty: {item.quantity} {item.unit}
                        </span>
                      </div>

                      {item.suggested_clearance_price && (
                        <button
                          type="button"
                          disabled={isApplied}
                          onClick={() => handleApplyDiscountClick(item.id, item.suggested_clearance_price)}
                          className={`px-3 py-1.5 rounded text-xs font-extrabold flex items-center gap-1 transition-all ${
                            isApplied
                              ? 'bg-emerald-800 text-white'
                              : 'bg-[#1a150e] hover:bg-slate-900 text-amber-300'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> ₹{item.suggested_clearance_price}
                            </>
                          ) : (
                            <>
                              <Tag className="w-3.5 h-3.5" /> ₹{item.suggested_clearance_price}
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

          {/* COLUMN 2: बाज़ार हलचल (FAST MOVERS & DEAD STOCK ADVICE) */}
          <div className="newspaper-column-rule pr-0 md:pr-4 flex flex-col gap-4">
            <div className="border-b-2 border-[#1a150e] pb-1.5">
              <span className="bg-[#1a150e] text-white px-2 py-0.5 text-[11px] font-extrabold font-sans uppercase tracking-widest">
                {fastStory.category || 'बाज़ार हलचल'}
              </span>
              <span className="text-[10px] font-bold text-slate-600 float-right">पेज 2 - बिक्री ख़बर</span>
            </div>

            <h2 className="font-newspaper-headline font-extrabold text-2xl text-[#1a150e] leading-snug">
              {fastStory.title || 'बिक्री सामान्य गति से जारी'}
            </h2>

            <p className="text-sm font-newspaper-body text-[#1a150e] leading-relaxed text-justify">
              {fastStory.body || 'मुख्य सामानों की मात्रा पर्याप्त है।'}
            </p>

            {/* FAST MOVER ACTION LIST */}
            {fastStory.items && fastStory.items.length > 0 && (
              <div className="flex flex-col gap-2 font-sans border-t border-[#1a150e]/20 pt-3">
                {fastStory.items.map((item) => (
                  <div key={item.id} className="bg-[#eee8d8] p-2.5 rounded border border-[#1a150e]/30 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-[#1a150e]">{item.name}</span>
                      <span className="text-[11px] font-semibold text-emerald-900">
                        केवल {item.quantity} {item.unit} बचे हैं
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onUpdateStock && onUpdateStock(item.id, parseFloat(item.quantity) + 10)}
                      className="px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs flex items-center gap-1 transition-all"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>+10 री-ऑर्डर</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SLOW MOVER & DEAD STOCK WARNING BOX */}
            <div className="border-t-2 border-b-2 border-[#1a150e] py-3 my-2 flex flex-col gap-2">
              <div className="flex items-center justify-between font-sans">
                <span className="font-newspaper-headline text-sm font-extrabold uppercase text-[#1a150e]">
                  {slowStory.category || 'धीमी बिक्री चेतावनी'}
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-900" />
              </div>

              <h3 className="font-newspaper-headline font-bold text-base text-[#1a150e]">
                {slowStory.title || 'बिक्री चक्र सुचारू है'}
              </h3>

              <p className="text-xs font-newspaper-body text-[#1a150e]">
                {slowStory.body || 'कोई सामान रुका हुआ नहीं है।'}
              </p>

              {slowStory.items && slowStory.items.length > 0 && (
                <div className="flex flex-col gap-1.5 font-sans mt-1">
                  {slowStory.items.map((item) => (
                    <div key={item.id} className="bg-[#e8e1cf] p-2 rounded border border-[#1a150e]/30 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1a150e]">{item.name}</span>
                      <span className="text-[10px] font-extrabold bg-amber-900 text-amber-50 px-2 py-0.5 rounded">
                        दोबारा न मंगाएं
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: उधार वसूली & विज्ञापन समाचार (CLASSIFIEDS & UDHAAR) */}
          <div className="flex flex-col gap-4">
            <div className="border-b-2 border-[#1a150e] pb-1.5">
              <span className="bg-[#1a150e] text-white px-2 py-0.5 text-[11px] font-extrabold font-sans uppercase tracking-widest">
                {udhaarStory.category || 'उधार वसूली'}
              </span>
              <span className="text-[10px] font-bold text-slate-600 float-right">पेज 3 - गल्ला समाचार</span>
            </div>

            {/* CLASSIFIEDS / NOTICE BOX STYLE FOR UDHAAR */}
            <div className="bg-[#ede7d7] border-2 border-[#1a150e] p-3 shadow-2xs flex flex-col gap-2">
              <div className="text-center font-newspaper-headline text-xs font-black uppercase tracking-wider border-b border-[#1a150e] pb-1">
                विशेष सूचना: उधार वसूली रिगार्डिंग
              </div>

              <h2 className="font-newspaper-headline font-extrabold text-lg text-[#1a150e] leading-snug">
                {udhaarStory.title || 'उधार खाता संतुलित है'}
              </h2>

              <p className="text-xs font-newspaper-body text-[#1a150e] leading-relaxed">
                {udhaarStory.body || 'किसी ग्राहक का भारी बकाया नहीं है।'}
              </p>

              {/* UDHAAR CUSTOMER LIST */}
              {udhaarStory.customers && udhaarStory.customers.length > 0 && (
                <div className="flex flex-col gap-2 font-sans mt-1">
                  {udhaarStory.customers.map((c) => (
                    <div key={c.id} className="bg-[#f7f3e9] p-2.5 rounded border border-[#1a150e]/30 flex items-center justify-between gap-1">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-[#1a150e]">{c.name}</span>
                        <span className="text-[11px] font-extrabold text-rose-900">
                          बकाया: ₹{c.udhaar_balance}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="p-1.5 rounded bg-emerald-800 text-white hover:bg-emerald-900 transition-all"
                            title="Call Customer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => speakAIVoicePrompt && speakAIVoicePrompt(`${c.name} को ₹${c.udhaar_balance} का SMS भेज दिया गया है`)}
                          className="px-2 py-1 rounded bg-[#1a150e] text-amber-300 font-bold text-[11px] flex items-center gap-1 hover:bg-slate-900 transition-all"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>SMS</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DUKANDAR AD & TIPS BOX */}
            <div className="bg-[#f0e9d9] border border-[#1a150e]/40 p-3 rounded flex flex-col gap-1.5 font-sans">
              <span className="text-[10px] font-extrabold uppercase text-amber-950 tracking-wider">
                दुकानदार दैनिक मंत्र:
              </span>
              <p className="text-xs font-newspaper-body text-[#1a150e] italic">
                "शाम के समय बिक्री काउंटर (गल्ला) की गिनती करें और धीमी गति वाले सामान को फ्रंट शेल्फ पर रखें।"
              </p>
            </div>
          </div>

        </div>

        {/* NEWSPAPER FOOTER BAR */}
        <div className="p-3 bg-[#e8e1cf] border-t-4 border-[#1a150e] text-center font-sans text-xs font-bold text-[#1a150e] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>मुद्रित एवं प्रकाशित: लास्टदुकान प्रेस, SHOP001 — भारत का दैनिक किराना समाचार</span>
          <span>LastDukan Express Daily Newspaper</span>
        </div>
      </div>
    </div>
  );
}
