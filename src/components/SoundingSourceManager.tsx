import React, { useState } from 'react';
import { SoundingData, HourlyForecastStep } from '../types';
import {
  buildOpenMeteoUrl,
  parseOpenMeteoResponse,
  parseSharpPySounding,
  SAMPLE_KPIT_TEXT,
  SAMPLE_PLAINS_SUPERCELL,
  SAMPLE_PROGRESSIVE_DERECHO
} from '../lib/soundingParser';
import {
  CloudDownload,
  Upload,
  Radio,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ChevronDown
} from 'lucide-react';

interface SoundingSourceManagerProps {
  soundings: SoundingData[];
  activeSoundingId: string;
  onSelectActiveSounding: (id: string) => void;
  onSoundingsAdded: (newSoundings: SoundingData[], newForecastSteps?: HourlyForecastStep[]) => void;
  forecastSteps: HourlyForecastStep[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const SoundingSourceManager: React.FC<SoundingSourceManagerProps> = ({
  soundings,
  activeSoundingId,
  onSelectActiveSounding,
  onSoundingsAdded,
  forecastSteps,
  isLoading,
  setIsLoading
}) => {
  const [activeTab, setActiveTab] = useState<'coordinates' | 'upload' | 'presets'>('coordinates');
  const [lat, setLat] = useState<number>(40.0);
  const [lon, setLon] = useState<number>(-80.0);
  const [forecastDays, setForecastDays] = useState<number>(1);
  const [rawTextInput, setRawTextInput] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const presetLocations = [
    { name: 'Pittsburgh, PA (KPIT)', lat: 40.49, lon: -80.23 },
    { name: 'Norman, OK (OUN / SPC)', lat: 35.22, lon: -97.44 },
    { name: 'Dallas / Fort Worth, TX', lat: 32.77, lon: -96.79 },
    { name: 'Omaha, NE / Des Moines, IA', lat: 41.25, lon: -95.93 },
    { name: 'Jackson, MS (Dixie Alley)', lat: 32.29, lon: -90.18 },
    { name: 'Wichita, KS (Plains Alley)', lat: 37.68, lon: -97.33 }
  ];

  // Fetch Open-Meteo API
  const handleFetchOpenMeteo = async (targetLat = lat, targetLon = lon) => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const url = buildOpenMeteoUrl(targetLat, targetLon, forecastDays);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const parsed = parseOpenMeteoResponse(data, targetLat, targetLon, url);

      onSoundingsAdded(parsed.allHourlySoundings, parsed.forecastSteps);
      onSelectActiveSounding(parsed.activeSounding.id);

      setStatusMsg({
        type: 'success',
        text: `Successfully retrieved ${parsed.allHourlySoundings.length} hourly forecast soundings for Lat ${targetLat}, Lon ${targetLon}. Active sounding set to peak severe convective timestep.`
      });
    } catch (err: any) {
      console.error('Error fetching Open-Meteo sounding:', err);
      setStatusMsg({
        type: 'error',
        text: `Failed to fetch Open-Meteo sounding: ${err.message || err}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Parse Uploaded SharpPy Text
  const handleParseSharpPy = (textToParse: string, title?: string) => {
    try {
      const parsed = parseSharpPySounding(textToParse, title);
      onSoundingsAdded([parsed]);
      onSelectActiveSounding(parsed.id);
      setStatusMsg({
        type: 'success',
        text: `Successfully imported Type 2 sounding "${parsed.title}". As a Type 2 observed sounding, it has been selected as the Active / Primary Sounding.`
      });
      setRawTextInput('');
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Error parsing sounding text: ${err.message || err}`
      });
    }
  };

  // Handle File Upload (.txt / .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseSharpPy(content, file.name);
    };
    reader.readAsText(file);
  };

  const activeSounding = soundings.find((s) => s.id === activeSoundingId) || soundings[0];

  return (
    <div className="w-full bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
      {/* Active Sounding Selection Badge Header */}
      {activeSounding && (
        <div className="mb-5 p-4 bg-black/40 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 text-black font-bold rounded-lg flex items-center justify-center shadow-md shadow-orange-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-orange-500 text-black rounded">
                  Active / Primary Sounding
                </span>
                <span className="text-xs font-mono text-orange-400 font-bold">
                  {activeSounding.type === 2 ? 'Type 2 (SharpPy Text)' : 'Type 1 (Open-Meteo GFS)'}
                </span>
              </div>
              <h3 className="text-base font-bold font-mono text-white mt-1">
                {activeSounding.title}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {activeSounding.selectionReason || 'Selected by user.'}
              </p>
            </div>
          </div>

          {/* Sounding Switcher Dropdown */}
          {soundings.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Switch:</span>
              <select
                id="sounding-selector-dropdown"
                value={activeSoundingId}
                onChange={(e) => onSelectActiveSounding(e.target.value)}
                className="px-3 py-1.5 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono font-bold text-orange-400 focus:outline-none focus:border-orange-500"
              >
                {soundings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.type === 2 ? '★ [Type 2] ' : '[Type 1] '} {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Bento Tabs for Source Input */}
      <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-lg border border-slate-800 mb-5">
        <button
          id="tab-coordinates"
          onClick={() => setActiveTab('coordinates')}
          className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'coordinates'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CloudDownload className="w-3.5 h-3.5" />
          <span>Type 1: Open-Meteo Coordinates</span>
        </button>
        <button
          id="tab-upload"
          onClick={() => setActiveTab('upload')}
          className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Type 2: Upload / Paste SharpPy</span>
        </button>
        <button
          id="tab-presets"
          onClick={() => setActiveTab('presets')}
          className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'presets'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Preloaded Sounding Library</span>
        </button>
      </div>

      {/* Tab 1: Coordinate Fetch (Type 1) */}
      {activeTab === 'coordinates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-black/30 p-3 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                Latitude (°N)
              </label>
              <input
                id="input-latitude"
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg font-mono text-sm text-orange-400 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                Longitude (°E/W)
              </label>
              <input
                id="input-longitude"
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={lon}
                onChange={(e) => setLon(Number(e.target.value))}
                className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg font-mono text-sm text-orange-400 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                Forecast Horizon
              </label>
              <select
                value={forecastDays}
                onChange={(e) => setForecastDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg font-mono text-sm text-orange-400 focus:outline-none focus:border-orange-500"
              >
                <option value={1}>1 Day (24 Hourly Timesteps)</option>
                <option value={2}>2 Days (48 Hourly Timesteps)</option>
                <option value={3}>3 Days (72 Hourly Timesteps)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-500 uppercase font-bold">Quick Locations:</span>
            {presetLocations.map((loc) => (
              <button
                key={loc.name}
                onClick={() => {
                  setLat(loc.lat);
                  setLon(loc.lon);
                  handleFetchOpenMeteo(loc.lat, loc.lon);
                }}
                className="px-2.5 py-1 bg-black/40 hover:bg-orange-500 hover:text-black text-slate-300 text-xs font-mono rounded border border-slate-800 hover:border-orange-500 transition"
              >
                {loc.name}
              </button>
            ))}
          </div>

          <button
            id="btn-fetch-open-meteo"
            onClick={() => handleFetchOpenMeteo()}
            disabled={isLoading}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold uppercase tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs"
          >
            <CloudDownload className="w-4 h-4" />
            {isLoading ? 'Retrieving Open-Meteo Soundings...' : 'Fetch Open-Meteo Pressure Level Sounding'}
          </button>
        </div>
      )}

      {/* Tab 2: Upload / Paste SharpPy (Type 2) */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="bg-black/30 p-3 rounded-lg border border-slate-800">
            <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
              Upload Sounding File (.txt / .csv)
            </label>
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="w-full text-xs font-mono text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-mono file:font-bold file:bg-orange-500 file:text-black hover:file:bg-orange-400 cursor-pointer"
            />
          </div>

          <div className="bg-black/30 p-3 rounded-lg border border-slate-800">
            <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
              Or Paste Sounding Text (%TITLE% ... %RAW% ... %END%)
            </label>
            <textarea
              id="textarea-sharppy-input"
              rows={4}
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              placeholder="Paste %TITLE% ... %RAW% ... level data ... %END% here"
              className="w-full p-3 bg-black/60 border border-slate-700 rounded-lg font-mono text-xs text-orange-300 focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            id="btn-parse-sharppy-text"
            onClick={() => handleParseSharpPy(rawTextInput)}
            disabled={!rawTextInput.trim()}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold uppercase tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs"
          >
            <FileText className="w-4 h-4" />
            Parse & Ingest Type 2 Sounding
          </button>
        </div>
      )}

      {/* Tab 3: Preloaded Real-World Benchmark Soundings */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                Type 2 Benchmark
              </span>
              <h4 className="text-sm font-bold font-mono text-white mt-1.5">KPIT Severe Outbreak</h4>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Observed sounding from Pittsburgh PA with intense instability and boundary shear.
              </p>
            </div>
            <button
              onClick={() => handleParseSharpPy(SAMPLE_KPIT_TEXT, 'KPIT 260322/1900')}
              className="mt-3 py-1.5 bg-slate-800 hover:bg-orange-500 hover:text-black text-orange-300 font-mono text-xs font-bold rounded transition"
            >
              Load KPIT Sounding
            </button>
          </div>

          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                Type 2 Outbreak
              </span>
              <h4 className="text-sm font-bold font-mono text-white mt-1.5">Norman OK Supercell Outbreak</h4>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Violent tornado outbreak profile with STP &gt; 4.0, MLCAPE 3200 J/kg, 0-1km SRH 280 m²/s².
              </p>
            </div>
            <button
              onClick={() => handleParseSharpPy(SAMPLE_PLAINS_SUPERCELL, 'OUN Norman OK Violent Supercell')}
              className="mt-3 py-1.5 bg-slate-800 hover:bg-red-500 hover:text-white text-red-300 font-mono text-xs font-bold rounded transition"
            >
              Load Violent Supercell
            </button>
          </div>

          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                Type 2 High-Wind
              </span>
              <h4 className="text-sm font-bold font-mono text-white mt-1.5">Progressive Derecho (DVN)</h4>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                High DCAPE, deep dry air entrainment, and intense linear shear driving widespread 80+ MPH gusts.
              </p>
            </div>
            <button
              onClick={() => handleParseSharpPy(SAMPLE_PROGRESSIVE_DERECHO, 'DVN Progressive Derecho')}
              className="mt-3 py-1.5 bg-slate-800 hover:bg-blue-500 hover:text-white text-blue-300 font-mono text-xs font-bold rounded transition"
            >
              Load Progressive Derecho
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {statusMsg && (
        <div
          className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
              : 'bg-red-950/60 border-red-700 text-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};
