import React, { useState } from 'react';
import {
  HazardRiskAssessment,
  SoundingData,
  MesoMaxInputs,
  SoundingIndices
} from '../types';
import { calculateConditionalEventLikelihood, getSpcRiskColor } from '../lib/mesoMaxEngine';
import {
  FileText,
  Activity,
  Layers,
  Award,
  Target,
  Copy,
  Check,
  Zap,
  Flame,
  Wind,
  Compass,
  ArrowUpRight
} from 'lucide-react';

interface AnalysisViewProps {
  assessment: HazardRiskAssessment;
  activeSounding: SoundingData;
  inputs: MesoMaxInputs;
  indices: SoundingIndices;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  assessment,
  activeSounding,
  inputs,
  indices
}) => {
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'discussion' | 'modes' | 'composites' | 'spc' | 'estimator'>('discussion');
  const [copiedDiscussion, setCopiedDiscussion] = useState(false);

  // Estimator States
  const [estHazard, setEstHazard] = useState<'wind' | 'hail' | 'tor'>('wind');
  const [estIntensity, setEstIntensity] = useState<number>(60);
  const [estMode, setEstMode] = useState<string>('DISCRETE SUPERCELL');

  const handleCopyDiscussion = () => {
    const rawText = `${assessment.discussion.summary}\n\n${assessment.discussion.synopsis}\n\n${assessment.discussion.thermo}\n\n${assessment.discussion.kine}\n\n${assessment.discussion.expectation}\n\n${assessment.discussion.tagsBlock}`;
    navigator.clipboard.writeText(rawText);
    setCopiedDiscussion(true);
    setTimeout(() => setCopiedDiscussion(false), 2000);
  };

  const estimatorResult = calculateConditionalEventLikelihood(
    assessment,
    inputs,
    estHazard,
    estIntensity,
    estMode
  );

  return (
    <div className="w-full space-y-6">
      {/* Active Sounding Diagnostic Bar */}
      <div className="bg-[#141820] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-orange-500 text-black rounded uppercase">
                Active Sounding
              </span>
              <span className="text-xs font-mono text-orange-400 font-bold">{activeSounding.title}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-mono uppercase text-white tracking-wider mt-1">
              Advanced Mesoscale Risk Simulation & Analysis
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 text-xs font-mono font-black rounded uppercase"
              style={{
                backgroundColor: getSpcRiskColor(assessment.spcCat),
                color: assessment.spcCat === 'MRGL' || assessment.spcCat === 'SLGT' ? '#000' : '#fff'
              }}
            >
              SPC: {assessment.spcCat}
            </span>
            <span className="px-3 py-1 bg-black/40 text-orange-400 text-xs font-mono font-bold rounded-lg border border-slate-800">
              Primary: {assessment.primaryMode.name}
            </span>
          </div>
        </div>

        {/* Hazard Intensity Tiers Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-4">
          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl border-l-4 border-blue-500">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
              Max Wind Gust Tier
            </span>
            <strong className="text-lg font-black font-mono text-blue-300 block mt-0.5">
              {assessment.intensity.wind.tierText}
            </strong>
            <span className="text-[10px] font-mono text-slate-500">
              Mean Wind {inputs.meanWind} kt + DCAPE {inputs.dcape} J/kg
            </span>
          </div>

          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl border-l-4 border-yellow-500">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
              Max Hail Size Tier
            </span>
            <strong className="text-lg font-black font-mono text-yellow-300 block mt-0.5">
              {assessment.intensity.hail.tierText}
            </strong>
            <span className="text-[10px] font-mono text-slate-500">
              SHIP {indices.ship.toFixed(2)} · Max size {assessment.intensity.hail.maxSizeInches.toFixed(2)}"
            </span>
          </div>

          <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl border-l-4 border-red-500">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
              Peak Tornado Intensity
            </span>
            <strong className="text-lg font-black font-mono text-red-400 block mt-0.5">
              {assessment.intensity.tor.tierText}
            </strong>
            <span className="text-[10px] font-mono text-slate-500">
              STP {indices.stp.toFixed(2)} · Sig Tor {assessment.sigTor.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Bento Sub-Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-lg border border-slate-800 mb-5">
          <button
            onClick={() => setActiveAnalysisTab('discussion')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition flex items-center gap-1.5 ${
              activeAnalysisTab === 'discussion'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Mesoscale Discussion
          </button>
          <button
            onClick={() => setActiveAnalysisTab('modes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition flex items-center gap-1.5 ${
              activeAnalysisTab === 'modes'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Storm Modes (7 Morphologies)
          </button>
          <button
            onClick={() => setActiveAnalysisTab('composites')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition flex items-center gap-1.5 ${
              activeAnalysisTab === 'composites'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Composite Indices
          </button>
          <button
            onClick={() => setActiveAnalysisTab('spc')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition flex items-center gap-1.5 ${
              activeAnalysisTab === 'spc'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            SPC Simulator
          </button>
          <button
            onClick={() => setActiveAnalysisTab('estimator')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition flex items-center gap-1.5 ${
              activeAnalysisTab === 'estimator'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Event Likelihood Estimator
          </button>
        </div>

        {/* Tab 1: Mesoscale Discussion */}
        {activeAnalysisTab === 'discussion' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase text-orange-400">
                Official Mesoscale Convective Discussion Product
              </h3>
              <button
                id="btn-copy-discussion"
                onClick={handleCopyDiscussion}
                className="px-3 py-1.5 bg-black/40 hover:bg-orange-500 hover:text-black text-orange-400 font-mono text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                {copiedDiscussion ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedDiscussion ? 'Copied to Clipboard!' : 'Copy Discussion Text'}
              </button>
            </div>

            <div className="p-5 bg-black/40 border border-slate-800 rounded-xl border-l-4 border-l-orange-500 font-mono text-sm leading-relaxed text-slate-200 shadow-inner">
              <h4 className="text-orange-400 font-bold uppercase text-base mb-2 pb-1 border-b border-slate-800">
                SUMMARY: {assessment.discussion.summary}
              </h4>

              <div className="space-y-3.5 mt-3 text-xs sm:text-sm">
                <div>
                  <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Synopsis & Initiation Dynamics:
                  </h5>
                  <p className="text-slate-300 mt-1">{assessment.discussion.synopsis}</p>
                </div>

                <div>
                  <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Thermodynamic & Kinematic Environment:
                  </h5>
                  <p className="text-slate-300 mt-1">{assessment.discussion.thermo}</p>
                  <p className="text-slate-300 mt-2">{assessment.discussion.kine}</p>
                </div>

                <div>
                  <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Threat Evolution & Expectation:
                  </h5>
                  <p className="text-slate-300 mt-1">{assessment.discussion.expectation}</p>
                </div>
              </div>

              {/* Preformatted Tags Block */}
              <pre className="mt-5 p-3 bg-black/60 border border-slate-800 rounded-lg text-orange-400 font-mono text-xs whitespace-pre-wrap font-bold overflow-x-auto">
                {assessment.discussion.tagsBlock}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Storm Modes */}
        {activeAnalysisTab === 'modes' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-orange-400">
              Storm Mode Morphology Distribution & Rankings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {assessment.modes.map((mode, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 bg-black/30 border rounded-xl shadow-md ${
                    idx === 0 ? 'border-orange-500 ring-1 ring-orange-500/30' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-1.5">
                      {idx === 0 && <span className="text-orange-400">★</span>}
                      {mode.name}
                    </h4>
                    <span className="text-sm font-black font-mono text-orange-400">{mode.prob.toFixed(1)}%</span>
                  </div>

                  {/* Probability Bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden my-2">
                    <div
                      className={`h-full rounded-full ${idx === 0 ? 'bg-orange-500' : 'bg-slate-600'}`}
                      style={{ width: `${Math.min(100, mode.prob * 1.8)}%` }}
                    ></div>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">{mode.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Composite Indices */}
        {activeAnalysisTab === 'composites' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-orange-400">
              Operational Severe Weather Composite Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Significant Tornado (STP)
                </span>
                <strong className="text-2xl font-black font-mono text-red-400 block my-1">
                  {indices.stp.toFixed(2)}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  MLCAPE, LCL, ESRH, Shear & CIN combination. &gt;1.0 supports tornadoes, &gt;3.0 violent tornadoes.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Supercell Composite (SCP)
                </span>
                <strong className="text-2xl font-black font-mono text-blue-400 block my-1">
                  {indices.scp.toFixed(2)}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  MUCAPE, ESRH, 0-6km Shear combination. Values &gt;1.0 favor persistent rotating updrafts.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Significant Hail (SHIP)
                </span>
                <strong className="text-2xl font-black font-mono text-yellow-400 block my-1">
                  {indices.ship.toFixed(2)}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  MUCAPE, mixing ratio, 700-500 lapse & 500mb T. Values &gt;1.0 support 2"+ hail.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Derecho Composite (DCP)
                </span>
                <strong className="text-2xl font-black font-mono text-orange-400 block my-1">
                  {indices.dcp.toFixed(2)}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  DCAPE, MUCAPE, deep shear, and mean wind. Values &gt;1.0 favor organized bow echoes.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Energy-Helicity (EHI 0–1km)
                </span>
                <strong className="text-2xl font-black font-mono text-red-400 block my-1">
                  {indices.ehi_0_1km.toFixed(2)}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  (SBCAPE × 0-1km SRH) / 160000.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Craven-Brooks Sig Severe
                </span>
                <strong className="text-2xl font-black font-mono text-emerald-400 block my-1">
                  {indices.craven_brooks}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  MLCAPE × 0-6km Shear (m/s). Threshold &gt;20000 for severe.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  Bulk Richardson (BRN)
                </span>
                <strong className="text-2xl font-black font-mono text-slate-200 block my-1">
                  {indices.brn}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  10–45 favors supercells; &gt;45 favors multicell clusters.
                </p>
              </div>

              <div className="p-3.5 bg-black/30 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase block">
                  SWEAT Index
                </span>
                <strong className="text-2xl font-black font-mono text-slate-200 block my-1">
                  {indices.sweat}
                </strong>
                <p className="text-[10px] font-mono text-slate-500">
                  Severe Weather Threat Index. &gt;300 severe, &gt;400 tornadic.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: SPC Simulator */}
        {activeAnalysisTab === 'spc' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-orange-400">
              SPC Day 1 Convective Outlook Categorical Simulation
            </h3>

            <div className="p-4 bg-black/30 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-slate-400 block font-bold uppercase">Simulated SPC Risk</span>
                <strong
                  className="text-3xl font-black font-mono px-3 py-1 rounded inline-block mt-1"
                  style={{
                    backgroundColor: getSpcRiskColor(assessment.spcCat),
                    color: assessment.spcCat === 'MRGL' || assessment.spcCat === 'SLGT' ? '#000' : '#fff'
                  }}
                >
                  {assessment.spcCat}
                </strong>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2 bg-black/50 border border-slate-800 rounded">
                  <span className="text-slate-500 block">Binned Tor %</span>
                  <span className="text-red-400 font-bold text-base">{assessment.spcProbBinned.tor}%</span>
                </div>
                <div className="p-2 bg-black/50 border border-slate-800 rounded">
                  <span className="text-slate-500 block">Binned Hail %</span>
                  <span className="text-yellow-400 font-bold text-base">{assessment.spcProbBinned.hail}%</span>
                </div>
                <div className="p-2 bg-black/50 border border-slate-800 rounded">
                  <span className="text-slate-500 block">Binned Wind %</span>
                  <span className="text-blue-400 font-bold text-base">{assessment.spcProbBinned.wind}%</span>
                </div>
                <div className="p-2 bg-black/50 border border-slate-800 rounded">
                  <span className="text-slate-500 block">Binned Tstm %</span>
                  <span className="text-slate-300 font-bold text-base">{assessment.spcProbBinned.tstm}%</span>
                </div>
              </div>
            </div>

            {/* Likelihood Distribution */}
            <div className="p-4 bg-black/30 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase text-slate-400">
                SPC Category Likelihood Distribution:
              </h4>
              <div className="space-y-1.5">
                {assessment.spcLikelihoods.map((l) => (
                  <div key={l.lvl} className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-12 text-right font-bold text-slate-300">{l.lvl}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${l.prob}%`, backgroundColor: getSpcRiskColor(l.lvl) }}
                      ></div>
                    </div>
                    <span className="w-12 text-slate-400 font-bold">{l.prob.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Event Likelihood Estimator */}
        {activeAnalysisTab === 'estimator' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-orange-400">
              Real-World Event Likelihood Estimator (Conditional Probability)
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Estimate the mathematical real-world odds of a specific physical hazard threshold being met given a chosen storm morphology.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-black/30 border border-slate-800 rounded-xl">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
                  Target Hazard
                </label>
                <select
                  value={estHazard}
                  onChange={(e) => {
                    const h = e.target.value as 'wind' | 'hail' | 'tor';
                    setEstHazard(h);
                    if (h === 'wind') setEstIntensity(65);
                    if (h === 'hail') setEstIntensity(1.75);
                    if (h === 'tor') setEstIntensity(2);
                  }}
                  className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono font-bold text-orange-400 focus:outline-none"
                >
                  <option value="wind">Damaging Wind (MPH)</option>
                  <option value="hail">Large Hail (Inches)</option>
                  <option value="tor">Tornado (EF Scale)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
                  Intensity Threshold ({estHazard === 'wind' ? 'MPH' : estHazard === 'hail' ? 'Inches' : 'EF Rating'})
                </label>
                <input
                  type="number"
                  step={estHazard === 'hail' ? 0.25 : 1}
                  min={estHazard === 'tor' ? 0 : 0}
                  max={estHazard === 'tor' ? 5 : 200}
                  value={estIntensity}
                  onChange={(e) => setEstIntensity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono font-bold text-orange-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
                  Assumed Storm Mode
                </label>
                <select
                  value={estMode}
                  onChange={(e) => setEstMode(e.target.value)}
                  className="w-full px-3 py-2 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono font-bold text-orange-400 focus:outline-none"
                >
                  {assessment.modes.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.prob.toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estimator Gold Result Box */}
            <div className="p-5 bg-gradient-to-br from-orange-950/40 to-black/80 border-2 border-orange-500/80 rounded-xl text-center shadow-xl">
              <span className="text-xs font-mono font-bold uppercase text-orange-400 tracking-wider">
                Conditional Event Probability ({estMode} & {estimatorResult.label})
              </span>
              <strong className="text-4xl sm:text-5xl font-black font-mono text-orange-400 block my-2 drop-shadow-md">
                {estimatorResult.finalProbPct}%
              </strong>
              <span className="text-xs font-mono text-slate-400">
                Conditional exceedance rate in storm cell: {estimatorResult.conditionalProbPct}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
