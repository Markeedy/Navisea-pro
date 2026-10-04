import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useNavigationStore } from '../store/useNavigationStore';
import { SAMPLE_HYDROGRAPHIC_GEOJSON, S52_PALETTES, buildS52MaplibreStyle } from '../utils/s52Style';
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
} from 'lucide-react';

export const ChartPlotter: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ownVesselMarker = useRef<maplibregl.Marker | null>(null);
  const aisMarkersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

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
    setColorPalette,
    toggleLayer,
    setDraft,
    setAnchorWatch,
  } = useNavigationStore();

  const [zoomLevel, setZoomLevel] = useState(13);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
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
    </div>
  );
};
