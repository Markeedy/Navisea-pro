import { AisTarget, GeoCoordinate, VesselState } from '../types/marine';

/**
 * Décodeur haute performance pour trames NMEA 0183 AIS (!AIVDM et !AIVDO).
 * Conforme à la spécification ITU-R M.1371.
 */

export interface DecodedAisMessage {
  type: number;
  mmsi: number;
  sog?: number;
  cog?: number;
  heading?: number;
  navStatus?: number;
  position?: GeoCoordinate;
  accuracy?: number;
  name?: string;
  callsign?: string;
  shipType?: number;
}

export class AisDecoder {
  /**
   * Désarme la charge utile ASCII 6-bits
   * 1. charCode - 48
   * 2. Si valeur > 40, soustraire 8
   * 3. Convertir en séquence de 6 bits binaires
   */
  public static unarmorPayload(payload: string): string {
    let bitString = '';
    for (let i = 0; i < payload.length; i++) {
      let val = payload.charCodeAt(i) - 48;
      if (val > 40) {
        val -= 8;
      }
      bitString += (val & 0x3f).toString(2).padStart(6, '0');
    }
    return bitString;
  }

  /**
   * Extraction d'un entier non signé à partir d'un segment de bits
   */
  public static extractUnsignedInt(bits: string, start: number, length: number): number {
    const slice = bits.substring(start, start + length);
    return parseInt(slice, 2) || 0;
  }

  /**
   * Extraction d'un entier signé (complément à deux)
   */
  public static extractSignedInt(bits: string, start: number, length: number): number {
    const slice = bits.substring(start, start + length);
    if (slice.charAt(0) === '1') {
      // Nombre négatif
      const inverted = slice
        .split('')
        .map((b) => (b === '0' ? '1' : '0'))
        .join('');
      return -(parseInt(inverted, 2) + 1);
    }
    return parseInt(slice, 2) || 0;
  }

  /**
   * Décode les chaînes de texte 6-bits AIS (ex: nom du navire, indicatif)
   */
  public static decodeAisString(bits: string, start: number, numChars: number): string {
    let str = '';
    for (let i = 0; i < numChars; i++) {
      const charBits = bits.substring(start + i * 6, start + (i + 1) * 6);
      let val = parseInt(charBits, 2);
      if (val < 32) {
        val += 64; // Remappe vers les lettres majuscules ASCII
      }
      const char = String.fromCharCode(val);
      if (char !== '@') str += char;
    }
    return str.trim();
  }

  /**
   * Valide la somme de contrôle XOR d'une phrase NMEA
   */
  public static validateChecksum(nmeaSentence: string): boolean {
    const starIndex = nmeaSentence.indexOf('*');
    if (starIndex === -1) return false;

    const sentence = nmeaSentence.substring(1, starIndex);
    const expectedChecksum = parseInt(nmeaSentence.substring(starIndex + 1, starIndex + 3), 16);

    let sum = 0;
    for (let i = 0; i < sentence.length; i++) {
      sum ^= sentence.charCodeAt(i);
    }
    return sum === expectedChecksum;
  }

  /**
   * Analyse une phrase AIVDM complète
   * Ex: !AIVDM,1,1,,B,15N43R0P00rCH<hN4OD000?v0000,0*12
   */
  public static parseSentence(nmeaSentence: string): DecodedAisMessage | null {
    const parts = nmeaSentence.trim().split(',');
    if (parts.length < 6) return null;

    const payload = parts[5];
    const bitstream = this.unarmorPayload(payload);
    if (bitstream.length < 38) return null;

    const messageType = this.extractUnsignedInt(bitstream, 0, 6);
    const mmsi = this.extractUnsignedInt(bitstream, 8, 30);

    // Messages de position classe A (Type 1, 2, 3)
    if (messageType === 1 || messageType === 2 || messageType === 3) {
      if (bitstream.length < 128) return null;

      const navStatus = this.extractUnsignedInt(bitstream, 38, 4);
      const rawSog = this.extractUnsignedInt(bitstream, 46, 10);
      const sog = rawSog === 1023 ? 0 : rawSog / 10.0; // Nœuds

      const rawLon = this.extractSignedInt(bitstream, 57, 28);
      const rawLat = this.extractSignedInt(bitstream, 85, 27);

      const longitude = rawLon / 600000.0;
      const latitude = rawLat / 600000.0;

      const rawCog = this.extractUnsignedInt(bitstream, 112, 12);
      const cog = rawCog === 3600 ? 0 : rawCog / 10.0; // Degrés

      const trueHeading = this.extractUnsignedInt(bitstream, 124, 9);

      return {
        type: messageType,
        mmsi,
        navStatus,
        sog,
        cog,
        heading: trueHeading !== 511 ? trueHeading : cog,
        position: { latitude, longitude },
      };
    }

    // Message 5 : Données statiques et de voyage
    if (messageType === 5) {
      if (bitstream.length < 420) return null;
      const callsign = this.decodeAisString(bitstream, 70, 7);
      const shipName = this.decodeAisString(bitstream, 112, 20);
      const shipType = this.extractUnsignedInt(bitstream, 232, 8);

      return {
        type: 5,
        mmsi,
        callsign,
        name: shipName,
        shipType,
      };
    }

    return { type: messageType, mmsi };
  }

  /**
   * Calcul trigonométrique du CPA (Closest Point of Approach)
   * et du TCPA (Time to CPA) entre le propre navire et une cible AIS.
   *
   * Formule vectorielle géodésique relative :
   * R_rel = P_target - P_own (en milles nautiques)
   * V_rel = V_target - V_own (en nœuds)
   * TCPA = - (R_rel . V_rel) / |V_rel|^2 (en heures)
   * CPA = |R_rel + V_rel * TCPA|
   */
  public static calculateCpaTcpa(
    own: VesselState,
    targetPos: GeoCoordinate,
    targetSog: number,
    targetCog: number
  ): { cpaNM: number; tcpaMinutes: number } {
    // Conversion coordonnées en milles nautiques cartésiens locaux (1 NM = 1852 mètres = 1 minute de latitude)
    const latRad = (own.position.latitude * Math.PI) / 180;
    const dy = (targetPos.latitude - own.position.latitude) * 60; // NM
    const dx = (targetPos.longitude - own.position.longitude) * 60 * Math.cos(latRad); // NM

    // Vecteur vitesse propre navire (nœuds)
    const ownCogRad = (own.cog * Math.PI) / 180;
    const ownVx = own.sog * Math.sin(ownCogRad);
    const ownVy = own.sog * Math.cos(ownCogRad);

    // Vecteur vitesse cible (nœuds)
    const targetCogRad = (targetCog * Math.PI) / 180;
    const targetVx = targetSog * Math.sin(targetCogRad);
    const targetVy = targetSog * Math.cos(targetCogRad);

    // Vitesse relative V_rel = V_target - V_own
    const dvx = targetVx - ownVx;
    const dvy = targetVy - ownVy;

    const dvSquared = dvx * dvx + dvy * dvy;

    // Si vitesse relative quasi nulle (trajectoires parallèles et vitesses identiques)
    if (dvSquared < 0.01) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      return { cpaNM: Math.round(distance * 100) / 100, tcpaMinutes: 0 };
    }

    // TCPA en heures : - (dx * dvx + dy * dvy) / dvSquared
    const tcpaHours = -(dx * dvx + dy * dvy) / dvSquared;
    const tcpaMinutes = Math.round(tcpaHours * 60 * 10) / 10;

    // Si le croisement est dans le passé
    if (tcpaHours < 0) {
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      return { cpaNM: Math.round(currentDistance * 100) / 100, tcpaMinutes: -1 };
    }

    // Position relative au moment du CPA
    const cpaX = dx + dvx * tcpaHours;
    const cpaY = dy + dvy * tcpaHours;
    const cpaNM = Math.sqrt(cpaX * cpaX + cpaY * cpaY);

    return {
      cpaNM: Math.round(cpaNM * 100) / 100,
      tcpaMinutes,
    };
  }
}
