import React from 'react';
import { 
  Home, 
  Search, 
  Library, 
  Heart, 
  FileText, 
  PlusCircle, 
  FolderDown, 
  Settings, 
  Sparkles,
  Radio,
  Clock,
  Disc3,
  Info
} from 'lucide-react';

export default function Sidebar({
  currentView,
  setCurrentView,
  playlists,
  selectedPlaylistId,
  setSelectedPlaylistId,
  likedCount,
  downloadedCount = 0,
  onOpenSettings,
  onOpenInfo,
  onCreatePlaylist,
  onOpenSleepTimer,
  sleepTimerMinutes
}) {
  return (
    <aside className="hidden md:flex w-64 theme-bg-secondary flex-col h-full border-r theme-border select-none flex-shrink-0">
      {/* Navigation section */}
      <div className="p-4 space-y-1">
        <button
          onClick={() => {
            setCurrentView('home');
            setSelectedPlaylistId(null);
          }}
          className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === 'home' && !selectedPlaylistId
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(29,185,84,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('search');
            setSelectedPlaylistId(null);
          }}
          className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === 'search'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(29,185,84,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Cerca</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('downloads');
            setSelectedPlaylistId(null);
          }}
          className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === 'downloads'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(29,185,84,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <FolderDown className="w-4 h-4 text-emerald-400" />
          <span className="flex-1 text-left">Libreria Locale</span>
          {downloadedCount > 0 && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-semibold">
              {downloadedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setCurrentView('lyrics');
            setSelectedPlaylistId(null);
          }}
          className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === 'lyrics'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(29,185,84,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="flex-1 text-left">Testi sincronizzati</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">LRC</span>
        </button>
      </div>

      {/* Sleep timer widget */}
      <div className="mx-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800/70 mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-xs font-semibold text-white">Sleep Timer</div>
            <div className="text-[10px] text-slate-400">
              {sleepTimerMinutes > 0 ? `Spegnimento in ${sleepTimerMinutes}m` : 'Disattivato'}
            </div>
          </div>
        </div>
        <button
          onClick={onOpenSleepTimer}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
            sleepTimerMinutes > 0
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {sleepTimerMinutes > 0 ? 'Modifica' : 'Imposta'}
        </button>
      </div>

      {/* Library & Playlists */}
      <div className="flex-1 flex flex-col min-h-0 px-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider py-2">
          <span className="flex items-center gap-2">
            <Library className="w-3.5 h-3.5 text-slate-400" />
            La tua Libreria
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={onCreatePlaylist}
              title="Crea nuova playlist"
              className="p-1 hover:text-white hover:bg-slate-800/60 rounded transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Liked songs tab */}
        <button
          onClick={() => {
            setCurrentView('liked');
            setSelectedPlaylistId(null);
          }}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all mb-1.5 ${
            currentView === 'liked'
              ? 'bg-gradient-to-r from-purple-900/40 to-indigo-900/30 text-white border border-purple-500/30 font-medium'
              : 'text-slate-300 hover:bg-slate-800/40'
          }`}
        >
          <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-xs leading-none">Brani che ti piacciono</div>
            <div className="text-[10px] text-slate-500 mt-1">{likedCount} brani salvati</div>
          </div>
        </button>

        {/* Playlists list */}
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 mt-1">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all group ${
                selectedPlaylistId === pl.id
                  ? 'bg-slate-800 text-white font-medium border border-slate-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <button
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setCurrentView('playlist');
                }}
                className="flex items-center space-x-3 flex-1 min-w-0 text-left"
              >
                <img
                  src={pl.cover}
                  alt={pl.name}
                  className="w-7 h-7 rounded-lg object-cover shadow-sm flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium group-hover:text-white">{pl.name}</div>
                  <div className="text-[10px] text-slate-500">{pl.songs?.length || 0} brani</div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Settings & Info */}
      <div className="p-3 border-t border-slate-800/60 flex items-center space-x-1.5 text-xs text-slate-400">
        <button
          onClick={onOpenSettings}
          className="flex items-center space-x-2 p-2 hover:bg-slate-800/50 hover:text-white rounded-lg transition-colors flex-1"
          title="Impostazioni SuperMusicPro"
        >
          <Settings className="w-4 h-4" />
          <span>Impostazioni</span>
        </button>

        {onOpenInfo && (
          <button
            onClick={onOpenInfo}
            className="p-2 hover:bg-slate-800/50 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
            title="Info sull'app e sviluppatore"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
