import React, { useState, useEffect, useRef } from 'react';
import { useNavigationStore } from '../store/useNavigationStore';
import { WeatherService } from '../services/WeatherService';
import {
  Wind,
  Waves,
  Compass,
  Gauge,
  Thermometer,
  CloudSun,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Droplets,
  ShieldAlert,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Sliders,
  LifeBuoy,
} from 'lucide-react';

export const WeatherDashboard: React.FC = () => {
  const {
    vessel,
    cachedWeather,
    isWeatherLoading,
    windSafetyThresholdKnots,
    windAlertEnabled,
    setWindSafetyThreshold,
    toggleWindAlertEnabled,
  } = useNavigationStore();

  const [selectedModel, setSelectedModel] = useState<'AROME' | 'ECMWF' | 'GFS'>('AROME');
  const [monitorGusts, setMonitorGusts] = useState<boolean>(true); // Surveiller également les rafales
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hasNotifiedBrowser, setHasNotifiedBrowser] = useState<boolean>(false);
  const [simulatedWindOverride, setSimulatedWindOverride] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastAlertTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!cachedWeather) {
      WeatherService.getInstance().fetchMarineWeather(vessel.position, selectedModel);
    }
  }, []);

  const handleRefresh = (model = selectedModel) => {
    WeatherService.getInstance().fetchMarineWeather(vessel.position, model);
  };

  const handleModelChange = (model: 'AROME' | 'ECMWF' | 'GFS') => {
    setSelectedModel(model);
    handleRefresh(model);
  };

  const weather = cachedWeather;

  // Données anémométriques effectives (avec support de la simulation interactive)
  const actualWindSpeed = weather?.windSpeed10m[0] || 18;
  const actualWindGusts = weather?.windGusts10m[0] || Math.round(actualWindSpeed * 1.35);
  const currentWindSpeed = simulatedWindOverride !== null ? simulatedWindOverride : actualWindSpeed;
  const currentWindGusts = simulatedWindOverride !== null ? Math.round(simulatedWindOverride * 1.35) : actualWindGusts;

  const currentWaveHeight = weather?.waveHeight[0] || 1.8;
  const currentSwellHeight = weather?.swellWaveHeight[0] || 1.4;
  const currentSwellDir = weather?.swellWaveDirection[0] || 300;
  const currentWindDir = weather?.windDirection10m[0] || 250;
  const currentSwellPeriod = weather?.swellWavePeriod[0] || 10.5;
  const currentPressure = weather?.surfacePressure[0] || 1018;
  const currentSST = weather?.seaSurfaceTemperature[0] || 15.2;
  const currentStream = weather?.oceanCurrentVelocity[0] || 1.4;

  // Vérification de dépassement du seuil de sécurité
  const effectiveWindToCheck = monitorGusts ? Math.max(currentWindSpeed, currentWindGusts) : currentWindSpeed;
  const isThresholdExceeded = windAlertEnabled && effectiveWindToCheck >= windSafetyThresholdKnots;

  // Calcul des heures futures dépassant le seuil dans les prochaines 24h
  const exceedingHours: { time: string; wind: number; gusts: number }[] = [];
  if (weather && weather.time) {
    for (let i = 0; i < Math.min(24, weather.time.length); i++) {
      const wSpeed = weather.windSpeed10m[i] || 0;
      const wGust = weather.windGusts10m[i] || wSpeed * 1.3;
      const val = monitorGusts ? Math.max(wSpeed, wGust) : wSpeed;
      if (val >= windSafetyThresholdKnots) {
        exceedingHours.push({
          time: weather.time[i].split(' ')[1] || `${i}:00`,
          wind: wSpeed,
          gusts: Math.round(wGust),
        });
      }
    }
  }

  // Échelle de Beaufort et recommandations nautiques
  const getBeaufortData = (knots: number) => {
    if (knots < 1) return { force: 0, label: 'Calme', advice: 'Mer d’huile. Navigation moteur nécessaire.' };
    if (knots <= 3) return { force: 1, label: 'Très légère brise', advice: 'Rides sur l’eau sans écume.' };
    if (knots <= 6) return { force: 2, label: 'Légère brise', advice: 'Vent sensible sur le visage, voilure haute.' };
    if (knots <= 10) return { force: 3, label: 'Petite brise', advice: 'Très bonnes conditions de voile et de pêche.' };
    if (knots <= 16) return { force: 4, label: 'Jolie brise', advice: 'Moutons fréquents, voilure standard.' };
    if (knots <= 21) return { force: 5, label: 'Bonne brise', advice: 'Vagues modérées. Prévoir réduction de voilure pour l’équipage.' };
    if (knots <= 27) return { force: 6, label: 'Grand frais', advice: 'Prendre 1er ris dans la GV, ariser le génois, sécuriser les panneaux de pont.' };
    if (knots <= 33) return { force: 7, label: 'Coup de vent', advice: 'Prendre 2e ris, passer sous trinquette. Éviter les passes étroites et parages rocheux.' };
    if (knots <= 40) return { force: 8, label: 'Coup de vent violent', advice: '3e ris ou tourmentin. Port des gilets et longes obligatoire. Rallier un port abrité.' };
    return { force: 9, label: 'Forte tempête / Ouragan', advice: 'Situation critique. Fuite ou cape à sec de toile. Veille ASN VHF canal 16.' };
  };

  const beaufort = getBeaufortData(effectiveWindToCheck);

  // Synthèse sonore d'alerte Web Audio API
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // Mi5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // La5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio autoplay restrictions
    }
  };

  // Déclenchement de l'alerte
  useEffect(() => {
    if (isThresholdExceeded) {
      const now = Date.now();
      // On ne rejoue le son qu'au maximum toutes les 30 secondes
      if (now - lastAlertTimeRef.current > 30000) {
        playAlertSound();
        lastAlertTimeRef.current = now;
      }

      // Notification système navigateur si autorisée
      if (!hasNotifiedBrowser && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('NaviSea Pro - Alerte Vent Sécurité', {
          body: `Vent détecté à ${effectiveWindToCheck} kn (Seuil: ${windSafetyThresholdKnots} kn). Force ${beaufort.force} Beaufort (${beaufort.label}).`,
          icon: '/favicon.ico',
        });
        setHasNotifiedBrowser(true);
      }
    } else {
      setHasNotifiedBrowser(false);
    }
  }, [isThresholdExceeded, effectiveWindToCheck, windSafetyThresholdKnots]);

  const requestBrowserNotification = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        alert('Notifications de sécurité autorisées dans le navigateur.');
      }
    }
  };

  // Calcul du risque de mer croisée
  const angleDiff = Math.abs(currentSwellDir - currentWindDir);
  const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
  const isCrossSea = normalizedDiff > 55 && currentWaveHeight > 1.5;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-6">
      {/* En-tête avec sélecteur de modèle météo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-cyan-400" />
              Bulletins &amp; Océanographie Haute Résolution
            </h2>
            <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
              Open-Meteo Marine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Zone : {vessel.position.latitude.toFixed(3)}°N, {Math.abs(vessel.position.longitude).toFixed(3)}°W • Veille anémométrique active
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur de modèles */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => handleModelChange('AROME')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                selectedModel === 'AROME' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AROME (1.3 km)
            </button>
            <button
              onClick={() => handleModelChange('ECMWF')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                selectedModel === 'ECMWF' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ECMWF (IFS)
            </button>
            <button
              onClick={() => handleModelChange('GFS')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                selectedModel === 'GFS' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GFS (NOAA)
            </button>
          </div>

          <button
            onClick={() => handleRefresh()}
            disabled={isWeatherLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
            title="Rafraîchir les prévisions"
          >
            <RefreshCw className={`w-4 h-4 ${isWeatherLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* PANNEAU D'ALERTE DE SÉCURITÉ VENT DÉPASSÉ */}
      {isThresholdExceeded && (
        <div className="bg-red-950/80 border-2 border-red-500 rounded-xl p-4 shadow-2xl animate-pulse text-red-100 backdrop-blur-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-600/40">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Alerte Sécurité Vent Dépassé</span>
                  <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                    Force {beaufort.force} Beaufort
                  </span>
                </div>
                <p className="text-xs text-red-200 mt-0.5">
                  Vent effectif mesuré : <b className="text-white text-sm font-mono">{effectiveWindToCheck} kn</b> (Seuil d'alerte capitaine : <b>{windSafetyThresholdKnots} kn</b>)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                  soundEnabled ? 'bg-red-900 border-red-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
                title={soundEnabled ? 'Alarme sonore active' : 'Alarme sonore coupée'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="text-[10px]">{soundEnabled ? 'Son ON' : 'Muet'}</span>
              </button>

              <button
                onClick={() => setSimulatedWindOverride(null)}
                className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 border border-red-700 rounded-lg text-xs font-semibold"
              >
                Acquitter
              </button>
            </div>
          </div>

          {/* Recommandation nautique tactile */}
          <div className="bg-red-900/40 border border-red-700/60 rounded-lg p-3 text-xs flex items-start gap-2.5">
            <LifeBuoy className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-200 uppercase tracking-wide">
                Consigne de Sécurité ({beaufort.label}) :
              </span>
              <p className="text-red-100 mt-0.5 font-medium leading-relaxed">
                {beaufort.advice}
              </p>
            </div>
          </div>

          {/* Fenêtres d'heures à risque dans la journée */}
          {exceedingHours.length > 0 && (
            <div className="text-[11px] text-red-200 flex items-center gap-2 pt-1">
              <Clock className="w-3.5 h-3.5 text-red-300 shrink-0" />
              <span>
                Créneaux à risque prévus :{' '}
                <b className="text-white font-mono">
                  {exceedingHours.map((h) => `${h.time} (${h.wind}kn)`).slice(0, 5).join(' • ')}
                </b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* CARTE DE CONFIGURATION DU SEUIL DE VENT DÉFINI PAR L'UTILISATEUR */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Paramétrage du Seuil de Sécurité Anémométrique
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => toggleWindAlertEnabled()}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-semibold transition-colors ${
                windAlertEnabled
                  ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {windAlertEnabled ? <Bell className="w-3.5 h-3.5 text-cyan-400" /> : <BellOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>{windAlertEnabled ? 'Surveillance Active' : 'Désactivée'}</span>
            </button>

            <button
              onClick={requestBrowserNotification}
              className="text-slate-400 hover:text-slate-200 text-[11px] underline"
              title="Autoriser les notifications système pour être alerté même onglet masqué"
            >
              Notifications navigateur
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Curseur de seuil en nœuds */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Seuil de Déclenchement de l'Alerte :</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold font-mono text-cyan-400">
                  {windSafetyThresholdKnots} nœuds
                </span>
                <span className="text-[11px] text-slate-500">
                  (Force {getBeaufortData(windSafetyThresholdKnots).force} Beaufort)
                </span>
              </div>
            </div>

            <input
              type="range"
              min="10"
              max="45"
              step="1"
              value={windSafetyThresholdKnots}
              onChange={(e) => setWindSafetyThreshold(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>10 kn (F3)</span>
              <span>15 kn (F4)</span>
              <span>20 kn (F5)</span>
              <span>25 kn (F6 Grand Frais)</span>
              <span>30 kn (F7 Coup de Vent)</span>
              <span>40+ kn (F8+)</span>
            </div>
          </div>

          {/* Options de contrôle et simulation de test */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={monitorGusts}
                onChange={(e) => setMonitorGusts(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>Surveiller les rafales max</span>
            </label>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Banc d'essai :</span>
              {simulatedWindOverride === null ? (
                <button
                  onClick={() => setSimulatedWindOverride(windSafetyThresholdKnots + 6)}
                  className="px-2 py-1 bg-red-950 border border-red-700 text-red-300 rounded text-[10px] font-bold hover:bg-red-900 transition-colors"
                >
                  Tester Dépassement
                </button>
              ) : (
                <button
                  onClick={() => setSimulatedWindOverride(null)}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px] hover:bg-slate-700 transition-colors"
                >
                  Rétablir Réel ({actualWindSpeed} kn)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerte Phénomène Dangereux : Mer croisée (Cross Sea) */}
      {isCrossSea && (
        <div className="bg-amber-950/60 border border-amber-600/70 rounded-lg p-3 text-amber-200 text-xs flex items-start gap-3 backdrop-blur-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold uppercase tracking-wide text-amber-300">
              Vigilance Océanique : Risque de Mer Croisée Détecté ({normalizedDiff}° de différentiel)
            </div>
            <p className="mt-0.5 text-slate-300">
              Interférence entre le train de houle d'Ouest ({currentSwellDir}°) et la mer du vent ({currentWindDir}°).
              Risque de vagues pyramidales et de déferlantes brutales. Ralentir l'allure et adapter le cap.
            </p>
          </div>
        </div>
      )}

      {/* Cartes d'indicateurs temps-réel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Hauteur Vagues Totales */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Hauteur Vagues</span>
            <Waves className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-cyan-300 font-mono">{currentWaveHeight.toFixed(1)}</span>
            <span className="text-xs text-slate-400 ml-1">m</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Houle: {currentSwellHeight.toFixed(1)}m ({currentSwellPeriod.toFixed(0)}s)
          </div>
        </div>

        {/* Vent & Rafales avec alerte de seuil intégrée */}
        <div
          className={`border rounded-xl p-3 flex flex-col justify-between transition-colors ${
            effectiveWindToCheck >= windSafetyThresholdKnots
              ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={effectiveWindToCheck >= windSafetyThresholdKnots ? 'text-red-300' : 'text-slate-400'}>
              Vent Moyen
            </span>
            <Wind className={`w-4 h-4 ${effectiveWindToCheck >= windSafetyThresholdKnots ? 'text-red-400 animate-pulse' : 'text-sky-400'}`} />
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl font-black font-mono ${
                effectiveWindToCheck >= windSafetyThresholdKnots ? 'text-red-300' : 'text-sky-300'
              }`}
            >
              {currentWindSpeed}
            </span>
            <span className="text-xs text-slate-400 ml-1">kn</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Rafales : <b className="text-slate-200">{currentWindGusts} kn</b> ({currentWindDir}°)
          </div>
        </div>

        {/* Pression Barométrique */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pression Mer</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">{currentPressure}</span>
            <span className="text-xs text-slate-400 ml-1">hPa</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <span>Tendance :</span>
            <span className="font-semibold">Hausse (+2.4/3h)</span>
          </div>
        </div>

        {/* Température de l'Eau (SST) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Temp. Mer (SST)</span>
            <Thermometer className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-300 font-mono">{currentSST.toFixed(1)}</span>
            <span className="text-xs text-slate-400 ml-1">°C</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Air : {weather?.temperature2m[0] || 15.4}°C</div>
        </div>

        {/* Courant Marin */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Courant Surface</span>
            <Compass className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{currentStream}</span>
            <span className="text-xs text-slate-400 ml-1">kn</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Cap flot : 075° (Montante)</div>
        </div>

        {/* Indice de Confiance Modèle */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Fiabilité Modèle</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-300 font-mono">
              {weather?.confidenceIndex || 94}%
            </span>
          </div>
          <div className="text-[10px] text-indigo-300 mt-1">Convergence AROME</div>
        </div>
      </div>

      {/* Graphique temporel défilable des prévisions horaires avec surbrillance des heures à risque */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Évolution Chronologique (48 Heures) - Vagues &amp; Vent
          </span>
          <span className="text-[11px] text-slate-400">
            Seuil sécurité : <b className="text-cyan-400 font-mono">{windSafetyThresholdKnots} kn</b>
          </span>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex gap-2 min-w-[780px]">
            {(weather?.time || []).slice(0, 24).map((t, idx) => {
              const hour = t.split(' ')[1] || `${idx}:00`;
              const hWave = weather?.waveHeight[idx] || 1.5;
              const wSpeed = weather?.windSpeed10m[idx] || 15;
              const wGust = weather?.windGusts10m[idx] || Math.round(wSpeed * 1.3);
              const baro = weather?.surfacePressure[idx] || 1015;
              const isOver = wSpeed >= windSafetyThresholdKnots || wGust >= windSafetyThresholdKnots;

              return (
                <div
                  key={idx}
                  className={`flex-1 min-w-[70px] border rounded-lg p-2.5 flex flex-col items-center text-center text-xs transition-colors ${
                    isOver
                      ? 'bg-red-950/40 border-red-500/70 shadow-sm'
                      : 'bg-slate-950 border-slate-800/80 hover:border-cyan-500/50'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isOver ? 'text-red-300' : 'text-slate-300'}`}>
                    {hour}
                  </span>

                  {/* Jauge visuelle de hauteur de vague */}
                  <div className="h-16 w-3 bg-slate-900 rounded-full my-2 flex flex-col justify-end p-0.5 overflow-hidden">
                    <div
                      className={`w-full rounded-full ${hWave > 2.5 ? 'bg-red-500' : hWave > 1.8 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ height: `${Math.min(100, (hWave / 4.0) * 100)}%` }}
                    />
                  </div>

                  <span className="font-mono font-bold text-cyan-300">{hWave.toFixed(1)}m</span>
                  <span className={`text-[10px] mt-1 font-bold ${isOver ? 'text-red-400 animate-pulse' : 'text-sky-400'}`}>
                    {wSpeed} kn
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5">{baro} hPa</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
