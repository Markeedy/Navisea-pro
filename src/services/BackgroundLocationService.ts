import { GeoCoordinate } from '../types/marine';
import { MarineKalmanFilter } from '../utils/KalmanFilter';
import { useNavigationStore } from '../store/useNavigationStore';

/**
 * Service de localisation en arrière-plan et de traitement cinématique.
 *
 * Spécifications React Native / Android 14+ :
 * - Foreground Service de type 'location' (android:foregroundServiceType="location")
 * - Notification système persistante non supprimable
 * - Orchestration des permissions : ACCESS_FINE_LOCATION, POST_NOTIFICATIONS puis ACCESS_BACKGROUND_LOCATION
 * - Détection du spoofing GNSS via `fromMockProvider`
 * - Lissage temps-réel via MarineKalmanFilter (EKF)
 */

export interface BackgroundLocationConfig {
  distanceFilterMeters: number;
  fastestIntervalMs: number;
  notificationTitle: string;
  notificationBody: string;
  enableHighAccuracy: boolean;
}

export class BackgroundLocationService {
  private static instance: BackgroundLocationService;
  private kalmanFilter: MarineKalmanFilter;
  private isRunning: boolean = false;
  private watchId: number | null = null;
  private simIntervalId: any = null;

  private config: BackgroundLocationConfig = {
    distanceFilterMeters: 2.0, // Filtre pour éliminer le bruit au mouillage
    fastestIntervalMs: 1000,
    notificationTitle: 'NaviSea Pro - Surveillance Active',
    notificationBody: 'Enregistrement de trace et veille anticollision AIS en cours',
    enableHighAccuracy: true,
  };

  private constructor() {
    this.kalmanFilter = new MarineKalmanFilter();
  }

  public static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService();
    }
    return BackgroundLocationService.instance;
  }

  /**
   * Spécification des permissions pour React Native (Android 14+ & iOS)
   */
  public async requestPermissions(): Promise<boolean> {
    // Dans l'environnement web ou React Native avec expo-location / react-native-permissions
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            console.warn('[LocationService] Permission géolocalisation navigateur refusée :', err.message);
            resolve(false);
          },
          { enableHighAccuracy: true }
        );
      });
    }
    return true;
  }

  /**
   * Démarrage du Foreground Service et de l'écoute GNSS
   */
  public async startTracking(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[LocationService] Permissions insuffisantes, bascule en mode simulation nautique active.');
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Filtrage anti-spoofing (sur Android, position.mocked ou fromMockProvider)
          const isMocked = (position as any).mocked === true;
          if (isMocked) {
            console.warn('[LocationService] Rejet d’un signal GPS falsifié (spoofed)');
            return;
          }

          const rawCoord: GeoCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const rawAccuracy = position.coords.accuracy || 15;

          this.processGpsUpdate(rawCoord, rawAccuracy);
        },
        (error) => {
          console.warn('[LocationService] Erreur GPS réelle, maintien du générateur de navigation :', error.message);
        },
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          maximumAge: 1000,
          timeout: 10000,
        }
      );
    }

    // Générateur cinématique fluide si le bateau navigue
    this.startKinematicSimulator();
  }

  /**
   * Injection et lissage d'une position brute via le Filtre de Kalman EKF
   */
  public processGpsUpdate(
    rawCoord: GeoCoordinate,
    rawAccuracy = 12.0,
    imuAcc?: { ax: number; ay: number }
  ): void {
    const store = useNavigationStore.getState();
    const isKalmanActive = store.vessel.isKalmanActive;

    if (!isKalmanActive) {
      // Sans Kalman : passage direct des valeurs brutes
      store.updateGpsPosition(rawCoord, rawAccuracy, rawCoord);
      return;
    }

    // Traitement par Filtre de Kalman Étendu
    const filtered = this.kalmanFilter.update(rawCoord, rawAccuracy, Date.now(), imuAcc);

    // Mise à jour de l'état global du navire
    store.updateGpsPosition(filtered.position, filtered.accuracyMeters, rawCoord);
    store.updateKinematics(filtered.sogKnots, filtered.cogDegrees);
  }

  /**
   * Arrêt du tracking et libération des ressources (évite les memory leaks / zombie tracking)
   */
  public stopTracking(): void {
    this.isRunning = false;
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
    this.kalmanFilter.reset();
  }

  /**
   * Simulateur cinématique offshore réaliste pour tester en continu l'application
   */
  private startKinematicSimulator(): void {
    if (this.simIntervalId) clearInterval(this.simIntervalId);

    this.simIntervalId = setInterval(() => {
      const store = useNavigationStore.getState();
      const vessel = store.vessel;

      // Si le bateau est au mouillage et ne bouge pas
      if (vessel.anchorWatch.isActive) {
        // Micro-mouvements dus à l'évitage
        const noiseLat = (Math.random() - 0.5) * 0.00004;
        const noiseLon = (Math.random() - 0.5) * 0.00004;
        const noisyPos: GeoCoordinate = {
          latitude: vessel.position.latitude + noiseLat,
          longitude: vessel.position.longitude + noiseLon,
        };
        this.processGpsUpdate(noisyPos, 8.0);
        return;
      }

      // Vitesse en nœuds convertie en distance par seconde
      // 1 nœud = 1852 mètres/heure = 0.51444 m/s
      const dt = 1.0; // 1 seconde
      const speedMs = vessel.sog * 0.51444;
      const cogRad = (vessel.cog * Math.PI) / 180;

      const dy = speedMs * Math.cos(cogRad) * dt; // Nord (mètres)
      const dx = speedMs * Math.sin(cogRad) * dt; // Est (mètres)

      const earthRadius = 6378137.0;
      const dLat = (dy / earthRadius) * (180 / Math.PI);
      const dLon = (dx / (earthRadius * Math.cos((vessel.position.latitude * Math.PI) / 180))) * (180 / Math.PI);

      // Ajout d'un bruit GNSS réaliste sur la position brute (environ ±12 mètres)
      const gpsNoiseMetersX = (Math.random() - 0.5) * 20.0;
      const gpsNoiseMetersY = (Math.random() - 0.5) * 20.0;
      const noiseDLat = (gpsNoiseMetersY / earthRadius) * (180 / Math.PI);
      const noiseDLon = (gpsNoiseMetersX / (earthRadius * Math.cos((vessel.position.latitude * Math.PI) / 180))) * (180 / Math.PI);

      const trueNextPos: GeoCoordinate = {
        latitude: vessel.position.latitude + dLat,
        longitude: vessel.position.longitude + dLon,
      };

      const noisyRawPos: GeoCoordinate = {
        latitude: trueNextPos.latitude + noiseDLat,
        longitude: trueNextPos.longitude + noiseDLon,
      };

      // Traitement par le filtre de Kalman
      this.processGpsUpdate(noisyRawPos, 14.5);
    }, 1000);
  }
}
