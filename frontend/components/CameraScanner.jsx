'use client';

import React, { useState } from 'react';
import { Camera, Package } from 'lucide-react';

export default function CameraScanner({ videoRef, canvasRef, onSnapPhoto }) {
  const [cameraActive, setCameraActive] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 font-heading font-bold text-base">
          <Camera className="w-5 h-5 text-emerald-600" />
          <span>Product Snap View</span>
        </div>
      </div>
    </div>
  );
}
