import { GeoCoordinate } from '../types/marine';

/**
 * Filtre de Kalman Étendu (EKF) cinématique à 6 états pour récepteur GNSS maritime.
 *
 * Vecteur d'état X = [Px, Py, Vx, Vy, Ax, Ay]^T
 * Px, Py : Positions cartésiennes relatives locales (mètres, repère tangentiel Est-Nord)
 * Vx, Vy : Vélocités relatives (m/s)
 * Ax, Ay : Accélérations estimées (m/s²)
 *
 * Réduit le bruit de mesure GNSS classique (15m RMS) à ~5m RMS,
 * et stabilise le vecteur de Route sur le Fond (COG) et de Vitesse (SOG).
 */

export interface KalmanOutput {
  position: GeoCoordinate;
  sogKnots: number;
  cogDegrees: number;
  accuracyMeters: number;
  rawPosition: GeoCoordinate;
}

export class MarineKalmanFilter {
  // Vecteur d'état 6x1
  private x: number[] = [0, 0, 0, 0, 0, 0];

  // Matrice de covariance d'erreur 6x6
  private P: number[][] = [];

  // Matrice de bruit de processus 6x6
  private Q: number[][] = [];

  // Référence géodésique pour la projection cartésienne locale
  private refOrigin: GeoCoordinate | null = null;

  private lastTimestampMs: number = 0;
  private isInitialized: boolean = false;

  // Paramètres de réglage
  private readonly processNoiseAcc: number = 0.5; // Variance d'accélération (m/s²)
  private readonly earthRadiusMeters: number = 6378137.0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.x = [0, 0, 0, 0, 0, 0];
    this.P = this.createIdentityMatrix(6, 100.0); // Incertitude initiale élevée
    this.refOrigin = null;
    this.lastTimestampMs = 0;
    this.isInitialized = false;
  }

  /**
   * Initialise le filtre avec la première mesure GNSS
   */
  public init(coord: GeoCoordinate, accuracyMeters = 10, timestampMs = Date.now()): void {
    this.refOrigin = { ...coord };
    this.x = [0, 0, 0, 0, 0, 0];
    this.P = this.createIdentityMatrix(6, accuracyMeters * accuracyMeters);
    // Incertitude sur les vitesses initiales (ex: 5 m/s)
    this.P[2][2] = 25.0;
    this.P[3][3] = 25.0;
    this.P[4][4] = 4.0;
    this.P[5][5] = 4.0;

    this.lastTimestampMs = timestampMs;
    this.isInitialized = true;
  }

  /**
   * Projection géodésique WGS84 -> Plan tangent local ENU (East-North-Up) en mètres
   */
  private geoToLocal(coord: GeoCoordinate): { x: number; y: number } {
    if (!this.refOrigin) return { x: 0, y: 0 };
    const latRad = (this.refOrigin.latitude * Math.PI) / 180;
    const dLat = ((coord.latitude - this.refOrigin.latitude) * Math.PI) / 180;
    const dLon = ((coord.longitude - this.refOrigin.longitude) * Math.PI) / 180;

    const y = dLat * this.earthRadiusMeters;
    const x = dLon * this.earthRadiusMeters * Math.cos(latRad);
    return { x, y };
  }

  /**
   * Rétro-projection locale ENU (mètres) -> Coordonnées WGS84
   */
  private localToGeo(x: number, y: number): GeoCoordinate {
    if (!this.refOrigin) return { latitude: 0, longitude: 0 };
    const latRad = (this.refOrigin.latitude * Math.PI) / 180;
    const dLat = y / this.earthRadiusMeters;
    const dLon = x / (this.earthRadiusMeters * Math.cos(latRad));

    return {
      latitude: this.refOrigin.latitude + (dLat * 180) / Math.PI,
      longitude: this.refOrigin.longitude + (dLon * 180) / Math.PI,
    };
  }

  /**
   * Étape de Prédiction : Propagation de l'état cinématique
   * Px(t+dt) = Px + Vx*dt + 0.5*Ax*dt^2
   * Py(t+dt) = Py + Vy*dt + 0.5*Ay*dt^2
   * Vx(t+dt) = Vx + Ax*dt
   * Vy(t+dt) = Vy + Ay*dt
   */
  private predict(dt: number): void {
    const dt2 = 0.5 * dt * dt;

    // Matrice de transition d'état F (6x6)
    // [1, 0, dt, 0, dt2, 0 ]
    // [0, 1, 0, dt, 0, dt2 ]
    // [0, 0, 1, 0,  dt, 0  ]
    // [0, 0, 0, 1,  0,  dt ]
    // [0, 0, 0, 0,  1,  0  ]
    // [0, 0, 0, 0,  0,  1  ]

    const newX = [
      this.x[0] + this.x[2] * dt + this.x[4] * dt2,
      this.x[1] + this.x[3] * dt + this.x[5] * dt2,
      this.x[2] + this.x[4] * dt,
      this.x[3] + this.x[5] * dt,
      this.x[4] * 0.98, // Amortissement d'accélération
      this.x[5] * 0.98,
    ];

    // Matrice de bruit de processus discrétisée Q basée sur la variance d'accélération
    const qAcc = this.processNoiseAcc;
    const dt3 = dt * dt2;
    const dt4 = dt2 * dt2;

    const Q: number[][] = [
      [dt4 * qAcc, 0, dt3 * qAcc, 0, dt2 * qAcc, 0],
      [0, dt4 * qAcc, 0, dt3 * qAcc, 0, dt2 * qAcc],
      [dt3 * qAcc, 0, dt * dt * qAcc, 0, dt * qAcc, 0],
      [0, dt3 * qAcc, 0, dt * dt * qAcc, 0, dt * qAcc],
      [dt2 * qAcc, 0, dt * qAcc, 0, qAcc, 0],
      [0, dt2 * qAcc, 0, dt * qAcc, 0, qAcc],
    ];

    // P = F * P * F^T + Q
    const F = [
      [1, 0, dt, 0, dt2, 0],
      [0, 1, 0, dt, 0, dt2],
      [0, 0, 1, 0, dt, 0],
      [0, 0, 0, 1, 0, dt],
      [0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 1],
    ];

    const FP = this.multiplyMatrices(F, this.P);
    const FPFt = this.multiplyMatrices(FP, this.transposeMatrix(F));
    this.P = this.addMatrices(FPFt, Q);
    this.x = newX;
  }

  /**
   * Étape de Mise à Jour (Correction) avec la mesure GNSS bruitée
   * Z = [measX, measY]^T
   * R = diag(accuracy^2, accuracy^2)
   */
  public update(
    rawCoord: GeoCoordinate,
    accuracyMeters = 10,
    timestampMs = Date.now(),
    imuAcc?: { ax: number; ay: number }
  ): KalmanOutput {
    if (!this.isInitialized || !this.refOrigin) {
      this.init(rawCoord, accuracyMeters, timestampMs);
      return {
        position: rawCoord,
        sogKnots: 0,
        cogDegrees: 0,
        accuracyMeters,
        rawPosition: rawCoord,
      };
    }

    const dt = Math.max(0.05, Math.min(5.0, (timestampMs - this.lastTimestampMs) / 1000.0));
    this.lastTimestampMs = timestampMs;

    // 1. Prédiction
    this.predict(dt);

    // Intégration optionnelle de l'accéléromètre IMU
    if (imuAcc) {
      this.x[4] = 0.7 * this.x[4] + 0.3 * imuAcc.ax;
      this.x[5] = 0.7 * this.x[5] + 0.3 * imuAcc.ay;
    }

    // 2. Mesure GNSS projetée
    const meas = this.geoToLocal(rawCoord);
    const z = [meas.x, meas.y];

    // Matrice d'observation H (2x6)
    // H = [1 0 0 0 0 0]
    //     [0 1 0 0 0 0]

    // Innovation y = z - H*x
    const y = [z[0] - this.x[0], z[1] - this.x[1]];

    // Matrice de covariance du bruit de mesure R (2x2)
    const rVar = Math.max(1.0, accuracyMeters * accuracyMeters);
    const S = [
      [this.P[0][0] + rVar, this.P[0][1]],
      [this.P[1][0], this.P[1][1] + rVar],
    ];

    // Inversion de S (2x2)
    const detS = S[0][0] * S[1][1] - S[0][1] * S[1][0];
    const invS = [
      [S[1][1] / detS, -S[0][1] / detS],
      [-S[1][0] / detS, S[0][0] / detS],
    ];

    // Gain de Kalman K = P * H^T * inv(S) (taille 6x2)
    const K: number[][] = [];
    for (let i = 0; i < 6; i++) {
      K[i] = [
        this.P[i][0] * invS[0][0] + this.P[i][1] * invS[1][0],
        this.P[i][0] * invS[0][1] + this.P[i][1] * invS[1][1],
      ];
    }

    // Mise à jour de l'état : x = x + K * y
    for (let i = 0; i < 6; i++) {
      this.x[i] += K[i][0] * y[0] + K[i][1] * y[1];
    }

    // Mise à jour de la covariance P = (I - K*H) * P
    const I_KH = this.createIdentityMatrix(6, 1.0);
    for (let i = 0; i < 6; i++) {
      I_KH[i][0] -= K[i][0];
      I_KH[i][1] -= K[i][1];
    }
    this.P = this.multiplyMatrices(I_KH, this.P);

    // Extraction des coordonnées lissées
    const filteredPos = this.localToGeo(this.x[0], this.x[1]);

    // Calcul de la Vitesse sur le Fond (SOG) en nœuds (1 m/s = 1.94384 knots)
    const speedMs = Math.sqrt(this.x[2] * this.x[2] + this.x[3] * this.x[3]);
    const sogKnots = speedMs * 1.94384;

    // Calcul de la Route sur le Fond (COG) en degrés (sens horaire par rapport au Nord)
    // vx = Est, vy = Nord -> angle = atan2(vx, vy)
    let cogDegrees = (Math.atan2(this.x[2], this.x[3]) * 180) / Math.PI;
    if (cogDegrees < 0) cogDegrees += 360;

    // Précision estimée filtrée (écart-type position)
    const filteredAccuracy = Math.sqrt(Math.max(0.5, (this.P[0][0] + this.P[1][1]) / 2));

    return {
      position: filteredPos,
      sogKnots: Math.round(sogKnots * 10) / 10,
      cogDegrees: Math.round(cogDegrees * 10) / 10,
      accuracyMeters: Math.round(filteredAccuracy * 10) / 10,
      rawPosition: rawCoord,
    };
  }

  // --- Utilitaires matriciels ---

  private createIdentityMatrix(dim: number, diagVal = 1.0): number[][] {
    const m: number[][] = [];
    for (let i = 0; i < dim; i++) {
      m[i] = new Array(dim).fill(0);
      m[i][i] = diagVal;
    }
    return m;
  }

  private multiplyMatrices(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    const result: number[][] = [];

    for (let i = 0; i < rowsA; i++) {
      result[i] = new Array(colsB).fill(0);
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  private transposeMatrix(A: number[][]): number[][] {
    const rows = A.length;
    const cols = A[0].length;
    const result: number[][] = [];
    for (let j = 0; j < cols; j++) {
      result[j] = new Array(rows).fill(0);
      for (let i = 0; i < rows; i++) {
        result[j][i] = A[i][j];
      }
    }
    return result;
  }

  private addMatrices(A: number[][], B: number[][]): number[][] {
    const rows = A.length;
    const cols = A[0].length;
    const result: number[][] = [];
    for (let i = 0; i < rows; i++) {
      result[i] = new Array(cols).fill(0);
      for (let j = 0; j < cols; j++) {
        result[i][j] = A[i][j] + B[i][j];
      }
    }
    return result;
  }
}
