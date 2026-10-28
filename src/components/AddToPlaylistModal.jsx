import React, { useState } from 'react';
import { X, Plus, Check, ListPlus, FolderPlus, Search, CheckCircle2 } from 'lucide-react';

export default function AddToPlaylistModal({
  isOpen,
  onClose,
  track,
  playlists = [],
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onCreateNewPlaylist
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  if (!isOpen || !track) return null;

  const showFeedback = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 2000);
  };

  const handleTogglePlaylist = (playlist) => {
    const isAlreadyIn = (playlist.songs || []).some(s => s.id === track.id);
    if (isAlreadyIn) {
      if (onRemoveFromPlaylist) {
        onRemoveFromPlaylist(playlist.id, track.id);
        showFeedback(`Rimosso da "${playlist.name}"`);
      }
    } else {
      if (onAddToPlaylist) {
        onAddToPlaylist(playlist.id, track);
        showFeedback(`Aggiunto a "${playlist.name}"`);
      }
    }
  };

  const handleCreateAndAdd = (e) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    if (onCreateNewPlaylist) {
      const created = onCreateNewPlaylist(trimmed);
      if (created && onAddToPlaylist) {
        onAddToPlaylist(created.id, track);
        showFeedback(`Creata ed aggiunto a "${created.name}"`);
      }
    }
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const filteredPlaylists = playlists.filter(pl => 
    pl.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div 
        className="bg-[#121824] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
              <ListPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight">Gestione Playlist</h3>
              <p className="text-xs text-emerald-400 truncate font-medium">{track.title}</p>
              <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback alert toast */}
        {feedbackMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{feedbackMsg}</span>
          </div>
        )}

        {/* Search existing playlists filter */}
        {playlists.length > 3 && (
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtra tra le playlist esistenti..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Playlists list */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1 max-h-72">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
            Seleziona una playlist esistente:
          </div>

          {filteredPlaylists.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs space-y-1">
              <p>{searchFilter ? 'Nessuna playlist corrisponde alla ricerca.' : 'Nessuna playlist creata finora.'}</p>
              <p className="text-[11px] text-slate-500">Crea la tua prima playlist dal pulsante in basso!</p>
            </div>
          ) : (
            filteredPlaylists.map((pl) => {
              const alreadyIn = (pl.songs || []).some(s => s.id === track.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => handleTogglePlaylist(pl)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all group ${
                    alreadyIn
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-900/50 hover:bg-slate-800/80 border-slate-800/80 text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <img
                      src={pl.cover}
                      alt={pl.name}
                      className="w-9 h-9 rounded-lg object-cover shadow-sm flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs truncate text-white">{pl.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {pl.songs?.length || 0} {pl.songs?.length === 1 ? 'brano' : 'brani'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {alreadyIn ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Inclusa</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700/60 group-hover:border-emerald-400">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Aggiungi</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer: Create new playlist inline or Close */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 space-y-2">
          {isCreating ? (
            <form onSubmit={handleCreateAndAdd} className="space-y-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-700/80">
              <input
                type="text"
                autoFocus
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nome nuova playlist..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewPlaylistName('');
                  }}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold"
                >
                  Crea e Aggiungi
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreating(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 border border-slate-700/60 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Crea nuova playlist</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Fatto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
