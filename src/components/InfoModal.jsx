import React from 'react';
import logoImg from '../assets/logo.png';
import { 
  X, 
  Info, 
  User, 
  Code2, 
  Sparkles, 
  Music2, 
  Download, 
  FileText, 
  CheckCircle2, 
  Heart,
  Cpu,
  Layers,
  Smartphone
} from 'lucide-react';

export default function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const isAndroid = typeof window !== 'undefined' && (
    window.Capacitor?.isNativePlatform?.() || 
    /Android/i.test(navigator?.userAgent || '')
  );

  const getAndroidVersion = () => {
    if (typeof navigator !== 'undefined') {
      const match = navigator.userAgent.match(/Android\s([0-9\.]+)/i);
      if (match) return `Android ${match[1]}`;
    }
    return 'Android 14/15';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900">
          <div className="flex items-center space-x-3.5">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.3)] flex-shrink-0">
              <img src={logoImg} alt="SuperMusic PRO" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">SuperMusic</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold uppercase tracking-wider">
                  PRO
                </span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono font-bold">
                  {isAndroid ? 'Android Edition' : 'Desktop Edition'}
                </span>
              </div>
              <p className="text-xs text-emerald-400 font-medium italic">
                Che la Musica sia con te!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Sviluppatore Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Sviluppatore & Ideatore</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-base font-bold text-white">Luca Baglivo</h3>
                <p className="text-xs text-rose-300 mt-1 italic font-medium flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>Sviluppato per mia figlia Ilaria</span>
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-pulse"></span>
                <span>Lead Dev</span>
              </div>
            </div>
          </div>

          {/* Info App & Specifiche */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Specifiche Tecniche & Funzionalità</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start space-x-2.5">
                <Layers className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Versione App</div>
                  <div className="text-emerald-400 font-mono mt-0.5 font-bold">v2.2.8 PRO</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Build 2026.10 Stabile</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start space-x-2.5">
                <Smartphone className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Android Version</div>
                  <div className="text-cyan-300 font-mono mt-0.5 font-bold">
                    {isAndroid ? `${getAndroidVersion()} (APK)` : 'Android & Desktop Ready'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isAndroid ? 'Capacitor Native Standalone' : 'Windows 10/11 x64'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start space-x-2.5">
                <Music2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Brani Completi</div>
                  <div className="text-slate-400 mt-0.5">Streaming intero senza anteprime</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start space-x-2.5">
                <Download className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Download Offline</div>
                  <div className="text-slate-400 mt-0.5">Audio completo con copertine ID3</div>
                </div>
              </div>
            </div>
          </div>

          {/* Caratteristiche Chiave */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pure Music Experience</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-none pl-0">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Nessuna pubblicità e riproduzione continua senza interruzioni</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Brani musicali completi in streaming ad alta fedeltà</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Riproduzione fluida e download offline istantaneo Hi-Fi</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Fatto con passione per la musica</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
