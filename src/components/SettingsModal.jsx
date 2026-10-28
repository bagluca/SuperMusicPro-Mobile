import React from 'react';
import { 
  X, 
  Settings, 
  Headphones, 
  FolderDown, 
  FolderOpen,
  Palette, 
  Trash2, 
  Check, 
  Sparkles,
  HardDrive
} from 'lucide-react';
import { musicService } from '../services/musicService';

const THEMES = [
  {
    id: 'dark',
    name: 'Dark Studio (Predefinito)',
    color: '#10b981',
    bg: '#0a0d14',
    border: '#10b981'
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    color: '#6366f1',
    bg: '#050711',
    border: '#6366f1'
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    color: '#10b981',
    bg: '#06120d',
    border: '#10b981'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    color: '#ec4899',
    bg: '#0e0517',
    border: '#ec4899'
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    color: '#f97316',
    bg: '#140908',
    border: '#f97316'
  }
];

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) {
  if (!isOpen) return null;

  const currentFolder = settings.downloadFolder || 'SuperMusicPro/downloads/ (Predefinita)';

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.selectDownloadFolder) {
      const selected = await window.electronAPI.selectDownloadFolder();
      if (selected) {
        onUpdateSettings({ ...settings, downloadFolder: selected });
      }
    } else {
      const path = prompt('Inserisci percorso assoluto della cartella di download:', settings.downloadFolder || '');
      if (path !== null) {
        onUpdateSettings({ ...settings, downloadFolder: path.trim() });
      }
    }
  };

  const handleResetFolder = () => {
    onUpdateSettings({ ...settings, downloadFolder: '' });
  };

  const handleOpenFolder = () => {
    musicService.openDownloadFolder(settings.downloadFolder);
  };

  const handleClearCache = () => {
    localStorage.removeItem('supermusicpro_match_cache');
    localStorage.removeItem('supermusicpro_history');
    alert('Cache delle ricerche e cronologia svuotate con successo.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121824] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Impostazioni SuperMusicPro</h3>
              <p className="text-xs text-slate-400">Personalizza temi, cartella di download e motore audio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Section: Temi & Aspetto */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              Temi & Colori Interfaccia
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {THEMES.map((th) => {
                const isSelected = (settings.theme || 'dark') === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => onUpdateSettings({ ...settings, theme: th.id, accentColor: th.color })}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center space-x-3 ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/50 hover:bg-slate-800/50 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg border border-white/20 shadow-sm flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: th.bg }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: th.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {th.name}
                      </div>
                      <div className="text-[10px] text-slate-500">Stile personalizzato</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Cartella di Download */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <FolderDown className="w-3.5 h-3.5 text-cyan-400" />
              Cartella di Download & Brani Offline
            </h4>
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white mb-0.5">Percorso di salvataggio file audio</div>
                  <div className="text-[11px] text-slate-400 font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 truncate" title={currentFolder}>
                    {currentFolder}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSelectFolder}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Sfoglia e cambia cartella...</span>
                </button>

                {settings.downloadFolder && (
                  <button
                    onClick={handleResetFolder}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700"
                  >
                    Ripristina predefinita
                  </button>
                )}

                {settings.downloadFolder && (
                  <button
                    onClick={handleOpenFolder}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700 ml-auto"
                    title="Apri nel visualizzatore file di Windows"
                  >
                    Apri cartella
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section: Motore Audio & Qualita */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
              Motore Audio & Qualità Streaming
            </h4>
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Formato Streaming & Download</div>
                  <div className="text-[11px] text-slate-400">Estrazione stream diretto m4a con yt_dlp</div>
                </div>
                <select
                  value={settings.audioQuality || 'high'}
                  onChange={(e) => onUpdateSettings({ ...settings, audioQuality: e.target.value })}
                  className="bg-slate-950 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="high">Massima Qualità (Opus/M4A 160-320 kbps)</option>
                  <option value="standard">Standard (M4A 128 kbps)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <div className="text-xs font-medium text-white">Riproduzione Automatica (Autoplay)</div>
                  <div className="text-[11px] text-slate-400">Passa automaticamente al brano successivo nella coda</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPlayNext !== false}
                  onChange={(e) => onUpdateSettings({ ...settings, autoPlayNext: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section: Server Desktop & Streaming */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              Connessione Server Desktop / Streaming
            </h4>
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 space-y-3">
              <div>
                <div className="text-xs font-medium text-white mb-1">Indirizzo Server SuperMusic (Backend IP)</div>
                <div className="text-[11px] text-slate-400 mb-2">
                  Permette ad Android di ricevere flussi audio diretti lossless identici alla versione desktop.
                </div>
                <input
                  type="text"
                  value={settings.backendUrl || 'http://192.168.1.33:4545'}
                  onChange={(e) => onUpdateSettings({ ...settings, backendUrl: e.target.value })}
                  placeholder="http://192.168.1.33:4545"
                  className="w-full bg-slate-950 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section: Manutenzione & Info */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Informazioni & Manutenzione
            </h4>
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Svuota Cache Locale</div>
                  <div className="text-[11px] text-slate-400">Cancella cronologia ricerche e cache audio</div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 border border-slate-700 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Svuota Cache
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span>Versione Applicazione</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  v2.2.9 PRO {typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator?.userAgent || '')) ? '(Android Version)' : '(Desktop Edition)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md transition-colors"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
