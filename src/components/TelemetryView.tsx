import React, { useState } from 'react';
import { useNavigationStore } from '../store/useNavigationStore';
import { SignalKService } from '../services/SignalKService';
import { AisDecoder } from '../utils/AisDecoder';
import {
  Radio,
  Activity,
  AlertTriangle,
  Send,
  Shield,
  Layers,
  Cpu,
  Compass,
  CheckCircle,
} from 'lucide-react';

export const TelemetryView: React.FC = () => {
  const {
    vessel,
    signalKConnected,
    signalKServerUrl,
    nmeaSentenceCount,
    aisTargets,
    cpaAlarmThresholdNM,
    tcpaAlarmThresholdMinutes,
    activeCollisionAlert,
    setSignalKServerUrl,
    setCpaThresholds,
  } = useNavigationStore();

  const [rawNmeaInput, setRawNmeaInput] = useState('!AIVDM,1,1,,B,15N43R0P00rCH<hN4OD000?v0000,0*12');
  const [testLog, setTestLog] = useState<string[]>([]);

  const handleTestInject = () => {
    if (!rawNmeaInput.trim()) return;
    SignalKService.getInstance().handleRawNmea(rawNmeaInput.trim());
    const decoded = AisDecoder.parseSentence(rawNmeaInput.trim());
    if (decoded) {
      setTestLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Décodé avec succès: MMSI ${decoded.mmsi} | SOG: ${decoded.sog ?? 'N/A'} kn | Pos: ${decoded.position ? `${decoded.position.latitude.toFixed(4)}, ${decoded.position.longitude.toFixed(4)}` : 'N/A'}`,
        ...prev.slice(0, 7),
      ]);
    } else {
      setTestLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Erreur décodage ou trame incomplète : ${rawNmeaInput}`,
        ...prev.slice(0, 7),
      ]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-6">
      {/* En-tête statut Signal K */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400" />
              Télémétrie Navale & Passerelle Signal K / NMEA
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
              signalKConnected
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : 'bg-red-950 text-red-400 border-red-800'
            }`}>
              {signalKConnected ? 'WebSocket Actif' : 'Déconnecté'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Décodage matériel asynchrone des flux NMEA 0183 / 2000 et serveur Signal K local (mDNS)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-slate-400">Trames traitées :</span>
            <span className="font-mono font-bold text-cyan-300">{nmeaSentenceCount}</span>
          </div>
        </div>
      </div>

      {/* Matrice anticollision AIS & Cibles Détectées */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Cibles AIS Détectées ({aisTargets.size}) & Calcul Anticollision (CPA / TCPA)
            </h3>
          </div>

          {/* Réglage des seuils d'alarme */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Seuil Alarme :</span>
            <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-amber-300 font-mono">
              &lt; {cpaAlarmThresholdNM} NM &amp; &lt; {tcpaAlarmThresholdMinutes} min
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">MMSI / Nom</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Position</th>
                <th className="py-2.5 px-3">SOG (kn)</th>
                <th className="py-2.5 px-3">COG (°)</th>
                <th className="py-2.5 px-3">CPA (NM)</th>
                <th className="py-2.5 px-3">TCPA (min)</th>
                <th className="py-2.5 px-3">Statut Risque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {Array.from(aisTargets.values()).map((target) => (
                <tr
                  key={target.mmsi}
                  className={`hover:bg-slate-900/50 transition-colors ${
                    target.isDangerous ? 'bg-red-950/30 text-red-200' : 'text-slate-300'
                  }`}
                >
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {target.name || target.mmsi}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400">
                    {target.shipType === 60 ? 'Passagers' : target.shipType === 70 ? 'Cargo' : target.shipType === 30 ? 'Pêche' : 'Service'}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400">
                    {target.position.latitude.toFixed(3)}°N, {Math.abs(target.position.longitude).toFixed(3)}°W
                  </td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">{target.sog.toFixed(1)}</td>
                  <td className="py-2.5 px-3">{Math.round(target.cog)}°</td>
                  <td className={`py-2.5 px-3 font-bold ${target.cpa < cpaAlarmThresholdNM ? 'text-red-400' : 'text-slate-200'}`}>
                    {target.cpa.toFixed(2)} NM
                  </td>
                  <td className={`py-2.5 px-3 font-bold ${target.tcpa > 0 && target.tcpa < tcpaAlarmThresholdMinutes ? 'text-red-400' : 'text-slate-200'}`}>
                    {target.tcpa > 0 ? `${target.tcpa.toFixed(1)} min` : 'Éloignement'}
                  </td>
                  <td className="py-2.5 px-3">
                    {target.isDangerous ? (
                      <span className="bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                        DANGER ABORDAGE
                      </span>
                    ) : (
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                        Sécurisé
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Injecteur et testeur de trames NMEA AIVDM 6-bits */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Banc de Test & Décodage AIVDM 6-Bits (ITU-R M.1371)
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Injectez une phrase NMEA AIS brute pour éprouver l'algorithme de désarmement ASCII et d'extraction de bits en temps réel.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={rawNmeaInput}
            onChange={(e) => setRawNmeaInput(e.target.value)}
            placeholder="!AIVDM,..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleTestInject}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Injecter & Décoder
          </button>
        </div>

        {/* Historique du banc de test */}
        {testLog.length > 0 && (
          <div className="mt-3 bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] space-y-1 text-slate-300">
            {testLog.map((log, i) => (
              <div key={i} className="text-emerald-400">{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
