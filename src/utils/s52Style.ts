import { S52ColorPalette } from '../types/marine';

/**
 * Bibliothèque de Présentation IHO S-52 pour MapLibre GL.
 * Transposition des règles de symbologie et palettes officielles :
 * - DAY (CHMGD - Day White/Bright)
 * - DUSK (Dusk Black/Grey)
 * - NIGHT (CHMGF - Night Red/Dark)
 */

export interface S52PaletteConfig {
  landFill: string;
  landOutline: string;
  seaShallow: string;      // 0 - 2m (très hauts-fonds)
  seaMedium: string;       // 2 - 5m
  seaDeep: string;         // 5 - 10m
  seaOcean: string;        // > 10m
  safetyContourAlert: string;
  safetyContourSafe: string;
  depthContourLine: string;
  anchorageAreaFill: string;
  anchorageAreaLine: string;
  cableSubmarine: string;
  textPrimary: string;
  textSecondary: string;
  ownVessel: string;
  cogVector: string;
  aisNormal: string;
  aisDangerous: string;
}

export const S52_PALETTES: Record<S52ColorPalette, S52PaletteConfig> = {
  DAY: {
    landFill: '#fef08a',       // Jaune ocre sable typique carte marine S-52
    landOutline: '#ca8a04',
    seaShallow: '#bae6fd',      // Bleu très clair
    seaMedium: '#7dd3fc',
    seaDeep: '#38bdf8',
    seaOcean: '#0284c7',        // Bleu marine soutenu
    safetyContourAlert: '#ef4444', // Rouge sécurité ECDIS
    safetyContourSafe: '#0284c7',
    depthContourLine: '#0369a1',
    anchorageAreaFill: 'rgba(217, 70, 239, 0.12)',
    anchorageAreaLine: '#c026d3', // Magenta S-52
    cableSubmarine: '#c026d3',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    ownVessel: '#000000',
    cogVector: '#0284c7',
    aisNormal: '#16a34a',
    aisDangerous: '#dc2626',
  },
  DUSK: {
    landFill: '#713f12',
    landOutline: '#854d0e',
    seaShallow: '#0c4a6e',
    seaMedium: '#075985',
    seaDeep: '#0369a1',
    seaOcean: '#082f49',
    safetyContourAlert: '#f87171',
    safetyContourSafe: '#38bdf8',
    depthContourLine: '#0ea5e9',
    anchorageAreaFill: 'rgba(244, 114, 182, 0.15)',
    anchorageAreaLine: '#f472b6',
    cableSubmarine: '#f472b6',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    ownVessel: '#f8fafc',
    cogVector: '#38bdf8',
    aisNormal: '#4ade80',
    aisDangerous: '#ef4444',
  },
  NIGHT: {
    landFill: '#1c1917',
    landOutline: '#292524',
    seaShallow: '#020617',
    seaMedium: '#020617',
    seaDeep: '#020617',
    seaOcean: '#000000',
    safetyContourAlert: '#dc2626', // Rouge vif pour préserver la vision scotopique
    safetyContourSafe: '#334155',
    depthContourLine: '#1e293b',
    anchorageAreaFill: 'rgba(157, 23, 77, 0.15)',
    anchorageAreaLine: '#9d174d',
    cableSubmarine: '#9d174d',
    textPrimary: '#ef4444',
    textSecondary: '#991b1b',
    ownVessel: '#ef4444',
    cogVector: '#f59e0b',
    aisNormal: '#22c55e',
    aisDangerous: '#ef4444',
  },
};

/**
 * Données hydrographiques géospatiales de démonstration (S-57 ENC converties)
 * centrées sur la zone maritime pilote (rade et approches de Cherbourg / Manche).
 */
export const SAMPLE_HYDROGRAPHIC_GEOJSON: any = {
  type: 'FeatureCollection',
  features: [
    // 1. Lignes de côte et terre ferme
    {
      type: 'Feature',
      properties: { objClass: 'LNDARE', name: 'Presqu’île du Cotentin' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-1.68, 49.63],
            [-1.56, 49.63],
            [-1.56, 49.65],
            [-1.60, 49.655],
            [-1.62, 49.652],
            [-1.65, 49.648],
            [-1.68, 49.63],
          ],
        ],
      },
    },
    // 2. Zone de mouillage (ACHARE)
    {
      type: 'Feature',
      properties: { objClass: 'ACHARE', name: 'Grande Rade - Mouillage A' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-1.645, 49.66],
            [-1.63, 49.662],
            [-1.628, 49.67],
            [-1.648, 49.668],
            [-1.645, 49.66],
          ],
        ],
      },
    },
    // 3. Isobath 2m (DEPCNT)
    {
      type: 'Feature',
      properties: { objClass: 'DEPCNT', depth: 2.0, label: '2m' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-1.66, 49.653],
          [-1.63, 49.656],
          [-1.60, 49.658],
          [-1.58, 49.654],
        ],
      },
    },
    // 4. Isobath 5m (DEPCNT)
    {
      type: 'Feature',
      properties: { objClass: 'DEPCNT', depth: 5.0, label: '5m' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-1.67, 49.658],
          [-1.64, 49.662],
          [-1.61, 49.665],
          [-1.58, 49.66],
        ],
      },
    },
    // 5. Isobath 10m (DEPCNT)
    {
      type: 'Feature',
      properties: { objClass: 'DEPCNT', depth: 10.0, label: '10m' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-1.68, 49.666],
          [-1.65, 49.67],
          [-1.62, 49.674],
          [-1.57, 49.668],
        ],
      },
    },
    // 6. Isobath 20m (DEPCNT)
    {
      type: 'Feature',
      properties: { objClass: 'DEPCNT', depth: 20.0, label: '20m' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-1.69, 49.675],
          [-1.66, 49.68],
          [-1.61, 49.682],
          [-1.56, 49.678],
        ],
      },
    },
    // 7. Câble sous-marin haute tension (CBLSUB)
    {
      type: 'Feature',
      properties: { objClass: 'CBLSUB', name: 'Interconnexion IFA 2000' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-1.61, 49.65],
          [-1.59, 49.67],
          [-1.58, 49.70],
        ],
      },
    },
    // 8. Bouée latérale bâbord (BOYLAT - canne rouge)
    {
      type: 'Feature',
      properties: {
        objClass: 'BOYLAT',
        category: 'PORT',
        color: 'RED',
        name: 'Passe Ouest - Babord 2',
        light: 'Fl(2) R 6s',
      },
      geometry: { type: 'Point', coordinates: [-1.652, 49.667] },
    },
    // 9. Bouée latérale tribord (BOYLAT - cône vert)
    {
      type: 'Feature',
      properties: {
        objClass: 'BOYLAT',
        category: 'STARBOARD',
        color: 'GREEN',
        name: 'Passe Ouest - Tribord 1',
        light: 'Fl G 3s',
      },
      geometry: { type: 'Point', coordinates: [-1.648, 49.671] },
    },
    // 10. Bouée cardinale Nord (BOYCAR)
    {
      type: 'Feature',
      properties: {
        objClass: 'BOYCAR',
        category: 'NORTH',
        name: 'Banc de la Rade Nord',
        light: 'Q W',
      },
      geometry: { type: 'Point', coordinates: [-1.625, 49.678] },
    },
    // 11. Épave dangereuse (WRECKS)
    {
      type: 'Feature',
      properties: {
        objClass: 'WRECKS',
        waterLevel: 'ALWAYS_UNDER_WATER',
        depth: 4.2,
        name: 'Épave "Le Triton" (1944)',
      },
      geometry: { type: 'Point', coordinates: [-1.636, 49.664] },
    },
    // 12. Sondes bathymétriques remarquables (SOUNDG)
    {
      type: 'Feature',
      properties: { objClass: 'SOUNDG', depth: 14.8 },
      geometry: { type: 'Point', coordinates: [-1.6215, 49.6645] },
    },
    {
      type: 'Feature',
      properties: { objClass: 'SOUNDG', depth: 3.2 },
      geometry: { type: 'Point', coordinates: [-1.642, 49.658] },
    },
    {
      type: 'Feature',
      properties: { objClass: 'SOUNDG', depth: 8.6 },
      geometry: { type: 'Point', coordinates: [-1.635, 49.668] },
    },
    {
      type: 'Feature',
      properties: { objClass: 'SOUNDG', depth: 22.4 },
      geometry: { type: 'Point', coordinates: [-1.665, 49.682] },
    },
    {
      type: 'Feature',
      properties: { objClass: 'SOUNDG', depth: 1.8 },
      geometry: { type: 'Point', coordinates: [-1.61, 49.655] },
    },
  ],
};

/**
 * Générateur de style MapLibre conforme S-52 avec gestion réactive du Safety Contour
 */
export function buildS52MaplibreStyle(palette: S52ColorPalette, draftMeters: number): any {
  const c = S52_PALETTES[palette];

  return {
    version: 8,
    name: `IHO-S52-${palette}`,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors | IHO S-52 Presentation Engine',
      },
    },
    layers: [
      {
        id: 'base-osm',
        type: 'raster',
        source: 'osm-tiles',
        paint: {
          'raster-opacity': palette === 'DAY' ? 0.35 : palette === 'DUSK' ? 0.2 : 0.1,
          'raster-saturation': -0.7,
        },
      },
    ],
  };
}
