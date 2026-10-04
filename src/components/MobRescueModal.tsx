import React, { useState, useEffect, useRef } from 'react';
import { useNavigationStore } from '../store/useNavigationStore';
import {
  LifeBuoy,
  Volume2,
  VolumeX,
  Compass,
  Navigation,
  Radio,
  Sliders,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

interface MobRescueModalProps {
  onCenterOnMob?: () => void;
}

export const MobRescueModal: React.FC<MobRescueModalProps> = ({ onCenterOnMob }) => {
  const { mobIncident, cancelMob, setMobSearchRadius, vessel } = useNavigationStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Chronomètre de dérive
  useEffect(() => {
    if (!mobIncident?.isActive) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.floor((now - mobIncident.timestamp) / 1000);
      setElapsedSeconds(diffSec);
    }, 1000);

    return () => clearInterval(timer);
  }, [mobIncident?.isActive, mobIncident?.timestamp]);

  // Alarme sonore bitonale d'urgence maritime (Web Audio API)
  useEffect(() => {
    if (!mobIncident?.isActive || isSoundMuted) {
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
      return;
    }

    const playSirenBurst = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Fréquences d'urgence alternées (880 Hz La5 -> 659 Hz Mi5)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } catch {
        // Restrictions d'autoplay
      }
    };

    playSirenBurst();
    sirenIntervalRef.current = setInterval(playSirenBurst, 1200);

    return () => {
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
    };
  }, [mobIncident?.isActive, isSoundMuted]);

  if (!mobIncident?.isActive) return null;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const formatDMM = (lat: number, lon: number) => {
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(3);
    const latDir = lat >= 0 ? 'N' : 'S';

    const lonDeg = Math.floor(Math.abs(lon));
    const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(3);
    const lonDir = lon >= 0 ? 'E' : 'W';

    return `${latDeg}°${latMin}' ${latDir} - ${lonDeg.toString().padStart(3, '0')}°${lonMin}' ${lonDir}`;
  };

  return (
    <>
      {/* BANNIÈRE D'ALERTE HAUTE PRIORITÉ TOUJOURS VISIBLE EN HAUT */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-3 border-b-2 border-white animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center font-black animate-spin">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <span>URGENCE HOMME À LA MER (MOB)</span>
              <span className="bg-white text-red-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                T+ {timeFormatted}
              </span>
            </div>
            <div className="text-[11px] font-mono text-red-100 flex items-center gap-3 mt-0.5">
              <span>
                Cap retour : <b className="text-white text-xs">{mobIncident.currentBearingDeg}°</b>
              </span>
              <span>•</span>
              <span>
                Distance : <b className="text-white text-xs">{mobIncident.currentDistanceMeters} m</b> ({mobIncident.currentDistanceNM} NM)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSoundMuted(!isSoundMuted)}
            className="p-1.5 bg-red-700 hover:bg-red-800 rounded-lg text-white border border-red-400 text-xs flex items-center gap-1"
            title={isSoundMuted ? 'Activer le son' : 'Couper la sirène'}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="text-[10px] hidden sm:inline">{isSoundMuted ? 'Sirène OFF' : 'Sirène ON'}</span>
          </button>

          {onCenterOnMob && (
            <button
              onClick={onCenterOnMob}
              className="px-2.5 py-1 bg-white text-red-700 font-bold rounded-lg text-xs hover:bg-red-50 flex items-center gap-1 shadow"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Centrer Carte</span>
            </button>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-2.5 py-1 bg-red-800 hover:bg-red-900 border border-red-500 rounded-lg text-xs font-semibold"
          >
            {isMinimized ? 'Détails +' : 'Réduire -'}
          </button>
        </div>
      </div>

      {/* PUPITRE TACTIQUE DE SAUVETAGE MOB (MODALE OU FLOTTANT) */}
      {!isMinimized && (
        <div className="fixed top-14 left-4 right-4 md:right-auto md:w-[480px] z-50 bg-slate-950/95 border-2 border-red-600 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-xs text-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* En-tête */}
          <div className="flex items-center justify-between pb-3 border-b border-red-900/60">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-red-500 animate-spin" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                  Pupitre Opérationnel Sauvetage SAR
                </h3>
                <span className="text-[10px] text-slate-400">Procédure internationale Solas / IAMSAR</span>
              </div>
            </div>
            <span className="bg-red-950 border border-red-700 text-red-300 font-mono font-bold text-xs px-2 py-0.5 rounded">
              {timeFormatted}
            </span>
          </div>

          {/* Vecteurs de guidage vers le point MOB */}
          <div className="grid grid-cols-2 gap-3 bg-red-950/40 border border-red-600/40 rounded-xl p-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-red-300 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-red-400" /> Cap Vrai à Suivre
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-white">
                  {mobIncident.currentBearingDeg}
                </span>
                <span className="text-sm font-bold text-red-300">°</span>
              </div>
              <span className="text-[10px] text-slate-400">Faire route vers ce relèvement</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-red-300 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-red-400" /> Distance au Point
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-white">
                  {mobIncident.currentDistanceMeters}
                </span>
                <span className="text-sm font-bold text-red-300">m</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                ({mobIncident.currentDistanceNM} NM)
              </span>
            </div>
          </div>

          {/* Coordonnées géographiques précises */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-sans">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Datum de Chute (GPS Fix)
              </span>
              <span className="text-emerald-400">Précision : ±{mobIncident.accuracy}m</span>
            </div>
            <div className="text-white font-bold text-xs">
              {formatDMM(mobIncident.position.latitude, mobIncident.position.longitude)}
            </div>
            <div className="text-slate-400 text-[10px]">
              WGS84 : {mobIncident.position.latitude.toFixed(6)}°, {mobIncident.position.longitude.toFixed(6)}°
            </div>
            <div className="text-slate-500 text-[10px] pt-1 border-t border-slate-800">
              Vitesse au largage : {mobIncident.initialSog} kn • Cap au largage : {mobIncident.initialCog}°
            </div>
          </div>

          {/* Réglage du Cercle de Recherche à Rayon Variable */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Cercle de Recherche Variable (SAR) :
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {mobIncident.searchRadiusMeters} mètres
              </span>
            </div>

            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={mobIncident.searchRadiusMeters}
              onChange={(e) => setMobSearchRadius(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />

            <div className="flex items-center justify-between gap-1 text-[10px]">
              {[50, 100, 250, 500, 1000].map((r) => (
                <button
                  key={r}
                  onClick={() => setMobSearchRadius(r)}
                  className={`px-2 py-0.5 rounded border ${
                    mobIncident.searchRadiusMeters === r
                      ? 'bg-cyan-600 border-cyan-400 text-white font-bold'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Le rayon s'adapte à la dérive présumée sous l'effet du courant de surface et de la dérive au vent.
            </p>
          </div>

          {/* Script de détresse VHF Canal 16 (MAYDAY) */}
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] font-black text-red-300 uppercase tracking-wide flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-red-400" /> Message de Détresse VHF Canal 16
            </span>
            <p className="font-mono text-[10px] text-red-100 bg-red-950/60 p-2 rounded border border-red-900 leading-relaxed select-all">
              "MAYDAY, MAYDAY, MAYDAY. Ici le navire {vessel.name} ({vessel.id}). HOMME À LA MER à la position {formatDMM(mobIncident.position.latitude, mobIncident.position.longitude)}. Une personne à l'eau. Demandons assistance immédiate. Terminé."
            </p>
          </div>

          {/* Boutons d'annulation et d'acquittement */}
          <div className="pt-2 border-t border-slate-800">
            {!isConfirmingCancel ? (
              <button
                type="button"
                onClick={() => setIsConfirmingCancel(true)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-red-400" />
                Acquitter / Terminer l'Opération MOB
              </button>
            ) : (
              <div className="bg-red-950/90 border border-red-500 rounded-xl p-3 space-y-2 text-center animate-fade-in">
                <span className="text-xs font-bold text-white block">
                  Êtes-vous certain de vouloir annuler l'alarme Homme à la Mer ?
                </span>
                <p className="text-[10px] text-red-200">
                  Confirmez uniquement si la victime est récupérée à bord et en sécurité.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingCancel(false)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-xs"
                  >
                    Non, Poursuivre
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cancelMob();
                      setIsConfirmingCancel(false);
                    }}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs shadow-lg shadow-red-600/40"
                  >
                    Oui, Victime Récupérée
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
