import { SoundingLevel, SoundingIndices, LapseRateTuning } from '../types';

export const defaultLapseTuning: LapseRateTuning = {
  dryLapseRate: 9.8,
  moistLapseFactor: 1.0,
  virtualTempFactor: 0.61,
  entrainmentRate: 0,
  midLevelWeight: 1.0
};

// Meteorological Constants
export const Rd = 287.058;        // Specific gas constant for dry air, J/(kg·K)
export const Rv = 461.5;          // Specific gas constant for water vapor, J/(kg·K)
export const Cp = 1005.7;         // Specific heat of dry air at constant pressure, J/(kg·K)
export const Lv = 2.501e6;        // Latent heat of vaporization, J/kg
export const g = 9.80665;         // Standard acceleration of gravity, m/s²
export const EPSILON = Rd / Rv;   // 0.62197

/**
 * Saturation vapor pressure in hPa using Bolton (1980) / Magnus formula
 */
export function calcVaporPressure(tempC: number): number {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/**
 * Saturation mixing ratio in kg/kg given saturation vapor pressure (hPa) and total pressure (hPa)
 */
export function calcMixingRatio(es: number, p: number): number {
  const safeP = Math.max(p, es + 0.1);
  return EPSILON * (es / (safeP - es));
}

/**
 * Dewpoint (°C) from actual vapor pressure (hPa)
 */
export function calcDewpoint(e: number): number {
  const safeE = Math.max(0.001, e);
  const logE = Math.log(safeE / 6.112);
  return (243.5 * logE) / (17.67 - logE);
}

/**
 * Virtual Temperature in Kelvin
 */
export function calcVirtualTempK(tempC: number, mixingRatioKgKg: number, factor = 0.61): number {
  const tk = tempC + 273.15;
  return tk * (1 + factor * mixingRatioKgKg);
}

/**
 * Potential temperature in Kelvin
 */
export function calcThetaK(tempC: number, p: number): number {
  const tk = tempC + 273.15;
  return tk * Math.pow(1000.0 / Math.max(10, p), Rd / Cp);
}

/**
 * Equivalent potential temperature (Theta-e) in Kelvin (Bolton 1980)
 */
export function calcThetaE(tempC: number, dewC: number, p: number): number {
  const tk = tempC + 273.15;
  const e = calcVaporPressure(dewC);
  const w = calcMixingRatio(e, p); // kg/kg
  const rGKg = w * 1000.0;         // g/kg
  
  // Temperature at LCL
  const tlclK = 55.0 + (2840.0 / (3.5 * Math.log(tk) - Math.log(Math.max(0.001, e)) - 4.805));
  const thetaL = tk * Math.pow(1000.0 / p, 0.2854 * (1 - 0.28e-3 * rGKg)) * Math.pow(tk / tlclK, 0.28e-3 * rGKg);
  return thetaL * Math.exp(((3376.0 / tlclK) - 2.54) * w * (1 + 0.81e-3 * rGKg));
}

/**
 * Moist adiabatic lapse rate in K/m (or °C/m) at temperature T (°C) and pressure P (hPa)
 * Formula: Gamma_m = g * (1 + (Lv * rs) / (Rd * Tk)) / (Cp + (Lv^2 * rs * EPSILON) / (Rd * Tk^2))
 * Note: Returns rate in K/m (e.g. 0.0045 to 0.0075 K/m, which equals 4.5 to 7.5 °C/km)
 */
export function calcMoistAdiabaticLapseRate(tempC: number, p: number, tuning?: LapseRateTuning): number {
  const tk = Math.max(180, tempC + 273.15);
  const es = calcVaporPressure(tempC);
  const rs = calcMixingRatio(es, p); // in kg/kg
  
  const num = 1.0 + (Lv * rs) / (Rd * tk);
  const den = Cp + (Math.pow(Lv, 2) * rs * EPSILON) / (Rd * Math.pow(tk, 2));
  const standardRate = (num / den) * g; // in K/m
  
  const factor = tuning?.moistLapseFactor !== undefined ? tuning.moistLapseFactor : 1.0;
  return standardRate * factor;
}

/**
 * Calculate Lifting Condensation Level (LCL) in meters AGL
 */
export function calcLCL(tempC: number, dewC: number, pSfc: number): { lclHeightM: number; lclPressureHpa: number; lclTempC: number } {
  const tk = tempC + 273.15;
  const e = calcVaporPressure(dewC);
  const tlclK = 55.0 + 2840.0 / (3.5 * Math.log(tk) - Math.log(Math.max(0.001, e)) - 4.805);
  const lclTempC = tlclK - 273.15;
  
  // Height approx: ~125 m per °C dewpoint depression at sfc
  const lclHeightM = Math.max(0, (tempC - lclTempC) * 125.0);
  
  // Pressure at LCL via Poisson dry adiabatic expansion
  const lclPressureHpa = pSfc * Math.pow(tlclK / tk, Cp / Rd);
  
  return { lclHeightM, lclPressureHpa, lclTempC };
}

/**
 * Interpolate atmospheric variables at a given pressure level (hPa)
 */
export function interpolatePressure(levels: SoundingLevel[], targetP: number): { p: number; h: number; t: number; td: number; wd: number; ws: number; u: number; v: number } {
  if (levels.length === 0) {
    return { p: targetP, h: 1000, t: 20, td: 10, wd: 180, ws: 10, u: 0, v: 10 };
  }

  // Exact match
  const exact = levels.find((l) => Math.abs(l.p - targetP) < 0.1);
  if (exact) {
    const uv = windToUV(exact.ws, exact.wd);
    return { ...exact, u: uv.u, v: uv.v };
  }

  // Out of bounds - lower than bottom level (highest pressure)
  if (targetP >= levels[0].p) {
    const l0 = levels[0];
    const uv = windToUV(l0.ws, l0.wd);
    return { ...l0, p: targetP, u: uv.u, v: uv.v };
  }

  // Out of bounds - higher than top level (lowest pressure)
  const last = levels[levels.length - 1];
  if (targetP <= last.p) {
    const uv = windToUV(last.ws, last.wd);
    return { ...last, p: targetP, u: uv.u, v: uv.v };
  }

  for (let i = 0; i < levels.length - 1; i++) {
    const lA = levels[i];
    const lB = levels[i + 1];
    // In descending pressure order (lA.p >= targetP >= lB.p)
    if (targetP <= lA.p && targetP >= lB.p) {
      const frac = (lA.p - targetP) / Math.max(0.01, lA.p - lB.p);
      const h = lA.h + (lB.h - lA.h) * frac;
      const t = lA.t + (lB.t - lA.t) * frac;
      const td = lA.td + (lB.td - lA.td) * frac;

      const uvA = windToUV(lA.ws, lA.wd);
      const uvB = windToUV(lB.ws, lB.wd);
      const u = uvA.u + (uvB.u - uvA.u) * frac;
      const v = uvA.v + (uvB.v - uvA.v) * frac;
      const wind = uvToWind(u, v);

      return { p: targetP, h: Math.round(h), t, td, wd: wind.wd, ws: wind.ws, u, v };
    }
  }

  const uv = windToUV(levels[0].ws, levels[0].wd);
  return { ...levels[0], p: targetP, u: uv.u, v: uv.v };
}

/**
 * Helper to interpolate sounding variable at a given height AGL or pressure
 */
export function interpolateSounding(levels: SoundingLevel[], targetZ_AGL: number): { p: number; t: number; td: number; wd: number; ws: number; u: number; v: number } {
  if (levels.length === 0) {
    return { p: 1000, t: 20, td: 10, wd: 180, ws: 10, u: 0, v: 10 };
  }
  
  const sfc = levels[0];
  const targetZ_MSL = sfc.h + targetZ_AGL;
  
  if (targetZ_MSL <= levels[0].h) {
    const l0 = levels[0];
    const uv = windToUV(l0.ws, l0.wd);
    return { ...l0, u: uv.u, v: uv.v };
  }
  
  const last = levels[levels.length - 1];
  if (targetZ_MSL >= last.h) {
    const uv = windToUV(last.ws, last.wd);
    return { ...last, u: uv.u, v: uv.v };
  }
  
  for (let i = 0; i < levels.length - 1; i++) {
    const lA = levels[i];
    const lB = levels[i + 1];
    if (targetZ_MSL >= lA.h && targetZ_MSL <= lB.h) {
      const frac = (targetZ_MSL - lA.h) / Math.max(1, lB.h - lA.h);
      const p = lA.p + (lB.p - lA.p) * frac;
      const t = lA.t + (lB.t - lA.t) * frac;
      const td = lA.td + (lB.td - lA.td) * frac;
      
      // Vector wind interpolation
      const uvA = windToUV(lA.ws, lA.wd);
      const uvB = windToUV(lB.ws, lB.wd);
      const u = uvA.u + (uvB.u - uvA.u) * frac;
      const v = uvA.v + (uvB.v - uvA.v) * frac;
      const wind = uvToWind(u, v);
      
      return { p, t, td, wd: wind.wd, ws: wind.ws, u, v };
    }
  }
  
  const uv = windToUV(levels[0].ws, levels[0].wd);
  return { ...levels[0], u: uv.u, v: uv.v };
}

/**
 * Convert wind speed (kt) and direction (deg meteorological) to (u, v) components (kt)
 */
export function windToUV(wspdKt: number, wdirDeg: number): { u: number; v: number } {
  const rad = (wdirDeg * Math.PI) / 180.0;
  return {
    u: -wspdKt * Math.sin(rad),
    v: -wspdKt * Math.cos(rad)
  };
}

/**
 * Convert (u, v) wind components (kt) to meteorological wind direction (deg) and speed (kt)
 */
export function uvToWind(u: number, v: number): { ws: number; wd: number } {
  const ws = Math.sqrt(u * u + v * v);
  let wd = (Math.atan2(-u, -v) * 180.0) / Math.PI;
  if (wd < 0) wd += 360;
  return { ws, wd: Math.round(wd * 10) / 10 };
}

/**
 * Calculate Bunkers Storm Motion Vectors (Right-Mover RM and Left-Mover LM)
 * Standard Bunkers et al. (2000) technique using pressure-weighted or height-weighted 0-6 km mean wind and 0-6 km shear.
 */
export function calcBunkersStormMotion(levels: SoundingLevel[]): {
  rmU: number; rmV: number; rmWd: number; rmWsKt: number; rmWsMph: number;
  lmU: number; lmV: number; lmWd: number; lmWsKt: number; lmWsMph: number;
  meanU: number; meanV: number; meanWd: number; meanWsKt: number;
} {
  if (levels.length === 0) {
    return {
      rmU: 0, rmV: 15, rmWd: 220, rmWsKt: 25, rmWsMph: 29,
      lmU: 0, lmV: 15, lmWd: 220, lmWsKt: 25, lmWsMph: 29,
      meanU: 0, meanV: 15, meanWd: 220, meanWsKt: 20
    };
  }

  const sfc = levels[0];
  const sfcUV = windToUV(sfc.ws, sfc.wd);
  const w6k = interpolateSounding(levels, 6000);
  
  // Compute pressure-weighted 0-6km mean wind
  let sumU = 0, sumV = 0, count = 0;
  for (let z = 0; z <= 6000; z += 250) {
    const w = interpolateSounding(levels, z);
    sumU += w.u;
    sumV += w.v;
    count++;
  }
  const meanU = count > 0 ? sumU / count : sfcUV.u;
  const meanV = count > 0 ? sumV / count : sfcUV.v;
  const meanWind = uvToWind(meanU, meanV);

  // 0-6km shear vector (from surface to 6km)
  const shearU = w6k.u - sfcUV.u;
  const shearV = w6k.v - sfcUV.v;
  const shearMag = Math.sqrt(shearU * shearU + shearV * shearV);

  // Bunkers deviation vector is 7.5 m/s = 14.58 kt orthogonal to 0-6km shear vector
  const devMagKt = 14.58;
  const unitShearU = shearMag > 0.001 ? shearU / shearMag : 0;
  const unitShearV = shearMag > 0.001 ? shearV / shearMag : 1;

  // Right-mover: mean wind + 7.5 m/s to the right of shear vector (rotate clockwise 90: (u, v) -> (v, -u))
  const rmU = meanU + devMagKt * unitShearV;
  const rmV = meanV - devMagKt * unitShearU;
  const rmWind = uvToWind(rmU, rmV);

  // Left-mover: mean wind - 7.5 m/s
  const lmU = meanU - devMagKt * unitShearV;
  const lmV = meanV + devMagKt * unitShearU;
  const lmWind = uvToWind(lmU, lmV);

  return {
    rmU, rmV, rmWd: rmWind.wd, rmWsKt: rmWind.ws, rmWsMph: Math.round(rmWind.ws * 1.15078),
    lmU, lmV, lmWd: lmWind.wd, lmWsKt: lmWind.ws, lmWsMph: Math.round(lmWind.ws * 1.15078),
    meanU, meanV, meanWd: meanWind.wd, meanWsKt: meanWind.ws
  };
}

/**
 * Calculate Storm Relative Helicity (SRH) in m²/s² over a specified layer AGL
 */
export function calcSRH(levels: SoundingLevel[], topZ_AGL: number, stormU_kt: number, stormV_kt: number): number {
  if (levels.length < 2) return 0;
  
  // kt to m/s conversion factor: 0.514444
  const KT_TO_MS = 0.5144444;
  const cU_ms = stormU_kt * KT_TO_MS;
  const cV_ms = stormV_kt * KT_TO_MS;

  let srh = 0;
  const dz = 50; // step size in meters

  let prev = interpolateSounding(levels, 0);
  let prevU_ms = prev.u * KT_TO_MS - cU_ms;
  let prevV_ms = prev.v * KT_TO_MS - cV_ms;

  for (let z = dz; z <= topZ_AGL; z += dz) {
    const curr = interpolateSounding(levels, z);
    const currU_ms = curr.u * KT_TO_MS - cU_ms;
    const currV_ms = curr.v * KT_TO_MS - cV_ms;

    // Cross product integral: (u1 - cx)*(v2 - cy) - (u2 - cx)*(v1 - cy)
    const dH = (prevU_ms * currV_ms) - (currU_ms * prevV_ms);
    srh += dH;

    prevU_ms = currU_ms;
    prevV_ms = currV_ms;
  }

  // Helicity is signed; right movers in cyclonic hodographs ingest positive SRH
  return Math.max(0, srh);
}

/**
 * Integrated Thermodynamic Parcel Analysis:
 * Calculates SBCAPE, MLCAPE, MUCAPE, CIN, LCL, LFC, EL, DCAPE, Lapse Rates
 */
export function computeSoundingThermodynamics(
  levels: SoundingLevel[],
  tuning: LapseRateTuning = {
    dryLapseRate: 9.8,
    moistLapseFactor: 1.0,
    virtualTempFactor: 0.61,
    entrainmentRate: 0,
    midLevelWeight: 1.0
  }
): {
  sbcape: number;
  mlcape: number;
  mucape: number;
  cape3km: number;
  sbcin: number;
  mlcin: number;
  sblcl: number;
  mllcl: number;
  lfc: number;
  el: number;
  el_km: number;
  el_ft: number;
  dcape: number;
  lapse_700_500: number;
  lapse_850_500: number;
  lapse_0_3km: number;
  t500_c: number;
  t700_c: number;
  t850_c: number;
} {
  if (levels.length < 2) {
    return {
      sbcape: 1800, mlcape: 1500, mucape: 2100, cape3km: 120,
      sbcin: -15, mlcin: -25, sblcl: 850, mllcl: 950, lfc: 1200, el: 11500,
      el_km: 11.5, el_ft: 37729, dcape: 950, lapse_700_500: 7.5, lapse_850_500: 7.2,
      lapse_0_3km: 7.8, t500_c: -12, t700_c: 4, t850_c: 14
    };
  }

  const sfc = levels[0];
  const sfcP = sfc.p;

  // Mixed Layer (lowest 100 hPa layer) - standard meteorology average theta and mixing ratio
  let sumTheta = 0;
  let sumMixRatio = 0;
  let mlCount = 0;
  for (const l of levels) {
    if (l.p >= sfcP - 100) {
      const theta = calcThetaK(l.t, l.p);
      const vp = calcVaporPressure(l.td);
      const w = calcMixingRatio(vp, l.p);
      sumTheta += theta;
      sumMixRatio += w;
      mlCount++;
    }
  }
  const meanTheta = mlCount > 0 ? sumTheta / mlCount : calcThetaK(sfc.t, sfc.p);
  const meanMixRatio = mlCount > 0 ? sumMixRatio / mlCount : calcMixingRatio(calcVaporPressure(sfc.td), sfc.p);

  // Surface parcel equivalent for Mixed Layer
  const mlT = meanTheta * Math.pow(sfc.p / 1000.0, Rd / Cp) - 273.15;
  const mlVaporP = (sfc.p * meanMixRatio) / (EPSILON + meanMixRatio);
  const mlTd = calcDewpoint(mlVaporP);

  // LCL Calculations
  const sbLcl = calcLCL(sfc.t, sfc.td, sfc.p);
  const mlLcl = calcLCL(mlT, mlTd, sfc.p);

  // Function to integrate a parcel from an initial (T, Td, P_sfc, Z_start)
  function integrateParcel(initT: number, initTd: number, initP: number, initZ = 0) {
    const lcl = calcLCL(initT, initTd, initP);
    const lclZ_AGL = initZ + lcl.lclHeightM;
    let parcelT = initT;
    let cape = 0;
    let cape3km = 0;
    let cin = 0;
    let lfcM = -1;
    let elM = -1;
    let hasPositiveBuoyancyStarted = false;

    const maxZ = Math.min(18000, levels[levels.length - 1].h - sfc.h);
    const dz = 25; // 25m fine integration steps for precision

    // Initial mixing ratio (constant below LCL)
    const initVaporP = calcVaporPressure(initTd);
    const initMixRatio = calcMixingRatio(initVaporP, initP);

    for (let z = initZ; z <= maxZ; z += dz) {
      const env = interpolateSounding(levels, z);

      // Parcel temperature ascent
      if (z < lclZ_AGL) {
        // Dry adiabatic ascent: Gamma_d in K/m = tuning.dryLapseRate / 1000.0 (e.g. 9.8 / 1000 = 0.0098)
        const dryRate_per_m = (tuning.dryLapseRate || 9.8) / 1000.0;
        parcelT -= dryRate_per_m * dz;
      } else {
        // Moist pseudo-adiabatic ascent: Gamma_m is already in K/m
        const moistLapse_per_m = calcMoistAdiabaticLapseRate(parcelT, env.p, tuning);
        parcelT -= moistLapse_per_m * dz;
      }

      // Optional entrainment penalty
      if (tuning.entrainmentRate > 0 && z > lclZ_AGL) {
        const entrainFrac = (tuning.entrainmentRate / 100000.0) * dz;
        parcelT -= entrainFrac * (parcelT - env.t);
      }

      // Virtual temperature correction for buoyancy
      const envVaporP = calcVaporPressure(env.td);
      const envMixRatio = calcMixingRatio(envVaporP, env.p);
      const envTvK = calcVirtualTempK(env.t, envMixRatio, tuning.virtualTempFactor ?? 0.61);

      // Parcel mixing ratio: constant below LCL, saturated above LCL
      let parcelMixRatio = initMixRatio;
      if (z >= lclZ_AGL) {
        const parcelSatVaporP = calcVaporPressure(parcelT);
        parcelMixRatio = calcMixingRatio(parcelSatVaporP, env.p);
      }
      const parcelTvK = calcVirtualTempK(parcelT, parcelMixRatio, tuning.virtualTempFactor ?? 0.61);

      // Buoyancy acceleration: B = g * (Tv_parcel - Tv_env) / Tv_env
      const buoy = g * ((parcelTvK - envTvK) / envTvK);

      if (buoy > 0) {
        if (!hasPositiveBuoyancyStarted && z >= lclZ_AGL) {
          hasPositiveBuoyancyStarted = true;
          lfcM = z;
        }
        if (hasPositiveBuoyancyStarted) {
          const dCAPE = buoy * dz;
          cape += dCAPE;
          if (z <= 3000) {
            cape3km += dCAPE;
          }
          elM = z; // Updates until parcel ceases to be buoyant
        }
      } else {
        if (!hasPositiveBuoyancyStarted && z <= 4500) {
          cin += buoy * dz;
        }
      }
    }

    return {
      cape: Math.max(0, cape),
      cape3km: Math.max(0, cape3km),
      cin: Math.min(0, Math.max(-1000, cin)),
      lfc: lfcM > 0 ? lfcM : lcl.lclHeightM + 250,
      el: elM > 0 ? elM : 10500
    };
  }

  const sbResults = integrateParcel(sfc.t, sfc.td, sfc.p, 0);
  const mlResults = integrateParcel(mlT, mlTd, sfc.p, 0);

  // Most Unstable Parcel (highest CAPE in lowest 300 hPa)
  let maxMuCape = -1;
  let muResults = sbResults;
  for (const l of levels) {
    if (l.p >= sfcP - 300) {
      const res = integrateParcel(l.t, l.td, l.p, Math.max(0, l.h - sfc.h));
      if (res.cape > maxMuCape) {
        maxMuCape = res.cape;
        muResults = res;
      }
    }
  }

  // Downdraft CAPE (DCAPE): parcel with minimum Theta-E between 700 and 500 hPa brought moist adiabatically to sfc
  let minThetaE = 9999;
  let minThE_level: SoundingLevel = levels[0];
  for (const l of levels) {
    if (l.p <= 750 && l.p >= 450) {
      const thE = calcThetaE(l.t, l.td, l.p);
      if (thE < minThetaE) {
        minThetaE = thE;
        minThE_level = l;
      }
    }
  }

  let dcape = 0;
  if (minThE_level) {
    let dParcelT = minThE_level.t;
    const startZ = minThE_level.h - sfc.h;
    const dz = 25;
    for (let z = startZ; z >= 0; z -= dz) {
      const env = interpolateSounding(levels, z);
      const moistLapse_per_m = calcMoistAdiabaticLapseRate(dParcelT, env.p, tuning);
      dParcelT += moistLapse_per_m * dz; // warms moist adiabatically on descent

      const envTvK = env.t + 273.15;
      const dParcelTvK = dParcelT + 273.15;
      const buoy = g * ((envTvK - dParcelTvK) / envTvK); // negative buoyancy accelerates downdraft
      if (buoy > 0) {
        dcape += buoy * dz;
      }
    }
  }
  dcape = Math.max(0, Math.min(2500, dcape));

  // Key Pressure Level Temperatures & Lapse Rates (Precision Interpolated)
  const p500 = interpolatePressure(levels, 500);
  const p700 = interpolatePressure(levels, 700);
  const p850 = interpolatePressure(levels, 850);

  const dz_700_500_km = Math.max(0.5, (p500.h - p700.h) / 1000.0);
  const dz_850_500_km = Math.max(1.0, (p500.h - p850.h) / 1000.0);

  const lapse_700_500 = Math.max(
    3.0,
    Math.min(11.5, ((p700.t - p500.t) / dz_700_500_km) * (tuning.midLevelWeight ?? 1.0))
  );

  const lapse_850_500 = Math.max(
    3.0,
    Math.min(11.5, (p850.t - p500.t) / dz_850_500_km)
  );

  const sfcLevel = levels[0];
  const z3k = interpolateSounding(levels, 3000);
  const lapse_0_3km = Math.max(3.0, Math.min(11.5, (sfcLevel.t - z3k.t) / 3.0));

  const elHeightM = sbResults.el;
  const elFt = Math.round(elHeightM * 3.28084);

  return {
    sbcape: Math.round(sbResults.cape),
    mlcape: Math.round(mlResults.cape),
    mucape: Math.round(muResults.cape),
    cape3km: Math.round(sbResults.cape3km),
    sbcin: Math.round(sbResults.cin),
    mlcin: Math.round(mlResults.cin),
    sblcl: Math.round(sbLcl.lclHeightM),
    mllcl: Math.round(mlLcl.lclHeightM),
    lfc: Math.round(sbResults.lfc),
    el: Math.round(elHeightM),
    el_km: Math.round((elHeightM / 1000.0) * 10) / 10,
    el_ft: elFt,
    dcape: Math.round(dcape),
    lapse_700_500: Math.round(lapse_700_500 * 10) / 10,
    lapse_850_500: Math.round(lapse_850_500 * 10) / 10,
    lapse_0_3km: Math.round(lapse_0_3km * 10) / 10,
    t500_c: Math.round(p500.t * 10) / 10,
    t700_c: Math.round(p700.t * 10) / 10,
    t850_c: Math.round(p850.t * 10) / 10
  };
}

/**
 * Full Sounding Indices Computation
 */
export function computeAllSoundingIndices(levels: SoundingLevel[], tuning?: LapseRateTuning): SoundingIndices {
  if (levels.length === 0) {
    throw new Error('Sounding has no levels to compute indices.');
  }

  const thermo = computeSoundingThermodynamics(levels, tuning);
  const bunkers = calcBunkersStormMotion(levels);

  const sfc = levels[0];
  const sfcUV = windToUV(sfc.ws, sfc.wd);
  const w1k = interpolateSounding(levels, 1000);
  const w3k = interpolateSounding(levels, 3000);
  const w6k = interpolateSounding(levels, 6000);

  const calcShearKt = (u1: number, v1: number, u2: number, v2: number) =>
    Math.sqrt(Math.pow(u2 - u1, 2) + Math.pow(v2 - v1, 2));

  const shear1 = calcShearKt(sfcUV.u, sfcUV.v, w1k.u, w1k.v);
  const shear3 = calcShearKt(sfcUV.u, sfcUV.v, w3k.u, w3k.v);
  const shear6 = calcShearKt(sfcUV.u, sfcUV.v, w6k.u, w6k.v);
  const ebwd = Math.round(shear6 * 0.85 * 10) / 10;

  const srh1 = Math.round(calcSRH(levels, 1000, bunkers.rmU, bunkers.rmV));
  const srh3 = Math.round(calcSRH(levels, 3000, bunkers.rmU, bunkers.rmV));
  const esrh = Math.round(srh1 * 1.25);

  const temp_sfc_c = sfc.t;
  const dew_sfc_c = sfc.td;
  const temp_sfc_f = Math.round((temp_sfc_c * 9.0) / 5.0 + 32.0);
  const dew_sfc_f = Math.round((dew_sfc_c * 9.0) / 5.0 + 32.0);
  const t500_f = Math.round((thermo.t500_c * 9.0) / 5.0 + 32.0);

  // Composite Indices
  // Significant Tornado Parameter (STP)
  const capeTerm = thermo.mlcape / 1500.0;
  const lclTerm = (2000.0 - thermo.mllcl) / 1000.0;
  const srhTerm = esrh / 150.0;
  const shearTerm = shear6 / 40.0;
  const cinTerm = (200.0 + thermo.mlcin) / 150.0;
  const stp = Math.max(-1, capeTerm * lclTerm * srhTerm * shearTerm * cinTerm);

  // Supercell Composite Parameter (SCP)
  const scp = Math.max(-1, (thermo.mucape / 1000.0) * (esrh / 50.0) * Math.min(shear6 / 40.0, 1.5));

  // Significant Hail Parameter (SHIP)
  const vapor_p = calcVaporPressure(dew_sfc_c);
  const mix_ratio = calcMixingRatio(vapor_p, 850) * 1000.0;
  const t500_factor = thermo.t500_c > -5 ? 5 : Math.min(Math.abs(thermo.t500_c), 20);
  const ship = Math.max(
    0,
    (thermo.mucape * mix_ratio * thermo.lapse_700_500 * t500_factor * shear6) / 42000000.0
  );

  // Derecho Composite Parameter (DCP)
  const dcp = Math.max(
    0,
    (thermo.dcape / 980.0) * (thermo.mucape / 2000.0) * (shear6 / 40.0) * (bunkers.meanWsKt / 32.0)
  );

  // Energy-Helicity Index (EHI)
  const ehi_0_1km = (thermo.sbcape * srh1) / 160000.0;
  const ehi_0_3km = (thermo.sbcape * srh3) / 160000.0;

  // Bulk Richardson Number (BRN)
  const shearDenom = 0.5 * Math.pow(shear6 * 0.514444, 2);
  const brn = shearDenom > 0 ? thermo.sbcape / shearDenom : 999;

  // Craven-Brooks Significant Severe Parameter (CAPE * 0-6km shear in m/s)
  const craven_brooks = thermo.mlcape * (shear6 * 0.514444);

  // SWEAT Index approximation
  const sweat =
    12 * Math.max(0, dew_sfc_c) +
    20 * Math.max(0, thermo.t850_c - thermo.t500_c) +
    2 * (sfc.ws) +
    (w6k.ws) +
    125 * (Math.sin(((w6k.wd - sfc.wd) * Math.PI) / 180.0) + 0.2);

  return {
    sbcape: thermo.sbcape,
    mlcape: thermo.mlcape,
    mucape: thermo.mucape,
    cape3km: thermo.cape3km,
    sbcin: thermo.sbcin,
    mlcin: thermo.mlcin,
    sblcl: thermo.sblcl,
    mllcl: thermo.mllcl,
    lfc: thermo.lfc,
    el: thermo.el,
    el_km: thermo.el_km,
    el_ft: thermo.el_ft,
    dcape: thermo.dcape,
    lapse_700_500: thermo.lapse_700_500,
    lapse_850_500: thermo.lapse_850_500,
    lapse_0_3km: thermo.lapse_0_3km,
    temp_sfc_c: Math.round(temp_sfc_c * 10) / 10,
    dew_sfc_c: Math.round(dew_sfc_c * 10) / 10,
    temp_sfc_f,
    dew_sfc_f,
    t500_c: thermo.t500_c,
    t500_f,
    t700_c: thermo.t700_c,
    t850_c: thermo.t850_c,

    shear_0_1km: Math.round(shear1 * 10) / 10,
    shear_0_3km: Math.round(shear3 * 10) / 10,
    shear_0_6km: Math.round(shear6 * 10) / 10,
    ebwd,
    srh_0_1km: srh1,
    srh_0_3km: srh3,
    esrh,
    meanWind_0_6km: Math.round(bunkers.meanWsKt * 10) / 10,
    bunkers_rm_dir: bunkers.rmWd,
    bunkers_rm_spd_kt: bunkers.rmWsKt,
    bunkers_rm_spd_mph: bunkers.rmWsMph,
    bunkers_lm_dir: bunkers.lmWd,
    bunkers_lm_spd_kt: bunkers.lmWsKt,

    stp: Math.round(stp * 100) / 100,
    scp: Math.round(scp * 100) / 100,
    ship: Math.round(ship * 100) / 100,
    dcp: Math.round(dcp * 100) / 100,
    ehi_0_1km: Math.round(ehi_0_1km * 100) / 100,
    ehi_0_3km: Math.round(ehi_0_3km * 100) / 100,
    brn: Math.round(brn * 10) / 10,
    sweat: Math.round(Math.max(0, sweat)),
    craven_brooks: Math.round(craven_brooks)
  };
}
