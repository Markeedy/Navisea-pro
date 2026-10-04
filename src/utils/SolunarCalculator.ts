import { GeoCoordinate, SolunarDayData, SolunarPeriod } from '../types/marine';

/**
 * Calculateur Solunaire Professionnel basé sur la Théorie de John Alden Knight (1926).
 * Modélisation astronomique des transits lunaires, éphémérides et empilement (Stacking Engine).
 */
export class SolunarCalculator {
  // Constante synodique moyenne (durée exacte d'un cycle de lunaison)
  private static readonly SYNODIC_MONTH = 29.53058867;

  // Nouvelle Lune de référence astronomique : 11 Janvier 2024 à 11:57:00 UTC
  private static readonly REFERENCE_NEW_MOON_EPOCH = new Date(Date.UTC(2024, 0, 11, 11, 57, 0)).getTime();

  /**
   * Calcule les données solunaires complètes pour un jour et une coordonnée GPS donnés.
   */
  public static calculate(
    date: Date,
    coord: GeoCoordinate,
    barometricTrend: 'RISING_POST_STORM' | 'STABLE_HIGH' | 'FALLING' | 'LOW' = 'RISING_POST_STORM'
  ): SolunarDayData {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // 1. Calcul de l'âge de la lune et de la phase
    const dayMillis = targetDate.getTime();
    const diffDays = (dayMillis - this.REFERENCE_NEW_MOON_EPOCH) / (1000 * 60 * 60 * 24);
    const moonAge = ((diffDays % this.SYNODIC_MONTH) + this.SYNODIC_MONTH) % this.SYNODIC_MONTH;

    const { phaseName, illumination, phaseFactor } = this.evaluateMoonPhase(moonAge);

    // 2. Éphémérides solaires (Lever / Coucher de Soleil)
    const { sunrise, sunset } = this.calculateSunTimes(targetDate, coord);

    // 3. Éphémérides lunaires (Transit / Nadir / Lever / Coucher)
    // Le décalage lunaire moyen est d'environ 50.4 minutes par jour (24.84h par jour lunaire)
    // Le transit supérieur (zénith) dépend de la longitude et de la phase
    const transitHoursFraction = (moonAge / this.SYNODIC_MONTH) * 24;
    const longitudeAdjustmentHours = -coord.longitude / 15.0; // 15° par heure

    let transitHour = (12 + transitHoursFraction + longitudeAdjustmentHours) % 24;
    if (transitHour < 0) transitHour += 24;

    let underTransitHour = (transitHour + 12) % 24;

    // Lever et coucher de lune approximés à ±6.2 heures du transit
    let moonriseHour = (transitHour - 6.2 + 24) % 24;
    let moonsetHour = (transitHour + 6.2) % 24;

    const lunarTransit = this.createDateAtHour(targetDate, transitHour);
    const lunarUnderTransit = this.createDateAtHour(targetDate, underTransitHour);
    const moonrise = this.createDateAtHour(targetDate, moonriseHour);
    const moonset = this.createDateAtHour(targetDate, moonsetHour);

    // 4. Définition des Périodes Majeures (2 heures) et Mineures (1 heure)
    const periods: SolunarPeriod[] = [
      {
        type: 'MAJOR',
        label: 'Période Majeure 1 (Zénith)',
        start: new Date(lunarTransit.getTime() - 60 * 60 * 1000),
        end: new Date(lunarTransit.getTime() + 60 * 60 * 1000),
        peakTime: lunarTransit,
        intensity: 95,
        description: 'Lune au méridien céleste supérieur. Attraction gravitationnelle maximale.',
      },
      {
        type: 'MAJOR',
        label: 'Période Majeure 2 (Nadir)',
        start: new Date(lunarUnderTransit.getTime() - 60 * 60 * 1000),
        end: new Date(lunarUnderTransit.getTime() + 60 * 60 * 1000),
        peakTime: lunarUnderTransit,
        intensity: 90,
        description: 'Lune à l’opposé de la Terre (anti-transit). Pic d’activité instinctif.',
      },
      {
        type: 'MINOR',
        label: 'Période Mineure 1 (Lever Lune)',
        start: new Date(moonrise.getTime() - 30 * 60 * 1000),
        end: new Date(moonrise.getTime() + 30 * 60 * 1000),
        peakTime: moonrise,
        intensity: 75,
        description: 'Apparition de la lune à l’horizon local.',
      },
      {
        type: 'MINOR',
        label: 'Période Mineure 2 (Coucher Lune)',
        start: new Date(moonset.getTime() - 30 * 60 * 1000),
        end: new Date(moonset.getTime() + 30 * 60 * 1000),
        peakTime: moonset,
        intensity: 70,
        description: 'Disparition de la lune sous l’horizon local.',
      },
    ];

    // 5. Moteur d'Empilement (Stacking Engine) et Score Solunaire Global
    let stackingBonus = 0;

    // Bonus si transit coïncide avec lever ou coucher de soleil (transition lumineuse / aube / crépuscule)
    const sunriseDiffHours = Math.abs(transitHour - (sunrise.getHours() + sunrise.getMinutes() / 60));
    const sunsetDiffHours = Math.abs(transitHour - (sunset.getHours() + sunset.getMinutes() / 60));

    if (sunriseDiffHours < 1.5 || sunsetDiffHours < 1.5) {
      stackingBonus += 15; // Effet "Golden Hour" + Solunar Major
    }

    // Bonus / Malus Barométrique
    let baroFactorText = 'Pression stable : conditions neutres';
    if (barometricTrend === 'RISING_POST_STORM') {
      stackingBonus += 15;
      baroFactorText = 'Hausse post-dépression : déclencheur de frénésie alimentaire (+15%)';
    } else if (barometricTrend === 'STABLE_HIGH') {
      stackingBonus += 8;
      baroFactorText = 'Anticyclone stable : activité soutenue en profondeur (+8%)';
    } else if (barometricTrend === 'FALLING') {
      stackingBonus -= 12;
      baroFactorText = 'Chute barométrique : les poissons se calment au fond (-12%)';
    }

    const overallScore = Math.min(100, Math.max(10, Math.round(phaseFactor * 70 + stackingBonus)));

    // 6. Courbe horaire d'activité (24 heures)
    const hourlyActivity: { hour: number; score: number; isMajor: boolean; isMinor: boolean }[] = [];

    for (let h = 0; h < 24; h++) {
      let hScore = Math.round(overallScore * 0.35); // Base d'activité journalière
      let isMajor = false;
      let isMinor = false;

      // Distance temporelle aux périodes
      const distTransit = Math.min(Math.abs(h - transitHour), Math.abs(h - transitHour - 24), Math.abs(h - transitHour + 24));
      const distUnder = Math.min(Math.abs(h - underTransitHour), Math.abs(h - underTransitHour - 24), Math.abs(h - underTransitHour + 24));
      const distRise = Math.min(Math.abs(h - moonriseHour), Math.abs(h - moonriseHour - 24), Math.abs(h - moonriseHour + 24));
      const distSet = Math.min(Math.abs(h - moonsetHour), Math.abs(h - moonsetHour - 24), Math.abs(h - moonsetHour + 24));

      if (distTransit <= 1.0 || distUnder <= 1.0) {
        hScore += 50;
        isMajor = true;
      } else if (distRise <= 0.6 || distSet <= 0.6) {
        hScore += 30;
        isMinor = true;
      }

      // Bonus aube et crépuscule
      const distSunr = Math.abs(h - (sunrise.getHours() + sunrise.getMinutes() / 60));
      const distSuns = Math.abs(h - (sunset.getHours() + sunset.getMinutes() / 60));
      if (distSunr <= 1.0 || distSuns <= 1.0) {
        hScore += 20;
      }

      hourlyActivity.push({
        hour: h,
        score: Math.min(100, Math.round(hScore)),
        isMajor,
        isMinor,
      });
    }

    // 7. Conseils tactiques halieutiques
    let tacticalAdvice = '';
    if (overallScore >= 80) {
      tacticalAdvice = 'Conditions exceptionnelles. Périodes majeures idéales pour gros carnassiers pélagiques (bar, lieu jaune) et thonidés sur tombants de marée.';
    } else if (overallScore >= 60) {
      tacticalAdvice = 'Bonne journée halieutique. Focaliser les sorties sur la période majeure du zénith en concordance avec la renverse de marée.';
    } else {
      tacticalAdvice = 'Activité modérée. Privilégier les pêches lentes au ras du fond (jig lourd, appâts naturels) dans les zones de repli de courant.';
    }

    return {
      date: targetDate,
      moonPhaseName: phaseName,
      moonPhaseIndex: Math.round((moonAge / this.SYNODIC_MONTH) * 100) / 100,
      moonAgeDays: Math.round(moonAge * 10) / 10,
      moonIlluminationPercent: Math.round(illumination),
      moonrise,
      moonset,
      lunarTransit,
      lunarUnderTransit,
      sunrise,
      sunset,
      overallScore,
      periods,
      hourlyActivity,
      barometricFactorDescription: baroFactorText,
      tacticalAdvice,
    };
  }

  /**
   * Évalue la phase et le multiplicateur de force gravitationnelle
   */
  private static evaluateMoonPhase(moonAge: number): {
    phaseName: string;
    illumination: number;
    phaseFactor: number;
  } {
    // 0 = Nouvelle Lune, 14.76 = Pleine Lune, 29.53 = Nouvelle Lune
    const halfCycle = this.SYNODIC_MONTH / 2;
    const illumination = (1 - Math.cos((moonAge / this.SYNODIC_MONTH) * 2 * Math.PI)) * 50;

    let phaseName = 'Lune Gibbeuse';
    let phaseFactor = 0.7;

    if (moonAge < 1.84 || moonAge > 27.69) {
      phaseName = 'Nouvelle Lune';
      phaseFactor = 1.0; // Impact gravitationnel maximal
    } else if (moonAge < 7.38) {
      phaseName = 'Premier Croissant';
      phaseFactor = 0.65;
    } else if (moonAge < 9.23) {
      phaseName = 'Premier Quartier';
      phaseFactor = 0.55; // Mortes-eaux
    } else if (moonAge < 13.8) {
      phaseName = 'Lune Gibbeuse Croissante';
      phaseFactor = 0.75;
    } else if (moonAge < 16.61) {
      phaseName = 'Pleine Lune';
      phaseFactor = 0.95; // Fortes marées et luminosité nocturne
    } else if (moonAge < 22.15) {
      phaseName = 'Lune Gibbeuse Décroissante';
      phaseFactor = 0.75;
    } else if (moonAge < 23.99) {
      phaseName = 'Dernier Quartier';
      phaseFactor = 0.55;
    } else {
      phaseName = 'Dernier Croissant';
      phaseFactor = 0.7;
    }

    return { phaseName, illumination, phaseFactor };
  }

  /**
   * Calcul approximé du lever et coucher du soleil pour une coordonnée
   */
  private static calculateSunTimes(
    date: Date,
    coord: GeoCoordinate
  ): { sunrise: Date; sunset: Date } {
    // Jour de l'année (1-365)
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Déclinaison solaire
    const declination = 23.45 * Math.sin((((284 + dayOfYear) / 365) * 2 * Math.PI));
    const latRad = (coord.latitude * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;

    // Angle horaire
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
    const clampedCos = Math.max(-1, Math.min(1, cosHourAngle));
    const hourAngleHours = (Math.acos(clampedCos) * 180) / Math.PI / 15.0;

    // Midi solaire en heure locale
    const solarNoonHour = 12.0 - coord.longitude / 15.0;
    const sunriseHour = solarNoonHour - hourAngleHours;
    const sunsetHour = solarNoonHour + hourAngleHours;

    return {
      sunrise: this.createDateAtHour(date, sunriseHour),
      sunset: this.createDateAtHour(date, sunsetHour),
    };
  }

  private static createDateAtHour(baseDate: Date, hourFraction: number): Date {
    const d = new Date(baseDate);
    const normalizedHour = (hourFraction + 24) % 24;
    const hours = Math.floor(normalizedHour);
    const minutes = Math.floor((normalizedHour - hours) * 60);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
}
