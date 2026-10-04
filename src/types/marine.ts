/**
 * Types géospatiaux, télémétriques et environnementaux pour la navigation maritime
 * Conformes aux normes IHO S-57 / S-52, Signal K et ITU-R M.1371 (AIS).
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface VesselState {
  id: string;
  name: string;
  position: GeoCoordinate;
  rawPosition?: GeoCoordinate;
  sog: number; // Speed Over Ground en nœuds (kn)
  cog: number; // Course Over Ground en degrés (0-360°)
  headingTrue: number; // Cap vrai (degrés)
  depthBelowKeel: number; // Profondeur sous quille en mètres
  draft: number; // Tirant d'eau paramétré en mètres (pour Safety Contour S-52)
  accuracy: number; // Rayon d'incertitude GNSS en mètres
  timestamp: number;
  isKalmanActive: boolean;
  anchorWatch: {
    isActive: boolean;
    center: GeoCoordinate | null;
    radiusMeters: number;
    driftDistance: number;
    isDrifting: boolean;
  };
}

export interface AisTarget {
  mmsi: number;
  name?: string;
  callsign?: string;
  shipType?: number;
  position: GeoCoordinate;
  sog: number; // Nœuds
  cog: number; // Degrés
  heading?: number;
  length?: number;
  beam?: number;
  draft?: number;
  navStatus?: number; // 0=Under way using engine, 1=At anchor, 5=Moored, etc.
  lastReport: number;
  cpa: number; // Closest Point of Approach (milles nautiques - NM)
  tcpa: number; // Time to CPA (minutes)
  isDangerous: boolean; // Alerte collision si CPA < seuil && TCPA > 0
}

export type S52ColorPalette = 'DAY' | 'DUSK' | 'NIGHT';

export interface MarineWeatherForecast {
  time: string[];
  temperature2m: number[];
  surfacePressure: number[];
  windSpeed10m: number[];
  windDirection10m: number[];
  windGusts10m: number[];
  waveHeight: number[];
  waveDirection: number[];
  wavePeriod: number[];
  windWaveHeight: number[];
  windWaveDirection: number[];
  windWavePeriod: number[];
  swellWaveHeight: number[];
  swellWaveDirection: number[];
  swellWavePeriod: number[];
  oceanCurrentVelocity: number[];
  oceanCurrentDirection: number[];
  seaSurfaceTemperature: number[];
  modelUsed: 'AROME' | 'ECMWF' | 'GFS';
  confidenceIndex: number; // 0-100% calculé par variance d'ensemble
}

export interface SolunarPeriod {
  type: 'MAJOR' | 'MINOR';
  label: string;
  start: Date;
  end: Date;
  peakTime: Date;
  intensity: number; // 0 à 100
  description: string;
}

export interface SolunarDayData {
  date: Date;
  moonPhaseName: string;
  moonPhaseIndex: number; // 0.0 à 1.0 (0=Nouvelle lune, 0.5=Pleine lune)
  moonAgeDays: number; // 0 à 29.53 jours
  moonIlluminationPercent: number;
  moonrise: Date | null;
  moonset: Date | null;
  lunarTransit: Date; // Zénith
  lunarUnderTransit: Date; // Nadir
  sunrise: Date;
  sunset: Date;
  overallScore: number; // Solunar Score 0-100%
  periods: SolunarPeriod[];
  hourlyActivity: { hour: number; score: number; isMajor: boolean; isMinor: boolean }[];
  barometricFactorDescription: string;
  tacticalAdvice: string;
}

export type LogbookCategory = 'NAVIGATION' | 'WEATHER' | 'FISHING' | 'ENGINE' | 'ANCHOR' | 'SECURITY';

export interface FishCatchRecord {
  species: string;
  quantity: number;
  weightKg?: number;
  lureUsed?: string;
}

export interface LogbookEntry {
  id: string;
  timestamp: number;
  isoDate: string;
  position: GeoCoordinate;
  sog: number;
  cog: number;
  depthBelowKeel: number;
  weatherSummary: {
    windSpeedKnots: number;
    windDirectionDeg: number;
    waveHeightMeters: number;
    surfacePressureHpa: number;
    seaSurfaceTemp?: number;
  };
  category: LogbookCategory;
  title: string;
  notes: string;
  crewMember?: string;
  engineHours?: number;
  fishCatches?: FishCatchRecord[];
}

export interface SignalKDeltaMessage {
  context?: string;
  updates: {
    source?: { label: string; type?: string };
    timestamp: string;
    values: {
      path: string;
      value: any;
    }[];
  }[];
}
