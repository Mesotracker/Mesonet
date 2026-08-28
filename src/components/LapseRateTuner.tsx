import React from 'react';
import { LapseRateTuning } from '../types';
import { Sliders, HelpCircle, Activity } from 'lucide-react';

interface LapseRateTunerProps {
  tuning: LapseRateTuning;
  onTuningChange: (newTuning: LapseRateTuning) => void;
  onResetTuning: () => void;
}

export const LapseRateTuner: React.FC<LapseRateTunerProps> = ({
  tuning,
  onTuningChange,
  onResetTuning
}) => {
  const updateField = (field: keyof LapseRateTuning, val: number) => {
    onTuningChange({
      ...tuning,
      [field]: val
    });
  };

  return (
    <div className="w-full bg-[#141820] border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-white tracking-wider">
            Lapse Rate & Parcel Integration Constant Tuner
          </h3>
        </div>
        <button
          onClick={onResetTuning}
          className="text-xs font-mono text-orange-400 hover:text-orange-300 transition"
        >
          Reset Defaults
        </button>
      </div>

      <p className="text-xs text-slate-400 my-2.5">
        Adjust physical atmospheric constants to obtain the most accurate possible lapse-rate line (amber dotted on Skew-T) and CAPE buoyancy calculations.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-2">
        {/* Dry Lapse Constant */}
        <div className="p-3 bg-black/30 border border-slate-800 rounded-lg">
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-slate-300 font-bold">Dry Lapse (Γd)</span>
            <span className="text-orange-400 font-bold">{tuning.dryLapseRate.toFixed(1)} °C/km</span>
          </div>
          <input
            type="range"
            min={8.0}
            max={11.0}
            step={0.1}
            value={tuning.dryLapseRate}
            onChange={(e) => updateField('dryLapseRate', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>8.0</span>
            <span>Standard: 9.8</span>
            <span>11.0</span>
          </div>
        </div>

        {/* Moist Lapse Factor */}
        <div className="p-3 bg-black/30 border border-slate-800 rounded-lg">
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-slate-300 font-bold">Moist Scaling (Γm)</span>
            <span className="text-blue-400 font-bold">{tuning.moistLapseFactor.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.3}
            step={0.02}
            value={tuning.moistLapseFactor}
            onChange={(e) => updateField('moistLapseFactor', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0.70x</span>
            <span>1.00x</span>
            <span>1.30x</span>
          </div>
        </div>

        {/* Virtual Temp Buoyancy Factor */}
        <div className="p-3 bg-black/30 border border-slate-800 rounded-lg">
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-slate-300 font-bold">Virtual Temp (Tv)</span>
            <span className="text-emerald-400 font-bold">{tuning.virtualTempFactor.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.05}
            value={tuning.virtualTempFactor}
            onChange={(e) => updateField('virtualTempFactor', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0.0 (Off)</span>
            <span>0.61 (Std)</span>
            <span>1.0</span>
          </div>
        </div>

        {/* Mid-Level Lapse Weighting */}
        <div className="p-3 bg-black/30 border border-slate-800 rounded-lg">
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-slate-300 font-bold">700–500mb Slope</span>
            <span className="text-purple-400 font-bold">{tuning.midLevelWeight.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.3}
            step={0.02}
            value={tuning.midLevelWeight}
            onChange={(e) => updateField('midLevelWeight', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-purple-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0.70x</span>
            <span>1.00x</span>
            <span>1.30x</span>
          </div>
        </div>
      </div>
    </div>
  );
};
