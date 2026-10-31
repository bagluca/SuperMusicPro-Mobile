import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Trash2, 
  FolderDown, 
  Music, 
  HardDrive, 
  RefreshCw, 
  Plus, 
  FolderOpen, 
  Heart,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { musicService } from '../services/musicService';
import { storageService } from '../services/storageService';
import MarqueeText from './MarqueeText';

export default function DownloadsView({ 
  onPlayTrack, 
  onPlayAll,
  currentTrack, 
  isPlaying,
  onOpenAddToPlaylist,
  onToggleLike,
  likedSongsMap = {},
  onDownloadsChanged
}) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const settings = storageService.getSettings();

  const loadDownloads = async () => {
    setLoading(true);
    const list = await musicService.getDownloadedTracks();
    setDownloads(Array.isArray(list) ? list : []);
    setLoading(false);
    if (onDownloadsChanged) onDownloadsChanged();
  };

  useEffect(() => {
    loadDownloads();
  }, [settings.downloadFolder]);

  const sortedDownloads = useMemo(() => {
    const list = [...downloads];
    if (sortBy === 'title-asc') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'it', { sensitivity: 'base' }));
    } else if (sortBy === 'title-desc') {
      list.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'it', { sensitivity: 'base' }));
    } else if (sortBy === 'artist-asc') {
      list.sort((a, b) => {
        const cmp = (a.artist || '').localeCompare(b.artist || '', 'it', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : (a.title || '').localeCompare(b.title || '', 'it', { sensitivity: 'base' });
      });
    } else if (sortBy === 'artist-desc') {
      list.sort((a, b) => {
        const cmp = (b.artist || '').localeCompare(a.artist || '', 'it', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : (b.title || '').localeCompare(a.title || '', 'it', { sensitivity: 'base' });
      });
    }
    return list;
  }, [downloads, sortBy]);

  const handleDelete = async (track, idx) => {
    if (!track) return;
    await musicService.deleteDownloadedTrack(track);
    setDownloads(prev =>
      prev.filter((t, i) => {
        if (i === idx) return false;
        if (track.id && t.id === track.id) return false;
        if (track.videoId && t.videoId && t.videoId === track.videoId) return false;
        if (track.fileName && t.fileName && t.fileName === track.fileName) return false;
        if (track.title && t.title === track.title && t.artist === track.artist) return false;
        return true;
      })
    );
    if (onDownloadsChanged) onDownloadsChanged();
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3500);
      return;
    }
    setConfirmClearAll(false);
    if (musicService.clearAllDownloadedTracks) {
      await musicService.clearAllDownloadedTracks();
    }
    setDownloads([]);
    if (onDownloadsChanged) onDownloadsChanged();
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Audio M4A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden select-none max-w-full">
      {/* Fixed Header Banner */}
      <div className="shrink-0 px-3 md:px-8 pt-3 md:pt-5 pb-3 md:pb-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center space-x-3 md:space-x-3.5">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shrink-0">
              <FolderDown className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>Libreria Locale</span>
                <span className="text-[11px] md:text-xs bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {downloads.length} brani
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Archivio offline su memoria locale
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {sortedDownloads.length > 0 && onPlayAll && (
              <button
                onClick={() => onPlayAll(sortedDownloads, { type: 'local', title: 'Libreria Locale' })}
                className="px-3.5 py-1.5 md:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/25 active:scale-95 shrink-0"
                title="Riproduci tutti i brani della libreria locale"
              >
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>Riproduci Tutti</span>
              </button>
            )}

            {downloads.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shadow-sm shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-1"
                  title="Ordina i brani della libreria"
                >
                  <option value="default" className="bg-slate-900 text-white">Download recenti</option>
                  <option value="title-asc" className="bg-slate-900 text-white">Brano (A - Z)</option>
                  <option value="title-desc" className="bg-slate-900 text-white">Brano (Z - A)</option>
                  <option value="artist-asc" className="bg-slate-900 text-white">Artista (A - Z)</option>
                  <option value="artist-desc" className="bg-slate-900 text-white">Artista (Z - A)</option>
                </select>
              </div>
            )}

            {downloads.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 ${
                  confirmClearAll
                    ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
                    : 'bg-slate-800/80 hover:bg-rose-950/50 text-slate-300 hover:text-rose-400 border-slate-700'
                }`}
                title="Svuota intera libreria offline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmClearAll ? 'Conferma Svuota' : 'Svuota Tutto'}</span>
              </button>
            )}

            <button
              onClick={loadDownloads}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-700 shrink-0"
              title="Aggiorna lista file scaricati"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Aggiorna</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Tracks List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-8 py-3 md:py-4">
        {downloads.length === 0 ? (
          <div className="p-16 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800/60 my-auto">
            <HardDrive className="w-14 h-14 stroke-1 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-semibold text-slate-300">Nessun brano salvato</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Premi il pulsante "Scarica" accanto a qualsiasi canzone nella Home o nei risultati di ricerca per salvarla per l'ascolto offline.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-8">
            {sortedDownloads.map((track, idx) => {
            const isThisPlaying = Boolean(
              isPlaying && currentTrack && (
                (track.id && currentTrack.id && String(track.id) === String(currentTrack.id)) ||
                (track.videoId && currentTrack.videoId && String(track.videoId) === String(currentTrack.videoId)) ||
                (track.fileName && currentTrack.fileName && track.fileName === currentTrack.fileName) ||
                (track.title && currentTrack.title && track.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase() &&
                 track.artist && currentTrack.artist && track.artist.trim().toLowerCase() === currentTrack.artist.trim().toLowerCase())
              )
            );
            return (
              <div
                key={track.id || track.fileName || idx}
                onClick={() => onPlayTrack(track, sortedDownloads, { type: 'local', title: 'Libreria Locale' })}
                className={`flex flex-col p-2.5 md:p-3 rounded-xl transition-all cursor-pointer group border ${
                  isThisPlaying
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                }`}
              >
                {/* Upper row: Index, Artwork, Title & Artist (full width), file size */}
                <div className="flex items-center space-x-3 md:space-x-4 w-full min-w-0">
                  <span className="text-xs text-slate-500 font-mono w-4 text-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="relative w-11 h-11 shrink-0">
                    <img
                      src={track.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}
                      alt={track.title}
                      className="w-full h-full rounded-lg object-cover shadow-sm"
                    />
                    <div className={`absolute inset-0 bg-slate-950/50 rounded-lg flex items-center justify-center ${
                      isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                    <MarqueeText
                      text={track.title}
                      className={`font-semibold text-xs ${isThisPlaying ? 'text-emerald-400' : 'text-white'}`}
                    />
                    <MarqueeText
                      text={track.artist}
                      className="text-[11px] text-slate-400 mt-0.5"
                    />
                  </div>

                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs font-mono text-slate-400">{formatSize(track.fileSize)}</div>
                    <div className="text-[10px] text-emerald-400 font-medium">Offline OK</div>
                  </div>
                </div>

                {/* Actions centered immediately below in the card */}
                <div className="flex items-center justify-center space-x-4 mt-1.5 pt-1.5 border-t border-slate-800/40 w-full z-10">
                  {onOpenAddToPlaylist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddToPlaylist(track);
                      }}
                      className="w-7 h-7 rounded-md bg-slate-800/70 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700/50 shadow-sm"
                      title="Aggiungi a playlist"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onToggleLike && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(track);
                      }}
                      className={`w-7 h-7 rounded-md active:scale-90 flex items-center justify-center transition-all border shadow-sm ${
                        likedSongsMap[track.id]
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border-slate-700/50'
                      }`}
                      title={likedSongsMap[track.id] ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                    >
                      <Heart className={`w-3 h-3 ${likedSongsMap[track.id] ? 'fill-emerald-400' : ''}`} />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(track, idx);
                    }}
                    className="w-7 h-7 rounded-md bg-slate-800/70 hover:bg-rose-950/40 active:scale-90 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-all border border-slate-700/50 shadow-sm"
                    title="Elimina dalla libreria locale"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
