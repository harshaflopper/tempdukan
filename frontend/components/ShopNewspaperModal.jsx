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
  const marketStory = stories.market_demand_headline || {};

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-in fade-in zoom-in-95 duration-300 font-newspaper-body">
      {/* OUTER NEWSPAPER CONTAINER - PAPER TEXTURE & DOUBLE BORDER */}
      <div className="relative w-full max-w-6xl max-h-[96vh] flex flex-col bg-[#f4ebd0] shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_0_100px_rgba(139,115,85,0.15)] rounded-sm border-[12px] border-double border-[#2c2416] overflow-hidden">
        
        {/* TOP FOLD GRADIENT (Skeuomorphic lighting) */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/40 to-transparent pointer-events-none z-10" />

        <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden relative z-20 custom-scrollbar">
          
          {/* MASTHEAD SECTION */}
          <div className="px-6 pt-8 pb-4 flex flex-col gap-4 items-center border-b-[3px] border-[#2c2416] bg-gradient-to-b from-[#fdfbf7] to-transparent">
            
            {/* EARPIECES & DATE */}
            <div className="w-full flex justify-between items-end border-b border-[#2c2416] pb-2 text-[11px] sm:text-xs font-bold text-[#4a3f35] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <CloudSun className="w-4 h-4" />
                <span>मौसम: 28°C साफ़ | शुभ मुहूर्त</span>
              </div>
              <div className="hidden sm:block text-center font-black tracking-widest px-4 border-x border-[#2c2416]">
                भारत का नं. 1 दुकान समाचार पत्र
              </div>
              <div className="flex items-center gap-4">
                <span>दैनिक संस्करण: {shop_id}</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-full bg-[#2c2416]/10 hover:bg-[#2c2416] hover:text-[#f4ebd0] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TITLE */}
            <div className="flex flex-col items-center justify-center text-center w-full relative py-2 sm:py-4">
              <h1 className="font-newspaper-headline font-black text-6xl sm:text-[5.5rem] tracking-tighter text-[#1b160e] uppercase leading-none" style={{ textShadow: '2px 2px 0px rgba(255,255,255,0.5)' }}>
                {edition_name}
              </h1>
              <span className="absolute -bottom-3 bg-[#f4ebd0] px-4 text-xs sm:text-sm font-black tracking-[0.3em] text-[#4a3f35] border border-[#2c2416] py-1">
                {date_str} — वर्ष 1, अंक 245
              </span>
            </div>
          </div>

          {/* VINTAGE RADIO / AUDIO PLAYER */}
          {bulletin_audio_script && (
            <div className="mx-6 mt-6 mb-2">
              <div className="bg-gradient-to-r from-[#2c2416] via-[#3a2f20] to-[#2c2416] text-[#e8dbb5] p-1 rounded-sm shadow-[0_5px_15px_rgba(0,0,0,0.3)] border-2 border-[#16120b] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_100%)] pointer-events-none" />
                <div className="border border-[#4a3f35]/50 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4af37] to-[#aa7c11] border-2 border-[#16120b] flex items-center justify-center shadow-[inset_0_2px_5px_rgba(255,255,255,0.5)]">
                      <Volume2 className={`w-6 h-6 text-[#16120b] ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-widest text-[#d4af37] font-newspaper-headline drop-shadow-md">
                        रेडियो बुलेटिन (AI News Anchor)
                      </span>
                      <span className="text-xs font-semibold opacity-80 tracking-wide">
                        आज की मुख्य ख़बरें ऑडियो में सुनें
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayBulletin}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-b from-[#d4af37] to-[#b38510] hover:from-[#e3c153] hover:to-[#c69a19] text-[#16120b] font-black text-xs uppercase tracking-widest rounded-sm border border-[#16120b] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.4)] active:translate-y-[1px] transition-all"
                  >
                    {isPlayingAudio ? '► ब्रॉडकास्ट जारी...' : '► प्ले बुलेटिन'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EDITORIAL 3-COLUMN GRID */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMN 1: EXPIRY NEWS */}
            <div className="flex flex-col gap-5 lg:border-r-[1.5px] border-[#2c2416]/40 lg:pr-8">
              <div className="flex items-center gap-2 border-y-2 border-[#2c2416] py-1 mb-2">
                <span className="bg-[#2c2416] text-[#f4ebd0] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                  {expiryStory.category || 'मुख्य समाचार'}
                </span>
                <span className="text-[10px] font-bold text-[#5a4f40] uppercase tracking-wider ml-auto">पेज 1</span>
              </div>

              <h2 className="font-newspaper-headline font-black text-3xl sm:text-4xl text-[#1b160e] leading-[1.1] tracking-tight">
                {expiryStory.title || 'स्टॉक तरोताजा है'}
              </h2>

              {/* VINTAGE PRESS PHOTO */}
              <div className="bg-[#e9dec0] p-1.5 border border-[#4a3f35]/30 rotate-1 hover:rotate-0 transition-transform">
                <div className="bg-[#2c2416] grayscale contrast-125 text-[#d4af37] p-6 flex flex-col items-center justify-center min-h-[140px] border border-[#16120b]">
                  <ShieldAlert className="w-12 h-12 mb-3 opacity-90" />
                  <span className="text-sm font-black tracking-widest uppercase">दुकान शेल्फ रिपोर्ट</span>
                </div>
                <p className="text-[10px] font-bold text-[#4a3f35] italic mt-2 px-1 text-center font-serif">
                  चित्र 1: शेल्फ पर रखे सामान की तुरंत बिक्री आवश्यक है।
                </p>
              </div>

              <p className="text-sm font-newspaper-body text-[#2c2416] leading-relaxed text-justify first-letter:text-6xl first-letter:font-black first-letter:text-[#1b160e] first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                {expiryStory.body || 'आपकी दुकान का पूरा स्टॉक सुरक्षित है। सभी सामानों की एक्सपायरी डेट लंबी है।'}
              </p>

              {/* CLEARANCE ACTION ITEMS */}
              {expiryStory.items && expiryStory.items.length > 0 && (
                <div className="mt-4 border-t-2 border-dashed border-[#4a3f35]/30 pt-4 flex flex-col gap-3">
                  <span className="text-xs font-black uppercase tracking-widest text-[#1b160e]">
                    » तुरंत डिस्काउंट लगाएं
                  </span>
                  {expiryStory.items.map((item) => {
                    const isApplied = appliedItemIds.includes(item.id);
                    return (
                      <div key={item.id} className="bg-[#ede4cb] p-3 border border-[#2c2416]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm text-[#1b160e]">{item.name}</span>
                          <span className="text-[11px] font-bold text-[#8b2323] uppercase tracking-wider mt-0.5">
                            Exp: {item.expiry_date} | Qty: {item.quantity}
                          </span>
                        </div>
                        {item.suggested_clearance_price && (
                          <button
                            type="button"
                            disabled={isApplied}
                            onClick={() => handleApplyDiscountClick(item.id, item.suggested_clearance_price)}
                            className={`w-full sm:w-auto px-4 py-2 text-xs font-black uppercase tracking-widest border border-[#2c2416] shadow-[2px_2px_0px_rgba(44,36,22,1)] active:shadow-none active:translate-y-[2px] transition-all flex items-center justify-center gap-2 ${
                              isApplied
                                ? 'bg-[#2c2416] text-white'
                                : 'bg-[#d4af37] text-[#16120b] hover:bg-[#e3c153]'
                            }`}
                          >
                            {isApplied ? <><Check className="w-4 h-4" /> ₹{item.suggested_clearance_price}</> : <><Tag className="w-4 h-4" /> ₹{item.suggested_clearance_price}</>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLUMN 2: FAST & SLOW MOVERS */}
            <div className="flex flex-col gap-5 lg:border-r-[1.5px] border-[#2c2416]/40 lg:pr-8">
              <div className="flex items-center gap-2 border-y-2 border-[#2c2416] py-1 mb-2">
                <span className="bg-[#2c2416] text-[#f4ebd0] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                  {fastStory.category || 'बाज़ार हलचल'}
                </span>
                <span className="text-[10px] font-bold text-[#5a4f40] uppercase tracking-wider ml-auto">पेज 2</span>
              </div>

              <h2 className="font-newspaper-headline font-black text-2xl sm:text-3xl text-[#1b160e] leading-[1.2] tracking-tight">
                {fastStory.title || 'बिक्री सामान्य गति से जारी'}
              </h2>

              <p className="text-sm font-newspaper-body text-[#2c2416] leading-relaxed text-justify">
                {fastStory.body || 'मुख्य सामानों की मात्रा पर्याप्त है।'}
              </p>

              {fastStory.items && fastStory.items.length > 0 && (
                <div className="flex flex-col gap-3 font-sans border-y border-[#4a3f35]/20 py-4 my-2">
                  {fastStory.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#4a3f35]/10 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-[#1b160e]">{item.name}</span>
                        <span className="text-[11px] font-extrabold text-[#2e5a31] uppercase tracking-wider mt-0.5">
                          शेष स्टॉक: {item.quantity} {item.unit}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateStock && onUpdateStock(item.id, parseFloat(item.quantity) + 10)}
                        className="p-2 bg-[#2c2416] text-[#f4ebd0] hover:bg-[#4a3f35] rounded-full transition-colors"
                        title="+10 री-ऑर्डर"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* SLOW MOVERS AD-BOX */}
              <div className="mt-4 border-[3px] border-[#2c2416] p-4 bg-[#ede4cb] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2c2416] text-[#d4af37] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  {slowStory.category || 'धीमी बिक्री'}
                </div>
                
                <h3 className="font-newspaper-headline font-bold text-xl text-[#1b160e] text-center mt-2 mb-2 leading-tight">
                  {slowStory.title || 'बिक्री चक्र सुचारू है'}
                </h3>
                
                <p className="text-xs font-newspaper-body text-[#4a3f35] text-center italic mb-4">
                  {slowStory.body || 'कोई सामान रुका हुआ नहीं है।'}
                </p>

                {slowStory.items && slowStory.items.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {slowStory.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-xs border-b border-[#4a3f35]/20 pb-1.5 border-dashed">
                        <span className="font-bold text-[#1b160e]">{item.name}</span>
                        <span className="font-black text-[#8b2323] uppercase tracking-widest text-[9px]">✗ रद्द</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* COLUMN 3: UDHAAR & FOOTER */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-y-2 border-[#2c2416] py-1 mb-2">
                <span className="bg-[#2c2416] text-[#f4ebd0] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                  {udhaarStory.category || 'उधार वसूली'}
                </span>
                <span className="text-[10px] font-bold text-[#5a4f40] uppercase tracking-wider ml-auto">पेज 3</span>
              </div>

              <div className="border border-[#2c2416] p-1">
                <div className="border border-[#2c2416] bg-[#fdfbf7] p-4 flex flex-col gap-4 text-center">
                  <h2 className="font-newspaper-headline font-black text-2xl text-[#8b2323] leading-tight border-b-2 border-[#2c2416] pb-3 mx-4">
                    {udhaarStory.title || 'खाता संतुलित है'}
                  </h2>
                  <p className="text-xs font-newspaper-body text-[#4a3f35]">
                    {udhaarStory.body || 'किसी ग्राहक का भारी बकाया नहीं है।'}
                  </p>

                  {udhaarStory.customers && udhaarStory.customers.length > 0 && (
                    <div className="flex flex-col gap-3 mt-2 text-left">
                      {udhaarStory.customers.map((c) => (
                        <div key={c.id} className="flex flex-col gap-2 p-3 bg-[#f4ebd0] border border-[#2c2416]/20">
                          <div className="flex justify-between items-end">
                            <span className="font-black text-sm text-[#1b160e] uppercase tracking-wide">{c.name}</span>
                            <span className="text-sm font-black text-[#8b2323]">₹{c.udhaar_balance}</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className="flex-1 py-1.5 bg-[#2c2416] text-white text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-[#4a3f35] transition-colors">
                                <Phone className="w-3 h-3" /> कॉल
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => speakAIVoicePrompt && speakAIVoicePrompt(`${c.name} को ₹${c.udhaar_balance} का SMS भेजा गया`)}
                              className="flex-1 py-1.5 bg-white border border-[#2c2416] text-[#1b160e] text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-[#ede4cb] transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" /> SMS
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* MARKET DEMAND AD-BOX */}
              <div className="mt-4 border-[3px] border-[#2c2416] p-4 bg-[#f0e9d9] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2c2416] text-[#d4af37] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" />
                  {marketStory.category || 'बाज़ार की मांग'}
                </div>
                
                <h3 className="font-newspaper-headline font-bold text-xl text-[#1b160e] text-center mt-2 mb-2 leading-tight">
                  {marketStory.title || 'स्थानीय मांग सामान्य है'}
                </h3>
                
                <p className="text-xs font-newspaper-body text-[#4a3f35] text-center italic mb-4">
                  {marketStory.body || 'अभी आस-पास के ग्राहकों से कोई नई विशेष मांग नहीं है।'}
                </p>

                {marketStory.items && marketStory.items.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {marketStory.items.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between text-xs border-b border-[#4a3f35]/20 pb-1.5 border-dashed">
                        <span className="font-bold text-[#1b160e]">{item.query.toUpperCase()}</span>
                        <span className="font-black text-[#2e5a31] uppercase tracking-widest text-[10px]">
                          {item.count} खोज
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* DAILY QUOTE */}
              <div className="mt-auto border-t-4 border-double border-[#2c2416] pt-4 text-center">
                <Sparkles className="w-5 h-5 mx-auto text-[#d4af37] mb-2" />
                <p className="font-newspaper-headline font-bold text-lg text-[#1b160e] italic px-4">
                  "जो ग्राहक खोजें, वो दुकानदार जाने।"
                </p>
              </div>
            </div>

          </div>

          {/* NEWSPAPER FOOTER BAR */}
          <div className="mt-auto border-t-[3px] border-[#2c2416] bg-[#e9dec0] py-3 px-6 flex flex-col sm:flex-row items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#4a3f35]">
            <span>मुद्रित एवं प्रकाशित: लास्टदुकान प्रेस, SHOP001</span>
            <span className="hidden sm:inline">•</span>
            <span>भारत का दैनिक किराना समाचार</span>
            <span className="hidden sm:inline">•</span>
            <span>पंजीकरण संख्या: LD-2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
