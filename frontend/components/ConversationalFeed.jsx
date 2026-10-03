'use client';

import React from 'react';
import { Bot, User, Volume2, CheckCircle2 } from 'lucide-react';

export default function ConversationalFeed({ messages = [] }) {
  const speakText = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-slate-900 font-heading font-bold text-base">
          <Bot className="w-5 h-5 text-emerald-600" />
          <span>Conversational AI Assistant</span>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
          Zero Form Mode
        </span>
      </div>

      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">
            Snap a product photo or speak into the mic to start natural onboarding!
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 p-3 rounded-xl border transition-all ${
                msg.sender === 'ai'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900 ml-6'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                  msg.sender === 'ai' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {msg.sender === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">
                    {msg.sender === 'ai' ? 'AI Assistant' : 'Shopkeeper'}
                  </span>
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.text)}
                      className="text-emerald-700 hover:text-emerald-900 p-1"
                      title="Listen Audio"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>

                {msg.product && (
                  <div className="mt-1.5 p-2 bg-white/80 border border-emerald-300 rounded-lg flex items-center justify-between text-xs font-bold text-emerald-900 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{msg.product.name}</span>
                    </div>
                    <span>{msg.product.quantity} {msg.product.unit || 'units'} @ ₹{msg.product.selling_price}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
