import React, { useState, useRef } from 'react';
import { useNavigationStore } from '../store/useNavigationStore';
import { LogbookCategory, LogbookEntry, FishCatchRecord } from '../types/marine';
import { LogbookTrendChart } from './LogbookTrendChart';
import {
  BookOpen,
  PlusCircle,
  Download,
  Trash2,
  Compass,
  Wind,
  Waves,
  Gauge,
  Fish,
  Anchor,
  Shield,
  Wrench,
  Navigation,
  CloudSun,
  Search,
  CheckCircle,
  FileSpreadsheet,
  MapPin,
  Clock,
  User,
  Archive,
  Upload,
  FolderArchive,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react';

export const LogbookManager: React.FC = () => {
  const {
    vessel,
    cachedWeather,
    logbookEntries,
    addLogbookEntry,
    deleteLogbookEntry,
    importLogbookEntries,
  } = useNavigationStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LogbookCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // État du Centre d'Archivage et d'Exportation des Croisières
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<'GPX' | 'CSV' | 'JSON'>('GPX');
  const [cruiseName, setCruiseName] = useState('Croisière Manche & Anglo-Normandes 2026');
  const [skipperName, setSkipperName] = useState('Capitaine Dubois');
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [includeTrackInGpx, setIncludeTrackInGpx] = useState(true);
  const [includeWaypointsInGpx, setIncludeWaypointsInGpx] = useState(true);
  const [exportCategoryFilter, setExportCategoryFilter] = useState<LogbookCategory | 'ALL'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Champs du formulaire
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<LogbookCategory>('NAVIGATION');
  const [crewMember, setCrewMember] = useState('Capitaine Dubois');
  const [engineHours, setEngineHours] = useState<number>(142.8);

  // Champs spécifiques Pêche
  const [fishSpecies, setFishSpecies] = useState('');
  const [fishQty, setFishQty] = useState(1);
  const [fishWeight, setFishWeight] = useState<number | undefined>(undefined);
  const [fishLure, setFishLure] = useState('');

  // Conversion WGS84 décimal -> Degrés & Minutes Décimales nautiques (DMM)
  const formatNauticalCoords = (lat: number, lon: number): string => {
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(3);
    const latDir = lat >= 0 ? 'N' : 'S';

    const lonDeg = Math.floor(Math.abs(lon));
    const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(3);
    const lonDir = lon >= 0 ? 'E' : 'W';

    return `${latDeg}°${latMin}' ${latDir} - ${lonDeg.toString().padStart(3, '0')}°${lonMin}' ${lonDir}`;
  };

  // Soumission d'une nouvelle entrée
  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Conditions météo actuelles du store ou valeurs par défaut
    const weatherSummary = {
      windSpeedKnots: cachedWeather?.windSpeed10m[0] ?? 17,
      windDirectionDeg: cachedWeather?.windDirection10m[0] ?? 260,
      waveHeightMeters: cachedWeather?.waveHeight[0] ?? 1.6,
      surfacePressureHpa: cachedWeather?.surfacePressure[0] ?? 1018,
      seaSurfaceTemp: cachedWeather?.seaSurfaceTemperature[0] ?? 15.2,
    };

    const catches: FishCatchRecord[] = [];
    if (category === 'FISHING' && fishSpecies.trim()) {
      catches.push({
        species: fishSpecies.trim(),
        quantity: fishQty,
        weightKg: fishWeight,
        lureUsed: fishLure.trim() || undefined,
      });
    }

    addLogbookEntry({
      position: { ...vessel.position },
      sog: vessel.sog,
      cog: vessel.cog,
      depthBelowKeel: vessel.depthBelowKeel,
      weatherSummary,
      category,
      title: title.trim(),
      notes: notes.trim(),
      crewMember: crewMember.trim() || undefined,
      engineHours: engineHours || undefined,
      fishCatches: catches.length > 0 ? catches : undefined,
    });

    // Réinitialisation formulaire
    setTitle('');
    setNotes('');
    setFishSpecies('');
    setFishQty(1);
    setFishWeight(undefined);
    setFishLure('');
    setIsFormOpen(false);

    setSuccessToast('Entrée consignée avec succès dans le journal de bord officiel');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Saisie rapide instantanée (1-clic)
  const handleInstantSnapshot = (cat: LogbookCategory = 'NAVIGATION') => {
    const weatherSummary = {
      windSpeedKnots: cachedWeather?.windSpeed10m[0] ?? 17,
      windDirectionDeg: cachedWeather?.windDirection10m[0] ?? 260,
      waveHeightMeters: cachedWeather?.waveHeight[0] ?? 1.6,
      surfacePressureHpa: cachedWeather?.surfacePressure[0] ?? 1018,
      seaSurfaceTemp: cachedWeather?.seaSurfaceTemperature[0] ?? 15.2,
    };

    const autoTitle =
      cat === 'ANCHOR'
        ? `Vérification du Mouillage - Rayon ${vessel.anchorWatch.radiusMeters}m`
        : cat === 'WEATHER'
        ? `Relevé Barométrique & Météo (${weatherSummary.surfacePressureHpa} hPa)`
        : `Point de Route - SOG ${vessel.sog.toFixed(1)} kn, COG ${Math.round(vessel.cog)}°`;

    addLogbookEntry({
      position: { ...vessel.position },
      sog: vessel.sog,
      cog: vessel.cog,
      depthBelowKeel: vessel.depthBelowKeel,
      weatherSummary,
      category: cat,
      title: autoTitle,
      notes: `Relevé télémétrique automatique horodaté. Sonde sous quille : ${vessel.depthBelowKeel.toFixed(1)}m. Dérive du mouillage : ${vessel.anchorWatch.driftDistance}m.`,
      crewMember: 'Officier de Quart',
    });

    setSuccessToast(`Point rapide consigné (${cat})`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // EXPORTATION CSV ENCODÉ EN UTF-8 AVEC BOM POUR EXCEL & TABLEURS
  const handleExportCsv = (
    entriesToExport = logbookEntries,
    delimiter = csvDelimiter,
    customFilename?: string
  ) => {
    const filtered =
      exportCategoryFilter === 'ALL'
        ? entriesToExport
        : entriesToExport.filter((e) => e.category === exportCategoryFilter);

    const headers = [
      'ID',
      'Date Heure UTC (ISO)',
      'Date Heure Locale',
      'Latitude WGS84',
      'Longitude WGS84',
      'Coordonnees Nautiques (DMM)',
      'Vitesse Fond SOG (kn)',
      'Route Fond COG (deg)',
      'Sonde Quille (m)',
      'Vent Vitesse (kn)',
      'Vent Direction (deg)',
      'Hauteur Vagues (m)',
      'Pression Mer (hPa)',
      'Temperature Eau (C)',
      'Categorie Observation',
      'Titre Evenement',
      'Observations & Remarques',
      'Captures Halieutiques',
      'Officier de Quart',
      'Horametre Moteur (h)',
    ];

    const rows = filtered.map((e) => {
      const catchesSummary = e.fishCatches
        ? e.fishCatches
            .map((c) => `${c.quantity}x ${c.species}${c.weightKg ? ` (${c.weightKg}kg)` : ''}${c.lureUsed ? ` [${c.lureUsed}]` : ''}`)
            .join(' | ')
        : '';

      return [
        e.id,
        e.isoDate,
        new Date(e.timestamp).toLocaleString('fr-FR'),
        e.position.latitude.toFixed(6),
        e.position.longitude.toFixed(6),
        `"${formatNauticalCoords(e.position.latitude, e.position.longitude)}"`,
        e.sog.toFixed(1),
        Math.round(e.cog),
        e.depthBelowKeel.toFixed(1),
        e.weatherSummary.windSpeedKnots,
        e.weatherSummary.windDirectionDeg,
        e.weatherSummary.waveHeightMeters.toFixed(1),
        e.weatherSummary.surfacePressureHpa,
        e.weatherSummary.seaSurfaceTemp ?? '',
        e.category,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.notes.replace(/"/g, '""')}"`,
        `"${catchesSummary.replace(/"/g, '""')}"`,
        `"${e.crewMember ?? ''}"`,
        e.engineHours ?? '',
      ].join(delimiter);
    });

    // Insertion du BOM UTF-8 (\uFEFF) pour compatibilité Microsoft Excel universelle
    const csvContent = '\uFEFF' + headers.join(delimiter) + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (customFilename || cruiseName || 'Livre_de_Bord').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `${safeName}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessToast(`Export CSV réussi (${filtered.length} entrées exportées)`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // EXPORTATION GPX 1.1 MARITIME ÉTENDUE (Garmin, Furuno, Raymarine, Navionics, OpenCPN)
  const handleExportGpx = (
    entriesToExport = logbookEntries,
    customFilename?: string
  ) => {
    const filtered =
      exportCategoryFilter === 'ALL'
        ? entriesToExport
        : entriesToExport.filter((e) => e.category === exportCategoryFilter);

    // Tri chronologique ascendant pour le tracé de route
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    // 1. Waypoints individuels avec symboles maritimes
    const waypointsXml = includeWaypointsInGpx
      ? sorted
          .map((e) => {
            const sym =
              e.category === 'FISHING'
                ? 'Fish Symbol'
                : e.category === 'ANCHOR'
                ? 'Anchor'
                : e.category === 'WEATHER'
                ? 'Atmospheric'
                : e.category === 'ENGINE'
                ? 'Wrench'
                : e.category === 'SECURITY'
                ? 'Danger Area'
                : 'Flag, Blue';

            const catchesStr = e.fishCatches
              ? ' | Prises: ' + e.fishCatches.map((c) => `${c.quantity}x ${c.species}`).join(', ')
              : '';

            const desc = `Cat: ${e.category} | SOG: ${e.sog} kn | COG: ${e.cog}° | Sonde: ${e.depthBelowKeel}m | Vent: ${e.weatherSummary.windSpeedKnots}kn (${e.weatherSummary.windDirectionDeg}°) | Pression: ${e.weatherSummary.surfacePressureHpa} hPa${catchesStr} | Notes: ${e.notes}`.replace(/[<&>]/g, ' ');

            return `  <wpt lat="${e.position.latitude.toFixed(6)}" lon="${e.position.longitude.toFixed(6)}">
    <time>${e.isoDate}</time>
    <name>${e.title.replace(/[<&>]/g, ' ')}</name>
    <desc>${desc}</desc>
    <sym>${sym}</sym>
    <type>${e.category}</type>
  </wpt>`;
          })
          .join('\n')
      : '';

    // 2. Route maritime séquentielle
    const routeXml = `  <rte>
    <name>${cruiseName.replace(/[<&>]/g, ' ')} - Route Planifiée</name>
    <desc>Navigation officielle du navire ${vessel.name}</desc>
${sorted
  .map(
    (e) => `    <rtept lat="${e.position.latitude.toFixed(6)}" lon="${e.position.longitude.toFixed(6)}">
      <time>${e.isoDate}</time>
      <name>${e.title.replace(/[<&>]/g, ' ')}</name>
    </rtept>`
  )
  .join('\n')}
  </rte>`;

    // 3. Trace continue (Track) avec vitesses et caps cinématiques
    const trackXml = includeTrackInGpx
      ? `  <trk>
    <name>${cruiseName.replace(/[<&>]/g, ' ')} - Trace de Navigation</name>
    <trkseg>
${sorted
  .map((e) => {
    const speedMs = (e.sog * 0.514444).toFixed(2);
    return `      <trkpt lat="${e.position.latitude.toFixed(6)}" lon="${e.position.longitude.toFixed(6)}">
        <ele>${-e.depthBelowKeel}</ele>
        <time>${e.isoDate}</time>
        <course>${Math.round(e.cog)}</course>
        <speed>${speedMs}</speed>
      </trkpt>`;
  })
  .join('\n')}
    </trkseg>
  </trk>`
      : '';

    const gpxDocument = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" 
     creator="NaviSea Pro Marine Navigation System - ECDIS S-52"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${cruiseName.replace(/[<&>]/g, ' ')}</name>
    <desc>Journal de bord du navire ${vessel.name} (${vessel.id}) - Skipper: ${skipperName}</desc>
    <author>
      <name>${skipperName.replace(/[<&>]/g, ' ')}</name>
    </author>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypointsXml}
${routeXml}
${trackXml}
</gpx>`;

    const blob = new Blob([gpxDocument], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (customFilename || cruiseName || 'Livre_de_Bord').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `${safeName}_${new Date().toISOString().substring(0, 10)}.gpx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessToast(`Export GPX 1.1 réussi (${filtered.length} points de trace & waypoints générés)`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // EXPORTATION JSON (ARCHIVE NUMÉRIQUE INTÉGRALE)
  const handleExportJson = (customFilename?: string) => {
    const archivePayload = {
      archiveVersion: '2.4.0',
      archiveType: 'NAVISEA_LOGBOOK_CRUISE_BACKUP',
      exportedAt: new Date().toISOString(),
      cruiseMetadata: {
        cruiseName,
        skipperName,
        vesselId: vessel.id,
        vesselName: vessel.name,
        vesselDraft: vessel.draft,
      },
      totalEntries: logbookEntries.length,
      entries: logbookEntries,
    };

    const jsonString = JSON.stringify(archivePayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (customFilename || cruiseName || 'Archive_Croisiere').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `${safeName}_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessToast(`Archive JSON intégrale exportée avec succès`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // RESTAURATION / IMPORTATION D'UNE ARCHIVE JSON
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let importedList: LogbookEntry[] = [];
        if (Array.isArray(parsed)) {
          importedList = parsed;
        } else if (parsed.entries && Array.isArray(parsed.entries)) {
          importedList = parsed.entries;
        }

        if (importedList.length > 0) {
          importLogbookEntries(importedList);
          setSuccessToast(`${importedList.length} entrées de croisière importées et fusionnées avec succès !`);
          setTimeout(() => setSuccessToast(null), 4000);
          setIsArchiveModalOpen(false);
        } else {
          alert("Le fichier JSON ne contient pas d'entrées de journal de bord valides.");
        }
      } catch (err) {
        alert("Erreur lors de la lecture de l'archive JSON : " + String(err));
      }
    };
    reader.readAsText(file);
    // Réinitialisation du champ
    e.target.value = '';
  };

  // Filtrage des entrées
  const filteredEntries = logbookEntries.filter((entry) => {
    const matchCategory = selectedCategory === 'ALL' || entry.category === selectedCategory;
    const matchSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.crewMember && entry.crewMember.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // Badge de catégorie
  const renderCategoryBadge = (cat: LogbookCategory) => {
    switch (cat) {
      case 'NAVIGATION':
        return (
          <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <Navigation className="w-3 h-3 text-cyan-400" /> Navigation
          </span>
        );
      case 'WEATHER':
        return (
          <span className="bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <CloudSun className="w-3 h-3 text-sky-400" /> Météo
          </span>
        );
      case 'FISHING':
        return (
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <Fish className="w-3 h-3 text-emerald-400" /> Pêche
          </span>
        );
      case 'ENGINE':
        return (
          <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <Wrench className="w-3 h-3 text-amber-400" /> Mécanique
          </span>
        );
      case 'ANCHOR':
        return (
          <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <Anchor className="w-3 h-3 text-indigo-400" /> Mouillage
          </span>
        );
      case 'SECURITY':
        return (
          <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <Shield className="w-3 h-3 text-rose-400" /> Sécurité
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-6">
      {/* Toast de succès */}
      {successToast && (
        <div className="bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xl animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* En-tête & Statistiques */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              Journal de Bord Maritime (Logbook)
            </h2>
            <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
              {logbookEntries.length} Entrées Conformes
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registre officiel horodaté : capture GNSS, bathymétrie, météo marine et observations de quart
          </p>
        </div>

        {/* Actions principales */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Boutons Instant Snapshot */}
          <button
            onClick={() => handleInstantSnapshot('NAVIGATION')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Consigner instantanément la position actuelle et les paramètres météo"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Point Rapide
          </button>

          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Nouvelle Observation
          </button>

          {/* Bouton d'ouverture du Centre d'Archivage Avancé */}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-950/40"
            title="Ouvrir le centre d'archivage externe des croisières (GPX 1.1, CSV Excel, JSON)"
          >
            <FolderArchive className="w-4 h-4 text-indigo-400" />
            Archivage Croisière
          </button>

          {/* Exportations Rapides 1-clic */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => handleExportCsv()}
              className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 rounded font-semibold flex items-center gap-1 transition-colors"
              title="Exporter sous format tableau CSV (Excel UTF-8 BOM) pour audit maritime"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>
            <button
              onClick={() => handleExportGpx()}
              className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 rounded font-semibold flex items-center gap-1 transition-colors"
              title="Exporter au format GPX 1.1 pour traceurs Garmin, Furuno, Navionics, Raymarine"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              GPX
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DU CENTRE D'ARCHIVAGE EXTERNE DES CROISIÈRES */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 text-xs text-slate-200">
            {/* En-tête de la modale */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-950 border border-indigo-700 rounded-lg">
                  <Archive className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Centre d'Archivage Externe des Croisières
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Exportation certifiée pour traceurs nautiques, tableurs et sauvegarde pérenne
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Métadonnées de la Croisière */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Nom de la Croisière / Récit</label>
                <input
                  type="text"
                  value={cruiseName}
                  onChange={(e) => setCruiseName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Capitaine / Chef de Bord</label>
                <input
                  type="text"
                  value={skipperName}
                  onChange={(e) => setSkipperName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* Choix du Format d'Archivage */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5 font-semibold">Format d'Exportation Ciblé</label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Option GPX */}
                <button
                  type="button"
                  onClick={() => setArchiveFormat('GPX')}
                  className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                    archiveFormat === 'GPX'
                      ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs text-cyan-400">GPX 1.1</span>
                    {archiveFormat === 'GPX' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    Traceurs Garmin, Furuno, Raymarine, Navionics, OpenCPN
                  </span>
                </button>

                {/* Option CSV */}
                <button
                  type="button"
                  onClick={() => setArchiveFormat('CSV')}
                  className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                    archiveFormat === 'CSV'
                      ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs text-emerald-400">CSV Tableur</span>
                    {archiveFormat === 'CSV' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    Excel (UTF-8 BOM), LibreOffice, Audit de Sécurité
                  </span>
                </button>

                {/* Option JSON */}
                <button
                  type="button"
                  onClick={() => setArchiveFormat('JSON')}
                  className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                    archiveFormat === 'JSON'
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs text-indigo-400">JSON Archive</span>
                    {archiveFormat === 'JSON' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    Sauvegarde intégrale &amp; Restauration ultérieure
                  </span>
                </button>
              </div>
            </div>

            {/* Options contextuelles selon le format */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-semibold">Filtrer par Catégorie d'Entrées</span>
                <select
                  value={exportCategoryFilter}
                  onChange={(e) => setExportCategoryFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                >
                  <option value="ALL">Toutes les observations ({logbookEntries.length})</option>
                  <option value="NAVIGATION">Navigation seulement</option>
                  <option value="FISHING">Pêche &amp; Prises seulement</option>
                  <option value="WEATHER">Météo &amp; Barométrie</option>
                  <option value="ANCHOR">Mouillages &amp; Ports</option>
                  <option value="ENGINE">Horamètre Moteur</option>
                  <option value="SECURITY">Sécurité &amp; Exercices</option>
                </select>
              </div>

              {archiveFormat === 'GPX' && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={includeWaypointsInGpx}
                      onChange={(e) => setIncludeWaypointsInGpx(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span>Inclure les Waypoints ({'<wpt>'})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={includeTrackInGpx}
                      onChange={(e) => setIncludeTrackInGpx(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span>Inclure la Trace continue ({'<trk>'})</span>
                  </label>
                </div>
              )}

              {archiveFormat === 'CSV' && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400">Séparateur de colonnes :</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="delimiter"
                        checked={csvDelimiter === ';'}
                        onChange={() => setCsvDelimiter(';')}
                        className="accent-emerald-500"
                      />
                      <span>Point-virgule (;) [Standard France/Europe]</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="delimiter"
                        checked={csvDelimiter === ','}
                        onChange={() => setCsvDelimiter(',')}
                        className="accent-emerald-500"
                      />
                      <span>Virgule (,) [Standard US]</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Zone de Restauration d'Archive */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] text-slate-400">Restaurer une archive existante :</span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportJsonFile}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                Importer Fichier JSON...
              </button>
            </div>

            {/* Boutons d'Action Principaux */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (archiveFormat === 'GPX') handleExportGpx();
                  else if (archiveFormat === 'CSV') handleExportCsv();
                  else handleExportJson();
                  setIsArchiveModalOpen(false);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger l'Archive ({archiveFormat})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire de saisie détaillée */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmitEntry}
          className="bg-slate-950 border border-cyan-500/40 rounded-xl p-4 space-y-4 shadow-xl animate-fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              Consigner un Événement Maritime dans le Livre de Bord
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Fermer ✕
            </button>
          </div>

          {/* Aperçu des capteurs instantanés */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Position GNSS</span>
              <span className="text-cyan-300 font-bold">
                {vessel.position.latitude.toFixed(4)}°N, {Math.abs(vessel.position.longitude).toFixed(4)}°W
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Cinématique Fond</span>
              <span className="text-cyan-300 font-bold">
                {vessel.sog.toFixed(1)} kn / {Math.round(vessel.cog)}°
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Sondeur sous quille</span>
              <span className="text-emerald-400 font-bold">{vessel.depthBelowKeel.toFixed(1)} m</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Météo / Pression</span>
              <span className="text-amber-300 font-bold">
                {cachedWeather?.windSpeed10m[0] ?? 17} kn / {cachedWeather?.surfacePressure[0] ?? 1018} hPa
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Catégorie */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LogbookCategory)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="NAVIGATION">Navigation & Quart</option>
                <option value="WEATHER">Météorologie & Mer</option>
                <option value="FISHING">Pêche & Captures</option>
                <option value="ANCHOR">Mouillage & Port</option>
                <option value="ENGINE">Mécanique & Carburant</option>
                <option value="SECURITY">Sécurité & Manœuvres</option>
              </select>
            </div>

            {/* Titre */}
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Titre de l'Observation</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Parage de la pointe de Barfleur, Virement de bord..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Notes détaillées */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Notes & Observations nautiques</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Régime moteur, visibilité, état de la mer, dérive constatée, remarques..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Section conditionnelle Pêche */}
          {category === 'FISHING' && (
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 space-y-2">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <Fish className="w-3.5 h-3.5 text-emerald-400" /> Détails Halieutiques & Prises
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={fishSpecies}
                  onChange={(e) => setFishSpecies(e.target.value)}
                  placeholder="Espèce (ex: Bar commun)"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100"
                />
                <input
                  type="number"
                  min="1"
                  value={fishQty}
                  onChange={(e) => setFishQty(parseInt(e.target.value) || 1)}
                  placeholder="Quantité"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100"
                />
                <input
                  type="number"
                  step="0.1"
                  value={fishWeight ?? ''}
                  onChange={(e) => setFishWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Poids (kg)"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100"
                />
                <input
                  type="text"
                  value={fishLure}
                  onChange={(e) => setFishLure(e.target.value)}
                  placeholder="Leurre / Appât utilisé"
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Équipage & Heures Moteur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Officier de Quart / Équipage</label>
              <input
                type="text"
                value={crewMember}
                onChange={(e) => setCrewMember(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Heures Moteur</label>
              <input
                type="number"
                step="0.1"
                value={engineHours}
                onChange={(e) => setEngineHours(parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-md shadow-cyan-600/30"
            >
              Enregistrer au Journal
            </button>
          </div>
        </form>
      )}

      {/* Graphique de Tendance Historique 24h (Pression & Vent) pour Prédiction Locale */}
      <LogbookTrendChart />

      {/* Barre de filtre et de recherche */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Onglets Catégories */}
        <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {(['ALL', 'NAVIGATION', 'WEATHER', 'FISHING', 'ANCHOR', 'ENGINE', 'SECURITY'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                selectedCategory === cat ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'Toutes' : cat === 'NAVIGATION' ? 'Nav' : cat === 'WEATHER' ? 'Météo' : cat === 'FISHING' ? 'Pêche' : cat === 'ANCHOR' ? 'Mouillage' : cat === 'ENGINE' ? 'Moteur' : 'Sécurité'}
            </button>
          ))}
        </div>

        {/* Barre de recherche */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une entrée..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Liste des entrées du journal de bord */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Aucune entrée trouvée pour ces critères de recherche.</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors shadow-md space-y-3"
            >
              {/* Ligne 1 : Catégorie, Titre, Heure & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {renderCategoryBadge(entry.category)}
                  <h3 className="text-sm font-bold text-slate-100">{entry.title}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {new Date(entry.timestamp).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => deleteLogbookEntry(entry.id)}
                    className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                    title="Supprimer cette entrée"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Ligne 2 : Coordonnées nautiques & Télémesures */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{formatNauticalCoords(entry.position.latitude, entry.position.longitude)}</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    SOG {entry.sog.toFixed(1)} kn • COG {Math.round(entry.cog).toString().padStart(3, '0')}°
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Waves className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Sonde : {entry.depthBelowKeel.toFixed(1)} m</span>
                </div>

                <div className="flex items-center gap-1.5 text-amber-300">
                  <Wind className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {entry.weatherSummary.windSpeedKnots} kn ({entry.weatherSummary.windDirectionDeg}°) • {entry.weatherSummary.surfacePressureHpa} hPa
                  </span>
                </div>
              </div>

              {/* Ligne 3 : Observations écrites */}
              <p className="text-xs text-slate-300 leading-relaxed pl-1">
                {entry.notes}
              </p>

              {/* Ligne 4 : Captures de pêche (si existantes) */}
              {entry.fishCatches && entry.fishCatches.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2.5 text-xs text-emerald-200 space-y-1">
                  <div className="font-bold text-[11px] text-emerald-300 flex items-center gap-1.5 uppercase">
                    <Fish className="w-3.5 h-3.5" /> Prises Répertoriées
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {entry.fishCatches.map((c, i) => (
                      <span key={i} className="bg-slate-900 border border-emerald-700/60 px-2 py-0.5 rounded text-[11px] font-mono">
                        {c.quantity}x <b className="text-white">{c.species}</b> {c.weightKg ? `(${c.weightKg} kg)` : ''} {c.lureUsed ? `[${c.lureUsed}]` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ligne 5 : Métadonnées d'équipage */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                <div className="flex items-center gap-3">
                  {entry.crewMember && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Officier : {entry.crewMember}
                    </span>
                  )}
                  {entry.engineHours && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-slate-400" /> Horamètre moteur : {entry.engineHours} h
                    </span>
                  )}
                </div>
                <span className="font-mono text-slate-600">{entry.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
