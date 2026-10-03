'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, Volume2, Play } from 'lucide-react';

export default function VoiceRecorder({ onAudioRecorded }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [statusText, setStatusText] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
        }
      });

      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        setStatusText('Voice note captured successfully!');
        if (onAudioRecorded) onAudioRecorded(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setStatusText('Recording... Speak product name, price, quantity, expiry');
    } catch (err) {
      alert('Microphone permission denied or unsupported.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 font-heading font-bold text-base">
          <Volume2 className="w-5 h-5 text-emerald-600" />
          <span>Voice Note (Hindi / English)</span>
        </div>
        {isRecording && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full animate-pulse">
            Recording Live...
          </span>
        )}
      </div>

      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          className="w-full min-h-[54px] flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 rounded-xl font-bold text-base transition-all"
        >
          <Mic className="w-5 h-5 text-emerald-600" />
          <span>Tap to Record Voice Note</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="w-full min-h-[54px] flex items-center justify-center gap-3 bg-red-50 border-2 border-red-600 text-red-600 rounded-xl font-bold text-base animate-mic-pulse"
        >
          <Square className="w-5 h-5 fill-current" />
          <span>Stop Recording</span>
        </button>
      )}

      {recordedAudioUrl && !isRecording && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <Play className="w-4 h-4 text-emerald-600" />
            <span>Voice note ready for AI analysis</span>
          </div>
          <audio src={recordedAudioUrl} controls className="h-7 max-w-[160px]" />
        </div>
      )}

      {statusText && (
        <span className="text-xs font-medium text-slate-500 italic">{statusText}</span>
      )}
    </div>
  );
}
