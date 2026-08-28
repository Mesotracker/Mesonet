import React, { useState, useEffect, useMemo } from 'react';
import {
  SoundingData,
  SoundingLevel,
  MesoMaxInputs,
  SoundingIndices,
  HazardRiskAssessment,
  LapseRateTuning,
  HourlyForecastStep
} from './types';
import {
  parseSharpPySounding,
  SAMPLE_KPIT_TEXT,
  determineActiveSounding
} from './lib/soundingParser';
import {
  computeAllSoundingIndices,
  defaultLapseTuning
} from './lib/metMath';
import {
  runMesoMaxRiskEngine,
  getSpcRiskColor
} from './lib/mesoMaxEngine';
import { SkewTCanvas } from './components/SkewTCanvas';
import { HodographCanvas } from './components/HodographCanvas';
import { MesoMaxControls } from './components/MesoMaxControls';
import { LapseRateTuner } from './components/LapseRateTuner';
import { SoundingSourceManager } from './components/SoundingSourceManager';
import { HazardsView } from './components/HazardsView';
import { AnalysisView } from './components/AnalysisView';
import { ExportView } from './components/ExportView';
import {
  Activity,
  Layers,
  ShieldAlert,
  BarChart3,
  Download,
  Flame,
  Wind,
  Compass,
  Edit3,
  SlidersHorizontal,
  CloudLightning,
  Sparkles
} from 'lucide-react';

export default function App() {
  // 1. Initial State with Built-in KPIT Severe Sounding
  const initialSounding = useMemo(() => parseSharpPySounding(SAMPLE_KPIT_TEXT, 'KPIT 260322/1900'), []);
  const [soundings, setSoundings] = useState<SoundingData[]>([initialSounding]);
  const [activeSoundingId, setActiveSoundingId] = useState<string>(initialSounding.id);
  const [forecastSteps, setForecastSteps] = useState<HourlyForecastStep[]>([]);
  const [tuning, setTuning] = useState<LapseRateTuning>(defaultLapseTuning);
  const [isEditorMode, setIsEditorMode] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<'setup' | 'hazards' | 'analysis' | 'export'>('setup');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      setUtcTime(`${hours}:${mins} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Active Sounding
  const activeSounding = useMemo(() => {
    return soundings.find((s) => s.id === activeSoundingId) || soundings[0];
  }, [soundings, activeSoundingId]);

  // Derived Indices from Physical Sounding Levels + Tuning Constants
  const indices: SoundingIndices = useMemo(() => {
    if (!activeSounding || !activeSounding.levels || activeSounding.levels.length === 0) {
      return computeAllSoundingIndices([], tuning);
    }
    return computeAllSoundingIndices(activeSounding.levels, tuning);
  }, [activeSounding, tuning]);

  // 15 MesoMax Inputs (Synchronized with Active Sounding Indices)
  const [inputs, setInputs] = useState<MesoMaxInputs>({
    cape: indices.mlcape,
    cape3: indices.cape3km,
    cin: indices.mlcin,
    lcl: indices.mllcl,
    esrh: indices.esrh,
    ebwd: indices.ebwd,
    srh: indices.srh_0_1km,
    shear: indices.shear_0_6km,
    llShear: indices.shear_0_1km,
    dcape: indices.dcape,
    lapse: indices.lapse_700_500,
    meanWind: indices.meanWind_0_6km,
    temp: activeSounding?.levels?.[0]?.t != null ? Math.round(activeSounding.levels[0].t * 1.8 + 32) : 75,
    dew: activeSounding?.levels?.[0]?.td != null ? Math.round(activeSounding.levels[0].td * 1.8 + 32) : 65,
    t500: -15,
    time: 17
  });

  // Sync inputs whenever active sounding changes
  useEffect(() => {
    if (activeSounding && activeSounding.levels && activeSounding.levels.length > 0) {
      const sfc = activeSounding.levels[0];
      const l500 = activeSounding.levels.find((l) => l.p <= 505) || activeSounding.levels[activeSounding.levels.length - 1];
      setInputs({
        cape: indices.mlcape,
        cape3: indices.cape3km,
        cin: indices.mlcin,
        lcl: indices.mllcl,
        esrh: indices.esrh,
        ebwd: indices.ebwd,
        srh: indices.srh_0_1km,
        shear: indices.shear_0_6km,
        llShear: indices.shear_0_1km,
        dcape: indices.dcape,
        lapse: indices.lapse_700_500,
        meanWind: indices.meanWind_0_6km,
        temp: sfc ? Math.round(sfc.t * 1.8 + 32) : 75,
        dew: sfc ? Math.round(sfc.td * 1.8 + 32) : 65,
        t500: l500 ? Math.round(l500.t * 1.8 + 32) : -15,
        time: 17
      });
    }
  }, [activeSoundingId, indices]);

  // Derived Hazard Assessment from MesoMax Risk Engine
  const assessment: HazardRiskAssessment = useMemo(() => {
    return runMesoMaxRiskEngine(inputs);
  }, [inputs]);

  // Handle Input Changes
  const handleInputChange = (key: keyof MesoMaxInputs, value: number) => {
    setInputs((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Preset Configurations
  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'mod-outbreak') {
      setInputs((prev) => ({
        ...prev,
        cape: 2800,
        cape3: 160,
        cin: -15,
        lcl: 850,
        esrh: 240,
        ebwd: 25,
        srh: 220,
        shear: 55,
        llShear: 30,
        dcape: 1100,
        lapse: 7.8,
        meanWind: 40,
        temp: 84,
        dew: 68,
        t500: -14,
        time: 17
      }));
    } else if (presetName === 'high-tor') {
      setInputs((prev) => ({
        ...prev,
        cape: 3800,
        cape3: 260,
        cin: -5,
        lcl: 650,
        esrh: 380,
        ebwd: 32,
        srh: 340,
        shear: 65,
        llShear: 42,
        dcape: 1250,
        lapse: 8.4,
        meanWind: 48,
        temp: 86,
        dew: 72,
        t500: -16,
        time: 18
      }));
    } else if (presetName === 'derecho') {
      setInputs((prev) => ({
        ...prev,
        cape: 3200,
        cape3: 110,
        cin: -25,
        lcl: 1400,
        esrh: 150,
        ebwd: 28,
        srh: 140,
        shear: 60,
        llShear: 35,
        dcape: 1650,
        lapse: 8.2,
        meanWind: 55,
        temp: 92,
        dew: 70,
        t500: -12,
        time: 19
      }));
    }
  };

  // Reset to Sounding Values
  const handleResetInputs = () => {
    if (activeSounding && activeSounding.levels.length > 0) {
      const sfc = activeSounding.levels[0];
      const l500 = activeSounding.levels.find((l) => l.p <= 505) || activeSounding.levels[activeSounding.levels.length - 1];
      setInputs({
        cape: indices.mlcape,
        cape3: indices.cape3km,
        cin: indices.mlcin,
        lcl: indices.mllcl,
        esrh: indices.esrh,
        ebwd: indices.ebwd,
        srh: indices.srh_0_1km,
        shear: indices.shear_0_6km,
        llShear: indices.shear_0_1km,
        dcape: indices.dcape,
        lapse: indices.lapse_700_500,
        meanWind: indices.meanWind_0_6km,
        temp: Math.round(sfc.t * 1.8 + 32),
        dew: Math.round(sfc.td * 1.8 + 32),
        t500: Math.round(l500.t * 1.8 + 32),
        time: 17
      });
    }
  };

  // Update Sounding Levels from Skew-T or Hodograph Editor Mode
  const handleLevelsChanged = (newLevels: SoundingLevel[]) => {
    setSoundings((prev) =>
      prev.map((s) => {
        if (s.id === activeSoundingId) {
          return {
            ...s,
            levels: newLevels
          };
        }
        return s;
      })
    );
  };

  // Add new soundings (from Open-Meteo or file upload)
  const handleSoundingsAdded = (newSoundings: SoundingData[], newForecastSteps?: HourlyForecastStep[]) => {
    setSoundings((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const filtered = newSoundings.filter((s) => !existingIds.has(s.id));
      return [...filtered, ...prev];
    });

    if (newForecastSteps) {
      setForecastSteps(newForecastSteps);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 flex flex-col font-sans selection:bg-orange-500 selection:text-black">
      {/* Bento Header */}
      <header className="sticky top-0 z-50 bg-[#141820] border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-black shadow-md shadow-orange-500/20 text-sm">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  MESOMAX <span className="text-orange-500">RISKSIM</span>{' '}
                  <span className="text-slate-500 text-xs font-normal ml-1 italic hidden sm:inline">v4.2 PRO</span>
                </h1>
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden md:block">
                Mesoscale Convective Diagnostic Engine & Sounding Risk Matrix
              </p>
            </div>
          </div>

          {/* Bento Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-slate-800">
            <button
              id="nav-page-setup"
              onClick={() => setActivePage('setup')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activePage === 'setup'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Setup</span>
            </button>

            <button
              id="nav-page-hazards"
              onClick={() => setActivePage('hazards')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activePage === 'hazards'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Hazards</span>
              {assessment.spcCat !== 'NONE' && (
                <span className="hidden md:inline text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/50 text-orange-400 border border-orange-500/30">
                  {assessment.spcCat}
                </span>
              )}
            </button>

            <button
              id="nav-page-analysis"
              onClick={() => setActivePage('analysis')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activePage === 'analysis'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analysis</span>
            </button>

            <button
              id="nav-page-export"
              onClick={() => setActivePage('export')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activePage === 'export'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </nav>

          {/* Header Right Badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 font-mono">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              System Ready
            </div>
            <div className="text-slate-400 uppercase tracking-widest font-mono text-xs font-semibold">
              {utcTime || '10:24 UTC'}
            </div>
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* PAGE 1: SETUP & SOUNDING CONTROLS */}
        {activePage === 'setup' && (
          <div className="space-y-6">
            {/* Sounding Ingestion Component */}
            <SoundingSourceManager
              soundings={soundings}
              activeSoundingId={activeSoundingId}
              onSelectActiveSounding={(id) => setActiveSoundingId(id)}
              onSoundingsAdded={handleSoundingsAdded}
              forecastSteps={forecastSteps}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />

            {/* Skew-T & Hodograph Visualizer Bento Box */}
            <div className="bg-[#1a1f29] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded text-[10px] font-mono border border-slate-700 text-slate-300">
                    SKW: 100-1000mb
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded text-[10px] font-mono border border-slate-700 text-orange-400">
                    ACTIVE: {activeSounding.source === 'open-meteo' ? 'TYPE-1 (OPEN-METEO)' : 'TYPE-2 (OBSERVED)'}
                  </div>
                </div>

                {/* Editor Mode Button */}
                <button
                  id="btn-toggle-editor-mode"
                  onClick={() => setIsEditorMode(!isEditorMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 border ${
                    isEditorMode
                      ? 'bg-orange-600 text-white border-orange-400 shadow-md shadow-orange-600/30'
                      : 'bg-black/50 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  Editor Mode: {isEditorMode ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {/* Side-by-Side Canvas View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-mono font-bold uppercase text-slate-300">
                      Skew-T Log-P Thermodynamic Diagram
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">1050 to 100 hPa · 35° Isotherms</span>
                  </div>
                  <SkewTCanvas
                    levels={activeSounding.levels}
                    tuning={tuning}
                    isEditorMode={isEditorMode}
                    onLevelsChanged={handleLevelsChanged}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-mono font-bold uppercase text-slate-300">
                      Polar Wind Hodograph & Bunkers Storm Motion
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">0 to 120 kt Range · 0–12 km AGL</span>
                  </div>
                  <HodographCanvas
                    levels={activeSounding.levels}
                    isEditorMode={isEditorMode}
                    onLevelsChanged={handleLevelsChanged}
                  />
                </div>
              </div>

              {/* Visualizer Location & Coordinates Strip */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap justify-between items-center text-[10px] font-mono text-slate-500">
                <span>{activeSounding.title || 'Sounding Profile Coordinates'}</span>
                <span className="text-slate-400">Click & Drag to Pan / Zoom · Double Click to Reset</span>
              </div>
            </div>

            {/* Lapse-Rate Tuner */}
            <LapseRateTuner
              tuning={tuning}
              onTuningChange={(newTuning) => setTuning(newTuning)}
              onResetTuning={() => setTuning(defaultLapseTuning)}
            />

            {/* 15 MesoMax Sliders */}
            <MesoMaxControls
              inputs={inputs}
              indices={indices}
              onInputChange={handleInputChange}
              onReset={handleResetInputs}
              onApplyPreset={handleApplyPreset}
            />
          </div>
        )}

        {/* PAGE 2: HAZARDS VIEW */}
        {activePage === 'hazards' && (
          <HazardsView
            assessment={assessment}
            activeSounding={activeSounding}
            forecastSteps={forecastSteps}
            onSelectForecastHour={(step) => {
              setActiveSoundingId(step.sounding.id);
            }}
          />
        )}

        {/* PAGE 3: RISK SIMULATION & ANALYSIS */}
        {activePage === 'analysis' && (
          <AnalysisView
            assessment={assessment}
            activeSounding={activeSounding}
            inputs={inputs}
            indices={indices}
          />
        )}

        {/* PAGE 4: EXPORT */}
        {activePage === 'export' && (
          <ExportView
            sounding={activeSounding}
            assessment={assessment}
            inputs={inputs}
            indices={indices}
          />
        )}
      </main>

      {/* Bento Footer */}
      <footer className="px-6 py-3 border-t border-slate-800 bg-[#141820] flex flex-wrap justify-between items-center text-[10px] text-slate-500 font-mono mt-auto gap-3">
        <div>MESOMAX RISKSIM ENGINE v4.2 • CONVECTION ANALYZER ENABLED</div>
        <div className="hidden md:block">© 2024 METEOROLOGICAL SIMULATION SYSTEMS GROUP</div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            API CONNECTION STABLE
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            DATA NORMALIZED
          </span>
        </div>
      </footer>
    </div>
  );
}
