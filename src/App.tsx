import React, { useEffect, useState } from 'react';
import { useNavigationStore } from './store/useNavigationStore';
import { BackgroundLocationService } from './services/BackgroundLocationService';
import { SignalKService } from './services/SignalKService';
import { ChartPlotter } from './components/ChartPlotter';
import { WeatherDashboard } from './components/WeatherDashboard';
import { SolunarDashboard } from './components/SolunarDashboard';
import { TelemetryView } from './components/TelemetryView';
import { LogbookManager } from './components/LogbookManager';
import { CodeInspector } from './components/CodeInspector';
import {
  Compass,
  Map as MapIcon,
  CloudSun,
  Fish,
  Radio,
  Code,
  Shield,
  Anchor,
  Activity,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  LifeBuoy,
} from 'lucide-react';
import { MobRescueModal } from './components/MobRescueModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chart' | 'weather' | 'solunar' | 'telemetry' | 'logbook' | 'code'>('chart');

  const {
    vessel,
    signalKConnected,
    activeCollisionAlert,
    setKalmanActive,
    logbookEntries,
    mobIncident,
    triggerMob,
  } = useNavigationStore();

  // Démarrage des services maritimes en arrière-plan
  useEffect(() => {
    const locService = BackgroundLocationService.getInstance();
    locService.startTracking();

    const sigKService = SignalKService.getInstance();
    sigKService.connect();

    return () => {
      locService.stopTracking();
      sigKService.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Barre de statut système maritime supérieure (ECDIS Header) */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Identité navire et logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide">NaviSea Pro</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono font-semibold">
                  ECDIS S-52 / S-57
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {vessel.name} • <span className="text-slate-300 font-semibold">{vessel.id}</span>
              </div>
            </div>
          </div>

          {/* Alertes système globales */}
          {activeCollisionAlert && (
            <div className="flex items-center gap-2 bg-red-950/80 border border-red-500/80 px-3 py-1 rounded-full text-xs text-red-200 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="font-bold">COLLISION WARNING :</span>
              <span>Cible MMSI {activeCollisionAlert.mmsi} à {activeCollisionAlert.cpa} NM</span>
            </div>
          )}

          {/* Badges d'état temps réel */}
          <div className="flex items-center gap-2 text-xs">
            {/* Statut Signal K */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono ${
              signalKConnected
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                : 'bg-red-950/60 border-red-800 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${signalKConnected ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
              Signal K {signalKConnected ? 'OK' : 'OFF'}
            </div>

            {/* Filtre de Kalman EKF */}
            <button
              onClick={() => setKalmanActive(!vessel.isKalmanActive)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors ${
                vessel.isKalmanActive
                  ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300 hover:bg-cyan-900/60'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Cliquer pour activer/désactiver le filtre de Kalman EKF (6D)"
            >
              <Activity className="w-3.5 h-3.5" />
              EKF {vessel.isKalmanActive ? 'ON' : 'OFF'}
            </button>

            {/* Mouillage */}
            {vessel.anchorWatch.isActive && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/60 border border-amber-700 text-amber-300 text-[11px]">
                <Anchor className="w-3.5 h-3.5" />
                Mouillage
              </div>
            )}

            {/* BOUTON D'URGENCE ABSOLUE HOMME À LA MER (MOB) */}
            <button
              onClick={() => {
                if (!mobIncident?.isActive) {
                  triggerMob();
                }
                setActiveTab('chart');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-lg border-2 ${
                mobIncident?.isActive
                  ? 'bg-red-600 border-white text-white animate-bounce shadow-red-600/60'
                  : 'bg-red-700/95 hover:bg-red-600 active:scale-95 border-red-400 text-white shadow-red-950/60'
              }`}
              title="Détresse Immédiate Homme à la Mer - Capture instantanée des coordonnées GPS et alarme de sauvetage"
            >
              <LifeBuoy className={`w-4 h-4 text-white ${mobIncident?.isActive ? 'animate-spin' : ''}`} />
              <span>{mobIncident?.isActive ? 'MOB EN COURS !' : 'MOB (HOMME À LA MER)'}</span>
            </button>
          </div>
        </div>

        {/* Alerte Sonore & Visuelle Haute Priorité (visible dans tous les onglets) */}
        {mobIncident?.isActive && activeTab !== 'chart' && (
          <MobRescueModal onCenterOnMob={() => setActiveTab('chart')} />
        )}

        {/* Barre d'onglets principale */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1 border-t border-slate-800/80 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'chart'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Traceur S-52 / Cartographie
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            Télémétrie &amp; AIS ({useNavigationStore.getState().aisTargets.size})
          </button>

          <button
            onClick={() => setActiveTab('weather')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'weather'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CloudSun className="w-4 h-4" />
            Météo Marine &amp; AROME
          </button>

          <button
            onClick={() => setActiveTab('solunar')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'solunar'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Fish className="w-4 h-4" />
            Théorie Solunaire &amp; Pêche
          </button>

          <button
            onClick={() => setActiveTab('logbook')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'logbook'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Livre de Bord ({logbookEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ml-auto ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-indigo-900/60'
            }`}
          >
            <Code className="w-4 h-4" />
            Code React Native Expo
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-6">
        {activeTab === 'chart' && (
          <div className="space-y-4">
            <ChartPlotter />

            {/* Cartes de synthèse rapide sous le traceur */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
                <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-200 uppercase tracking-wide">
                    Norme IHO S-52 Safety Contour
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Le tracé des isobathes s’adapte en direct à votre tirant d'eau ({vessel.draft} m). Les profondeurs critiques sont surlignées en rouge alarme 0.6 mm.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
                <Activity className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-200 uppercase tracking-wide">
                    Filtre de Kalman EKF 6D
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Fusion GNSS + cinématique réduisant l’erreur de 15m à 4.8m. Vecteur de Route Fond (COG {vessel.cog}°) stabilisé sans décrochage.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
                <Radio className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-200 uppercase tracking-wide">
                    Veille AIS &amp; COLREGs
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Calcul géodésique continu du point de rapprochement maximal (CPA) et délai avant croisement (TCPA) pour tous les navires en portée VHF.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'telemetry' && <TelemetryView />}
        {activeTab === 'weather' && <WeatherDashboard />}
        {activeTab === 'solunar' && <SolunarDashboard />}
        {activeTab === 'logbook' && <LogbookManager />}
        {activeTab === 'code' && <CodeInspector />}
      </main>

      {/* Pied de page maritime professionnel */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        NaviSea Pro v2.4 • Architecture TurboModules React Native &amp; MapLibre GL • IHO S-52 / S-57 ECDIS Specifications
      </footer>
    </div>
  );
}
