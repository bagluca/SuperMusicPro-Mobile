import React, { useState } from 'react';
import { Library, Plus, Heart, Play, Trash2, Music, Disc3, FolderHeart, Sparkles } from 'lucide-react';
import MarqueeText from './MarqueeText';

export default function PlaylistsOverviewView({
  playlists = [],
  likedCount = 0,
  onSelectPlaylist,
  onOpenLiked,
  onCreatePlaylist,
  onDeletePlaylist,
  onPlayAll
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden select-none max-w-full">
      {/* Fixed View Header */}
      <div className="shrink-0 px-3.5 md:px-8 pt-3 md:pt-5 pb-3 md:pb-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-lg shrink-0">
              <Library className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Le Tue Playlist</span>
                <span className="text-[11px] md:text-xs bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded-full border border-purple-500/30">
                  {playlists.length + (likedCount > 0 ? 1 : 0)} raccolte
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Crea le tue raccolte personali, organizza i tuoi brani e ascolta offline
              </p>
            </div>
          </div>

          <button
            onClick={onCreatePlaylist}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova Playlist</span>
          </button>
        </div>
      </div>

      {/* Scrollable Grid of Playlists */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 md:px-8 py-3 md:py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pb-8">
        {/* Liked Songs Special Card */}
        <div
          onClick={onOpenLiked}
          className="relative p-4 rounded-2xl bg-gradient-to-br from-purple-950/70 via-indigo-950/60 to-slate-900 border border-purple-500/30 hover:border-purple-500/60 shadow-lg cursor-pointer group transition-all duration-200 active:scale-[0.98]"
        >
          <div className="flex items-center space-x-3.5 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg text-white group-hover:scale-105 transition-transform">
              <Heart className="w-6 h-6 fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white tracking-tight group-hover:text-pink-300 transition-colors">
                Brani che ti piacciono
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                I tuoi preferiti salvati
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-purple-500/20 text-xs">
            <span className="font-mono text-purple-300 font-semibold">
              {likedCount} {likedCount === 1 ? 'brano' : 'brani'}
            </span>
            <span className="text-[11px] text-pink-400 font-medium group-hover:underline flex items-center gap-1">
              <span>Apri raccolta</span>
              <span>→</span>
            </span>
          </div>
        </div>

        {/* User Created Custom Playlists */}
        {playlists.map((pl) => {
          const trackList = pl.songs || pl.tracks || [];
          const trackCount = trackList.length;
          const firstCover = trackList[0]?.cover;

          return (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              className="relative p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-850/90 border border-slate-800/80 hover:border-emerald-500/40 shadow-lg cursor-pointer group transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3.5 mb-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0 shadow border border-slate-700/60 group-hover:scale-105 transition-transform">
                  {firstCover ? (
                    <img
                      src={firstCover}
                      alt={pl.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-6 h-6 text-slate-500" />
                  )}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <MarqueeText
                    text={pl.name}
                    className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {pl.description || 'Playlist personalizzata'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="font-mono text-slate-400 font-medium">
                  {trackCount} {trackCount === 1 ? 'brano' : 'brani'}
                </span>

                <div className="flex items-center space-x-1">
                  {trackCount > 0 && onPlayAll && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayAll(trackList, { type: 'playlist', id: pl.id, title: pl.name });
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Riproduci tutti"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}

                  {onDeletePlaylist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDeleteId !== pl.id) {
                          setConfirmDeleteId(pl.id);
                          setTimeout(() => setConfirmDeleteId(prev => prev === pl.id ? null : prev), 3500);
                          return;
                        }
                        setConfirmDeleteId(null);
                        onDeletePlaylist(pl.id);
                      }}
                      className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold border ${
                        confirmDeleteId === pl.id
                          ? 'bg-rose-600 text-white border-rose-400 shadow'
                          : 'bg-slate-800/70 text-rose-400/90 hover:text-rose-400 border-slate-700/60'
                      }`}
                      title="Elimina playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {confirmDeleteId === pl.id && <span>Conferma</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty state prompt if 0 playlists */}
        {playlists.length === 0 && (
          <div
            onClick={onCreatePlaylist}
            className="p-6 rounded-2xl border-2 border-dashed border-slate-800 hover:border-emerald-500/40 bg-slate-900/30 flex flex-col items-center justify-center text-center cursor-pointer group transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-300 group-hover:text-white">
              Crea la tua prima playlist
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tocca qui per dare un nome alla tua raccolta
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
