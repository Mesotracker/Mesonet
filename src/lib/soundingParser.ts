import { SoundingData, SoundingLevel, HourlyForecastStep, MesoMaxInputs } from '../types';
import { computeAllSoundingIndices, windToUV } from './metMath';
import { runMesoMaxRiskEngine } from './mesoMaxEngine';

export const ALL_OPEN_METEO_LEVELS = [
  '1000hPa', '975hPa', '950hPa', '925hPa', '900hPa', '875hPa', '850hPa', '825hPa', '800hPa', '775hPa',
  '750hPa', '725hPa', '700hPa', '675hPa', '650hPa', '625hPa', '600hPa', '575hPa', '550hPa', '525hPa',
  '500hPa', '475hPa', '450hPa', '425hPa', '400hPa', '375hPa', '350hPa', '325hPa', '300hPa', '275hPa',
  '250hPa', '225hPa', '200hPa', '175hPa', '150hPa', '125hPa', '100hPa', '70hPa', '50hPa', '40hPa',
  '30hPa', '20hPa', '15hPa', '10hPa'
];

/**
 * Builds the complete Open-Meteo API query URL from latitude and longitude.
 */
export function buildOpenMeteoUrl(lat: number, lon: number, forecastDays = 1): string {
  const params = new URLSearchParams();
  params.set('latitude', lat.toString());
  params.set('longitude', lon.toString());

  const hourlyFields: string[] = [];
  ALL_OPEN_METEO_LEVELS.forEach((lvl) => {
    hourlyFields.push(`temperature_${lvl}`);
    hourlyFields.push(`dew_point_${lvl}`);
    hourlyFields.push(`wind_direction_${lvl}`);
    hourlyFields.push(`wind_speed_${lvl}`);
  });

  params.set('hourly', hourlyFields.join(','));
  params.set('models', 'ncep_gfs_seamless');
  params.set('timezone', 'auto');
  params.set('forecast_days', forecastDays.toString());

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * Parses Open-Meteo JSON response into SoundingData objects (one per forecast hour).
 */
export function parseOpenMeteoResponse(
  json: any,
  lat: number,
  lon: number,
  apiUrl: string
): { activeSounding: SoundingData; allHourlySoundings: SoundingData[]; forecastSteps: HourlyForecastStep[] } {
  if (!json || !json.hourly || !json.hourly.time || !Array.isArray(json.hourly.time)) {
    throw new Error('Malformed Open-Meteo API response: missing hourly timeline data.');
  }

  const times: string[] = json.hourly.time;
  const hourlySoundings: SoundingData[] = [];

  // Pressure map in hPa
  const pressureLevelsNumeric = [
    1000, 975, 950, 925, 900, 875, 850, 825, 800, 775,
    750, 725, 700, 675, 650, 625, 600, 575, 550, 525,
    500, 475, 450, 425, 400, 375, 350, 325, 300, 275,
    250, 225, 200, 175, 150, 125, 100, 70, 50, 40,
    30, 20, 15, 10
  ];

  // Standard atmosphere approximate heights for initial geopotential estimation
  const stdHeightMap: Record<number, number> = {
    1000: 110, 975: 320, 950: 540, 925: 760, 900: 990, 875: 1220, 850: 1460, 825: 1710, 800: 1950,
    775: 2200, 750: 2470, 725: 2740, 700: 3010, 675: 3300, 650: 3590, 625: 3900, 600: 4210, 575: 4530,
    550: 4860, 525: 5210, 500: 5570, 475: 5950, 450: 6340, 425: 6760, 400: 7190, 375: 7640, 350: 8120,
    325: 8630, 300: 9160, 275: 9740, 250: 10360, 225: 11040, 200: 11780, 175: 12620, 150: 13610,
    125: 14780, 100: 16180, 70: 18440, 50: 20580, 40: 22000, 30: 23850, 20: 26400, 15: 28300, 10: 31050
  };

  const elevation = json.elevation || 250;

  for (let tIdx = 0; tIdx < times.length; tIdx++) {
    const timeStr = times[tIdx];
    const levels: SoundingLevel[] = [];

    for (let pIdx = 0; pIdx < pressureLevelsNumeric.length; pIdx++) {
      const p = pressureLevelsNumeric[pIdx];
      const tag = `${p}hPa`;
      const t = json.hourly[`temperature_${tag}`]?.[tIdx];
      const td = json.hourly[`dew_point_${tag}`]?.[tIdx];
      const wd = json.hourly[`wind_direction_${tag}`]?.[tIdx];
      let ws = json.hourly[`wind_speed_${tag}`]?.[tIdx];

      // If temperature is missing or null, skip this level
      if (t === null || t === undefined || isNaN(t)) continue;

      // Handle wind speed: Open-Meteo returns km/h by default; convert to knots (1 km/h = 0.539957 kt)
      const wsUnits = json.hourly_units?.[`wind_speed_${tag}`] || 'km/h';
      let wsKt = ws ?? 0;
      if (wsUnits === 'km/h') {
        wsKt = (ws ?? 0) * 0.539957;
      } else if (wsUnits === 'm/s') {
        wsKt = (ws ?? 0) * 1.94384;
      }

      const safeTd = td !== null && td !== undefined && !isNaN(td) ? Math.min(t, td) : t - 30;
      const safeWd = wd !== null && wd !== undefined && !isNaN(wd) ? wd : 0;
      const approxH = (stdHeightMap[p] || 1000) + (elevation - 110);

      const uv = windToUV(wsKt, safeWd);

      levels.push({
        p,
        h: Math.round(approxH),
        t: Math.round(t * 10) / 10,
        td: Math.round(safeTd * 10) / 10,
        wd: Math.round(safeWd),
        ws: Math.round(wsKt * 10) / 10,
        u: uv.u,
        v: uv.v
      });
    }

    if (levels.length >= 5) {
      // Sort decreasing pressure (surface to top)
      levels.sort((a, b) => b.p - a.p);

      const dateObj = new Date(timeStr);
      const hourFmt = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayFmt = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const name = `${dayFmt} ${hourFmt} UTC (Lat ${lat}, Lon ${lon})`;

      const indices = computeAllSoundingIndices(levels);

      // Severe Composite Score for ranking
      const score =
        (indices.mlcape / 1000.0) * (indices.shear_0_6km / 30.0) +
        indices.srh_0_1km / 100.0 +
        indices.stp * 5.0;

      hourlySoundings.push({
        id: `om-${tIdx}-${timeStr}`,
        name,
        title: `Open-Meteo GFS ${timeStr} · ${lat}°N, ${lon}°E`,
        source: 'open-meteo',
        type: 1,
        timestamp: timeStr,
        lat,
        lon,
        apiUrl,
        levels,
        indices,
        compositeScore: Math.round(score * 10) / 10
      });
    }
  }

  if (hourlySoundings.length === 0) {
    throw new Error('No valid soundings could be constructed from Open-Meteo response.');
  }

  // Rank by composite score to find the most severe timestep
  let peakIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < hourlySoundings.length; i++) {
    const s = hourlySoundings[i].compositeScore ?? 0;
    if (s > maxScore) {
      maxScore = s;
      peakIndex = i;
    }
  }

  const activeSounding = hourlySoundings[peakIndex];
  activeSounding.selectionReason = `Peak Convective Potential timestep (${activeSounding.timestamp}): MLCAPE ${activeSounding.indices?.mlcape} J/kg, Shear ${activeSounding.indices?.shear_0_6km} kt, STP ${activeSounding.indices?.stp}.`;

  // Build forecast steps
  const forecastSteps: HourlyForecastStep[] = hourlySoundings.map((snd) => {
    const ind = snd.indices!;
    const hourVal = new Date(snd.timestamp!).getUTCHours();

    const inputs: MesoMaxInputs = {
      cape: ind.sbcape,
      cape3: ind.cape3km,
      cin: ind.sbcin,
      lcl: ind.sblcl,
      esrh: ind.esrh,
      ebwd: ind.ebwd,
      srh: ind.srh_0_1km,
      shear: ind.shear_0_6km,
      llShear: ind.shear_0_1km,
      dcape: ind.dcape,
      lapse: ind.lapse_700_500,
      meanWind: ind.meanWind_0_6km,
      temp: ind.temp_sfc_f,
      dew: ind.dew_sfc_f,
      t500: ind.t500_f,
      time: hourVal
    };

    const risks = runMesoMaxRiskEngine(inputs);
    const dateObj = new Date(snd.timestamp!);
    const hourLabel = dateObj.toLocaleTimeString([], { hour: 'numeric', hour12: true });

    return {
      time: snd.timestamp!,
      hourLabel,
      sounding: snd,
      inputs,
      indices: ind,
      risks
    };
  });

  return { activeSounding, allHourlySoundings: hourlySoundings, forecastSteps };
}

/**
 * Parses SharpPy / Type 2 text sounding format.
 */
export function parseSharpPySounding(
  rawText: string,
  customTitle?: string
): SoundingData {
  const trimmed = rawText.trim();
  let title = 'Imported SharpPy Sounding';
  const titleMatch = trimmed.match(/%TITLE%\s*([^\n\r]+)/i);
  if (titleMatch && titleMatch[1].trim()) {
    title = titleMatch[1].trim();
  } else if (customTitle) {
    title = customTitle;
  }

  let rawSection = trimmed;
  const rawMatch = trimmed.match(/%RAW%([\s\S]*?)%END%/i);
  if (rawMatch) {
    rawSection = rawMatch[1].trim();
  }

  const lines = rawSection.split('\n');
  const levels: SoundingLevel[] = [];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('%') || cleanLine.startsWith('-') || cleanLine.startsWith('LEVEL')) {
      continue;
    }

    const parts = cleanLine.split(/[\s,]+/).map((s) => parseFloat(s.trim()));
    if (parts.length >= 6 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const p = parts[0];
      const h = parts[1];
      const t = parts[2];
      let td = parts[3];
      const wd = parts[4] >= 0 ? parts[4] : 0;
      const ws = parts[5] >= 0 ? parts[5] : 0;

      // Handle unphysical dewpoint codes (like -130 or -9999)
      if (td < -100 || isNaN(td)) {
        td = t - 35;
      }
      if (td > t) td = t;

      const uv = windToUV(ws, wd);

      levels.push({
        p: Math.round(p * 10) / 10,
        h: Math.round(h),
        t: Math.round(t * 100) / 100,
        td: Math.round(td * 100) / 100,
        wd: Math.round(wd * 10) / 10,
        ws: Math.round(ws * 10) / 10,
        u: uv.u,
        v: uv.v
      });
    }
  }

  if (levels.length < 3) {
    throw new Error('Invalid Sounding Format: Could not extract at least 3 valid atmospheric levels from text.');
  }

  // Sort descending by pressure (surface first)
  levels.sort((a, b) => b.p - a.p);

  const indices = computeAllSoundingIndices(levels);
  const compositeScore =
    (indices.mlcape / 1000.0) * (indices.shear_0_6km / 30.0) +
    indices.srh_0_1km / 100.0 +
    indices.stp * 5.0;

  return {
    id: `sharppy-${Date.now()}`,
    name: title.split('\n')[0].substring(0, 40),
    title,
    source: 'sharppy',
    type: 2,
    rawText,
    levels,
    indices,
    compositeScore: Math.round(compositeScore * 10) / 10,
    selectionReason: 'Primary uploaded Type 2 sounding (Observed / SharpPy file format).'
  };
}

/**
 * Built-in Real-World Sample Soundings
 */
export const SAMPLE_KPIT_TEXT = `%TITLE%
KPIT   260322/1900
   LEVEL       HGHT       TEMP       DWPT       WDIR       WSPD
-------------------------------------------------------------------
%RAW%
  962.700000,    348.990000,     26.840000,      9.620000,    229.900000,     14.470000
  959.800000,    375.580000,     26.240000,      9.330000,    231.520000,     19.350000
  954.600000,    423.350000,     25.540000,      9.130000,    232.210000,     21.870000
  945.600000,    506.430000,     24.640000,      8.920000,    232.750000,     23.430000
  932.200000,    631.160000,     23.440000,      8.650000,    233.400000,     24.440000
  915.200000,    791.240000,     21.840000,      8.300000,    234.100000,     25.170000
  894.900000,    985.180000,     19.940000,      7.870000,    234.760000,     25.930000
  872.800000,   1199.900000,     17.840000,      7.330000,    235.850000,     27.000000
  848.800000,   1437.530000,     15.640000,      6.240000,    236.750000,     28.340000
  822.200000,   1706.750000,     13.540000,      3.160000,    238.730000,     30.690000
  792.900000,   2010.990000,     11.140000,      0.570000,    242.340000,     36.400000
  760.900000,   2353.150000,      8.540000,     -3.790000,    247.780000,     44.700000
  726.200000,   2736.960000,      5.840000,     -7.720000,    252.200000,     49.570000
  688.800000,   3166.900000,      2.340000,     -5.670000,    255.530000,     49.750000
  648.600000,   3649.260000,     -1.760000,     -7.190000,    254.050000,     49.490000
  605.600000,   4190.720000,     -6.160000,    -12.670000,    253.910000,     52.560000
  560.300000,   4793.920000,    -10.760000,    -15.200000,    263.770000,     57.250000
  516.200000,   5419.600000,    -14.660000,    -18.840000,    273.750000,     62.300000
  476.400000,   6022.890000,    -18.360000,    -22.800000,    277.790000,     60.200000
  440.600000,   6601.460000,    -22.260000,    -26.720000,    284.580000,     59.420000
  408.200000,   7157.870000,    -26.560000,    -30.690000,    290.280000,     57.150000
  378.800000,   7693.120000,    -30.660000,    -36.410000,    286.050000,     59.010000
  352.200000,   8206.200000,    -34.260000,    -41.730000,    279.850000,     61.320000
  328.100000,   8698.070000,    -37.960000,    -48.090000,    276.240000,     62.530000
  306.400000,   9165.570000,    -41.560000,    -52.210000,    275.470000,     65.170000
  286.700000,   9612.790000,    -44.960000,    -55.740000,    276.630000,     69.040000
  268.900000,  10037.740000,    -48.360000,    -60.710000,    281.490000,     72.140000
  252.400000,  10451.180000,    -51.860000,    -63.400000,    283.550000,     72.130000
  237.300000,  10848.070000,    -54.860000,    -63.860000,    281.740000,     70.630000
  223.500000,  11228.800000,    -57.260000,    -64.310000,    275.710000,     68.320000
  209.700000,  11630.630000,    -58.260000,    -64.790000,    269.510000,     68.380000
  195.800000,  12063.850000,    -56.460000,    -68.240000,    273.170000,     73.740000
  181.900000,  12535.660000,    -52.060000,   -130.000000,    278.340000,     75.000000
  168.000000,  13053.360000,    -49.260000,   -130.000000,    275.970000,     67.190000
  154.100000,  13617.580000,    -50.660000,   -130.000000,    272.250000,     59.480000
  140.200000,  14228.790000,    -53.860000,   -130.000000,    271.530000,     50.910000
  126.300000,  14892.580000,    -58.060000,   -130.000000,    275.170000,     45.240000
  112.500000,  15614.800000,    -61.760000,   -130.000000,    276.710000,     39.900000
   98.600000,  16427.170000,    -63.660000,   -130.000000,    267.660000,     33.240000
   85.700000,  17284.950000,    -64.660000,   -130.000000,    261.720000,     31.020000
   75.300000,  18075.620000,    -64.060000,   -130.000000,    256.400000,     24.790000
   66.900000,  18798.500000,    -64.660000,   -130.000000,    239.440000,     18.730000
   59.100000,  19553.240000,    -65.660000,   -130.000000,    238.150000,     15.090000
%END%`;

export const SAMPLE_PLAINS_SUPERCELL = `%TITLE%
OUN - Norman OK Violent Supercell Outbreak 2000 UTC
   LEVEL       HGHT       TEMP       DWPT       WDIR       WSPD
-------------------------------------------------------------------
%RAW%
 1000.0,   350,   29.4,   21.2,   160,   18
  975.0,   560,   27.8,   20.4,   165,   26
  950.0,   790,   26.1,   19.8,   175,   34
  925.0,  1020,   24.6,   18.9,   185,   38
  900.0,  1250,   23.0,   17.4,   195,   42
  850.0,  1520,   19.5,   14.8,   210,   45
  800.0,  2010,   15.8,    9.5,   225,   48
  750.0,  2520,   12.1,    3.2,   235,   50
  700.0,  3060,    8.4,   -2.1,   245,   52
  650.0,  3630,    3.9,   -7.4,   250,   55
  600.0,  4240,   -0.8,  -12.8,   255,   58
  550.0,  4890,   -5.9,  -17.5,   260,   62
  500.0,  5580,  -11.4,  -23.0,   265,   68
  450.0,  6330,  -16.8,  -28.5,   270,   74
  400.0,  7140,  -22.9,  -35.0,   275,   80
  350.0,  8050,  -30.2,  -42.0,   275,   88
  300.0,  9080,  -38.5,  -50.0,   270,   95
  250.0, 10280,  -48.0,  -58.0,   265,  105
  200.0, 11720,  -57.5,  -66.0,   260,  110
  150.0, 13580,  -62.0,  -72.0,   255,   90
  100.0, 16180,  -66.5,  -80.0,   250,   45
%END%`;

export const SAMPLE_PROGRESSIVE_DERECHO = `%TITLE%
DVN - Davenport IA Progressive Derecho High Wind Outbreak
   LEVEL       HGHT       TEMP       DWPT       WDIR       WSPD
-------------------------------------------------------------------
%RAW%
 1000.0,   220,   33.0,   23.5,   200,   22
  975.0,   440,   31.2,   22.8,   210,   32
  950.0,   670,   29.0,   21.5,   225,   40
  925.0,   900,   27.0,   20.0,   240,   48
  900.0,  1140,   25.0,   18.5,   255,   52
  850.0,  1520,   21.5,   13.0,   270,   58
  800.0,  2020,   17.8,    5.0,   280,   64
  750.0,  2540,   14.0,   -2.0,   285,   68
  700.0,  3080,   10.2,   -9.0,   290,   72
  650.0,  3650,    5.5,  -16.0,   295,   76
  600.0,  4260,    0.5,  -22.0,   300,   80
  550.0,  4910,   -5.0,  -27.0,   300,   85
  500.0,  5610,  -10.8,  -32.0,   300,   90
  400.0,  7180,  -22.0,  -42.0,   295,   95
  300.0,  9140,  -37.5,  -52.0,   290,  100
  250.0, 10340,  -47.0,  -60.0,   285,  110
  200.0, 11780,  -56.0,  -68.0,   280,   95
  150.0, 13620,  -62.5,  -75.0,   270,   70
  100.0, 16220,  -65.0,  -80.0,   265,   40
%END%`;

/**
 * Sounding Selector logic:
 * Multiple soundings may exist simultaneously.
 * Priority:
 * 1. Primary uploaded Type 2 sounding, when one is available; OR
 * 2. Type 1 sounding with highest relevant CAPE/shear/helicity composite score.
 */
export function determineActiveSounding(soundings: SoundingData[]): {
  activeSounding: SoundingData;
  reason: string;
} {
  if (soundings.length === 0) {
    throw new Error('No soundings available to select.');
  }

  // 1. Look for uploaded Type 2 sounding
  const type2Soundings = soundings.filter((s) => s.type === 2);
  if (type2Soundings.length > 0) {
    const topType2 = type2Soundings[0];
    const reason = `Selected primary uploaded Type 2 sounding (${topType2.name}). Type 2 observed soundings take primary precedence.`;
    return { activeSounding: topType2, reason };
  }

  // 2. Select Type 1 sounding with the highest convective composite score
  let bestSounding = soundings[0];
  let bestScore = bestSounding.compositeScore ?? 0;

  for (let i = 1; i < soundings.length; i++) {
    const snd = soundings[i];
    const score = snd.compositeScore ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestSounding = snd;
    }
  }

  const ind = bestSounding.indices;
  const reason = `Selected Type 1 / Open-Meteo forecast sounding with peak convective potential (${bestSounding.timestamp || bestSounding.name}): MLCAPE ${ind?.mlcape ?? 0} J/kg, Shear ${ind?.shear_0_6km ?? 0} kt, 0-1km SRH ${ind?.srh_0_1km ?? 0} m²/s², STP ${ind?.stp ?? 0}.`;

  return { activeSounding: bestSounding, reason };
}
