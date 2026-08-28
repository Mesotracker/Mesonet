import React, { useRef, useState, useEffect } from 'react';
import {
  SoundingData,
  HazardRiskAssessment,
  MesoMaxInputs,
  SoundingIndices
} from '../types';
import { getSpcRiskColor } from '../lib/mesoMaxEngine';
import {
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  FileCode,
  Link,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

interface ExportViewProps {
  sounding: SoundingData;
  assessment: HazardRiskAssessment;
  inputs: MesoMaxInputs;
  indices: SoundingIndices;
}

export const ExportView: React.FC<ExportViewProps> = ({
  sounding,
  assessment,
  inputs,
  indices
}) => {
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(2);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate Export Formats
  const getJsonExport = () => {
    return JSON.stringify(
      {
        sounding,
        inputs,
        indices,
        assessment
      },
      null,
      2
    );
  };

  const getCsvExport = () => {
    let csv = 'pressure_hpa,height_m,temp_c,dewpoint_c,wind_speed_kt,wind_dir_deg\n';
    sounding.levels.forEach((l) => {
      csv += `${l.p},${l.h},${l.t},${l.td},${l.ws},${l.wd}\n`;
    });
    return csv;
  };

  const getSharpPyExport = () => {
    let out = `%TITLE%\n${sounding.title}\n\n%RAW%\n`;
    sounding.levels.forEach((l) => {
      out += `${l.p.toFixed(1)}, ${l.h.toFixed(1)}, ${l.t.toFixed(1)}, ${l.td.toFixed(1)}, ${l.wd.toFixed(0)}, ${l.ws.toFixed(0)}\n`;
    });
    out += `%END%\n`;
    return out;
  };

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render PNG Risk Card on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 1200;
    const h = selectedTier === 1 ? 630 : selectedTier === 2 ? 800 : 1000;
    canvas.width = w;
    canvas.height = h;

    // 1. Dark Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Accent Border
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // 2. Header
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillText('MESOMAX RISKSIM · MESOSCALE SEVERE WEATHER RISK ASSESSMENT', 40, 55);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px "JetBrains Mono", monospace';
    ctx.fillText(sounding.title, 40, 105);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillText(`Issued: ${new Date().toUTCString()} · Lat: ${sounding.lat?.toFixed(2) || 'N/A'}, Lon: ${sounding.lon?.toFixed(2) || 'N/A'}`, 40, 135);

    // 3. SPC Risk Badge
    const spcColor = getSpcRiskColor(assessment.spcCat);
    ctx.fillStyle = spcColor;
    ctx.fillRect(w - 240, 35, 190, 80);
    ctx.fillStyle = assessment.spcCat === 'MRGL' || assessment.spcCat === 'SLGT' ? '#000' : '#fff';
    ctx.font = '900 38px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(assessment.spcCat, w - 145, 90);
    ctx.textAlign = 'left';

    // 4. General Hazard Probabilities Box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 170, w - 80, 160);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 170, w - 80, 160);

    const hazards = [
      { label: 'DAMAGING WIND (58+ MPH)', prob: assessment.pWind, color: '#00e5ff' },
      { label: 'LARGE HAIL (1.00"+)', prob: assessment.pHail, color: '#eab308' },
      { label: 'TORNADO THREAT', prob: assessment.pTor, color: '#ef4444' },
      { label: 'CONVECTIVE INIT', prob: assessment.ciProb, color: '#a855f7' }
    ];

    hazards.forEach((haz, i) => {
      const colX = 70 + i * 270;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(haz.label, colX, 205);

      ctx.fillStyle = haz.color;
      ctx.font = '900 48px "JetBrains Mono", monospace';
      ctx.fillText(`${haz.prob.toFixed(1)}%`, colX, 265);

      // Mini bar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(colX, 285, 230, 10);
      ctx.fillStyle = haz.color;
      ctx.fillRect(colX, 285, Math.min(230, (haz.prob / 100) * 230), 10);
    });

    // 5. Environmental Diagnostics Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 350, w - 80, 90);
    ctx.strokeRect(40, 350, w - 80, 90);

    const envMetrics = [
      `MLCAPE: ${inputs.cape} J/kg`,
      `0-6km Shear: ${inputs.shear} kt`,
      `0-1km SRH: ${inputs.srh} m²/s²`,
      `DCAPE: ${inputs.dcape} J/kg`,
      `STP: ${indices.stp.toFixed(2)}`,
      `SHIP: ${indices.ship.toFixed(2)}`
    ];

    envMetrics.forEach((m, i) => {
      const rowX = 65 + (i % 3) * 360;
      const rowY = i < 3 ? 385 : 420;
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(m, rowX, rowY);
    });

    // 6. Tier 2 & Tier 3 Additions: Storm Modes & Significant Hazards
    if (selectedTier >= 2) {
      // Significant Hazards Block
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 460, 520, 280);
      ctx.strokeRect(40, 460, 520, 280);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText('SIGNIFICANT SEVERE THREAT (CIG)', 60, 495);

      const sigs = [
        { label: 'Sig Wind (75+ MPH)', prob: assessment.sigWind, cig: assessment.cigWind },
        { label: 'Sig Hail (2.00"+)', prob: assessment.sigHail, cig: assessment.cigHail },
        { label: 'Sig Tornado (EF2+)', prob: assessment.sigTor, cig: assessment.cigTor }
      ];

      sigs.forEach((s, idx) => {
        const y = 540 + idx * 65;
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 16px "JetBrains Mono", monospace';
        ctx.fillText(s.label, 60, y);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 22px "JetBrains Mono", monospace';
        ctx.fillText(`${s.prob.toFixed(1)}%`, 340, y);

        ctx.fillStyle = s.cig === 'CIG 3' ? '#d946ef' : s.cig === 'CIG 2' ? '#ef4444' : s.cig === 'CIG 1' ? '#eab308' : '#64748b';
        ctx.font = 'bold 15px "JetBrains Mono", monospace';
        ctx.fillText(s.cig, 450, y);
      });

      // Storm Modes Block
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(580, 460, w - 620, 280);
      ctx.strokeRect(580, 460, w - 620, 280);

      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText('PRIMARY CONVECTIVE STORM MODES', 600, 495);

      assessment.modes.slice(0, 4).forEach((m, idx) => {
        const y = 535 + idx * 55;
        ctx.fillStyle = idx === 0 ? '#38bdf8' : '#e2e8f0';
        ctx.font = idx === 0 ? 'bold 16px "JetBrains Mono", monospace' : '15px "JetBrains Mono", monospace';
        ctx.fillText(`${idx === 0 ? '★ ' : ''}${m.name}`, 600, y);

        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 18px "JetBrains Mono", monospace';
        ctx.fillText(`${m.prob.toFixed(1)}%`, w - 160, y);
      });
    }

    // 7. Tier 3 Additions: Mesoscale Synopsis & Watermark
    if (selectedTier === 3) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, 760, w - 80, 180);
      ctx.strokeRect(40, 760, w - 80, 180);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText('MESOSCALE DISCUSSION SUMMARY:', 60, 795);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillText(assessment.discussion.summary.slice(0, 110) + '...', 60, 825);

      ctx.fillText(`Primary Storm Mode: ${assessment.primaryMode.name} · Bunkers RM: ${indices.bunkers_rm_spd_kt} kt @ ${indices.bunkers_rm_dir}°`, 60, 860);
      ctx.fillText(`Max Hail Size Tier: ${assessment.intensity.hail.tierText} · Max Wind Tier: ${assessment.intensity.wind.tierText}`, 60, 890);
    }

    // Watermark Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('Generated by MesoMax RiskSim Meteorological Engine · Advanced Convective Analysis Toolkit', 40, h - 25);
  }, [selectedTier, sounding, assessment, inputs, indices]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesomax-risk-card-tier-${selectedTier}.png`;
    a.click();
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. PNG Risk Card Generator (3 Tiers) */}
      <div className="bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-mono uppercase text-white tracking-wider flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-400" />
              High-Resolution PNG Risk Card Generator
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Select a sophistication tier to generate and download publication-quality graphic briefings.
            </p>
          </div>

          {/* Tier Buttons */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setSelectedTier(1)}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md transition ${
                selectedTier === 1 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Tier 1 (Basic)
            </button>
            <button
              onClick={() => setSelectedTier(2)}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md transition ${
                selectedTier === 2 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Tier 2 (Moderate)
            </button>
            <button
              onClick={() => setSelectedTier(3)}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md transition ${
                selectedTier === 3 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Tier 3 (Briefing)
            </button>
          </div>
        </div>

        {/* Canvas Preview Container */}
        <div className="my-5 flex flex-col items-center">
          <div className="w-full max-w-4xl border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-black">
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>

          <button
            id="btn-download-risk-card"
            onClick={handleDownloadPng}
            className="mt-4 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-mono font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Download Tier {selectedTier} PNG Graphic (1200px HD)
          </button>
        </div>
      </div>

      {/* 2. Sounding Data & API URL Export */}
      <div className="bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <h3 className="text-sm font-bold font-mono uppercase text-orange-400 mb-4 flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          Sounding Data & API Query Export
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* JSON Export */}
          <div className="p-4 bg-black/30 border border-slate-800 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-orange-400 font-bold uppercase">JSON Comprehensive Export</span>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Full state containing vertical levels, 15 MesoMax inputs, and calculated risk assessment.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleCopyText(getJsonExport(), 'json')}
                className="flex-1 py-1.5 bg-black/40 hover:bg-slate-700 text-orange-400 font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 border border-slate-800 transition"
              >
                {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy JSON
              </button>
              <button
                onClick={() => handleDownloadFile(getJsonExport(), `${sounding.id}.json`, 'application/json')}
                className="p-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded transition"
                title="Download JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SharpPy / Text Export */}
          <div className="p-4 bg-black/30 border border-slate-800 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-amber-400 font-bold uppercase">SharpPy Format (.txt)</span>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Standard SharpPy observed sounding ASCII text format with %TITLE% and %RAW% pressure blocks.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleCopyText(getSharpPyExport(), 'sharppy')}
                className="flex-1 py-1.5 bg-black/40 hover:bg-slate-700 text-amber-300 font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 border border-slate-800 transition"
              >
                {copiedType === 'sharppy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy SharpPy
              </button>
              <button
                onClick={() => handleDownloadFile(getSharpPyExport(), `${sounding.id}.txt`, 'text/plain')}
                className="p-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded transition"
                title="Download SharpPy Text"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CSV Export */}
          <div className="p-4 bg-black/30 border border-slate-800 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase">CSV Spreadsheet (.csv)</span>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Comma-separated values containing pressure, height, temp, dewpoint, wind speed, and direction.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleCopyText(getCsvExport(), 'csv')}
                className="flex-1 py-1.5 bg-black/40 hover:bg-slate-700 text-emerald-300 font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 border border-slate-800 transition"
              >
                {copiedType === 'csv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy CSV
              </button>
              <button
                onClick={() => handleDownloadFile(getCsvExport(), `${sounding.id}.csv`, 'text/csv')}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-black rounded transition"
                title="Download CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* API URL Box if Open-Meteo */}
        {sounding.sourceUrl && (
          <div className="mt-4 p-3 bg-black/30 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
            <div className="truncate text-xs font-mono text-slate-400">
              <strong className="text-orange-400 uppercase mr-2">Open-Meteo API Query URL:</strong>
              <span className="text-slate-300">{sounding.sourceUrl}</span>
            </div>
            <button
              onClick={() => handleCopyText(sounding.sourceUrl || '', 'url')}
              className="px-3 py-1 bg-black/40 hover:bg-orange-500 hover:text-black text-orange-400 font-mono text-xs font-bold rounded transition shrink-0 flex items-center gap-1 border border-slate-800"
            >
              {copiedType === 'url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copy URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
