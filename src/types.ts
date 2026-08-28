export interface SoundingLevel {
  p: number;    // Pressure in hPa / mb
  h: number;    // Height in meters MSL (or AGL)
  t: number;    // Temperature in °C
  td: number;   // Dewpoint in °C
  wd: number;   // Wind direction in degrees (0-360)
  ws: number;   // Wind speed in knots (converted from km/h or m/s if needed)
  u?: number;   // u-component (eastward, m/s or kt)
  v?: number;   // v-component (northward, m/s or kt)
}

export interface SoundingIndices {
  // Thermodynamics
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
  temp_sfc_c: number;
  dew_sfc_c: number;
  temp_sfc_f: number;
  dew_sfc_f: number;
  t500_c: number;
  t500_f: number;
  t700_c: number;
  t850_c: number;

  // Kinematics
  shear_0_1km: number; // kt
  shear_0_3km: number; // kt
  shear_0_6km: number; // kt
  ebwd: number;        // Effective bulk wind difference (m/s or kt)
  srh_0_1km: number;   // m2/s2
  srh_0_3km: number;   // m2/s2
  esrh: number;        // Effective SRH m2/s2
  meanWind_0_6km: number; // kt
  bunkers_rm_dir: number;
  bunkers_rm_spd_kt: number;
  bunkers_rm_spd_mph: number;
  bunkers_lm_dir: number;
  bunkers_lm_spd_kt: number;

  // Composites
  stp: number;
  scp: number;
  ship: number;
  dcp: number;
  ehi_0_1km: number;
  ehi_0_3km: number;
  brn: number;
  sweat: number;
  craven_brooks: number;
}

export interface MesoMaxInputs {
  cape: number;
  cape3: number;
  cin: number;
  lcl: number;
  esrh: number;
  ebwd: number;
  srh: number;
  shear: number;
  llShear: number;
  dcape: number;
  lapse: number;
  meanWind: number;
  temp: number;
  dew: number;
  t500: number;
  time: number;
}

export interface LapseRateTuning {
  dryLapseRate: number;      // °C/km (default 9.8)
  moistLapseFactor: number;   // scaling factor 0.8 - 1.2 (default 1.0)
  virtualTempFactor: number;  // buoyancy moisture boost (0.0 - 1.0, default 0.61)
  entrainmentRate: number;    // %/km entrainment penalty (default 0)
  midLevelWeight: number;     // 0.5 - 2.0 (default 1.0)
}

export interface StormModeEvaluation {
  name: string;
  score: number;
  prob: number;
  description: string;
}

export interface HazardIntensityTiers {
  wind: { maxGustMph: number; tierText: string };
  hail: { maxSizeInches: number; tierText: string };
  tor: { peakRating: string; tierText: string };
  watchProb: number;
}

export interface MesoscaleDiscussionProduct {
  summary: string;
  synopsis: string;
  thermo: string;
  kine: string;
  expectation: string;
  fullHtml: string;
  tagsBlock: string;
}

export interface HazardRiskAssessment {
  // 25-mile base probabilities (%)
  pWind: number;
  pHail: number;
  pTor: number;
  pTstm: number;
  maxBaseProb: number;

  // Significant threats (%)
  sigWind: number;
  sigHail: number;
  sigTor: number;
  cigWind: 'CIG 1' | 'CIG 2' | 'CIG 3' | 'None';
  cigHail: 'CIG 1' | 'CIG 2' | 'CIG 3' | 'None';
  cigTor: 'CIG 1' | 'CIG 2' | 'CIG 3' | 'None';

  // SPC Categorical
  spcCat: 'NONE' | 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH';
  spcLikelihoods: { lvl: 'NONE' | 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH'; prob: number }[];
  spcProbBinned: { tor: number; hail: number; wind: number; tstm: number };

  // Initiation & Diurnal
  ciProb: number;
  diurnalFactor: number;

  // Storm Modes
  primaryMode: StormModeEvaluation;
  modes: StormModeEvaluation[];

  // Intensity Tiers
  intensity: HazardIntensityTiers;

  // Mesoscale Discussion
  discussion: MesoscaleDiscussionProduct;

  // Motion & Tops
  stormMotion: { dir: number; speedKt: number; speedMph: number };
  stormHeight: { meters: number; feet: number; km: number };
}

export interface SoundingData {
  id: string;
  name: string;
  title: string;
  source: 'open-meteo' | 'sharppy' | 'custom';
  type: 1 | 2;
  timestamp?: string;
  lat?: number;
  lon?: number;
  apiUrl?: string;
  rawText?: string;
  levels: SoundingLevel[];
  indices?: SoundingIndices;
  compositeScore?: number;
  selectionReason?: string;
}

export interface HourlyForecastStep {
  time: string;
  hourLabel: string;
  sounding: SoundingData;
  inputs: MesoMaxInputs;
  indices: SoundingIndices;
  risks: HazardRiskAssessment;
}

export type PageTab = 'setup' | 'hazards' | 'analysis' | 'export';
export type ThemeId = 'theme-default' | 'theme-bubbles' | 'theme-sharp' | 'theme-light' | 'theme-dracula' | 'theme-retro';
