import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SoundingLevel, LapseRateTuning } from '../types';
import {
  calcVaporPressure,
  calcMixingRatio,
  calcMoistAdiabaticLapseRate,
  calcLCL,
  Rd,
  Cp,
  Lv,
  EPSILON
} from '../lib/metMath';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Move, Edit3 } from 'lucide-react';

interface SkewTCanvasProps {
  levels: SoundingLevel[];
  tuning: LapseRateTuning;
  isEditorMode: boolean;
  onLevelsChanged?: (newLevels: SoundingLevel[]) => void;
}

export const SkewTCanvas: React.FC<SkewTCanvasProps> = ({
  levels,
  tuning,
  isEditorMode,
  onLevelsChanged
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // View Transform (Pan & Zoom)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [hoverInfo, setHoverInfo] = useState<{
    p: number;
    h: number;
    t: number;
    td: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Dragging state for Pan & Editor Mode
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<'pan' | 'temp' | 'dew'>('pan');
  const [dragIndex, setDragIndex] = useState<number>(-1);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Skew-T Layout Constants
  const pBottom = 1050;
  const pTop = 100;
  const tLeft = -50;
  const tRight = 50;
  const skewAngle = (35.0 * Math.PI) / 180.0;

  // Coordinate Conversion Helpers
  const getSkewY = useCallback((p: number, h: number) => {
    const safeP = Math.max(pTop, Math.min(pBottom, p));
    return h - (Math.log(pBottom / safeP) / Math.log(pBottom / pTop)) * h;
  }, [pBottom, pTop]);

  const getPFromY = useCallback((y: number, h: number) => {
    const normY = (h - y) / h;
    return pBottom * Math.pow(pTop / pBottom, normY);
  }, [pBottom, pTop]);

  const getSkewX = useCallback((t: number, y: number, w: number, h: number) => {
    const baseNorm = (t - tLeft) / (tRight - tLeft);
    const skewOffset = (h - y) * Math.tan(skewAngle);
    return baseNorm * w + skewOffset;
  }, [tLeft, tRight, skewAngle]);

  const getTempFromX = useCallback((x: number, y: number, w: number, h: number) => {
    const skewOffset = (h - y) * Math.tan(skewAngle);
    const baseNorm = (x - skewOffset) / w;
    return baseNorm * (tRight - tLeft) + tLeft;
  }, [tLeft, tRight, skewAngle]);

  // Main Render Function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);

    // 1. Draw Isobars (horizontal lines)
    ctx.lineWidth = 1.0 / view.scale;
    const isobars = [1000, 925, 850, 700, 500, 400, 300, 250, 200, 150, 100];
    isobars.forEach((p) => {
      const y = getSkewY(p, h);
      ctx.strokeStyle = p === 1000 || p === 850 || p === 700 || p === 500 || p === 300 || p === 200
        ? 'rgba(71, 85, 105, 0.45)'
        : 'rgba(51, 65, 85, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Pressure labels
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.max(10, 16 / view.scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(`${p} mb`, 8 / view.scale, y - 4 / view.scale);
    });

    // 2. Draw Isotherms (slanted lines at 35°)
    for (let t = -80; t <= 50; t += 10) {
      const xBottom = getSkewX(t, h, w, h);
      const xTop = getSkewX(t, 0, w, h);
      ctx.strokeStyle = t === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(51, 65, 85, 0.25)';
      ctx.lineWidth = t === 0 ? 1.5 / view.scale : 1.0 / view.scale;
      ctx.beginPath();
      ctx.moveTo(xBottom, h);
      ctx.lineTo(xTop, 0);
      ctx.stroke();

      // Temperature labels at bottom
      if (xBottom >= 0 && xBottom <= w) {
        ctx.fillStyle = t === 0 ? '#38bdf8' : '#64748b';
        ctx.font = `${Math.max(9, 14 / view.scale)}px "JetBrains Mono", monospace`;
        ctx.fillText(`${t}°C`, xBottom - 10 / view.scale, h - 8 / view.scale);
      }
    }

    // 3. Draw Dry Adiabats (green-tinted curves theta lines)
    for (let theta = -20; theta <= 140; theta += 20) {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.lineWidth = 1.0 / view.scale;
      ctx.beginPath();
      let started = false;
      for (let p = pBottom; p >= pTop; p -= 25) {
        const tk = (theta + 273.15) * Math.pow(p / 1000.0, 0.286);
        const tC = tk - 273.15;
        const y = getSkewY(p, h);
        const x = getSkewX(tC, y, w, h);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 4. Draw Moist Pseudo-Adiabats (blue/cyan curves theta-w lines)
    for (let thetaW = 8; thetaW <= 36; thetaW += 4) {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.lineWidth = 1.0 / view.scale;
      ctx.beginPath();
      let tC = thetaW;
      let started = false;
      const dp = 15;
      for (let p = pBottom; p >= pTop; p -= dp) {
        const y = getSkewY(p, h);
        const x = getSkewX(tC, y, w, h);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
        const tk = Math.max(180, tC + 273.15);
        const es = calcVaporPressure(tC);
        const rs = calcMixingRatio(es, p);
        const num = Rd * tk + Lv * rs;
        const den = p * (Cp + (Math.pow(Lv, 2) * rs * EPSILON) / (Rd * Math.pow(tk, 2)));
        const factor = tuning.moistLapseFactor !== undefined ? tuning.moistLapseFactor : 1.0;
        const dT = (num / den) * dp * factor;
        tC -= dT;
      }
      ctx.stroke();
    }

    // 5. Draw Sounding Data & Parcel Profile
    if (levels.length > 1) {
      const sfc = levels[0];
      const lcl = calcLCL(sfc.t, sfc.td, sfc.p);

      // Compute parcel ascent curve in pressure coordinates
      const parcelPoints: { p: number; t: number; x: number; y: number }[] = [];
      let curParcelT = sfc.t;
      const dp = 5; // 5 hPa fine step
      for (let p = sfc.p; p >= pTop; p -= dp) {
        const y = getSkewY(p, h);
        const x = getSkewX(curParcelT, y, w, h);
        parcelPoints.push({ p, t: curParcelT, x, y });

        if (p > lcl.lclPressureHpa) {
          // Dry adiabatic lapse rate in pressure coordinates
          const tk = curParcelT + 273.15;
          const dryRate = (tuning.dryLapseRate || 9.8) / 9.8;
          const dT = (0.2854 * (tk / p)) * dp * dryRate;
          curParcelT -= dT;
        } else {
          // Moist pseudo-adiabatic lapse rate in pressure coordinates
          const tk = Math.max(180, curParcelT + 273.15);
          const es = calcVaporPressure(curParcelT);
          const rs = calcMixingRatio(es, p);
          const num = Rd * tk + Lv * rs;
          const den = p * (Cp + (Math.pow(Lv, 2) * rs * EPSILON) / (Rd * Math.pow(tk, 2)));
          const factor = tuning.moistLapseFactor !== undefined ? tuning.moistLapseFactor : 1.0;
          const dT = (num / den) * dp * factor;
          curParcelT -= dT;
        }
      }

      // 6. Draw CAPE & CIN Shaded Areas
      // Polygon between parcel curve and environmental temperature line
      ctx.save();
      for (let i = 0; i < parcelPoints.length - 1; i++) {
        const p1 = parcelPoints[i];
        const p2 = parcelPoints[i + 1];

        // Find environmental T at p1 and p2
        const getEnvT = (pTarget: number) => {
          for (let j = 0; j < levels.length - 1; j++) {
            if (pTarget <= levels[j].p && pTarget >= levels[j + 1].p) {
              const f = (levels[j].p - pTarget) / Math.max(0.01, levels[j].p - levels[j + 1].p);
              return levels[j].t + f * (levels[j + 1].t - levels[j].t);
            }
          }
          return levels[levels.length - 1].t;
        };

        const envT1 = getEnvT(p1.p);
        const envT2 = getEnvT(p2.p);

        const envX1 = getSkewX(envT1, p1.y, w, h);
        const envX2 = getSkewX(envT2, p2.y, w, h);

        if (p1.t > envT1 && p2.t > envT2) {
          // Positive buoyancy (CAPE)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.22)'; // Soft Red
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(envX2, p2.y);
          ctx.lineTo(envX1, p1.y);
          ctx.closePath();
          ctx.fill();
        } else if (p1.t < envT1 && p2.t < envT2 && p1.p > 500) {
          // Negative buoyancy (CIN)
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Soft Blue
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(envX2, p2.y);
          ctx.lineTo(envX1, p1.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // 7. Draw Dotted Lapse-Rate Line (Tuning Feedback)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0 / view.scale;
      ctx.setLineDash([4 / view.scale, 4 / view.scale]);
      ctx.beginPath();
      let lapseT = sfc.t;
      const lapseDp = 20;
      for (let p = sfc.p; p >= 300; p -= lapseDp) {
        const y = getSkewY(p, h);
        const x = getSkewX(lapseT, y, w, h);
        if (p === sfc.p) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        const tk = lapseT + 273.15;
        const dryRate = (tuning.dryLapseRate || 9.8) / 9.8;
        const midWeight = tuning.midLevelWeight || 1.0;
        const weight = p < 700 ? midWeight : 1.0;
        const dT = (0.2854 * (tk / p)) * lapseDp * dryRate * weight;
        lapseT -= dT;
      }
      ctx.stroke();
      ctx.setLineDash([]); // reset dash

      // 8. Draw Parcel Path Line
      ctx.strokeStyle = '#facc15'; // Gold Yellow
      ctx.lineWidth = 2.5 / view.scale;
      ctx.beginPath();
      parcelPoints.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // 9. Draw Temperature Profile (BOLD RED LINE)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4.0 / view.scale;
      ctx.beginPath();
      levels.forEach((l, i) => {
        const y = getSkewY(l.p, h);
        const x = getSkewX(l.t, y, w, h);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 10. Draw Dewpoint Profile (BOLD GREEN LINE)
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4.0 / view.scale;
      ctx.beginPath();
      levels.forEach((l, i) => {
        const y = getSkewY(l.p, h);
        const x = getSkewX(l.td, y, w, h);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 11. Draw LCL Marker
      const lclY = getSkewY(lcl.lclPressureHpa, h);
      const lclX = getSkewX(lcl.lclTempC, lclY, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(lclX, lclY, 5 / view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `bold ${Math.max(10, 14 / view.scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(`LCL (${Math.round(lcl.lclHeightM)}m)`, lclX + 8 / view.scale, lclY - 4 / view.scale);

      // 12. Draw Editor Mode Nodes (Interactive circles)
      if (isEditorMode) {
        levels.forEach((l, idx) => {
          const y = getSkewY(l.p, h);
          const xT = getSkewX(l.t, y, w, h);
          const xTd = getSkewX(l.td, y, w, h);

          // Temp node
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2 / view.scale;
          ctx.beginPath();
          ctx.arc(xT, y, 6 / view.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Dew node
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(xTd, y, 6 / view.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    }

    ctx.restore();
  }, [view, levels, tuning, isEditorMode, getSkewY, getSkewX]);

  // Redraw whenever inputs change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Resize using ResizeObserver for responsive rendering
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientWidth = rect.width > 0 ? rect.width : 500;
        const size = Math.max(300, Math.floor(Math.min(clientWidth, 1000)));
        if (canvasRef.current.width !== size || canvasRef.current.height !== size) {
          canvasRef.current.width = size;
          canvasRef.current.height = size;
        }
        renderCanvas();
      }
    };

    updateDimensions();

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [renderCanvas]);

  // Mouse / Touch Event Handlers
  const getCanvasMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const worldX = (pos.x - view.x) / view.scale;
    const worldY = (pos.y - view.y) / view.scale;

    let foundIndex = -1;
    let foundType: 'temp' | 'dew' | 'pan' = 'pan';
    const hitRadius = 16 / view.scale;

    if (isEditorMode && levels.length > 0) {
      for (let i = 0; i < levels.length; i++) {
        const l = levels[i];
        const y = getSkewY(l.p, h);
        const xT = getSkewX(l.t, y, w, h);
        const xTd = getSkewX(l.td, y, w, h);

        const distT = Math.hypot(worldX - xT, worldY - y);
        const distTd = Math.hypot(worldX - xTd, worldY - y);

        if (distT < hitRadius) {
          foundIndex = i;
          foundType = 'temp';
          break;
        }
        if (distTd < hitRadius) {
          foundIndex = i;
          foundType = 'dew';
          break;
        }
      }
    }

    setIsDragging(true);
    setDragAction(foundType);
    setDragIndex(foundIndex);
    lastMousePos.current = pos;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // Hover Info computation
    const worldX = (pos.x - view.x) / view.scale;
    const worldY = (pos.y - view.y) / view.scale;
    const p = getPFromY(worldY, h);
    const t = getTempFromX(worldX, worldY, w, h);

    if (p >= pTop && p <= pBottom) {
      setHoverInfo({
        p: Math.round(p),
        h: Math.round(44330 * (1 - Math.pow(p / 1013.25, 0.190284))),
        t: Math.round(t * 10) / 10,
        td: Math.round((t - 10) * 10) / 10,
        screenX: pos.x,
        screenY: pos.y
      });
    }

    if (!isDragging) return;

    if (dragAction === 'pan') {
      const dx = pos.x - lastMousePos.current.x;
      const dy = pos.y - lastMousePos.current.y;
      setView((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      lastMousePos.current = pos;
    } else if (isEditorMode && dragIndex >= 0 && onLevelsChanged) {
      const targetLevel = levels[dragIndex];
      const y = getSkewY(targetLevel.p, h);
      const newTemp = Math.round(getTempFromX(worldX, y, w, h) * 10) / 10;

      const newLevels = [...levels];
      if (dragAction === 'temp') {
        newLevels[dragIndex] = {
          ...targetLevel,
          t: newTemp,
          td: Math.min(newTemp, targetLevel.td)
        };
      } else if (dragAction === 'dew') {
        newLevels[dragIndex] = {
          ...targetLevel,
          td: Math.min(targetLevel.t, newTemp)
        };
      }
      onLevelsChanged(newLevels);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragIndex(-1);
    setDragAction('pan');
  };

  const handleZoom = (direction: number) => {
    const factor = direction > 0 ? 1.25 : 0.8;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    setView((prev) => ({
      scale: Math.max(0.6, Math.min(4.0, prev.scale * factor)),
      x: cx - (cx - prev.x) * factor,
      y: cy - (cy - prev.y) * factor
    }));
  };

  const handleResetView = () => {
    setView({ scale: 1, x: 0, y: 0 });
  };

  return (
    <div className="relative w-full flex flex-col items-center select-none" ref={containerRef}>
      {/* Canvas Frame */}
      <div className="relative w-full aspect-square bg-neutral-950 border-2 border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* Floating Zoom & Control Toolbar */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            id="skewt-zoom-in-btn"
            onClick={() => handleZoom(1)}
            title="Zoom In"
            className="p-2 bg-black/70 hover:bg-orange-500 hover:text-black text-orange-400 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="skewt-zoom-out-btn"
            onClick={() => handleZoom(-1)}
            title="Zoom Out"
            className="p-2 bg-black/70 hover:bg-orange-500 hover:text-black text-orange-400 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="skewt-reset-btn"
            onClick={handleResetView}
            title="Reset Pan & Zoom"
            className="p-2 bg-black/70 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Editor Mode Banner indicator */}
        {isEditorMode && (
          <div className="absolute top-3 left-3 bg-red-600/90 text-white px-3 py-1 text-xs font-mono font-bold tracking-wider rounded-md uppercase animate-pulse border border-red-400 shadow-lg flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" />
            Editor Mode: Drag Red (T) / Green (Td) Nodes
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-sm border border-slate-800 p-2.5 rounded-lg text-xs font-mono flex flex-wrap items-center gap-3.5 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-red-500 rounded-full"></span>
            <span>Temp (T)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-green-500 rounded-full"></span>
            <span>Dew (Td)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-yellow-400 rounded-full"></span>
            <span>Parcel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500"></span>
            <span>Lapse Rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-500/40 rounded-sm"></span>
            <span>CAPE</span>
          </div>
        </div>

        {/* Hover Coordinate Overlay */}
        {hoverInfo && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-cyan-300 border border-cyan-800 px-3 py-1 rounded text-xs font-mono pointer-events-none shadow-lg">
            {hoverInfo.p} mb · ~{hoverInfo.h}m AGL · T: {hoverInfo.t}°C
          </div>
        )}
      </div>
    </div>
  );
};
