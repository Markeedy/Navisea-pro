import { create } from 'zustand';
import { VesselState, AisTarget, S52ColorPalette, MarineWeatherForecast, SolunarDayData, GeoCoordinate, LogbookEntry } from '../types/marine';

interface NavigationStore {
  // État du propre navire (Own Vessel)
  vessel: VesselState;
  
  // Télémétrie et capteurs
  signalKConnected: boolean;
  signalKServerUrl: string;
  nmeaSentenceCount: number;
  
  // Cibles AIS
  aisTargets: Map<number, AisTarget>;
  cpaAlarmThresholdNM: number;
  tcpaAlarmThresholdMinutes: number;
  activeCollisionAlert: AisTarget | null;

  // Affichage cartographique S-52
  colorPalette: S52ColorPalette;
  showDepthSoundings: boolean;
  showBathymetry: boolean;
  showAisOverlay: boolean;
  showVectorCog: boolean;
  vectorTimeMinutes: number; // Durée de projection du vecteur COG (ex: 6 ou 12 min)

  // Météorologie et Solunaire
  cachedWeather: MarineWeatherForecast | null;
  cachedSolunar: SolunarDayData | null;
  isWeatherLoading: boolean;
  windSafetyThresholdKnots: number; // Seuil de vitesse du vent défini par l'utilisateur
  windAlertEnabled: boolean;

  // Journal de Bord (Logbook)
  logbookEntries: LogbookEntry[];

  // Actions
  updateGpsPosition: (pos: GeoCoordinate, accuracy: number, rawPos?: GeoCoordinate) => void;
  updateKinematics: (sog: number, cog: number, headingTrue?: number) => void;
  updateDepthBelowKeel: (depth: number) => void;
  setDraft: (draftMeters: number) => void;
  setKalmanActive: (active: boolean) => void;
  setWindSafetyThreshold: (knots: number) => void;
  toggleWindAlertEnabled: () => void;
  
  // Actions AIS
  upsertAisTarget: (target: AisTarget) => void;
  removeStaleAisTargets: (maxAgeMs?: number) => void;
  setCpaThresholds: (cpaNM: number, tcpaMin: number) => void;
  
  // Actions Mouillage (Anchor Watch)
  setAnchorWatch: (active: boolean, radiusMeters?: number) => void;
  checkAnchorDrift: () => void;

  // Actions Interface & Réglages
  setColorPalette: (palette: S52ColorPalette) => void;
  setSignalKConnected: (connected: boolean) => void;
  setSignalKServerUrl: (url: string) => void;
  incrementNmeaCount: () => void;
  setCachedWeather: (weather: MarineWeatherForecast | null) => void;
  setWeatherLoading: (loading: boolean) => void;
  setCachedSolunar: (solunar: SolunarDayData | null) => void;
  toggleLayer: (layer: 'soundings' | 'bathymetry' | 'ais' | 'cog') => void;

  // Actions Journal de bord
  addLogbookEntry: (entry: Omit<LogbookEntry, 'id' | 'timestamp' | 'isoDate'>) => void;
  deleteLogbookEntry: (id: string) => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  // Position par défaut au large de Cherbourg / Manche (zone nautique riche en courants et trafic)
  vessel: {
    id: 'VESSEL-FR-9821',
    name: 'Océan Indien II',
    position: { latitude: 49.6645, longitude: -1.6215 },
    rawPosition: { latitude: 49.6647, longitude: -1.6212 },
    sog: 7.4,
    cog: 78.5,
    headingTrue: 76.0,
    depthBelowKeel: 14.8,
    draft: 2.1, // 2.1 mètres de tirant d'eau
    accuracy: 4.8,
    timestamp: Date.now(),
    isKalmanActive: true,
    anchorWatch: {
      isActive: false,
      center: null,
      radiusMeters: 45,
      driftDistance: 0,
      isDrifting: false,
    },
  },

  signalKConnected: true,
  signalKServerUrl: 'ws://192.168.1.1:3000/signalk/v1/stream',
  nmeaSentenceCount: 1482,

  aisTargets: new Map<number, AisTarget>(),
  cpaAlarmThresholdNM: 1.0, // Alarme si croisement < 1.0 NM
  tcpaAlarmThresholdMinutes: 15, // et dans moins de 15 minutes
  activeCollisionAlert: null,

  colorPalette: 'DAY',
  showDepthSoundings: true,
  showBathymetry: true,
  showAisOverlay: true,
  showVectorCog: true,
  vectorTimeMinutes: 10,

  cachedWeather: null,
  cachedSolunar: null,
  isWeatherLoading: false,
  windSafetyThresholdKnots: 20, // Seuil de sécurité par défaut : 20 nœuds (Force 5/6 Beaufort)
  windAlertEnabled: true,

  logbookEntries: [
    {
      id: 'LOG-2026-1005',
      timestamp: Date.now() - 20 * 60 * 1000, // il y a 20 min
      isoDate: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      position: { latitude: 49.6645, longitude: -1.6215 },
      sog: 7.4,
      cog: 78.5,
      depthBelowKeel: 14.8,
      weatherSummary: {
        windSpeedKnots: 15,
        windDirectionDeg: 255,
        waveHeightMeters: 1.5,
        surfacePressureHpa: 1020.4,
        seaSurfaceTemp: 15.2,
      },
      category: 'NAVIGATION',
      title: 'Alignement Chenal & Stabilisation Anticyclonique',
      notes: 'Pression en hausse continue (+2.4 hPa sur 3h). Ciel bien dégagé, visi > 10 NM. Mer maniable. Navigation au moteur et génois déroulé.',
      crewMember: 'Capitaine Dubois',
      engineHours: 143.2,
    },
    {
      id: 'LOG-2026-1004',
      timestamp: Date.now() - 3 * 3600 * 1000, // il y a 3h
      isoDate: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      position: { latitude: 49.6740, longitude: -1.6280 },
      sog: 3.2,
      cog: 52.0,
      depthBelowKeel: 16.2,
      weatherSummary: {
        windSpeedKnots: 18,
        windDirectionDeg: 260,
        waveHeightMeters: 1.7,
        surfacePressureHpa: 1018.0,
        seaSurfaceTemp: 15.1,
      },
      category: 'FISHING',
      title: 'Tombant de Rade - Capture Bar Commun (3.2 kg)',
      notes: 'Pêche en dérive au ras de la cassure 15m/22m. Frénésie constatée en concordance avec le transit solunaire. Poisson relâché après mesure.',
      crewMember: 'Second Moreau',
      fishCatches: [
        { species: 'Bar Européen (Dicentrarchus labrax)', quantity: 1, weightKg: 3.2, lureUsed: 'Black Minnow 120 tête 25g Kaki' },
        { species: 'Lieu Jaune (Pollachius pollachius)', quantity: 2, weightKg: 1.8, lureUsed: 'Crazy Sand Eel 150' },
      ],
    },
    {
      id: 'LOG-2026-1003',
      timestamp: Date.now() - 6 * 3600 * 1000, // il y a 6h
      isoDate: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      position: { latitude: 49.6812, longitude: -1.6050 },
      sog: 8.1,
      cog: 80.0,
      depthBelowKeel: 24.5,
      weatherSummary: {
        windSpeedKnots: 21,
        windDirectionDeg: 270,
        waveHeightMeters: 2.1,
        surfacePressureHpa: 1015.5,
        seaSurfaceTemp: 14.9,
      },
      category: 'WEATHER',
      title: 'Fin du Coup de Vent - Éclaircies & Hausse Barométrique',
      notes: 'Passage du front froid terminé. Début de la remontée barométrique post-dépression. La mer commence à s’organiser.',
      crewMember: 'Capitaine Dubois',
    },
    {
      id: 'LOG-2026-1002',
      timestamp: Date.now() - 11 * 3600 * 1000, // il y a 11h
      isoDate: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
      position: { latitude: 49.6910, longitude: -1.5890 },
      sog: 6.2,
      cog: 72.0,
      depthBelowKeel: 28.0,
      weatherSummary: {
        windSpeedKnots: 27,
        windDirectionDeg: 280,
        waveHeightMeters: 2.7,
        surfacePressureHpa: 1011.2,
        seaSurfaceTemp: 14.8,
      },
      category: 'WEATHER',
      title: 'Creux Barométrique & Passage Frontal Actif',
      notes: 'Creux de la dépression à 1011.2 hPa. Rafales enregistrées à 34 nœuds. Voilure réduite à 2 ris. Veille active anticollision AIS.',
      crewMember: 'Second Moreau',
      engineHours: 140.5,
    },
    {
      id: 'LOG-2026-1001',
      timestamp: Date.now() - 18 * 3600 * 1000, // il y a 18h
      isoDate: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      position: { latitude: 49.6550, longitude: -1.6380 },
      sog: 5.5,
      cog: 60.0,
      depthBelowKeel: 11.2,
      weatherSummary: {
        windSpeedKnots: 16,
        windDirectionDeg: 235,
        waveHeightMeters: 1.4,
        surfacePressureHpa: 1017.8,
        seaSurfaceTemp: 15.3,
      },
      category: 'NAVIGATION',
      title: 'Départ Rade & Début de la Baisse Barométrique',
      notes: 'Appareillage du mouillage. Pression amorçant une baisse (-1.2 hPa/3h). Vérification VHF canal 16 et transpondeur AIS Classe B.',
      crewMember: 'Capitaine Dubois',
      engineHours: 138.2,
    },
  ],

  updateGpsPosition: (pos, accuracy, rawPos) => {
    set((state) => ({
      vessel: {
        ...state.vessel,
        position: pos,
        rawPosition: rawPos || state.vessel.rawPosition,
        accuracy,
        timestamp: Date.now(),
      },
    }));
    get().checkAnchorDrift();
  },

  updateKinematics: (sog, cog, headingTrue) => {
    set((state) => ({
      vessel: {
        ...state.vessel,
        sog: Math.max(0, sog),
        cog: (cog + 360) % 360,
        headingTrue: headingTrue !== undefined ? (headingTrue + 360) % 360 : state.vessel.headingTrue,
      },
    }));
  },

  updateDepthBelowKeel: (depth) => {
    set((state) => ({
      vessel: {
        ...state.vessel,
        depthBelowKeel: Math.max(0, depth),
      },
    }));
  },

  setDraft: (draft) => {
    set((state) => ({
      vessel: {
        ...state.vessel,
        draft: Math.max(0.5, draft),
      },
    }));
  },

  setKalmanActive: (active) => {
    set((state) => ({
      vessel: {
        ...state.vessel,
        isKalmanActive: active,
      },
    }));
  },

  setWindSafetyThreshold: (knots) => {
    set({ windSafetyThresholdKnots: Math.max(5, Math.min(60, Math.round(knots))) });
  },

  toggleWindAlertEnabled: () => {
    set((state) => ({ windAlertEnabled: !state.windAlertEnabled }));
  },

  upsertAisTarget: (target) => {
    set((state) => {
      const updated = new Map(state.aisTargets);
      updated.set(target.mmsi, target);

      // Vérifier les alarmes de collision CPA/TCPA
      let criticalAlert: AisTarget | null = null;
      for (const t of updated.values()) {
        if (t.cpa <= state.cpaAlarmThresholdNM && t.tcpa > 0 && t.tcpa <= state.tcpaAlarmThresholdMinutes) {
          t.isDangerous = true;
          if (!criticalAlert || t.tcpa < criticalAlert.tcpa) {
            criticalAlert = t;
          }
        } else {
          t.isDangerous = false;
        }
      }

      return {
        aisTargets: updated,
        activeCollisionAlert: criticalAlert,
      };
    });
  },

  removeStaleAisTargets: (maxAgeMs = 15 * 60 * 1000) => {
    const now = Date.now();
    set((state) => {
      const updated = new Map(state.aisTargets);
      let changed = false;
      for (const [mmsi, target] of updated.entries()) {
        if (now - target.lastReport > maxAgeMs) {
          updated.delete(mmsi);
          changed = true;
        }
      }
      return changed ? { aisTargets: updated } : state;
    });
  },

  setCpaThresholds: (cpaNM, tcpaMin) => {
    set({
      cpaAlarmThresholdNM: Math.max(0.1, cpaNM),
      tcpaAlarmThresholdMinutes: Math.max(1, tcpaMin),
    });
  },

  setAnchorWatch: (active, radiusMeters = 45) => {
    set((state) => {
      const center = active ? { ...state.vessel.position } : null;
      return {
        vessel: {
          ...state.vessel,
          anchorWatch: {
            isActive: active,
            center,
            radiusMeters,
            driftDistance: 0,
            isDrifting: false,
          },
        },
      };
    });
  },

  checkAnchorDrift: () => {
    const { vessel } = get();
    if (!vessel.anchorWatch.isActive || !vessel.anchorWatch.center) return;

    // Calcul de la distance géodésique haversine en mètres
    const R = 6371000; // Rayon terrestre en mètres
    const dLat = ((vessel.position.latitude - vessel.anchorWatch.center.latitude) * Math.PI) / 180;
    const dLon = ((vessel.position.longitude - vessel.anchorWatch.center.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((vessel.anchorWatch.center.latitude * Math.PI) / 180) *
        Math.cos((vessel.position.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const isDrifting = distance > vessel.anchorWatch.radiusMeters;

    set((state) => ({
      vessel: {
        ...state.vessel,
        anchorWatch: {
          ...state.vessel.anchorWatch,
          driftDistance: Math.round(distance * 10) / 10,
          isDrifting,
        },
      },
    }));
  },

  setColorPalette: (palette) => set({ colorPalette: palette }),
  setSignalKConnected: (connected) => set({ signalKConnected: connected }),
  setSignalKServerUrl: (url) => set({ signalKServerUrl: url }),
  incrementNmeaCount: () => set((s) => ({ nmeaSentenceCount: s.nmeaSentenceCount + 1 })),
  setCachedWeather: (weather) => set({ cachedWeather: weather }),
  setWeatherLoading: (loading) => set({ isWeatherLoading: loading }),
  setCachedSolunar: (solunar) => set({ cachedSolunar: solunar }),

  toggleLayer: (layer) => {
    set((state) => {
      switch (layer) {
        case 'soundings':
          return { showDepthSoundings: !state.showDepthSoundings };
        case 'bathymetry':
          return { showBathymetry: !state.showBathymetry };
        case 'ais':
          return { showAisOverlay: !state.showAisOverlay };
        case 'cog':
          return { showVectorCog: !state.showVectorCog };
        default:
          return state;
      }
    });
  },

  addLogbookEntry: (entryData) => {
    const now = Date.now();
    const newEntry: LogbookEntry = {
      ...entryData,
      id: `LOG-${Date.now().toString(36).toUpperCase()}`,
      timestamp: now,
      isoDate: new Date(now).toISOString(),
    };
    set((state) => ({
      logbookEntries: [newEntry, ...state.logbookEntries],
    }));
  },

  deleteLogbookEntry: (id) => {
    set((state) => ({
      logbookEntries: state.logbookEntries.filter((e) => e.id !== id),
    }));
  },
}));
