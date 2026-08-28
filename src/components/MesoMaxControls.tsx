import React from 'react';
import { MesoMaxInputs, SoundingIndices } from '../types';
import { Sparkles, RefreshCw, Zap, Flame, Wind, ShieldAlert } from 'lucide-react';

interface MesoMaxControlsProps {
  inputs: MesoMaxInputs;
  indices: SoundingIndices;
  onInputChange: (key: keyof MesoMaxInputs, value: number) => void;
  onReset: () => void;
  onApplyPreset: (presetName: string) => void;
}

export const MesoMaxControls: React.FC<MesoMaxControlsProps> = ({
  inputs,
  indices,
  onInputChange,
  onReset,
  onApplyPreset
}) => {
  const sliderConfig: {
    key: keyof MesoMaxInputs;
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    category: 'thermo' | 'kine' | 'temp';
  }[] = [
    { key: 'cape', label: 'MLCAPE', unit: 'J/kg', min: 0, max: 6000, step: 25, category: 'thermo' },
    { key: 'cape3', label: '0–3 km CAPE', unit: 'J/kg', min: 0, max: 800, step: 5, category: 'thermo' },
    { key: 'cin', label: 'MLCIN', unit: 'J/kg', min: -600, max: 0, step: 1, category: 'thermo' },
    { key: 'lcl', label: 'LCL Height', unit: 'm AGL', min: 0, max: 3000, step: 25, category: 'thermo' },
    { key: 'esrh', label: 'Eff. SRH', unit: 'm²/s²', min: 0, max: 600, step: 5, category: 'kine' },
    { key: 'ebwd', label: 'EBWD', unit: 'm/s', min: 0, max: 50, step: 0.5, category: 'kine' },
    { key: 'srh', label: '0–1 km SRH', unit: 'm²/s²', min: 0, max: 600, step: 5, category: 'kine' },
    { key: 'shear', label: '0–6 km Shear', unit: 'kt', min: 0, max: 100, step: 1, category: 'kine' },
    { key: 'llShear', label: '0–1 km Shear', unit: 'kt', min: 0, max: 60, step: 1, category: 'kine' },
    { key: 'dcape', label: 'DCAPE', unit: 'J/kg', min: 0, max: 2000, step: 25, category: 'thermo' },
    { key: 'lapse', label: '700–500 mb Lapse', unit: '°C/km', min: 4.0, max: 10.0, step: 0.1, category: 'thermo' },
    { key: 'meanWind', label: '0–6 km Mean Wind', unit: 'kt', min: 0, max: 80, step: 1, category: 'kine' },
    { key: 'temp', label: 'Surface Temp', unit: '°F', min: 20, max: 110, step: 1, category: 'temp' },
    { key: 'dew', label: 'Dewpoint', unit: '°F', min: 0, max: 85, step: 1, category: 'temp' },
    { key: 't500', label: '500 mb Temp', unit: '°F', min: -30, max: 50, step: 1, category: 'temp' }
  ];

  return (
    <div className="w-full bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
      {/* Header & Quick Action Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold font-mono uppercase text-white tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              MesoMax Parameter Engine
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              15 ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Thermodynamic & kinematic inputs synchronized dynamically with sounding and risk model.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="preset-mod-outbreak"
            onClick={() => onApplyPreset('mod-outbreak')}
            className="px-2.5 py-1.5 bg-black/40 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold rounded-lg border border-slate-800 hover:border-slate-700 transition"
          >
            Moderate Outbreak
          </button>
          <button
            id="preset-high-tor"
            onClick={() => onApplyPreset('high-tor')}
            className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-mono font-bold rounded-lg border border-red-800/80 transition"
          >
            Violent Supercell
          </button>
          <button
            id="preset-derecho"
            onClick={() => onApplyPreset('derecho')}
            className="px-2.5 py-1.5 bg-orange-950/40 hover:bg-orange-900/60 text-orange-300 text-xs font-mono font-bold rounded-lg border border-orange-800/80 transition"
          >
            Progressive Derecho
          </button>
          <button
            id="btn-reset-inputs"
            onClick={onReset}
            title="Reset to active sounding values"
            className="p-1.5 bg-black/40 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Bento Diagnostics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-4">
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">MLCAPE</span>
          <span className="text-lg font-mono text-orange-400 font-bold">{inputs.cape}</span>
          <span className="text-[8px] text-slate-600 font-mono">J/kg</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">Bulk Shear</span>
          <span className="text-lg font-mono text-blue-400 font-bold">{inputs.shear}</span>
          <span className="text-[8px] text-slate-600 font-mono">kts (0-6km)</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">0–1km SRH</span>
          <span className="text-lg font-mono text-green-400 font-bold">{inputs.srh}</span>
          <span className="text-[8px] text-slate-600 font-mono">m²/s²</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">STP Index</span>
          <span className="text-lg font-mono text-red-400 font-bold">{indices.stp.toFixed(2)}</span>
          <span className="text-[8px] text-slate-600 font-mono">Sig Tor</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">SHIP Index</span>
          <span className="text-lg font-mono text-yellow-400 font-bold">{indices.ship.toFixed(2)}</span>
          <span className="text-[8px] text-slate-600 font-mono">Large Hail</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-slate-800 flex flex-col justify-center text-center">
          <span className="text-[9px] text-slate-500 uppercase font-bold">DCP Index</span>
          <span className="text-lg font-mono text-purple-400 font-bold">{indices.dcp.toFixed(2)}</span>
          <span className="text-[8px] text-slate-600 font-mono">Derecho</span>
        </div>
      </div>

      {/* 15 Input Sliders Grid in Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {sliderConfig.map((item) => {
          const val = inputs[item.key];
          const isMoistureOrTemp = item.category === 'temp' || item.key === 'lcl';
          return (
            <div
              key={item.key}
              className="p-3 bg-black/30 border border-slate-800 rounded-lg hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono font-bold uppercase text-slate-300">
                  {item.label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={val}
                    onChange={(e) => onInputChange(item.key, Number(e.target.value))}
                    className="w-20 px-2 py-0.5 bg-black/60 border border-slate-700 rounded text-right font-mono text-xs font-bold text-orange-400 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] font-mono text-slate-500 w-9">{item.unit}</span>
                </div>
              </div>

              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={val}
                onChange={(e) => onInputChange(item.key, Number(e.target.value))}
                className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${
                  isMoistureOrTemp ? 'accent-blue-500' : 'accent-orange-500'
                }`}
              />

              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>{item.min}</span>
                <span>{item.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diurnal Time of Day Slider */}
      <div className="mt-4 p-3 bg-black/30 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-mono font-bold uppercase text-orange-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Diurnal Cycle / Time of Day (LST): {inputs.time}:00 ({inputs.time >= 12 ? `${inputs.time === 12 ? 12 : inputs.time - 12} PM` : `${inputs.time === 0 ? 12 : inputs.time} AM`})
          </label>
          <span className="text-xs font-mono font-bold text-orange-400">Peak Heating: 17:00 LST</span>
        </div>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={inputs.time}
          onChange={(e) => onInputChange('time', Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
          <span>00:00 (Midnight)</span>
          <span>06:00 (Dawn)</span>
          <span>12:00 (Noon)</span>
          <span>17:00 (Max Insolation)</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  );
};
