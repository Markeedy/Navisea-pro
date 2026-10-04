import React, { useState, useMemo } from 'react';
import { useNavigationStore } from '../store/useNavigationStore';
import { SolunarCalculator } from '../utils/SolunarCalculator';
import {
  Moon,
  Sun,
  Flame,
  Fish,
  Calendar,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Award,
  Sparkles,
  Info,
} from 'lucide-react';

export const SolunarDashboard: React.FC = () => {
  const { vessel } = useNavigationStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [baroTrend, setBaroTrend] = useState<'RISING_POST_STORM' | 'STABLE_HIGH' | 'FALLING' | 'LOW'>('RISING_POST_STORM');

  // Calcul instantané via le SolunarCalculator
  const solunarData = useMemo(() => {
    return SolunarCalculator.calculate(selectedDate, vessel.position, baroTrend);
  }, [selectedDate, vessel.position, baroTrend]);

  const handleDayOffset = (offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(next);
  };

  const formatTime = (d: Date | null) => {
    if (!d) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-6">
      {/* En-tête & Sélecteur de date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Fish className="w-5 h-5 text-indigo-400" />
              Moteur Prédictif Halieutique & Théorie Solunaire
            </h2>
            <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
              John Alden Knight
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calcul dynamique des transits célestes et empilement météo-astronomique (Stacking Engine)
          </p>
        </div>

        {/* Contrôleur de date */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => handleDayOffset(-1)}
            className="px-2.5 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            ← Jour Préc.
          </button>
          <div className="px-2 font-mono font-bold text-indigo-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <button
            onClick={() => handleDayOffset(1)}
            className="px-2.5 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            Jour Suiv. →
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="ml-1 px-2 py-1 bg-indigo-600 text-white rounded font-semibold text-[11px]"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Bloc principal : Score Solunaire & Phase Lunaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Solunaire du Jour */}
        <div className="bg-gradient-to-br from-indigo-950/70 via-slate-950 to-slate-950 border border-indigo-500/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Indice Global d'Activité
            </span>
            <span className="text-[10px] bg-indigo-900/60 border border-indigo-700 px-2 py-0.5 rounded text-indigo-200">
              Stacking Actif
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-3">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 font-mono">
              {solunarData.overallScore}%
            </span>
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold text-slate-200">
                {solunarData.overallScore >= 80 ? '🔥 Frénésie Exceptionnelle' : solunarData.overallScore >= 60 ? '⚡ Activité Soutenue' : '💤 Pêche Technique / Calme'}
              </span>
              <span className="text-[11px] text-slate-400">Potentiel de touche journalier</span>
            </div>
          </div>

          {/* Jauge linéaire */}
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${solunarData.overallScore}%` }}
            />
          </div>
        </div>

        {/* Phase et Âge Lunaire */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Moon className="w-4 h-4 text-amber-300" />
              Éphéméride Lunaire
            </span>
            <span className="text-[11px] font-mono text-amber-400">
              Jour {solunarData.moonAgeDays} / 29.5
            </span>
          </div>

          <div className="my-2 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border-2 border-amber-300/40 bg-slate-900 flex items-center justify-center relative shadow-inner">
              <Moon className="w-8 h-8 text-amber-300" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-100">{solunarData.moonPhaseName}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Illumination : <span className="font-semibold text-amber-300">{solunarData.moonIlluminationPercent}%</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Cycle synodique : {(solunarData.moonPhaseIndex * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Lever : <b className="text-slate-200">{formatTime(solunarData.moonrise)}</b></span>
            <span>Coucher : <b className="text-slate-200">{formatTime(solunarData.moonset)}</b></span>
          </div>
        </div>

        {/* Soleil et Multiplicateur Stacking Barométrique */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Sun className="w-4 h-4 text-amber-400" />
              Solaire & Stacking Météo
            </span>
            <span className="text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
              Heures Dorées
            </span>
          </div>

          <div className="my-2 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Aube / Lever</span>
              <span className="font-mono font-bold text-amber-300 text-sm">{formatTime(solunarData.sunrise)}</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Crépuscule</span>
              <span className="font-mono font-bold text-rose-300 text-sm">{formatTime(solunarData.sunset)}</span>
            </div>
          </div>

          {/* Sélecteur de simulation du Stacking Barométrique */}
          <div className="border-t border-slate-800/80 pt-2 text-[11px]">
            <span className="text-slate-400 block mb-1">Empilement Barométrique (Test) :</span>
            <select
              value={baroTrend}
              onChange={(e) => setBaroTrend(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="RISING_POST_STORM">Hausse post-dépression (+15%)</option>
              <option value="STABLE_HIGH">Anticyclone stable (+8%)</option>
              <option value="FALLING">Chute barométrique (-12%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fenêtres Solunaires : Périodes Majeures & Mineures */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          Fenêtres d'Activité Prédites pour la Journée
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {solunarData.periods.map((period, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-3 border ${
                period.type === 'MAJOR'
                  ? 'bg-indigo-950/40 border-indigo-500/40'
                  : 'bg-slate-950 border-slate-800'
              } flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    period.type === 'MAJOR' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {period.type === 'MAJOR' ? 'Majeure (2h)' : 'Mineure (1h)'}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {period.intensity}%
                  </span>
                </div>
                <div className="font-bold text-slate-100 text-xs mt-2">{period.label}</div>
                <div className="text-sm font-black font-mono text-cyan-400 mt-1">
                  {formatTime(period.start)} - {formatTime(period.end)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Pic exact : <b className="text-white">{formatTime(period.peakTime)}</b>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5">
                {period.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Graphique d'activité horaire (24 heures) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Courbe d'Activité Halieutique Heure par Heure
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" /> Période Majeure
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2.5 h-2.5 bg-cyan-500 rounded-sm" /> Période Mineure
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 md:grid-cols-24 gap-1 items-end h-28 pt-2">
          {solunarData.hourlyActivity.map((item) => (
            <div key={item.hour} className="flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip au survol */}
              <div className="hidden group-hover:block absolute bottom-full mb-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-30">
                {item.hour}h00 : {item.score}%
              </div>

              {/* Barre */}
              <div
                className={`w-full rounded-t transition-all ${
                  item.isMajor
                    ? 'bg-gradient-to-t from-indigo-600 to-cyan-400'
                    : item.isMinor
                    ? 'bg-cyan-500'
                    : 'bg-slate-800'
                }`}
                style={{ height: `${item.score}%` }}
              />
              <span className="text-[9px] text-slate-500 mt-1">{item.hour}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conseil tactique du jour */}
      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-bold text-indigo-200 uppercase tracking-wider">
            Recommandation Tactique Halieutique
          </div>
          <p className="mt-1 text-slate-300 leading-relaxed">
            {solunarData.tacticalAdvice}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Facteur météorologique appliqué : <span className="text-indigo-300 font-semibold">{solunarData.barometricFactorDescription}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
