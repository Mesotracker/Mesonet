import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SoundingLevel } from '../types';
import { calcBunkersStormMotion, interpolateSounding, windToUV, uvToWind } from '../lib/metMath';
import { ZoomIn, ZoomOut, RotateCcw, Compass, Edit3 } from 'lucide-react';

interface HodographCanvasProps {
  levels: SoundingLevel[];
  isEditorMode: boolean;
  onLevelsChanged?: (newLevels: SoundingLevel[]) => void;
}

export const HodographCanvas: React.FC<HodographCanvasProps> = ({
  levels,
  isEditorMode,
  onLevelsChanged
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [hoverWind, setHoverWind] = useState<{ ws: number; wd: number; u: number; v: number } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<'pan' | 'wind'>('pan');
  const [dragIndex, setDragIndex] = useState<number>(-1);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxSpdKt = 120;

  const renderHodograph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 40;
    const pxPerKt = radius / maxSpdKt;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);

    // 1. Draw Concentric Wind Speed Rings
    ctx.lineWidth = 1.0 / view.scale;
    for (let spd = 20; spd <= maxSpdKt; spd += 20) {
      const r = spd * pxPerKt;
      ctx.strokeStyle = spd === 60 ? 'rgba(71, 85, 105, 0.5)' : 'rgba(51, 65, 85, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Label on ring
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.max(9, 14 / view.scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(`${spd} kt`, cx + r + 4 / view.scale, cy - 4 / view.scale);
    }

    // 2. Draw Crosshairs & Cardinal Directions
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - radius - 15, cy);
    ctx.lineTo(cx + radius + 15, cy);
    ctx.moveTo(cx, cy - radius - 15);
    ctx.lineTo(cx, cy + radius + 15);
    ctx.stroke();

    // 3. Draw Height-Segmented Colored Hodograph Traces
    if (levels.length > 1) {
      const sfc = levels[0];
      const bunker = calcBunkersStormMotion(levels);

      // Sample hodograph points across height layers AGL
      const heights = [0, 500, 1000, 2000, 3000, 4500, 6000, 7500, 9000, 12000];
      const hPoints: { z: number; u: number; v: number; x: number; y: number }[] = [];

      heights.forEach((z) => {
        const wind = interpolateSounding(levels, z);
        const px = cx + wind.u * pxPerKt;
        const py = cy + wind.v * pxPerKt;
        hPoints.push({ z, u: wind.u, v: wind.v, x: px, y: py });
      });

      // 4. Draw SRH 0-1km and 0-3km Ingestion Area Polygons
      const rmPx = cx + bunker.rmU * pxPerKt;
      const rmPy = cy + bunker.rmV * pxPerKt;

      // 0-1km SRH Area Shading (Rose/Magenta)
      ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
      ctx.beginPath();
      ctx.moveTo(rmPx, rmPy);
      const h01 = hPoints.filter((p) => p.z <= 1000);
      h01.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();

      // 0-3km SRH Area Shading (Emerald Green)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.beginPath();
      ctx.moveTo(rmPx, rmPy);
      const h03 = hPoints.filter((p) => p.z <= 3000);
      h03.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();

      // Draw Colored Segments
      const getSegmentColor = (z1: number, z2: number) => {
        const midZ = (z1 + z2) / 2;
        if (midZ <= 1000) return '#f43f5e'; // 0-1 km: Bright Pink / Red
        if (midZ <= 3000) return '#22c55e'; // 1-3 km: Emerald Green
        if (midZ <= 6000) return '#eab308'; // 3-6 km: Amber / Yellow
        if (midZ <= 9000) return '#06b6d4'; // 6-9 km: Cyan
        return '#a855f7';                  // 9-12 km: Purple
      };

      for (let i = 0; i < hPoints.length - 1; i++) {
        const pA = hPoints[i];
        const pB = hPoints[i + 1];
        ctx.strokeStyle = getSegmentColor(pA.z, pB.z);
        ctx.lineWidth = 4.5 / view.scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }

      // Height Marker Dots
      hPoints.forEach((p) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.0 / view.scale, 0, Math.PI * 2);
        ctx.fill();

        // Label altitude km
        if (p.z === 1000 || p.z === 3000 || p.z === 6000 || p.z === 9000) {
          ctx.fillStyle = '#cbd5e1';
          ctx.font = `bold ${Math.max(10, 13 / view.scale)}px "JetBrains Mono", monospace`;
          ctx.fillText(`${p.z / 1000}km`, p.x + 6 / view.scale, p.y - 6 / view.scale);
        }
      });

      // 5. Draw Bunkers Storm Motion Vectors
      // RM (Right Mover) - Red Circle
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0 / view.scale;
      ctx.beginPath();
      ctx.arc(rmPx, rmPy, 7 / view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = `bold ${Math.max(11, 15 / view.scale)}px "JetBrains Mono", monospace`;
      ctx.fillText(`RM (${bunker.rmWsKt}kt)`, rmPx + 10 / view.scale, rmPy + 5 / view.scale);

      // LM (Left Mover) - Blue Circle
      const lmPx = cx + bunker.lmU * pxPerKt;
      const lmPy = cy + bunker.lmV * pxPerKt;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(lmPx, lmPy, 6 / view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(`LM (${bunker.lmWsKt}kt)`, lmPx + 9 / view.scale, lmPy + 5 / view.scale);

      // Mean Wind 0-6km - White Square
      const meanPx = cx + bunker.meanU * pxPerKt;
      const meanPy = cy + bunker.meanV * pxPerKt;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(meanPx - 4 / view.scale, meanPy - 4 / view.scale, 8 / view.scale, 8 / view.scale);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Mean`, meanPx + 8 / view.scale, meanPy + 4 / view.scale);

      // 6. Draw Editor Mode Draggable Nodes
      if (isEditorMode) {
        levels.forEach((l, idx) => {
          const uv = windToUV(l.ws, l.wd);
          const px = cx + uv.u * pxPerKt;
          const py = cy + uv.v * pxPerKt;

          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 / view.scale;
          ctx.beginPath();
          ctx.arc(px, py, 6 / view.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    }

    ctx.restore();
  }, [view, levels, isEditorMode]);

  useEffect(() => {
    renderHodograph();
  }, [renderHodograph]);

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
        renderHodograph();
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
  }, [renderHodograph]);

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
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 40;
    const pxPerKt = radius / maxSpdKt;

    const worldX = (pos.x - view.x) / view.scale;
    const worldY = (pos.y - view.y) / view.scale;

    let foundIndex = -1;
    let foundType: 'wind' | 'pan' = 'pan';
    const hitRadius = 16 / view.scale;

    if (isEditorMode && levels.length > 0) {
      for (let i = 0; i < levels.length; i++) {
        const l = levels[i];
        const uv = windToUV(l.ws, l.wd);
        const px = cx + uv.u * pxPerKt;
        const py = cy + uv.v * pxPerKt;

        const dist = Math.hypot(worldX - px, worldY - py);
        if (dist < hitRadius) {
          foundIndex = i;
          foundType = 'wind';
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
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 40;
    const pxPerKt = radius / maxSpdKt;

    const worldX = (pos.x - view.x) / view.scale;
    const worldY = (pos.y - view.y) / view.scale;

    const u = (worldX - cx) / pxPerKt;
    const v = (worldY - cy) / pxPerKt;
    const wind = uvToWind(u, v);
    setHoverWind({ ws: Math.round(wind.ws), wd: Math.round(wind.wd), u, v });

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
      const newLevels = [...levels];
      newLevels[dragIndex] = {
        ...newLevels[dragIndex],
        ws: Math.min(150, Math.round(wind.ws * 10) / 10),
        wd: Math.round(wind.wd)
      };
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

        {/* Floating Zoom & Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            id="hodo-zoom-in-btn"
            onClick={() => handleZoom(1)}
            title="Zoom In"
            className="p-2 bg-black/70 hover:bg-orange-500 hover:text-black text-orange-400 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="hodo-zoom-out-btn"
            onClick={() => handleZoom(-1)}
            title="Zoom Out"
            className="p-2 bg-black/70 hover:bg-orange-500 hover:text-black text-orange-400 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="hodo-reset-btn"
            onClick={handleResetView}
            title="Reset View"
            className="p-2 bg-black/70 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg shadow-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Editor Mode Banner */}
        {isEditorMode && (
          <div className="absolute top-3 left-3 bg-amber-600/90 text-white px-3 py-1 text-xs font-mono font-bold tracking-wider rounded-md uppercase animate-pulse border border-amber-400 shadow-lg flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" />
            Editor Mode: Drag Amber Nodes to alter wind vectors
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-sm border border-slate-800 p-2.5 rounded-lg text-xs font-mono flex flex-wrap items-center gap-3 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-rose-500 rounded-full"></span>
            <span>0-1km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-green-500 rounded-full"></span>
            <span>1-3km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-yellow-400 rounded-full"></span>
            <span>3-6km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 rounded-full"></span>
            <span>6-9km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white"></span>
            <span>RM Bunkers</span>
          </div>
        </div>

        {/* Hover Vector Readout */}
        {hoverWind && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-cyan-300 border border-cyan-800 px-3 py-1 rounded text-xs font-mono pointer-events-none shadow-lg">
            {hoverWind.wd}° @ {hoverWind.ws} kt
          </div>
        )}
      </div>
    </div>
  );
};
