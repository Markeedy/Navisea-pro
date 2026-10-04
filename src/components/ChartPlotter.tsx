import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useNavigationStore } from '../store/useNavigationStore';
import { SAMPLE_HYDROGRAPHIC_GEOJSON, S52_PALETTES, buildS52MaplibreStyle } from '../utils/s52Style';
import { NavigationCalculations, RouteCalculationResult } from '../utils/NavigationCalculations';
import { GeoCoordinate } from '../types/marine';
import {
  Compass,
  Layers,
  Moon,
  Sun,
  Sunset,
  Anchor,
  AlertTriangle,
  Navigation,
  Eye,
  Sliders,
  ShieldAlert,
  Route,
  ArrowRightLeft,
  XCircle,
  Crosshair,
  MapPin,
  Clock,
  Sparkles,
  LifeBuoy,
} from 'lucide-react';
import { MobRescueModal } from './MobRescueModal';

export const ChartPlotter: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ownVesselMarker = useRef<maplibregl.Marker | null>(null);
  const aisMarkersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const routeMarkerARef = useRef<maplibregl.Marker | null>(null);
  const routeMarkerBRef = useRef<maplibregl.Marker | null>(null);
  const mobMarkerRef = useRef<maplibregl.Marker | null>(null);

  const {
    vessel,
    colorPalette,
    showDepthSoundings,
    showBathymetry,
    showAisOverlay,
    showVectorCog,
    vectorTimeMinutes,
    aisTargets,
    cpaAlarmThresholdNM,
    activeCollisionAlert,
    mobIncident,
    setColorPalette,
    toggleLayer,
    setDraft,
    setAnchorWatch,
  } = useNavigationStore();

  const [zoomLevel, setZoomLevel] = useState(13);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Outil de calcul Orthodromique / Loxodromique
  const [isRouteToolActive, setIsRouteToolActive] = useState<boolean>(false);
  const [routeDisplayMode, setRouteDisplayMode] = useState<'BOTH' | 'ORTHODROMIQUE' | 'LOXODROMIQUE'>('BOTH');
  const [pointA, setPointA] = useState<GeoCoordinate | null>(null);
  const [pointB, setPointB] = useState<GeoCoordinate | null>(null);
  const [routeResult, setRouteResult] = useState<RouteCalculationResult | null>(null);

  const palette = useMemo(() => S52_PALETTES[colorPalette], [colorPalette]);

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialStyle = buildS52MaplibreStyle(colorPalette, vessel.draft);

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: [vessel.position.longitude, vessel.position.latitude],
      zoom: 13,
      maxZoom: 18,
      minZoom: 8,
      attributionControl: false,
    });

    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    m.on('zoom', () => {
      setZoomLevel(Math.round(m.getZoom() * 10) / 10);
    });

    m.on('load', () => {
      // 1. Ajout de la source GeoJSON hydrographique S-57
      m.addSource('hydro-s57', {
        type: 'geojson',
        data: SAMPLE_HYDROGRAPHIC_GEOJSON,
      });

      // 2. Zone de mouillage (ACHARE) - FillLayer
      m.addLayer({
        id: 'layer-achare-fill',
        type: 'fill',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'ACHARE'],
        paint: {
          'fill-color': palette.anchorageAreaFill,
          'fill-outline-color': palette.anchorageAreaLine,
        },
      });

      // 3. Contour de mouillage (ACHARE) - LineLayer pointillé
      m.addLayer({
        id: 'layer-achare-line',
        type: 'line',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'ACHARE'],
        paint: {
          'line-color': palette.anchorageAreaLine,
          'line-width': 1.8,
          'line-dasharray': [3, 2],
        },
      });

      // 4. Câble sous-marin haute tension (CBLSUB) - LineLayer
      m.addLayer({
        id: 'layer-cblsub',
        type: 'line',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'CBLSUB'],
        paint: {
          'line-color': palette.cableSubmarine,
          'line-width': 2.2,
          'line-dasharray': [4, 3],
        },
      });

      // 5. Isobathes S-52 (DEPCNT) avec coloration dynamique de l'isobathe de sécurité (Safety Contour)
      m.addLayer({
        id: 'layer-depcnt',
        type: 'line',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'DEPCNT'],
        paint: {
          'line-color': [
            'case',
            ['<=', ['get', 'depth'], vessel.draft],
            palette.safetyContourAlert, // ROUGE ALARME si profondeur <= tirant d'eau
            palette.safetyContourSafe,  // BLEU SÉCURISÉ si profondeur > tirant d'eau
          ],
          'line-width': [
            'case',
            ['<=', ['get', 'depth'], vessel.draft],
            3.5, // 0.6 mm ECDIS surligné pour le Safety Contour
            1.5,
          ],
        },
      });

      // 6. Étiquettes d'isobathes
      m.addLayer({
        id: 'layer-depcnt-labels',
        type: 'symbol',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'DEPCNT'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold'],
        },
        paint: {
          'text-color': palette.textSecondary,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      });

      // 7. Sondes bathymétriques remarquables (SOUNDG)
      m.addLayer({
        id: 'layer-soundg',
        type: 'symbol',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'SOUNDG'],
        layout: {
          'text-field': ['to-string', ['get', 'depth']],
          'text-size': 10,
          'text-font': ['Open Sans Regular'],
          'visibility': showDepthSoundings ? 'visible' : 'none',
        },
        paint: {
          'text-color': palette.textPrimary,
        },
      });

      // 8. Épaves sous-marines (WRECKS)
      m.addLayer({
        id: 'layer-wrecks',
        type: 'circle',
        source: 'hydro-s57',
        filter: ['==', ['get', 'objClass'], 'WRECKS'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#b45309',
        },
      });

      // 9. Source & Couche Orthodromique (Arc de Grand Cercle)
      m.addSource('route-ortho-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'layer-route-ortho',
        type: 'line',
        source: 'route-ortho-source',
        paint: {
          'line-color': '#06b6d4', // Cyan éclatant
          'line-width': 3.5,
        },
      });

      // 10. Source & Couche Loxodromique (Ligne de Rhumb Mercator)
      m.addSource('route-loxo-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'layer-route-loxo',
        type: 'line',
        source: 'route-loxo-source',
        paint: {
          'line-color': '#f59e0b', // Ambre / Orange pointillé
          'line-width': 2.5,
          'line-dasharray': [4, 2],
        },
      });

      // 11. Source & Couches Cercle de recherche MOB à rayon variable
      m.addSource('source-mob-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'layer-mob-circle-fill',
        type: 'fill',
        source: 'source-mob-circle',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.18,
        },
      });
      m.addLayer({
        id: 'layer-mob-circle-line',
        type: 'line',
        source: 'source-mob-circle',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });

      // 12. Vecteur de guidage vers le point MOB
      m.addSource('source-mob-vector', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'layer-mob-vector',
        type: 'line',
        source: 'source-mob-vector',
        paint: {
          'line-color': '#ef4444',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Mise à jour réactive du Safety Contour quand le tirant d'eau ou la palette change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer('layer-depcnt')) {
      map.current.setPaintProperty('layer-depcnt', 'line-color', [
        'case',
        ['<=', ['get', 'depth'], vessel.draft],
        palette.safetyContourAlert,
        palette.safetyContourSafe,
      ]);
      map.current.setPaintProperty('layer-depcnt', 'line-width', [
        'case',
        ['<=', ['get', 'depth'], vessel.draft],
        3.5,
        1.5,
      ]);
    }

    if (map.current.getLayer('layer-soundg')) {
      map.current.setLayoutProperty(
        'layer-soundg',
        'visibility',
        showDepthSoundings ? 'visible' : 'none'
      );
      map.current.setPaintProperty('layer-soundg', 'text-color', palette.textPrimary);
    }
  }, [vessel.draft, colorPalette, showDepthSoundings, palette]);

  // Mise à jour de la position du propre navire (Own Vessel Marker & COG Vector)
  useEffect(() => {
    if (!map.current) return;

    // Création ou déplacement du marqueur Own Vessel
    if (!ownVesselMarker.current) {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center cursor-pointer';
      el.innerHTML = `
        <div id="vessel-pulse" class="absolute w-10 h-10 rounded-full bg-cyan-500/20 animate-ping"></div>
        <div id="vessel-icon" class="relative w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/40">
          <svg class="w-4 h-4 text-cyan-300 transform" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 22,22 12,17 2,22" />
          </svg>
        </div>
      `;

      ownVesselMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([vessel.position.longitude, vessel.position.latitude])
        .addTo(map.current);
    } else {
      ownVesselMarker.current.setLngLat([vessel.position.longitude, vessel.position.latitude]);
      const icon = ownVesselMarker.current.getElement().querySelector('#vessel-icon svg') as HTMLElement | null;
      if (icon) {
        icon.style.transform = `rotate(${vessel.cog}deg)`;
      }
    }
  }, [vessel.position, vessel.cog]);

  // Mise à jour des cibles AIS sur la carte
  useEffect(() => {
    if (!map.current) return;

    if (!showAisOverlay) {
      // Masquer tous les marqueurs AIS
      aisMarkersRef.current.forEach((marker) => marker.remove());
      aisMarkersRef.current.clear();
      return;
    }

    const currentMmsis = new Set<number>();

    aisTargets.forEach((target, mmsi) => {
      currentMmsis.add(mmsi);
      const isDangerous = target.isDangerous;

      if (!aisMarkersRef.current.has(mmsi)) {
        const el = document.createElement('div');
        el.className = 'group relative flex flex-col items-center cursor-pointer';
        el.innerHTML = `
          <div class="relative w-6 h-6 rounded-sm ${
            isDangerous
              ? 'bg-red-600 border-2 border-white animate-bounce'
              : 'bg-emerald-600/90 border border-emerald-300'
          } flex items-center justify-center shadow-md">
            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${target.cog}deg)">
              <polygon points="12,3 20,21 12,17 4,21" />
            </svg>
          </div>
          <div class="hidden group-hover:flex absolute bottom-7 bg-slate-900/95 text-slate-100 text-[10px] px-2 py-1 rounded border border-slate-700 whitespace-nowrap shadow-xl flex-col z-50">
            <span class="font-bold text-cyan-400">${target.name || `MMSI: ${mmsi}`}</span>
            <span>SOG: ${target.sog} kn | COG: ${target.cog}°</span>
            <span>CPA: ${target.cpa} NM | TCPA: ${target.tcpa} min</span>
            ${isDangerous ? '<span class="text-red-400 font-black">RISQUE DE COLLISION</span>' : ''}
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([target.position.longitude, target.position.latitude])
          .addTo(map.current!);

        aisMarkersRef.current.set(mmsi, marker);
      } else {
        const marker = aisMarkersRef.current.get(mmsi)!;
        marker.setLngLat([target.position.longitude, target.position.latitude]);
      }
    });

    // Supprimer les cibles disparues
    aisMarkersRef.current.forEach((marker, mmsi) => {
      if (!currentMmsis.has(mmsi)) {
        marker.remove();
        aisMarkersRef.current.delete(mmsi);
      }
    });
  }, [aisTargets, showAisOverlay]);

  const handleRecenter = () => {
    if (!map.current) return;
    map.current.flyTo({
      center: [vessel.position.longitude, vessel.position.latitude],
      zoom: 13.5,
      speed: 1.2,
    });
  };

  // Formatage nautique DMM (Degrés et Minutes Décimales)
  const formatNauticalCoords = (coord: GeoCoordinate | null) => {
    if (!coord) return '--°--.---';
    const latDeg = Math.floor(Math.abs(coord.latitude));
    const latMin = ((Math.abs(coord.latitude) - latDeg) * 60).toFixed(3);
    const latDir = coord.latitude >= 0 ? 'N' : 'S';

    const lonDeg = Math.floor(Math.abs(coord.longitude));
    const lonMin = ((Math.abs(coord.longitude) - lonDeg) * 60).toFixed(3);
    const lonDir = coord.longitude >= 0 ? 'E' : 'W';

    return `${latDeg}°${latMin}' ${latDir}, ${lonDeg.toString().padStart(3, '0')}°${lonMin}' ${lonDir}`;
  };

  // Réinitialisation de la route
  const handleClearRoute = () => {
    if (routeMarkerARef.current) {
      routeMarkerARef.current.remove();
      routeMarkerARef.current = null;
    }
    if (routeMarkerBRef.current) {
      routeMarkerBRef.current.remove();
      routeMarkerBRef.current = null;
    }

    setPointA(null);
    setPointB(null);
    setRouteResult(null);

    if (map.current) {
      const orthoSrc = map.current.getSource('route-ortho-source') as maplibregl.GeoJSONSource | undefined;
      const loxoSrc = map.current.getSource('route-loxo-source') as maplibregl.GeoJSONSource | undefined;
      if (orthoSrc) orthoSrc.setData({ type: 'FeatureCollection', features: [] });
      if (loxoSrc) loxoSrc.setData({ type: 'FeatureCollection', features: [] });
    }
  };

  // Inverser Départ et Arrivée
  const handleSwapRoutePoints = () => {
    if (!pointA || !pointB) return;
    const tempA = { ...pointA };
    const tempB = { ...pointB };
    setPointA(tempB);
    setPointB(tempA);
    const res = NavigationCalculations.calculateRoute(tempB, tempA, vessel.sog);
    setRouteResult(res);
  };

  // Définir le Point A comme étant la position actuelle du navire
  const handleSetPointAFromVessel = () => {
    const shipPos = { ...vessel.position };
    setPointA(shipPos);
    if (pointB) {
      const res = NavigationCalculations.calculateRoute(shipPos, pointB, vessel.sog);
      setRouteResult(res);
    }
  };

  // Écouteur de clics pour l'outil de tracé de route
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!isRouteToolActive) return;

      const clicked: GeoCoordinate = {
        latitude: Math.round(e.lngLat.lat * 100000) / 100000,
        longitude: Math.round(e.lngLat.lng * 100000) / 100000,
      };

      if (!pointA) {
        setPointA(clicked);
      } else if (!pointB) {
        setPointB(clicked);
        const res = NavigationCalculations.calculateRoute(pointA, clicked, vessel.sog);
        setRouteResult(res);
      } else {
        // Redémarrer une nouvelle route avec ce point comme nouveau départ
        handleClearRoute();
        setPointA(clicked);
      }
    };

    m.on('click', handleMapClick);

    if (isRouteToolActive) {
      m.getCanvas().style.cursor = 'crosshair';
    } else {
      m.getCanvas().style.cursor = '';
    }

    return () => {
      m.off('click', handleMapClick);
      if (m.getCanvas()) {
        m.getCanvas().style.cursor = '';
      }
    };
  }, [isRouteToolActive, pointA, pointB, vessel.sog]);

  // Synchronisation des marqueurs A & B et des tracés cartographiques
  useEffect(() => {
    if (!map.current) return;

    // 1. Marqueur Point A
    if (pointA) {
      if (!routeMarkerARef.current) {
        const elA = document.createElement('div');
        elA.className = 'flex flex-col items-center cursor-pointer transform -translate-y-1/2';
        elA.innerHTML = `
          <div class="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full shadow-lg border border-white flex items-center gap-1">
            <span>A</span>
          </div>
          <div class="w-1.5 h-3 bg-emerald-600 rounded-b"></div>
        `;
        routeMarkerARef.current = new maplibregl.Marker({ element: elA })
          .setLngLat([pointA.longitude, pointA.latitude])
          .addTo(map.current);
      } else {
        routeMarkerARef.current.setLngLat([pointA.longitude, pointA.latitude]);
      }
    } else if (routeMarkerARef.current) {
      routeMarkerARef.current.remove();
      routeMarkerARef.current = null;
    }

    // 2. Marqueur Point B
    if (pointB) {
      if (!routeMarkerBRef.current) {
        const elB = document.createElement('div');
        elB.className = 'flex flex-col items-center cursor-pointer transform -translate-y-1/2';
        elB.innerHTML = `
          <div class="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-lg border border-white flex items-center gap-1">
            <span>B</span>
          </div>
          <div class="w-1.5 h-3 bg-rose-600 rounded-b"></div>
        `;
        routeMarkerBRef.current = new maplibregl.Marker({ element: elB })
          .setLngLat([pointB.longitude, pointB.latitude])
          .addTo(map.current);
      } else {
        routeMarkerBRef.current.setLngLat([pointB.longitude, pointB.latitude]);
      }
    } else if (routeMarkerBRef.current) {
      routeMarkerBRef.current.remove();
      routeMarkerBRef.current = null;
    }

    // 3. Mise à jour des tracés de lignes géodésiques
    if (routeResult) {
      const orthoSrc = map.current.getSource('route-ortho-source') as maplibregl.GeoJSONSource | undefined;
      const loxoSrc = map.current.getSource('route-loxo-source') as maplibregl.GeoJSONSource | undefined;

      if (orthoSrc) {
        orthoSrc.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeResult.orthoPoints.map((p) => [p.longitude, p.latitude]),
          },
        });
      }

      if (loxoSrc) {
        loxoSrc.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeResult.loxoPoints.map((p) => [p.longitude, p.latitude]),
          },
        });
      }

      // Visibilité des couches selon routeDisplayMode
      if (map.current.getLayer('layer-route-ortho')) {
        map.current.setLayoutProperty(
          'layer-route-ortho',
          'visibility',
          routeDisplayMode === 'BOTH' || routeDisplayMode === 'ORTHODROMIQUE' ? 'visible' : 'none'
        );
      }
      if (map.current.getLayer('layer-route-loxo')) {
        map.current.setLayoutProperty(
          'layer-route-loxo',
          'visibility',
          routeDisplayMode === 'BOTH' || routeDisplayMode === 'LOXODROMIQUE' ? 'visible' : 'none'
        );
      }
    }
  }, [pointA, pointB, routeResult, routeDisplayMode]);

  // Synchronisation cartographique du point MOB et du cercle de recherche variable
  useEffect(() => {
    if (!map.current) return;

    if (mobIncident && mobIncident.isActive) {
      // 1. Marqueur Homme à la Mer clignotant
      if (!mobMarkerRef.current) {
        const elMob = document.createElement('div');
        elMob.className = 'flex flex-col items-center cursor-pointer';
        elMob.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 rounded-full bg-red-600/40 animate-ping"></div>
            <div class="w-9 h-9 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-white shadow-2xl font-black text-xs">
              <svg class="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
                <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
                <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line>
                <line x1="4.93" y1="14.83" x2="9.17" y2="19.07"></line>
              </svg>
            </div>
          </div>
          <span class="mt-1 bg-red-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded shadow uppercase tracking-wider">
            MOB DATUM
          </span>
        `;
        mobMarkerRef.current = new maplibregl.Marker({ element: elMob })
          .setLngLat([mobIncident.position.longitude, mobIncident.position.latitude])
          .addTo(map.current);
      } else {
        mobMarkerRef.current.setLngLat([mobIncident.position.longitude, mobIncident.position.latitude]);
      }

      // 2. Polygone géodésique du cercle de recherche variable
      const circleCoords = NavigationCalculations.createGeodesicCircle(
        mobIncident.position,
        mobIncident.searchRadiusMeters,
        64
      );

      const circleSrc = map.current.getSource('source-mob-circle') as maplibregl.GeoJSONSource | undefined;
      if (circleSrc) {
        circleSrc.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords],
          },
        });
      }

      // 3. Vecteur de ralliement direct navire -> MOB
      const vectorSrc = map.current.getSource('source-mob-vector') as maplibregl.GeoJSONSource | undefined;
      if (vectorSrc) {
        vectorSrc.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [vessel.position.longitude, vessel.position.latitude],
              [mobIncident.position.longitude, mobIncident.position.latitude],
            ],
          },
        });
      }
    } else {
      // Nettoyage si MOB inactif
      if (mobMarkerRef.current) {
        mobMarkerRef.current.remove();
        mobMarkerRef.current = null;
      }
      const circleSrc = map.current?.getSource('source-mob-circle') as maplibregl.GeoJSONSource | undefined;
      if (circleSrc) circleSrc.setData({ type: 'FeatureCollection', features: [] });

      const vectorSrc = map.current?.getSource('source-mob-vector') as maplibregl.GeoJSONSource | undefined;
      if (vectorSrc) vectorSrc.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [mobIncident, vessel.position]);

  const handleCenterOnMob = () => {
    if (!map.current || !mobIncident) return;
    map.current.flyTo({
      center: [mobIncident.position.longitude, mobIncident.position.latitude],
      zoom: 15.5,
      speed: 1.2,
    });
  };

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Alarme Visuelle & Sonore MOB */}
      <MobRescueModal onCenterOnMob={handleCenterOnMob} />

      {/* Conteneur MapLibre GL */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Alerte anticollision prioritaire (COLREGs CPA / TCPA) */}
      {activeCollisionAlert && (
        <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 bg-red-950/95 border-2 border-red-500 rounded-lg p-3 text-red-100 shadow-2xl flex items-start gap-3 animate-pulse z-40 backdrop-blur-md">
          <ShieldAlert className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold uppercase tracking-wider text-red-200 flex items-center justify-between">
              <span>Alerte Abordage Critique</span>
              <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-black">
                CPA: {activeCollisionAlert.cpa} NM
              </span>
            </div>
            <p className="mt-1 text-slate-300">
              Cible AIS : <span className="font-semibold text-white">{activeCollisionAlert.name || activeCollisionAlert.mmsi}</span>
            </p>
            <p className="text-slate-300">
              TCPA estimé : <span className="font-bold text-red-300">{activeCollisionAlert.tcpa} minutes</span> (SOG: {activeCollisionAlert.sog} kn, COG: {activeCollisionAlert.cog}°)
            </p>
          </div>
        </div>
      )}

      {/* Alarme dérapage du mouillage (Anchor Watch) */}
      {vessel.anchorWatch.isActive && (
        <div className={`absolute top-4 ${activeCollisionAlert ? 'top-28' : ''} left-4 bg-slate-900/90 border ${vessel.anchorWatch.isDrifting ? 'border-amber-500 bg-amber-950/80 text-amber-200' : 'border-cyan-500/50 text-cyan-200'} rounded-lg p-2.5 text-xs shadow-xl backdrop-blur-md z-30 flex items-center gap-2.5`}>
          <Anchor className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="font-semibold flex items-center gap-2">
              <span>Veille Mouillage Active</span>
              <span className="text-[10px] bg-cyan-950 border border-cyan-800 px-1.5 py-0.2 rounded text-cyan-300">
                Garde: {vessel.anchorWatch.radiusMeters}m
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Évitage actuel : <span className="font-bold text-white">{vessel.anchorWatch.driftDistance}m</span>
              {vessel.anchorWatch.isDrifting && <span className="ml-1 text-amber-400 font-bold">⚠️ DÉRAPAGE DÉTECTÉ</span>}
            </div>
          </div>
        </div>
      )}

      {/* HUD de Navigation Supérieur : Instruments de bord */}
      <div className="absolute top-4 right-14 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-4 text-slate-100 z-30">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">SOG (Fond)</span>
          <span className="text-lg font-black text-cyan-400 font-mono leading-none">
            {vessel.sog.toFixed(1)} <span className="text-xs font-normal text-slate-400">kn</span>
          </span>
        </div>
        <div className="w-px h-7 bg-slate-700" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">COG (Route)</span>
          <span className="text-lg font-black text-cyan-400 font-mono leading-none">
            {Math.round(vessel.cog).toString().padStart(3, '0')}°
          </span>
        </div>
        <div className="w-px h-7 bg-slate-700" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Sonde (Quille)</span>
          <span className={`text-lg font-black font-mono leading-none ${vessel.depthBelowKeel <= vessel.draft ? 'text-red-400' : 'text-emerald-400'}`}>
            {vessel.depthBelowKeel.toFixed(1)} <span className="text-xs font-normal text-slate-400">m</span>
          </span>
        </div>
        <div className="w-px h-7 bg-slate-700" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Tirant d'eau</span>
          <span className="text-lg font-black text-amber-400 font-mono leading-none">
            {vessel.draft.toFixed(1)} <span className="text-xs font-normal text-slate-400">m</span>
          </span>
        </div>
      </div>

      {/* Barre d'outils et commandes rapides en bas */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 z-30 pointer-events-none">
        {/* Statut EKF et Position GPS */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-lg px-3 py-1.5 text-xs text-slate-300 flex items-center gap-3 shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${vessel.isKalmanActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              EKF {vessel.isKalmanActive ? 'ON' : 'OFF'} (±{vessel.accuracy}m)
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-[11px] text-cyan-300">
            {vessel.position.latitude.toFixed(4)}°N, {Math.abs(vessel.position.longitude).toFixed(4)}°W
          </span>
        </div>

        {/* Contrôles tactiques & S-52 */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-lg shadow-xl">
          {/* Recentrer */}
          <button
            onClick={handleRecenter}
            title="Recentrer sur mon navire"
            className="p-2 hover:bg-slate-800 text-cyan-400 rounded-md transition-colors"
          >
            <Navigation className="w-4 h-4" />
          </button>

          {/* Sélecteur de palette S-52 */}
          <div className="flex items-center bg-slate-950 rounded-md p-0.5 border border-slate-800">
            <button
              onClick={() => setColorPalette('DAY')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 ${colorPalette === 'DAY' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="IHO S-52 Palette Jour (CHMGD)"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setColorPalette('DUSK')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 ${colorPalette === 'DUSK' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="IHO S-52 Palette Crépuscule"
            >
              <Sunset className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setColorPalette('NIGHT')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 ${colorPalette === 'NIGHT' ? 'bg-red-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="IHO S-52 Palette Nuit (CHMGF)"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggles couches */}
          <button
            onClick={() => toggleLayer('soundings')}
            className={`px-2 py-1 rounded text-[11px] font-medium border ${showDepthSoundings ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'border-slate-700 text-slate-400'}`}
            title="Afficher/masquer les sondes bathymétriques"
          >
            Sondes
          </button>

          <button
            onClick={() => toggleLayer('ais')}
            className={`px-2 py-1 rounded text-[11px] font-medium border ${showAisOverlay ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-400'}`}
            title="Afficher/masquer le trafic AIS"
          >
            AIS ({aisTargets.size})
          </button>

          {/* Bouton Outil Calcul de Route Orthodromique / Loxodromique */}
          <button
            onClick={() => {
              const next = !isRouteToolActive;
              setIsRouteToolActive(next);
              if (!next) handleClearRoute();
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              isRouteToolActive
                ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-600/40 animate-pulse'
                : 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Activer l'outil de calcul de route orthodromique et loxodromique entre deux points cliqués"
          >
            <Route className="w-3.5 h-3.5 text-cyan-300" />
            <span>Route Ortho/Loxo</span>
          </button>

          {/* Bouton réglages tirant d'eau / Safety Contour */}
          <button
            onClick={() => setShowSettingsModal(!showSettingsModal)}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-md transition-colors border border-slate-700"
            title="Paramètres de sécurité S-52 et mouillage"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Paramètres S-52 Safety Contour & Mouillage */}
      {showSettingsModal && (
        <div className="absolute bottom-16 right-4 w-80 bg-slate-900/95 border border-slate-700 rounded-xl p-4 shadow-2xl backdrop-blur-md z-40 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Réglages de Sécurité IHO S-52
            </span>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Curseur Tirant d'Eau (Safety Contour dynamique) */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-slate-300">
              <span>Tirant d'eau (Draft)</span>
              <span className="font-bold text-amber-400 font-mono">{vessel.draft.toFixed(1)} m</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="6.0"
              step="0.1"
              value={vessel.draft}
              onChange={(e) => setDraft(parseFloat(e.target.value))}
              className="w-full mt-1 accent-amber-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tout contour de profondeur ≤ {vessel.draft.toFixed(1)}m bascule immédiatement en
              <span className="text-red-400 font-bold"> rouge alarme (Safety Contour)</span>.
            </p>
          </div>

          {/* Toggle Anchor Watch */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-cyan-400" />
                Veille de Mouillage
              </span>
              <button
                onClick={() => setAnchorWatch(!vessel.anchorWatch.isActive, 45)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold ${vessel.anchorWatch.isActive ? 'bg-red-600 text-white' : 'bg-cyan-600 text-white'}`}
              >
                {vessel.anchorWatch.isActive ? 'Désarmer' : 'Armer (45m)'}
              </button>
            </div>
            {vessel.anchorWatch.isActive && (
              <p className="text-[10px] text-cyan-300 mt-1">
                Surveillance de dérapage active. Alarme automatique au-delà de 45 mètres.
              </p>
            )}
          </div>
        </div>
      )}

      {/* PANNEAU FLOTTANT : CALCULATEUR DE ROUTE ORTHODROMIQUE & LOXODROMIQUE */}
      {isRouteToolActive && (
        <div className="absolute top-16 left-4 right-4 md:right-auto md:w-[420px] bg-slate-900/95 border border-cyan-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-md z-40 text-xs space-y-3 animate-fade-in">
          {/* En-tête de l'outil */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-100 uppercase tracking-wide">
                Calculateur de Route Ortho / Loxo
              </span>
            </div>
            <button
              onClick={() => {
                setIsRouteToolActive(false);
                handleClearRoute();
              }}
              className="text-slate-400 hover:text-white p-1"
              title="Fermer et effacer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Guide d'utilisation étape par étape */}
          {!pointA ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cliquez sur la carte pour définir le <b>Point de Départ (A)</b>.</span>
              </p>
              <button
                onClick={handleSetPointAFromVessel}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                Définir Départ = Position Actuelle de mon Navire
              </button>
            </div>
          ) : !pointB ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-2">
              <div className="text-[11px] flex items-center justify-between text-slate-300">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Point A (Départ) :
                </span>
                <span className="font-mono text-white">{formatNauticalCoords(pointA)}</span>
              </div>
              <p className="text-[11px] text-cyan-300 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                <Crosshair className="w-3.5 h-3.5 text-rose-400" />
                <span>Cliquez sur la carte pour définir le <b>Point d'Arrivée (B)</b>.</span>
              </p>
            </div>
          ) : routeResult && (
            <div className="space-y-3">
              {/* Sélecteur de mode d'affichage des tracés */}
              <div className="flex items-center justify-between gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setRouteDisplayMode('BOTH')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${
                    routeDisplayMode === 'BOTH'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Comparaison (Les 2)
                </button>
                <button
                  onClick={() => setRouteDisplayMode('ORTHODROMIQUE')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${
                    routeDisplayMode === 'ORTHODROMIQUE'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Orthodromie
                </button>
                <button
                  onClick={() => setRouteDisplayMode('LOXODROMIQUE')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${
                    routeDisplayMode === 'LOXODROMIQUE'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Loxodromie
                </button>
              </div>

              {/* Tableau comparatif des métriques Ortho vs Loxo */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Carte Orthodromie (Grand Cercle) */}
                <div className="bg-slate-950 border border-cyan-500/40 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-cyan-400">
                    <span>Orthodromie</span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <div>
                    <span className="text-base font-black font-mono text-white">
                      {routeResult.orthoDistanceNM}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">NM</span>
                    <span className="text-[10px] text-slate-500 block">({routeResult.orthoDistanceKm} km)</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono pt-1 border-t border-slate-900">
                    <div>Cap Init (Ti) : <b className="text-cyan-300">{routeResult.initialBearingDeg}°</b></div>
                    <div>Cap Final (Tf) : <b className="text-cyan-300">{routeResult.finalBearingDeg}°</b></div>
                  </div>
                </div>

                {/* Carte Loxodromie (Ligne de Rhumb) */}
                <div className="bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-400">
                    <span>Loxodromie</span>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <div>
                    <span className="text-base font-black font-mono text-white">
                      {routeResult.loxoDistanceNM}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">NM</span>
                    <span className="text-[10px] text-slate-500 block">({routeResult.loxoDistanceKm} km)</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono pt-1 border-t border-slate-900">
                    <div>Cap Constant (Tc) : <b className="text-amber-300">{routeResult.constantBearingDeg}°</b></div>
                    <div className="text-slate-500 text-[9px]">Ligne droite Mercator</div>
                  </div>
                </div>
              </div>

              {/* Différentiel et ETA */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Gain Orthodromique :
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {routeResult.distanceGainNM > 0 ? `-${routeResult.distanceGainNM} NM (-${routeResult.gainPercent}%)` : 'Quasi identique (< 0.05 NM)'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900 pt-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> Temps de route estimé (ETA) :
                  </span>
                  <span className="font-mono font-bold text-indigo-300">
                    {routeResult.estimatedTimeHours} h (à {vessel.sog} kn)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 text-right">
                  Arrivée prévue : {routeResult.etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Coordonnées détaillées */}
              <div className="text-[10px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-900 space-y-0.5">
                <div>A : <span className="text-slate-200">{formatNauticalCoords(pointA)}</span></div>
                <div>B : <span className="text-slate-200">{formatNauticalCoords(pointB)}</span></div>
              </div>

              {/* Actions rapides */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={handleSwapRoutePoints}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                  Inverser A ↔ B
                </button>
                <button
                  onClick={handleClearRoute}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded font-semibold text-[11px] transition-colors"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
