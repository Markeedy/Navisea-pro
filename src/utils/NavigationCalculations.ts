import { GeoCoordinate } from '../types/marine';

/**
 * Moteur Géodésique & Trigonométrique Maritime.
 * Implémentation rigoureuse des calculs de navigation :
 * - Orthodromie (Great Circle / Grand Cercle)
 * - Loxodromie (Rhumb Line / Ligne de Rhumb à cap constant)
 * - Interpolation d'arc géodésique pour le tracé cartographique
 * - Détermination du Vertex et calcul d'ETA selon le SOG
 */

export interface RouteCalculationResult {
  pointA: GeoCoordinate;
  pointB: GeoCoordinate;
  
  // Orthodromie (Grand Cercle)
  orthoDistanceNM: number;
  orthoDistanceKm: number;
  initialBearingDeg: number;  // Cap initial (Ti)
  finalBearingDeg: number;    // Cap final (Tf)
  orthoPoints: GeoCoordinate[]; // Arc géodésique interpolé
  
  // Loxodromie (Ligne de Rhumb)
  loxoDistanceNM: number;
  loxoDistanceKm: number;
  constantBearingDeg: number; // Cap constant loxodromique (Tc)
  loxoPoints: GeoCoordinate[]; // Ligne droite mercatorienne
  
  // Différentiel & Comparaison
  distanceGainNM: number;     // Gain orthodromique (D_loxo - D_ortho)
  gainPercent: number;
  
  // Estimation Temps d'Arrivée (ETA)
  estimatedTimeHours: number; // Basé sur le SOG
  etaDate: Date;
}

export class NavigationCalculations {
  public static readonly EARTH_RADIUS_NM = 3440.065; // Rayon terrestre moyen en Milles Nautiques (IUGG)
  public static readonly EARTH_RADIUS_KM = 6371.008; // Rayon terrestre en kilomètres
  public static readonly NM_TO_METERS = 1852.0;

  /**
   * Calcul complet comparatif Orthodromie / Loxodromie entre deux points géographiques
   */
  public static calculateRoute(
    pointA: GeoCoordinate,
    pointB: GeoCoordinate,
    vesselSogKnots = 7.0
  ): RouteCalculationResult {
    // 1. Orthodromie (Great Circle)
    const { distanceNM: orthoNM, initialBearing, finalBearing } = this.calculateGreatCircle(pointA, pointB);
    const orthoKm = orthoNM * 1.852;
    const orthoPoints = this.interpolateGreatCircleArc(pointA, pointB, 30);

    // 2. Loxodromie (Rhumb Line)
    const { distanceNM: loxoNM, constantBearing } = this.calculateRhumbLine(pointA, pointB);
    const loxoKm = loxoNM * 1.852;
    const loxoPoints = [pointA, pointB];

    // 3. Différentiel
    const distanceGainNM = Math.max(0, Math.round((loxoNM - orthoNM) * 100) / 100);
    const gainPercent = loxoNM > 0 ? Math.round(((loxoNM - orthoNM) / loxoNM) * 1000) / 10 : 0;

    // 4. ETA
    const effectiveSog = Math.max(0.5, vesselSogKnots);
    const hours = orthoNM / effectiveSog;
    const etaDate = new Date(Date.now() + hours * 3600 * 1000);

    return {
      pointA,
      pointB,
      orthoDistanceNM: Math.round(orthoNM * 100) / 100,
      orthoDistanceKm: Math.round(orthoKm * 100) / 100,
      initialBearingDeg: Math.round(initialBearing * 10) / 10,
      finalBearingDeg: Math.round(finalBearing * 10) / 10,
      orthoPoints,
      loxoDistanceNM: Math.round(loxoNM * 100) / 100,
      loxoDistanceKm: Math.round(loxoKm * 100) / 100,
      constantBearingDeg: Math.round(constantBearing * 10) / 10,
      loxoPoints,
      distanceGainNM,
      gainPercent,
      estimatedTimeHours: Math.round(hours * 10) / 10,
      etaDate,
    };
  }

  /**
   * Formule de Haversine & Calcul du Cap Initial / Final pour l'Orthodromie
   */
  public static calculateGreatCircle(
    p1: GeoCoordinate,
    p2: GeoCoordinate
  ): { distanceNM: number; initialBearing: number; finalBearing: number } {
    const phi1 = (p1.latitude * Math.PI) / 180;
    const phi2 = (p2.latitude * Math.PI) / 180;
    const deltaPhi = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const deltaLambda = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    // Formule de Haversine pour la distance angulaire sigma
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const sigma = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceNM = sigma * this.EARTH_RADIUS_NM;

    // Cap Initial (Initial True Course / Ti)
    const yInitial = Math.sin(deltaLambda) * Math.cos(phi2);
    const xInitial =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    let initialBearing = (Math.atan2(yInitial, xInitial) * 180) / Math.PI;
    initialBearing = (initialBearing + 360) % 360;

    // Cap Final (Final True Course / Tf)
    const yFinal = Math.sin(-deltaLambda) * Math.cos(phi1);
    const xFinal =
      Math.cos(phi2) * Math.sin(phi1) -
      Math.sin(phi2) * Math.cos(phi1) * Math.cos(-deltaLambda);
    let finalBearing = (Math.atan2(yFinal, xFinal) * 180) / Math.PI;
    finalBearing = (finalBearing + 180 + 360) % 360;

    return { distanceNM, initialBearing, finalBearing };
  }

  /**
   * Calcul de la Loxodromie (Rhumb Line) à cap constant en projection Mercator
   * Utilise les latitudes croissantes (latitude isométrique psi) :
   * psi = ln(tan(pi/4 + phi/2))
   */
  public static calculateRhumbLine(
    p1: GeoCoordinate,
    p2: GeoCoordinate
  ): { distanceNM: number; constantBearing: number } {
    const phi1 = (p1.latitude * Math.PI) / 180;
    const phi2 = (p2.latitude * Math.PI) / 180;
    const deltaPhi = phi2 - phi1;

    let deltaLambda = ((p2.longitude - p1.longitude) * Math.PI) / 180;
    // Si passage de l'antiméridien (> 180°)
    if (Math.abs(deltaLambda) > Math.PI) {
      deltaLambda = deltaLambda > 0 ? -(2 * Math.PI - deltaLambda) : 2 * Math.PI + deltaLambda;
    }

    // Latitude isométrique (Mercator projection formula)
    const psi1 = Math.log(Math.tan(Math.PI / 4 + phi1 / 2));
    const psi2 = Math.log(Math.tan(Math.PI / 4 + phi2 / 2));
    const deltaPsi = psi2 - psi1;

    // Calcul du cap constant (Rhumb line bearing)
    let constantBearing = (Math.atan2(deltaLambda, deltaPsi) * 180) / Math.PI;
    constantBearing = (constantBearing + 360) % 360;

    // Calcul du facteur de distorsion q
    let q = Math.abs(deltaPsi) > 1e-10 ? deltaPhi / deltaPsi : Math.cos(phi1);

    // Distance loxodromique
    const distanceNM = Math.sqrt(deltaPhi * deltaPhi + q * q * deltaLambda * deltaLambda) * this.EARTH_RADIUS_NM;

    return { distanceNM, constantBearing };
  }

  /**
   * Interpolation de N points le long de l'arc de grand cercle (Orthodromie)
   * pour un tracé courbe précis sur la projection de Mercator / MapLibre
   */
  public static interpolateGreatCircleArc(
    p1: GeoCoordinate,
    p2: GeoCoordinate,
    numSegments = 25
  ): GeoCoordinate[] {
    const points: GeoCoordinate[] = [];
    const phi1 = (p1.latitude * Math.PI) / 180;
    const lambda1 = (p1.longitude * Math.PI) / 180;
    const phi2 = (p2.latitude * Math.PI) / 180;
    const lambda2 = (p2.longitude * Math.PI) / 180;

    // Distance angulaire totale
    const deltaPhi = phi2 - phi1;
    const deltaLambda = lambda2 - lambda1;
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const sigma = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (sigma < 1e-6) {
      return [p1, p2];
    }

    for (let i = 0; i <= numSegments; i++) {
      const f = i / numSegments;
      const A = Math.sin((1 - f) * sigma) / Math.sin(sigma);
      const B = Math.sin(f * sigma) / Math.sin(sigma);

      const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
      const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
      const z = A * Math.sin(phi1) + B * Math.sin(phi2);

      const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lambda = Math.atan2(y, x);

      points.push({
        latitude: (phi * 180) / Math.PI,
        longitude: (lambda * 180) / Math.PI,
      });
    }

    return points;
  }

  /**
   * Génération des coordonnées d'un cercle géodésique pour MapLibre (Polygon GeoJSON)
   * utilisé pour le cercle de recherche à rayon variable MOB / SAR
   */
  public static createGeodesicCircle(
    center: GeoCoordinate,
    radiusMeters: number,
    numPoints = 64
  ): [number, number][] {
    const coords: [number, number][] = [];
    const centerLatRad = (center.latitude * Math.PI) / 180;
    const centerLonRad = (center.longitude * Math.PI) / 180;
    const angularDistance = radiusMeters / 6371008.0;

    for (let i = 0; i <= numPoints; i++) {
      const bearing = (i * 2 * Math.PI) / numPoints;
      const pointLatRad = Math.asin(
        Math.sin(centerLatRad) * Math.cos(angularDistance) +
          Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing)
      );
      const pointLonRad =
        centerLonRad +
        Math.atan2(
          Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatRad),
          Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(pointLatRad)
        );

      coords.push([(pointLonRad * 180) / Math.PI, (pointLatRad * 180) / Math.PI]);
    }

    return coords;
  }
}
