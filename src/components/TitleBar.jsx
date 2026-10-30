import React from 'react';
import { Minus, Square, X, Info, Mic } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function TitleBar({ 
  title = "SuperMusicPro", 
  onOpenInfo,
  onOpenRecognition
}) {
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close();
    } else {
      window.close();
    }
  };

  return (
    <div 
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className="w-full theme-bg-secondary select-none border-b theme-border z-50 text-xs text-slate-400 flex-shrink-0"
    >
      <div className="w-full h-11 md:h-9 flex items-center justify-between px-3">
        {/* App branding */}
      <div className="flex items-center space-x-2.5 font-medium tracking-wide">
        {/* App Icon + Neon Green Circle */}
        <img src={logoImg} alt="SuperMusic PRO" className="w-5 h-5 rounded-md object-cover shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
        
        {/* SuperMusic with PRO badge in green box */}
        <div className="flex items-center">
          <span className="text-white font-bold text-sm tracking-tight">SuperMusic</span>
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold uppercase tracking-wider ml-1.5">
            PRO
          </span>
        </div>
        
        <span className="text-slate-600 hidden md:inline">•</span>
        <span className="text-slate-300 text-[11px] font-medium hidden md:inline">
          Che la Musica sia con te!
        </span>
      </div>

      {/* Right controls: Recognition button, Info button, Neon Green indicator, and Windows window buttons */}
      <div className="flex items-center space-x-2 -mr-1">
        {onOpenRecognition && (
          <button
            onClick={onOpenRecognition}
            className="px-2 py-1 rounded-lg text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 transition-colors flex items-center space-x-1.5 text-xs font-semibold active:scale-95"
            title="Riconosci canzone dall'ambiente (Shazam)"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold">Riconosci</span>
          </button>
        )}

        {onOpenInfo && (
          <button
            onClick={onOpenInfo}
            className="px-2 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700/60 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
            title="Informazioni sull'app e sviluppatore"
          >
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-slate-200">Info</span>
          </button>
        )}

        {/* Neon Green Online indicator */}
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mr-1" title="SuperMusicPro Online">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-[10px] text-emerald-400 font-semibold tracking-wide hidden sm:inline">ONLINE</span>
        </div>
        {/* Windows window buttons - only on Electron desktop */}
        {typeof window !== 'undefined' && window.electronAPI && (
          <div className="hidden md:flex items-center">
            <button
              onClick={handleMinimize}
              className="w-10 h-8 flex items-center justify-center hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              title="Riduci a icona"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-10 h-8 flex items-center justify-center hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              title="Ingrandisci / Ripristina"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="w-10 h-8 flex items-center justify-center hover:bg-rose-600 text-slate-400 hover:text-white transition-colors"
              title="Chiudi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
