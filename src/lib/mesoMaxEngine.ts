import {
  MesoMaxInputs,
  HazardRiskAssessment,
  HazardIntensityTiers,
  MesoscaleDiscussionProduct,
  StormModeEvaluation
} from '../types';

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function calcSpcCat(t: number, h: number, w: number): 'NONE' | 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH' {
  if (t >= 60 || h >= 60 || w >= 60) return 'HIGH';
  if (t >= 30 || h >= 45 || w >= 45) return 'MDT';
  if (t >= 10 || h >= 30 || w >= 30) return 'ENH';
  if (t >= 5 || h >= 15 || w >= 15) return 'SLGT';
  if (t >= 2 || h >= 5 || w >= 5) return 'MRGL';
  return 'NONE';
}

export function snapToBin(val: number, type: 'tor' | 'hail' | 'wind'): number {
  const bins = type === 'tor' ? [0, 2, 5, 10, 15, 30, 45, 60] : [0, 5, 15, 30, 45, 60];
  let closest = 0;
  for (const bin of bins) {
    if (val >= bin) closest = bin;
  }
  return closest;
}

export function snapToBinTstm(val: number): number {
  const bins = [0, 15, 30, 45, 60, 75, 90];
  let closest = 0;
  for (const bin of bins) {
    if (val >= bin) closest = bin;
  }
  return closest;
}

export function getSpcRiskColor(cat: string): string {
  switch (cat) {
    case 'NONE': return '#475569';
    case 'TSTM': return '#94a3b8';
    case 'MRGL': return '#22c55e'; // Green
    case 'SLGT': return '#eab308'; // Yellow
    case 'ENH':  return '#f97316'; // Orange
    case 'MDT':  return '#ef4444'; // Red
    case 'HIGH': return '#d946ef'; // Magenta
    default:     return '#64748b';
  }
}

export function getRiskTierBadge(prob: number): 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH' {
  if (prob < 5) return 'MRGL';
  if (prob < 15) return 'SLGT';
  if (prob < 30) return 'ENH';
  if (prob < 45) return 'MDT';
  return 'HIGH';
}

export function windTier(gustMph: number): string {
  const tiers = [37, 43, 48, 54, 60, 66, 72, 78, 85, 92, 99, 106, 113, 121, 128];
  for (let i = 0; i < tiers.length; i++) {
    if (gustMph < tiers[i]) return `${tiers[i] - 8} to ${tiers[i]} MPH`;
  }
  return '130+ MPH';
}

export function hailTier(sizeInches: number): string {
  const tiers = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
  for (let i = 0; i < tiers.length; i++) {
    if (sizeInches < tiers[i]) return `${(tiers[i] - 0.35).toFixed(2)} to ${tiers[i].toFixed(2)} in`;
  }
  return '4.00+ in';
}

export function tornadoTier(stp: number, sigTorProb: number): string {
  const score = stp + sigTorProb / 10.0;
  if (score < 0.5) return '< 85 MPH';
  if (score < 1.15) return '85 to 110 MPH';
  if (score < 1.8) return '100 to 130 MPH';
  if (score < 2.9) return '120 to 150 MPH';
  if (score < 4.25) return '140 to 170 MPH';
  if (score < 6.5) return '155 to 190 MPH';
  return '175+ MPH';
}

/**
 * Exact Mesoscale Discussion Builder (Preserves exact required format and text integrity)
 */
export function buildMesoscaleDiscussion(
  env: MesoMaxInputs,
  sig: { tornado: number; hail: number; wind: number },
  comp: { scp: number; stp: number; ship: number; dcp: number },
  intensity: HazardIntensityTiers,
  primaryMode: StormModeEvaluation,
  ciProb: number,
  stormMotion: { dir: number; speedKt: number; speedMph: number },
  stormHeight: { meters: number; feet: number; km: number }
): MesoscaleDiscussionProduct {
  const buoyancyDesc =
    env.cape > 4000 ? 'extreme' : env.cape > 2500 ? 'strong' : env.cape > 1000 ? 'moderate' : 'weak';
  const shearDesc =
    env.shear > 60 ? 'intense' : env.shear > 40 ? 'strong' : env.shear > 25 ? 'adequate' : 'marginal';

  const synoptic =
    ciProb < 25
      ? `Synoptic forcing remains nebulous, characterized by neutral height tendencies and weak mid-level flow. Substantial convective inhibition (CIN: ${env.cin.toFixed(
          0
        )} J/kg) serves as a formidable barrier, severely restricting updraft development. Intense mesoscale forcing—such as a concentrated boundary collision—will be imperative to breach the resilient capping inversion.`
      : ciProb < 65
      ? `Subtle shortwave troughing and modest 500 mb height falls are overspreading the warm sector, providing glancing broad-scale ascent. This forcing, combined with localized low-level convergence along surface boundaries, suggests scattered convective initiation is plausible (${ciProb.toFixed(
          0
        )}%). Ambient boundary layer moisture pooling (Td: ${env.dew.toFixed(
          0
        )}°F) will support rapid maturation of initial updrafts as they breach the weakening cap.`
      : `Robust synoptic-scale ascent, driven by a potent mid-level jet streak and substantial height falls, is directly phasing with an uncapped and deeply convergent boundary layer. This volatile combination virtually guarantees widespread, rapid convective initiation (Probability of CI: ${ciProb.toFixed(
          0
        )}%). Convection will explosively mature into deep, sustained updrafts within minutes of triggering.`;

  const thermo = `The thermodynamic profile is highly volatile and characterized by ${buoyancyDesc} buoyancy. Unimpeded diurnal heating and persistent low-level moisture advection have yielded a warm sector with MLCAPE analyzed at ${env.cape.toFixed(
    0
  )} J/kg. Plume advection of an Elevated Mixed Layer (EML) has steepened 700-500 mb lapse rates to ${env.lapse.toFixed(
    1
  )} °C/km, maximizing parcel acceleration in the hail growth zone (-10°C to -30°C). Furthermore, concentrated boundary-layer buoyancy (0-3 km CAPE: ${env.cape3.toFixed(
    0
  )} J/kg) is juxtaposed with LCL heights around ${env.lcl.toFixed(
    0
  )} m, readily sustaining aggressive low-level mass flux and profound precipitation loading without detrimental entrainment. The Equilibrium Level (EL) is estimated at ${stormHeight.feet.toLocaleString()} ft AGL (~${stormHeight.km.toFixed(
    1
  )} km).`;

  const kine = `Kinematic fields are ${shearDesc} and definitively favor a ${primaryMode.name.toLowerCase()} storm morphology. The deep-layer environmental shear is characterized by a 0-6 km bulk magnitude of ${env.shear.toFixed(
    0
  )} kt and a storm-relative mean wind of ${env.meanWind.toFixed(
    0
  )} kt. Projected Bunkers Storm Motion vector for right-moving supercells is estimated at ${stormMotion.dir}° at ${
    stormMotion.speedKt
  } kt (${stormMotion.speedMph} mph). In the lower atmosphere, hodographs exhibit prominent curvature; 0-1 km Storm Relative Helicity (SRH) is maximized near ${env.srh.toFixed(
    0
  )} m²/s², supporting strong low-level streamwise vorticity ingestion.`;

  let expectation = `Evolution Timeline & Hazard Expectation: `;
  if (sig.tornado > 5 || comp.stp > 1) {
    expectation += `The parameter space strongly indicates a threat for intense, potentially long-track tornadoes. With the Significant Tornado Parameter (STP) spiking near ${comp.stp.toFixed(
      1
    )}, augmented by suppressed LCLs and robust 0-3km CAPE stretching, the low-level mesocyclone environment is incredibly supportive of tornadogenesis. `;
  }
  if (sig.hail > 5 || comp.ship > 1) {
    expectation += `Simultaneously, the threat for significant, destructive large hail (up to ${intensity.hail.maxSizeInches.toFixed(
      1
    )} inches in diameter) is heavily supported by a SHIP index of ${comp.ship.toFixed(
      1
    )}. Rapid supercellular residence times in the maximized CAPE density layer will allow for massive ice accretion. `;
  }
  if (sig.wind > 5 || comp.dcp > 1) {
    expectation += `As storms evolve and potential cold-pool amalgamation occurs, damaging wind gusts up to ${intensity.wind.maxGustMph} MPH are anticipated. This is propelled by a localized DCAPE reservoir of ${env.dcape.toFixed(
      0
    )} J/kg, which will aggressively accelerate severe, precipitation-loaded downdrafts to the surface. `;
  }
  if (
    sig.tornado <= 5 &&
    sig.hail <= 5 &&
    sig.wind <= 5 &&
    comp.stp <= 1 &&
    comp.ship <= 1 &&
    comp.dcp <= 1
  ) {
    expectation += `While organized, significant severe threats remain spatially localized or marginal. Isolated strong downbursts generating sporadic wind damage, or marginally severe hail up to 1.0 inch remain possible within the most robust, sustained updraft cores.`;
  }

  const tagsBlock = `OPERATIONAL DIAGNOSTICS...\nPRIMARY STORM MODE...... ${primaryMode.name.toUpperCase()}\nESTIMATED STORM MOTION... ${stormMotion.dir}° AT ${stormMotion.speedKt} KT (${stormMotion.speedMph} MPH)\nESTIMATED STORM TOP HEIGHT.. ${stormHeight.feet.toLocaleString()} FT AGL (~${stormHeight.km.toFixed(1)} KM)\nCI PROBABILITY.......... ${ciProb.toFixed(0)}%\nMAX HAIL TIER........... ${intensity.hail.tierText}\nMAX WIND TIER........... ${intensity.wind.tierText}\nMAX TORNADO TIER........ ${intensity.tor.tierText}\nWATCH ISSUANCE PROB..... ${Math.round(intensity.watchProb / 10) * 10}%`;

  const summary = `Organized severe weather, predominantly featuring a ${primaryMode.name.toUpperCase()} mode, is expected to evolve.`;

  const fullHtml = `<h4>Synopsis & Initiation Dynamics</h4><p>${synoptic}</p><h4>Thermodynamic & Kinematic Environment</h4><p>${thermo}</p><p>${kine}</p><h4>Threat Evolution & Expectation</h4><p>${expectation}</p>`;

  return {
    summary,
    synopsis: synoptic,
    thermo,
    kine,
    expectation,
    fullHtml,
    tagsBlock
  };
}

/**
 * Revamped MesoMax RiskSim Engine:
 * Fully calculates all 25-mile base probabilities, significant threats, CIG levels,
 * storm modes, SPC categories, and mesoscale discussion.
 */
export function runMesoMaxRiskEngine(env: MesoMaxInputs): HazardRiskAssessment {
  // Diurnal & Initiation Physics
  const time_diff = Math.abs(env.time - 17);
  const diurnalFactor = Math.exp(-Math.pow(time_diff / 5.5, 2));
  const temp_spread = Math.max(0, env.temp - env.dew);
  const cap_penalty = Math.abs(env.cin) / 25.0;

  const ci_logit =
    -2.5 +
    env.cape / 1200.0 -
    cap_penalty -
    temp_spread / 12.0 +
    (env.lapse - 6.0) * 0.4 +
    diurnalFactor * 1.8;

  const ciProb = clamp(100.0 / (1.0 + Math.exp(-ci_logit)), 2, 98);
  const ci_factor = ciProb / 100.0;

  // Key Composite Parameters
  const stp = Math.max(
    0,
    (env.cape / 1500.0) *
      ((2000.0 - env.lcl) / 1000.0) *
      (env.esrh / 150.0) *
      (env.shear / 40.0) *
      ((200.0 + env.cin) / 150.0)
  );

  const scp = Math.max(
    0,
    (env.cape / 1000.0) * (env.esrh / 50.0) * Math.min(env.shear / 40.0, 1.5)
  );

  // Dewpoint to mixing ratio approx
  const t500_c = ((env.t500 - 32) * 5) / 9.0;
  const t500_factor = t500_c > -5 ? 5 : Math.min(Math.abs(t500_c), 20);
  const vapor_p = 6.112 * Math.exp((17.67 * ((env.dew - 32) * 5) / 9.0) / (((env.dew - 32) * 5) / 9.0 + 243.5));
  const mix_ratio = (0.622 * (vapor_p / Math.max(850 - vapor_p, 1))) * 1000.0;

  const ship = Math.max(
    0,
    (env.cape * mix_ratio * env.lapse * t500_factor * env.shear) / 42000000.0
  );

  const dcp = Math.max(
    0,
    (env.dcape / 980.0) * (env.cape / 2000.0) * (env.shear / 40.0) * (env.meanWind / 32.0)
  );

  // Logistic Logits for Hazard Probabilities
  const x_tor =
    -4.5 +
    0.9 * stp +
    0.0035 * env.srh +
    0.015 * env.llShear -
    0.0008 * env.lcl +
    0.0003 * env.cape3 +
    0.15 * (env.lapse - 6.5);

  const x_hail =
    -3.8 +
    0.65 * ship +
    0.0003 * env.cape -
    0.035 * env.t500 +
    0.2 * (env.lapse - 6.5) +
    0.008 * env.shear;

  const x_wind =
    -3.2 +
    0.85 * dcp +
    0.0015 * env.dcape +
    0.027 * env.meanWind +
    0.03 * temp_spread +
    0.008 * env.shear;

  const raw_pTor = 100.0 / (1.0 + Math.exp(-x_tor));
  const raw_pHail = 100.0 / (1.0 + Math.exp(-x_hail));
  const raw_pWind = 100.0 / (1.0 + Math.exp(-x_wind));

  const pTor = clamp(raw_pTor * ci_factor, 0, 60);
  const pHail = clamp(raw_pHail * ci_factor, 0, 75);
  const pWind = clamp(raw_pWind * ci_factor, 0, 90);

  const pTstm = clamp(ciProb * Math.min(1.0, env.cape / 100.0), 0, 100);
  const spcTstm = snapToBinTstm(pTstm);

  // Significant Threats
  const dampenSig = (val: number) => {
    if (val <= 15) return val;
    return 15 + 35 * (1 - Math.exp(-(val - 15) / 15.0));
  };

  const rawSigTor = ((stp / 6.25) * 30.0) * ci_factor;
  const rawSigHail = ((ship / 3.5) * 30.0) * ci_factor;
  const rawSigWind = ((dcp / 1.75) * 30.0) * ci_factor;

  const sigTor = clamp(Math.min(pTor, dampenSig(rawSigTor)), 0, 60);
  const sigHail = clamp(Math.min(pHail, dampenSig(rawSigHail)), 0, 60);
  const sigWind = clamp(Math.min(pWind, dampenSig(rawSigWind)), 0, 60);

  const getSigLevel = (sigProb: number): 'CIG 1' | 'CIG 2' | 'CIG 3' | 'None' => {
    if (sigProb >= 32) return 'CIG 3';
    if (sigProb >= 16) return 'CIG 2';
    if (sigProb >= 8) return 'CIG 1';
    return 'None';
  };

  const cigTor = getSigLevel(sigTor);
  const cigHail = getSigLevel(sigHail);
  const cigWind = getSigLevel(sigWind);

  // Maximum Gust & Hail Tiers
  const gustMax = Math.round(clamp(env.meanWind + Math.sqrt(2 * Math.max(env.dcape, 0)) * 1.0, 30, 130));
  const hailMax = clamp(0.75 + 0.75 * ship + 0.0001 * env.cape, 0.25, 5.0);

  const intensity: HazardIntensityTiers = {
    wind: { maxGustMph: gustMax, tierText: windTier(gustMax) },
    hail: { maxSizeInches: Math.round(hailMax * 100) / 100, tierText: hailTier(hailMax) },
    tor: { peakRating: tornadoTier(stp, sigTor), tierText: tornadoTier(stp, sigTor) },
    watchProb: clamp(Math.max(pTor, pHail, pWind) * 1.6, 0, 95)
  };

  // Storm Motion & Storm Top Height
  const meanU = env.meanWind * 0.707;
  const meanV = env.meanWind * 0.707;
  const devU = env.shear > 0 ? (7.5 * (env.shear * 0.707)) / env.shear : 5;
  const devV = env.shear > 0 ? (-7.5 * (env.shear * 0.707)) / env.shear : -5;
  const rmU = meanU + devU;
  const rmV = meanV + devV;
  const stormSpeedKt = Math.round(Math.sqrt(rmU * rmU + rmV * rmV));
  const stormSpeedMph = Math.round(stormSpeedKt * 1.15078);
  let stormDirDeg = Math.round((270 - (Math.atan2(rmV, rmU) * 180.0) / Math.PI) % 360);
  if (stormDirDeg < 0) stormDirDeg += 360;

  const stormMotion = { dir: stormDirDeg, speedKt: stormSpeedKt, speedMph: stormSpeedMph };

  const stormHeightM = Math.round(env.lcl + 7500 + Math.sqrt(Math.max(0, env.cape)) * 85);
  const stormHeightFt = Math.round(stormHeightM * 3.28084);
  const stormHeight = {
    meters: stormHeightM,
    feet: stormHeightFt,
    km: Math.round((stormHeightM / 1000.0) * 10) / 10
  };

  // Storm Mode Morphology Analysis
  const modesList: { name: string; score: number; desc: string }[] = [
    {
      name: 'DISCRETE SUPERCELL',
      score: clamp(scp * 20 + env.ebwd * 1.5 + env.srh * 0.1, 0, 100),
      desc: 'Isolated rotating updrafts with intense localized severe and tornadic potential.'
    },
    {
      name: 'DISCRETE CELLS',
      score: clamp(env.cape * 0.01 + env.shear * 0.8 + (env.cin > -25 ? 20 : 0), 0, 100),
      desc: 'Multi-cell or pulse convection with isolated hail/wind threats.'
    },
    {
      name: 'CELL CLUSTERS',
      score: clamp(env.cape * 0.015 + (env.shear >= 15 && env.shear <= 35 ? 40 : 10), 0, 100),
      desc: 'Amalgamating multicell clusters with heavy rainfall and localized downbursts.'
    },
    {
      name: 'BROKEN LINES',
      score: clamp(env.llShear * 1.5 + (env.shear >= 30 ? 30 : 10) + env.cape / 150.0, 0, 100),
      desc: 'Segmented convective lines transitioning into embedded mesovortices.'
    },
    {
      name: 'SERIAL LINES',
      score: clamp(env.shear * 1.2 + env.llShear * 1.5 + env.cape / 120.0, 0, 100),
      desc: 'Strongly forced linear system aligned along synoptic frontal boundaries.'
    },
    {
      name: 'PROGRESSIVE QLCS',
      score: clamp(env.meanWind * 1.5 + env.dcape * 0.03 + env.llShear, 0, 100),
      desc: 'Fast-moving squall line capable of widespread damaging straight-line winds.'
    },
    {
      name: 'BOW SEGMENTS',
      score: clamp(dcp * 20 + env.dcape * 0.04 + env.meanWind, 0, 100),
      desc: 'Accelerating bow echoes producing severe rear-inflow jet downbursts.'
    }
  ];

  const modeSignatures: Record<string, number> = {
    'DISCRETE SUPERCELL': clamp(
      0.25 +
        0.30 * clamp(env.srh / 200, 0, 1) +
        0.20 * clamp(env.shear / 50, 0, 1) +
        0.15 * clamp(env.ebwd / 25, 0, 1) +
        0.10 * clamp(env.cape / 3000, 0, 1),
      0,
      1
    ),
    'DISCRETE CELLS': clamp(
      0.20 +
        0.30 * clamp(env.cape / 2500, 0, 1) +
        0.20 * clamp(env.shear / 35, 0, 1) +
        0.20 * clamp((env.cin + 100) / 100, 0, 1) +
        0.10 * clamp((40 - env.llShear) / 40, 0, 1),
      0,
      1
    ),
    'CELL CLUSTERS': clamp(
      0.20 +
        0.30 * clamp(env.cape / 3000, 0, 1) +
        0.25 * clamp((env.shear - 10) / 30, 0, 1) +
        0.15 * clamp((35 - Math.abs(env.shear - 25)) / 25, 0, 1) +
        0.10 * clamp(env.cape3 / 1000, 0, 1),
      0,
      1
    ),
    'BROKEN LINES': clamp(
      0.15 +
        0.30 * clamp(env.llShear / 25, 0, 1) +
        0.25 * clamp(env.shear / 50, 0, 1) +
        0.15 * clamp(env.cape / 2500, 0, 1) +
        0.15 * clamp(env.meanWind / 40, 0, 1),
      0,
      1
    ),
    'SERIAL LINES': clamp(
      0.15 +
        0.30 * clamp(env.shear / 55, 0, 1) +
        0.25 * clamp(env.llShear / 25, 0, 1) +
        0.15 * clamp(env.meanWind / 45, 0, 1) +
        0.15 * clamp(env.cape / 2500, 0, 1),
      0,
      1
    ),
    'PROGRESSIVE QLCS': clamp(
      0.15 +
        0.30 * clamp(env.meanWind / 45, 0, 1) +
        0.25 * clamp(env.llShear / 25, 0, 1) +
        0.20 * clamp(env.dcape / 1000, 0, 1) +
        0.10 * clamp(env.shear / 50, 0, 1),
      0,
      1
    ),
    'BOW SEGMENTS': clamp(
      0.10 +
        0.35 * clamp(dcp / 1.5, 0, 1) +
        0.25 * clamp(env.dcape / 1200, 0, 1) +
        0.20 * clamp(env.meanWind / 45, 0, 1) +
        0.10 * clamp(env.llShear / 25, 0, 1),
      0,
      1
    )
  };

  const modeWeightsRaw = modesList.map((m) => {
    const signature = modeSignatures[m.name] ?? 0.25;
    const evidence = 0.55 + 0.90 * signature;
    return Math.exp((m.score * evidence - 50.0) / 18.0);
  });
  const modeWeightSum = modeWeightsRaw.reduce((sum, weight) => sum + weight, 0);

  const evaluatedModes: StormModeEvaluation[] = modesList
    .map((m, i) => ({
      name: m.name,
      score: Math.round(m.score * 10) / 10,
      prob: Math.round((modeWeightsRaw[i] / modeWeightSum) * 1000) / 10,
      description: m.desc
    }))
    .sort((a, b) => b.prob - a.prob);

  const primaryMode = evaluatedModes[0];

  // SPC Categorical Simulation
  const spcT = snapToBin(pTor, 'tor');
  const spcH = snapToBin(pHail, 'hail');
  const spcW = snapToBin(pWind, 'wind');
  const spcCat = calcSpcCat(spcT, spcH, spcW);

  const maxEq = Math.max(pWind, pHail, pTor * 2.0);
  const centers: Record<string, number> = {
    NONE: 0,
    TSTM: 10,
    MRGL: 15,
    SLGT: 30,
    ENH: 45,
    MDT: 60,
    HIGH: 75
  };
  const spcLikelihoods = (Object.keys(centers) as ('NONE' | 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH')[]).map(
    (lvl) => ({
      lvl,
      prob: Math.exp(-Math.pow(maxEq - centers[lvl], 2) / 200.0)
    })
  );
  const sumSpc = spcLikelihoods.reduce((a, b) => a + b.prob, 0);
  const normalizedSpcLikelihoods = spcLikelihoods.map((l) => ({
    lvl: l.lvl,
    prob: Math.round((l.prob / sumSpc) * 1000) / 10
  }));

  // Mesoscale Discussion Text
  const discussion = buildMesoscaleDiscussion(
    env,
    { tornado: sigTor, hail: sigHail, wind: sigWind },
    { scp, stp, ship, dcp },
    intensity,
    primaryMode,
    ciProb,
    stormMotion,
    stormHeight
  );

  return {
    pWind: Math.round(pWind * 10) / 10,
    pHail: Math.round(pHail * 10) / 10,
    pTor: Math.round(pTor * 10) / 10,
    pTstm: Math.round(pTstm * 10) / 10,
    maxBaseProb: Math.round(Math.max(pWind, pHail, pTor) * 10) / 10,

    sigWind: Math.round(sigWind * 10) / 10,
    sigHail: Math.round(sigHail * 10) / 10,
    sigTor: Math.round(sigTor * 10) / 10,
    cigWind,
    cigHail,
    cigTor,

    spcCat,
    spcLikelihoods: normalizedSpcLikelihoods,
    spcProbBinned: { tor: spcT, hail: spcH, wind: spcW, tstm: spcTstm },

    ciProb: Math.round(ciProb * 10) / 10,
    diurnalFactor: Math.round(diurnalFactor * 100),

    primaryMode,
    modes: evaluatedModes,

    intensity,
    discussion,

    stormMotion,
    stormHeight
  };
}

/**
 * Event Likelihood Estimator (Conditional Probability Calculation)
 */
export function calculateConditionalEventLikelihood(
  assessment: HazardRiskAssessment,
  env: MesoMaxInputs,
  hazard: 'wind' | 'hail' | 'tor',
  threshold: number,
  modeName: string
): { conditionalProbPct: number; finalProbPct: number; label: string } {
  const modeData = assessment.modes.find((m) => m.name === modeName);
  const pMode = modeData ? modeData.prob / 100.0 : 0.05;

  let pBaseHazard = 0;
  let probExceed = 0;

  if (hazard === 'wind') {
    pBaseHazard = assessment.pWind / 100.0;
    const alpha = 14.0 + env.dcape / 90.0 + env.meanWind * 0.25;
    const beta = 1.2;
    const speedDiff = Math.max(0, threshold - 50);

    if (threshold <= 50) probExceed = 0.99;
    else probExceed = Math.exp(-Math.pow(speedDiff / alpha, beta));
  } else if (hazard === 'hail') {
    pBaseHazard = assessment.pHail / 100.0;
    const stpFactor = (env.cape / 1500.0) * (env.lapse / 7.0);
    const scale = 0.35 + stpFactor * 0.18 + env.cape / 9000.0;
    const hailDiff = Math.max(0, threshold - 0.75);

    if (threshold <= 0.75) probExceed = 0.99;
    else probExceed = Math.exp(-hailDiff / scale);
  } else if (hazard === 'tor') {
    pBaseHazard = assessment.pTor / 100.0;
    const stp = Math.max(0, (env.cape / 1500.0) * ((2000.0 - env.lcl) / 1000.0) * (env.esrh / 150.0));
    const lambda = Math.max(0.65, 1.45 - stp * 0.12);
    const efLevel = clamp(Math.floor(threshold), 0, 5);

    if (efLevel === 0) probExceed = 1.0;
    else probExceed = Math.exp(-lambda * efLevel);
  }

  let modeFactor = 1.0;
  if (hazard === 'tor') {
    if (modeName.includes('SUPERCELL')) modeFactor = 1.4;
    else if (modeName.includes('QLCS')) modeFactor = 0.6;
    else if (modeName.includes('CELLS')) modeFactor = 0.8;
    else modeFactor = 0.2;
  } else if (hazard === 'hail') {
    if (modeName.includes('SUPERCELL')) modeFactor = 1.3;
    else if (modeName.includes('DISCRETE')) modeFactor = 1.1;
    else modeFactor = 0.5;
  } else if (hazard === 'wind') {
    if (modeName.includes('BOW') || modeName.includes('QLCS') || modeName.includes('LINES')) modeFactor = 1.3;
    else modeFactor = 0.9;
  }

  const conditionalProb = clamp(pBaseHazard * modeFactor * probExceed, 0.00001, 0.99);
  const finalProb = clamp(pMode * conditionalProb * 100.0, 0.001, 99.5);

  const unit = hazard === 'wind' ? 'MPH' : hazard === 'hail' ? 'IN' : 'EF';
  const label = hazard === 'tor' ? `EF${Math.floor(threshold)}+ Tornado` : `${threshold} ${unit} ${hazard.toUpperCase()}`;

  return {
    conditionalProbPct: Math.round(conditionalProb * 1000) / 10,
    finalProbPct: finalProb < 0.1 ? Math.round(finalProb * 1000) / 1000 : Math.round(finalProb * 100) / 100,
    label
  };
}
