import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Shuffle, 
  Heart, 
  Trash2, 
  Plus, 
  Edit3, 
  Music, 
  MoreVertical,
  Check,
  FolderOpen,
  ListPlus,
  Search,
  Loader2,
  Sparkles,
  X,
  ArrowLeft
} from 'lucide-react';
import { musicService } from '../services/musicService';
import MarqueeText from './MarqueeText';

export default function PlaylistView({
  playlist,
  isLikedView = false,
  likedSongs = [],
  onPlayTrack,
  onPlayAll,
  currentTrack,
  isPlaying,
  likedSongsMap = {},
  onToggleLike,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onOpenAddToPlaylist,
  onDeletePlaylist,
  onUpdatePlaylistDetails,
  onBackToPlaylists
}) {
  const songs = isLikedView ? likedSongs : (playlist?.songs || []);
  const title = isLikedView ? 'Brani che ti piacciono' : (playlist?.name || 'Playlist');
  const description = isLikedView 
    ? 'Tutti i tuoi brani preferiti salvati in locale su SuperMusicPro.' 
    : (playlist?.description || 'Collezione personale creata su SuperMusicPro');
  const cover = isLikedView
    ? 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60'
    : (playlist?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDesc, setEditDesc] = useState(playlist?.description || '');
  const [confirmDeletePlaylist, setConfirmDeletePlaylist] = useState(false);

  // Add tracks to this existing playlist state
  const [isAddSearchOpen, setIsAddSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState({});

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await musicService.searchTracks(searchQuery.trim());
        setSearchResults(results.slice(0, 15));
      } catch (err) {
        console.error('Error searching tracks for playlist:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim() || !playlist || !onUpdatePlaylistDetails) return;
    onUpdatePlaylistDetails(playlist.id, {
      name: editName.trim(),
      description: editDesc.trim()
    });
    setIsEditing(false);
  };

  const handleAddSongToPlaylist = (track) => {
    if (onAddTrackToPlaylist) {
      onAddTrackToPlaylist(track);
      setRecentlyAdded(prev => ({ ...prev, [track.id]: true }));
    }
  };

  const isSongInThisPlaylist = (trackId) => {
    return songs.some(s => s.id === trackId) || !!recentlyAdded[trackId];
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden select-none max-w-full">
      {/* Back button to all playlists */}
      {onBackToPlaylists && (
        <div className="px-4 pt-3 pb-1 md:hidden">
          <button
            onClick={onBackToPlaylists}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white py-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Tutte le playlist</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 md:p-8 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-transparent border-b border-slate-800/60 flex flex-col md:flex-row items-start md:items-end space-y-3 md:space-y-0 md:space-x-6">
        <img
          src={cover}
          alt={title}
          className="w-28 h-28 md:w-40 md:h-40 rounded-xl md:rounded-2xl object-cover shadow-2xl border border-slate-700/60 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
            {isLikedView ? 'Collezione Personale' : 'Playlist Personale'}
          </span>

          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="mt-2 space-y-2 max-w-md">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-lg font-bold text-white focus:outline-none"
                placeholder="Nome playlist"
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none"
                placeholder="Descrizione"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
                >
                  Salva
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Annulla
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3 mt-1 mb-2">
                <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight truncate">
                  {title}
                </h1>
                {!isLikedView && onUpdatePlaylistDetails && (
                  <button
                    onClick={() => {
                      setEditName(playlist?.name || '');
                      setEditDesc(playlist?.description || '');
                      setIsEditing(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                    title="Modifica nome e descrizione"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-300 max-w-xl">{description}</p>
            </>
          )}

          <div className="flex items-center space-x-2 text-xs text-slate-400 mt-3 font-medium">
            <span>{songs.length} brani</span>
            <span>•</span>
            <span className="text-emerald-400">Audio Hi-Fi Lossless</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 md:px-8 py-4 md:py-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/40">
        <div className="flex items-center space-x-2.5 md:space-x-3">
          <button
            onClick={() => songs.length > 0 && onPlayAll(songs, { type: 'playlist', id: playlist?.id || 'liked', title: title })}
            disabled={songs.length === 0}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            title="Riproduci tutto"
          >
            <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
          </button>

          <button
            onClick={() => songs.length > 0 && onPlayAll([...songs].sort(() => 0.5 - Math.random()), { type: 'playlist', id: playlist?.id || 'liked', title: title })}
            disabled={songs.length === 0}
            className="p-2.5 md:p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50 shrink-0"
            title="Riproduci in ordine casuale"
          >
            <Shuffle className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Add songs directly to this playlist button */}
          {!isLikedView && onAddTrackToPlaylist && (
            <button
              onClick={() => setIsAddSearchOpen(prev => !prev)}
              className={`px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 md:gap-2 transition-all border ${
                isAddSearchOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
              }`}
              title="Cerca e aggiungi brani a questa playlist"
            >
              <ListPlus className="w-4 h-4 flex-shrink-0" />
              <span>{isAddSearchOpen ? 'Chiudi ricerca' : 'Aggiungi brani'}</span>
            </button>
          )}
        </div>

        {!isLikedView && onDeletePlaylist && playlist && (
          <button
            onClick={() => {
              if (!confirmDeletePlaylist) {
                setConfirmDeletePlaylist(true);
                setTimeout(() => setConfirmDeletePlaylist(false), 3500);
                return;
              }
              setConfirmDeletePlaylist(false);
              onDeletePlaylist(playlist.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              confirmDeletePlaylist
                ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
                : 'bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border-slate-700/60 hover:border-rose-800/50'
            }`}
            title="Elimina questa playlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmDeletePlaylist ? 'Conferma Elimina' : 'Elimina Playlist'}</span>
          </button>
        )}
      </div>

      {/* Integrated Search & Add Drawer / Section */}
      {!isLikedView && onAddTrackToPlaylist && isAddSearchOpen && (
        <div className="mx-8 mt-5 p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Cerca e aggiungi brani alla playlist</span>
            </div>
            <button
              onClick={() => setIsAddSearchOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search input field */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca titolo brano o artista da aggiungere (es. Queen, Coldplay, pop, rock...)"
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results list */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {searchResults.map((track) => {
                const alreadyIn = isSongInThisPlaylist(track.id);
                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-3">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{track.title}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{track.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {alreadyIn ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Aggiunto</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddSongToPlaylist(track)}
                          className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Aggiungi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggested from Liked Songs if no query entered yet */}
          {!searchQuery && likedSongs && likedSongs.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                <span>Suggeriti dai tuoi brani preferiti:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {likedSongs.slice(0, 8).map((track) => {
                  const alreadyIn = isSongInThisPlaylist(track.id);
                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <img src={track.cover} alt={track.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">{track.title}</div>
                          <div className="text-[10px] text-slate-400 truncate">{track.artist}</div>
                        </div>
                      </div>
                      {alreadyIn ? (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddSongToPlaylist(track)}
                          className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition-colors"
                          title="Aggiungi alla playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracks Table */}
      <div className="px-3 md:px-8 py-4 pb-16">
        {songs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800/60 space-y-3">
            <Music className="w-12 h-12 stroke-1 mx-auto text-slate-600" />
            <div>
              <p className="text-sm font-semibold text-slate-300">Questa raccolta è vuota</p>
              <p className="text-xs text-slate-500 mt-1">Cerca canzoni qui sotto oppure usa l'icona "+" nella Home, Ricerca o Player per aggiungerne.</p>
            </div>
            {!isLikedView && onAddTrackToPlaylist && !isAddSearchOpen && (
              <button
                onClick={() => setIsAddSearchOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi i tuoi primi brani</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {songs.map((track, idx) => {
              const isThisPlaying = Boolean(
                isPlaying && currentTrack && (
                  (track.id && currentTrack.id && String(track.id) === String(currentTrack.id)) ||
                  (track.videoId && currentTrack.videoId && String(track.videoId) === String(currentTrack.videoId)) ||
                  (track.fileName && currentTrack.fileName && track.fileName === currentTrack.fileName) ||
                  (track.title && currentTrack.title && track.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase() &&
                   track.artist && currentTrack.artist && track.artist.trim().toLowerCase() === currentTrack.artist.trim().toLowerCase())
                )
              );
              const isLiked = !!(likedSongsMap[track.id] || (track.videoId && likedSongsMap[`yt_${track.videoId}`]));

              return (
                <div
                  key={`${track.id || idx}-${idx}`}
                  onClick={() => onPlayTrack(track, songs, { type: 'playlist', id: playlist?.id || 'liked', title: title })}
                  className={`flex items-center space-x-3 p-2.5 md:p-3 rounded-xl transition-all cursor-pointer group border ${
                    isThisPlaying
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                  }`}
                >
                  {/* Track number / play icon */}
                  <div className="text-xs text-slate-500 font-mono w-5 text-center shrink-0">
                    <span className="group-hover:hidden">{idx + 1}</span>
                    <Play className="w-3.5 h-3.5 fill-current hidden group-hover:inline-block text-white" />
                  </div>

                  {/* Cover */}
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
                  />

                  {/* Title & Artist */}
                  <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                    <MarqueeText
                      text={track.title}
                      className={`text-xs font-semibold ${isThisPlaying ? 'text-emerald-400' : 'text-white'}`}
                    />
                    <MarqueeText
                      text={track.artist}
                      className="text-[11px] text-slate-400 mt-0.5"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 shrink-0 z-10">
                    {onOpenAddToPlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddToPlaylist(track);
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-800/70 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700/60"
                        title="Aggiungi ad altra playlist"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isLikedView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track);
                        }}
                        className={`w-8 h-8 rounded-lg active:scale-90 flex items-center justify-center transition-all border ${
                          isLiked
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border-slate-700/60'
                        }`}
                        title={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-emerald-400' : ''}`} />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isLikedView) {
                          onToggleLike(track);
                        } else if (playlist && onRemoveTrackFromPlaylist) {
                          onRemoveTrackFromPlaylist(playlist.id, track);
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-800/70 hover:bg-rose-500/20 active:scale-90 flex items-center justify-center text-rose-400/90 hover:text-rose-400 transition-all border border-slate-700/60 hover:border-rose-500/40"
                      title={isLikedView ? 'Rimuovi dai brani preferiti' : 'Rimuovi da questa playlist'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
