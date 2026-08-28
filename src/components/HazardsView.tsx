import React, { useState } from 'react';
import { HazardRiskAssessment, HourlyForecastStep, SoundingData } from '../types';
import { getSpcRiskColor, getRiskTierBadge } from '../lib/mesoMaxEngine';
import {
  Wind,
  CloudHail,
  Tornado,
  Zap,
  ShieldAlert,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles
} from 'lucide-react';

interface HazardsViewProps {
  assessment: HazardRiskAssessment;
  activeSounding: SoundingData;
  forecastSteps: HourlyForecastStep[];
  onSelectForecastHour?: (step: HourlyForecastStep) => void;
}

export const HazardsView: React.FC<HazardsViewProps> = ({
  assessment,
  activeSounding,
  forecastSteps,
  onSelectForecastHour
}) => {
  const [selectedHazardModal, setSelectedHazardModal] = useState<string | null>(null);

  const isForecastAvailable = activeSounding.source === 'open-meteo' && forecastSteps.length > 0;

  const generalHazards = [
    {
      id: 'wind',
      name: 'Damaging Wind',
      prob: assessment.pWind,
      subtext: '58+ MPH (50+ kt) gusts within 25 miles',
      icon: Wind,
      color: '#00e5ff',
      details: `Damaging downburst winds are driven by strong mid-level momentum transport and negative downdraft buoyancy (DCAPE). With analyzed DCAPE and environmental wind fields, convective downdrafts can produce peak surface gusts in the ${assessment.intensity.wind.tierText} tier.`
    },
    {
      id: 'hail',
      name: 'Large Hail',
      prob: assessment.pHail,
      subtext: '1.00"+ (Quarter size+) within 25 miles',
      icon: CloudHail,
      color: '#eab308',
      details: `Large hail development is fueled by strong updraft acceleration through the hail growth zone (-10°C to -30°C). With steep 700-500 mb lapse rates and high CAPE density, maximum hail size is estimated in the ${assessment.intensity.hail.tierText} tier.`
    },
    {
      id: 'tornado',
      name: 'Tornado',
      prob: assessment.pTor,
      subtext: 'Tornadogenesis within 25 miles',
      icon: Tornado,
      color: '#ef4444',
      details: `Tornado threat is modulated by low-level moisture (LCL height), 0-1 km Storm Relative Helicity (SRH), 0-3 km CAPE stretching, and effective-layer shear. Peak intensity is analyzed in the ${assessment.intensity.tor.tierText} tier.`
    },
    {
      id: 'tstm',
      name: 'General Thunderstorms',
      prob: assessment.pTstm,
      subtext: 'Convective initiation likelihood',
      icon: Zap,
      color: '#a855f7',
      details: `Thunderstorm probability reflects the likelihood of convective initiation overcoming the capping inversion (CIN) in combination with diurnal solar heating and low-level boundary convergence.`
    }
  ];

  const significantHazards = [
    {
      name: 'Significant Damaging Wind',
      prob: assessment.sigWind,
      threshold: '75+ MPH (Hurricane Force / Destructive)',
      cigLevel: assessment.cigWind,
      color: '#f97316',
      desc: 'Violent downbursts and bow echo rear-inflow jets capable of structural damage and downed high-tension utility lines.'
    },
    {
      name: 'Significant Large Hail',
      prob: assessment.sigHail,
      threshold: '2.00"+ (Hen Egg / Baseball Size+)',
      cigLevel: assessment.cigHail,
      color: '#eab308',
      desc: 'Destructive supercellular giant hail capable of penetrating roofs, destroying siding, and shattering vehicle windshields.'
    },
    {
      name: 'Significant Tornado',
      prob: assessment.sigTor,
      threshold: 'EF2 to EF5 (111+ MPH Violent Tornado)',
      cigLevel: assessment.cigTor,
      color: '#d946ef',
      desc: 'Strong to violent tornadoes associated with intense mesocyclone rotation and deep low-level streamwise vorticity ingestion.'
    }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Page Title & Summary Strip */}
      <div className="bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-mono uppercase text-white tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              General & Significant Hazard Probabilities
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Active Sounding: <strong className="text-orange-400">{activeSounding.title}</strong> · SPC Outlook Category: <strong className="text-yellow-400">{assessment.spcCat}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 bg-black/40 text-orange-400 font-bold rounded-lg border border-slate-800">
              CI Prob: {assessment.ciProb}%
            </span>
            <span className="text-xs font-mono px-3 py-1 bg-black/40 text-red-400 font-bold rounded-lg border border-slate-800">
              Peak Base Risk: {assessment.maxBaseProb}%
            </span>
          </div>
        </div>

        {/* 1. General Hazards Grid */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
              1. General Convective Hazards (25-Mile Radius Probabilities)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Click any card for full diagnostic briefing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {generalHazards.map((haz) => {
              const Icon = haz.icon;
              const tier = getRiskTierBadge(haz.prob);
              const colorCode = getSpcRiskColor(tier);

              return (
                <div
                  key={haz.id}
                  id={`hazard-card-${haz.id}`}
                  onClick={() => setSelectedHazardModal(haz.id === selectedHazardModal ? null : haz.id)}
                  className={`p-4 bg-black/30 border rounded-xl cursor-pointer hover:border-orange-500 transition-all duration-200 shadow-md ${
                    selectedHazardModal === haz.id ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-orange-400" />
                      <h4 className="text-sm font-bold font-mono uppercase text-slate-200">{haz.name}</h4>
                    </div>
                    <span
                      className="px-2 py-0.5 text-[10px] font-mono font-black rounded uppercase"
                      style={{ backgroundColor: colorCode, color: tier === 'MRGL' || tier === 'SLGT' ? '#000' : '#fff' }}
                    >
                      {tier}
                    </span>
                  </div>

                  <div className="my-3 flex items-baseline gap-2">
                    <strong className="text-3xl font-black font-mono text-white">{haz.prob.toFixed(1)}%</strong>
                    <span className="text-xs font-mono text-slate-400">within 25 mi</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, haz.prob * 1.3)}%`, backgroundColor: colorCode }}
                    ></div>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400 mt-2">{haz.subtext}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Significant Hazards Grid (Hatched Background) */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono font-bold uppercase text-orange-400 tracking-wider">
              2. Significant Severe Hazards (High-Impact Threat Tiers)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Conditional Intensity Guidance (CIG)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {significantHazards.map((sig, idx) => (
              <div
                key={idx}
                className="p-4 bg-black/30 border border-slate-800 rounded-xl relative overflow-hidden shadow-lg"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 10px, rgba(148, 163, 184, 0.04) 10px 20px)'
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono uppercase text-slate-300">{sig.name}</h4>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-black rounded uppercase ${
                      sig.cigLevel === 'CIG 3'
                        ? 'bg-purple-600 text-white animate-pulse'
                        : sig.cigLevel === 'CIG 2'
                        ? 'bg-red-600 text-white'
                        : sig.cigLevel === 'CIG 1'
                        ? 'bg-orange-500 text-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {sig.cigLevel}
                  </span>
                </div>

                <div className="my-2.5 flex items-baseline gap-2">
                  <strong className="text-3xl font-black font-mono text-orange-400">{sig.prob.toFixed(1)}%</strong>
                  <span className="text-xs font-mono text-slate-400">Sig Probability</span>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, sig.prob * 2.0)}%` }}
                  ></div>
                </div>

                <div className="mt-2 text-xs font-mono font-bold text-slate-300">{sig.threshold}</div>
                <p className="text-[11px] font-mono text-slate-400 mt-1 leading-relaxed">{sig.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Detailed Modal/Drawer If User Clicked Hazard */}
      {selectedHazardModal && (
        <div className="bg-[#141820] border-2 border-orange-500 rounded-xl p-5 shadow-2xl transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-base font-bold font-mono uppercase text-orange-400 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Detailed Meteorological Diagnosis: {generalHazards.find((h) => h.id === selectedHazardModal)?.name}
            </h4>
            <button
              onClick={() => setSelectedHazardModal(null)}
              className="text-xs font-mono text-slate-300 hover:text-white px-2.5 py-1 bg-black/40 border border-slate-700 rounded"
            >
              Close [X]
            </button>
          </div>
          <p className="text-sm font-mono text-slate-200 mt-3 leading-relaxed">
            {generalHazards.find((h) => h.id === selectedHazardModal)?.details}
          </p>
        </div>
      )}

      {/* 4. Forecast Risk Evolution Graph (Open-Meteo Only) */}
      {isForecastAvailable ? (
        <div className="bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold font-mono uppercase text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Hourly Forecast Severe Hazard Evolution (Open-Meteo GFS)
              </h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Displays real-time temporal progression of convective risk across the available {forecastSteps.length}-hour forecast window.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 bg-black/40 text-orange-400 border border-slate-800 rounded-lg">
              {forecastSteps.length} Hourly Timesteps
            </span>
          </div>

          {/* Interactive Timeline Bar Chart / Timeline Selector */}
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="min-w-[700px] h-64 bg-black/30 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-mono text-slate-300 pb-2 border-b border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-cyan-400 rounded-sm"></span> Wind %
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-yellow-400 rounded-sm"></span> Hail %
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded-sm"></span> Tor %
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-orange-500 rounded-sm"></span> MLCAPE (scaled)
                </span>
              </div>

              {/* Bars Container */}
              <div className="flex items-end justify-between gap-1 flex-1 pt-3">
                {forecastSteps.map((step, idx) => {
                  const maxProb = Math.max(step.risks.pWind, step.risks.pHail, step.risks.pTor);
                  const isCurrent = step.sounding.id === activeSounding.id;

                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectForecastHour && onSelectForecastHour(step)}
                      title={`${step.hourLabel}: Wind ${step.risks.pWind}%, Hail ${step.risks.pHail}%, Tor ${step.risks.pTor}%, MLCAPE ${step.indices.mlcape} J/kg, Category ${step.risks.spcCat}`}
                      className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer p-0.5 rounded transition ${
                        isCurrent ? 'bg-orange-950/40 border border-orange-500' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-[9px] font-mono text-orange-400 mb-1 opacity-0 group-hover:opacity-100 font-bold">
                        {maxProb.toFixed(0)}%
                      </span>

                      {/* Stacked/Parallel Risk Indicators */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-36">
                        {/* Wind bar */}
                        <div
                          className="w-1.5 bg-cyan-400 rounded-t"
                          style={{ height: `${Math.min(100, step.risks.pWind * 1.1)}%` }}
                        ></div>
                        {/* Hail bar */}
                        <div
                          className="w-1.5 bg-yellow-400 rounded-t"
                          style={{ height: `${Math.min(100, step.risks.pHail * 1.1)}%` }}
                        ></div>
                        {/* Tor bar */}
                        <div
                          className="w-1.5 bg-red-500 rounded-t"
                          style={{ height: `${Math.min(100, step.risks.pTor * 1.5)}%` }}
                        ></div>
                      </div>

                      {/* Hour Label */}
                      <span
                        className={`text-[9px] font-mono mt-1.5 truncate max-w-[32px] ${
                          isCurrent ? 'text-orange-400 font-black' : 'text-slate-400'
                        }`}
                      >
                        {step.hourLabel.replace(':00', '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
