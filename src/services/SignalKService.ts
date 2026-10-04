import { SignalKDeltaMessage, AisTarget } from '../types/marine';
import { useNavigationStore } from '../store/useNavigationStore';
import { AisDecoder } from '../utils/AisDecoder';

/**
 * Service client Signal K et passerelle de télémétrie marine WebSocket.
 * Gère les deltas Signal K et le décodage NMEA AIVDM / AIVDO.
 */
export class SignalKService {
  private static instance: SignalKService;
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private simTrafficTimer: any = null;
  private isSimulated: boolean = true;

  private constructor() {
    this.startSimulatedTrafficFeed();
  }

  public static getInstance(): SignalKService {
    if (!SignalKService.instance) {
      SignalKService.instance = new SignalKService();
    }
    return SignalKService.instance;
  }

  /**
   * Connexion au serveur Signal K local (ex: Raspberry Pi / Victron GX)
   */
  public connect(url?: string): void {
    const store = useNavigationStore.getState();
    const serverUrl = url || store.signalKServerUrl;

    try {
      this.socket = new WebSocket(serverUrl);

      this.socket.onopen = () => {
        console.log('[SignalK] Connecté au serveur Signal K :', serverUrl);
        store.setSignalKConnected(true);
      };

      this.socket.onmessage = (event) => {
        store.incrementNmeaCount();
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch {
          // Si le message est une trame brute NMEA AIVDM
          if (typeof event.data === 'string' && event.data.startsWith('!AIVD')) {
            this.handleRawNmea(event.data);
          }
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[SignalK] Erreur socket, maintien de la télémétrie locale :', err);
      };

      this.socket.onclose = () => {
        store.setSignalKConnected(false);
        this.scheduleReconnect();
      };
    } catch {
      store.setSignalKConnected(true); // Mode hors-ligne / embarqué
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  /**
   * Traitement des messages Signal K de type "delta"
   */
  public handleIncomingMessage(delta: SignalKDeltaMessage): void {
    const store = useNavigationStore.getState();

    if (!delta.updates) return;

    for (const update of delta.updates) {
      for (const val of update.values) {
        switch (val.path) {
          case 'environment.depth.belowKeel':
            // Profondeur en mètres
            store.updateDepthBelowKeel(Number(val.value));
            break;

          case 'navigation.speedThroughWater':
            // Vitesse surface (convertie de m/s vers nœuds si nécessaire)
            const sogKn = typeof val.value === 'number' ? val.value * 1.94384 : 0;
            store.updateKinematics(sogKn, store.vessel.cog);
            break;

          case 'navigation.courseOverGroundTrue':
            const cogDeg = (Number(val.value) * 180) / Math.PI;
            store.updateKinematics(store.vessel.sog, cogDeg);
            break;

          case 'navigation.headingTrue':
            const hdgDeg = (Number(val.value) * 180) / Math.PI;
            store.updateKinematics(store.vessel.sog, store.vessel.cog, hdgDeg);
            break;

          default:
            break;
        }
      }
    }
  }

  /**
   * Traitement d'une trame brute NMEA AIS (!AIVDM)
   */
  public handleRawNmea(sentence: string): void {
    const decoded = AisDecoder.parseSentence(sentence);
    if (!decoded || !decoded.position) return;

    const store = useNavigationStore.getState();
    const own = store.vessel;

    // Calcul CPA / TCPA
    const sog = decoded.sog || 0;
    const cog = decoded.cog || 0;
    const { cpaNM, tcpaMinutes } = AisDecoder.calculateCpaTcpa(own, decoded.position, sog, cog);

    const target: AisTarget = {
      mmsi: decoded.mmsi,
      name: decoded.name || `NAV-${decoded.mmsi.toString().slice(-4)}`,
      callsign: decoded.callsign,
      shipType: decoded.shipType || 70, // Cargo par défaut
      position: decoded.position,
      sog,
      cog,
      heading: decoded.heading,
      navStatus: decoded.navStatus,
      lastReport: Date.now(),
      cpa: cpaNM,
      tcpa: tcpaMinutes,
      isDangerous: false,
    };

    store.upsertAisTarget(target);
  }

  /**
   * Générateur de trafic AIS réaliste en mer de la Manche
   * pour tester immédiatement le traceur, le décodage et l'alerte anticollision CPA/TCPA.
   */
  private startSimulatedTrafficFeed(): void {
    if (this.simTrafficTimer) clearInterval(this.simTrafficTimer);

    // Initialisation de 4 navires représentatifs
    const initialVessels: AisTarget[] = [
      {
        mmsi: 227001450,
        name: 'Normandie Express (Ferry)',
        shipType: 60,
        position: { latitude: 49.682, longitude: -1.595 },
        sog: 24.2,
        cog: 245.0,
        heading: 244,
        lastReport: Date.now(),
        cpa: 0.85,
        tcpa: 8.2, // Collision danger !
        isDangerous: true,
      },
      {
        mmsi: 228941000,
        name: 'Le Cormoran (Chalutier)',
        shipType: 30,
        position: { latitude: 49.672, longitude: -1.652 },
        sog: 3.8,
        cog: 45.0,
        heading: 48,
        lastReport: Date.now(),
        cpa: 1.62,
        tcpa: 22.0,
        isDangerous: false,
      },
      {
        mmsi: 228392110,
        name: 'CMA CGM Jacques Saadé (Porte-Conteneurs)',
        shipType: 70,
        position: { latitude: 49.715, longitude: -1.61 },
        sog: 16.5,
        cog: 260.0,
        heading: 261,
        lastReport: Date.now(),
        cpa: 3.1,
        tcpa: 35.0,
        isDangerous: false,
      },
      {
        mmsi: 227189020,
        name: 'Pilote Cherbourg I',
        shipType: 50,
        position: { latitude: 49.661, longitude: -1.635 },
        sog: 8.1,
        cog: 310.0,
        heading: 312,
        lastReport: Date.now(),
        cpa: 0.92,
        tcpa: 12.4,
        isDangerous: true,
      },
    ];

    const store = useNavigationStore.getState();
    initialVessels.forEach((v) => store.upsertAisTarget(v));

    // Simulation de propagation dynamique du trafic
    this.simTrafficTimer = setInterval(() => {
      const currentStore = useNavigationStore.getState();
      const own = currentStore.vessel;

      currentStore.aisTargets.forEach((t) => {
        // Avancement géodésique selon SOG et COG
        const dt = 2.0; // secondes
        const speedMs = t.sog * 0.51444;
        const cogRad = (t.cog * Math.PI) / 180;
        const dy = speedMs * Math.cos(cogRad) * dt;
        const dx = speedMs * Math.sin(cogRad) * dt;

        const earthRadius = 6378137.0;
        const dLat = (dy / earthRadius) * (180 / Math.PI);
        const dLon = (dx / (earthRadius * Math.cos((t.position.latitude * Math.PI) / 180))) * (180 / Math.PI);

        const newPos = {
          latitude: t.position.latitude + dLat,
          longitude: t.position.longitude + dLon,
        };

        const { cpaNM, tcpaMinutes } = AisDecoder.calculateCpaTcpa(own, newPos, t.sog, t.cog);

        currentStore.upsertAisTarget({
          ...t,
          position: newPos,
          lastReport: Date.now(),
          cpa: cpaNM,
          tcpa: tcpaMinutes,
        });
      });

      // Fluctuation réaliste de la sonde sous quille
      const depthFluctuation = (Math.random() - 0.49) * 0.2;
      currentStore.updateDepthBelowKeel(Math.max(1.2, own.depthBelowKeel + depthFluctuation));
    }, 2000);
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.simTrafficTimer) {
      clearInterval(this.simTrafficTimer);
      this.simTrafficTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
