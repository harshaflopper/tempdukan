'use client';

import React from 'react';
import { Newspaper, ChevronRight, Volume2, Sparkles, FileText } from 'lucide-react';

export default function NewspaperBanner({ newspaperData, onOpenNewspaperModal, speakAIVoicePrompt }) {
  if (!newspaperData) return null;

  const { edition_name, date_str, stories = {}, bulletin_audio_script } = newspaperData;
  const expiryStory = stories.expiry_headline || {};
  const fastStory = stories.fast_movers_headline || {};
  const udhaarStory = stories.udhaar_headline || {};

  return (
    <div
      onClick={onOpenNewspaperModal}
      className="cursor-pointer bg-[#faf7f0] border-2 border-amber-900/30 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 font-serif"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-900 text-amber-50 flex items-center justify-center shrink-0 border border-amber-950/40 shadow-xs">
          <Newspaper className="w-6 h-6" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap font-sans">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-amber-900 text-amber-50 rounded-md">
              दैनिक दुकान समाचार
            </span>
            <span className="text-[11px] font-bold text-amber-800/80">
              {date_str || '4 अक्टूबर 2026'} | संस्करण: SHOP001
            </span>
          </div>

          <p className="text-sm font-bold text-amber-950 mt-1 line-clamp-1 leading-snug">
            {expiryStory.title ? `${expiryStory.title} — ${fastStory.title || ''}` : 'आज की मुख्य ख़बरें पढ़ें'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-sans">
        {bulletin_audio_script && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (speakAIVoicePrompt) speakAIVoicePrompt(bulletin_audio_script);
            }}
            className="px-3 py-2 rounded-xl bg-amber-200/80 hover:bg-amber-300/80 text-amber-950 border border-amber-900/30 font-bold text-xs flex items-center gap-1.5 transition-all"
            title="समाचार वाचक ऑडियो सुनें"
          >
            <Volume2 className="w-4 h-4 text-amber-900" />
            <span className="hidden md:inline">समाचार वाचक</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNewspaperModal();
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-amber-50 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <span>अखबार पढ़ें</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
