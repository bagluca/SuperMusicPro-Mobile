import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Sparkles, 
  Flame, 
  Heart, 
  Download, 
  Check, 
  Disc3, 
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { MUSIC_SOURCES, musicService } from '../services/musicService';
import MarqueeText from './MarqueeText';

const HeroBanner = React.memo(function HeroBanner({
  heroTracks,
  onPlayTrack,
  handleDownload,
  downloadingIds,
  onToggleLike,
  likedSongsMap
}) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const heroTrack = heroTracks[heroIndex] || heroTracks[0];

  useEffect(() => {
    if (heroTracks.length <= 1 || isHeroHovered) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroTracks.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [heroTracks.length, isHeroHovered]);

  if (!heroTrack) return null;

  return (
    <div 
      onMouseEnter={() => setIsHeroHovered(true)}
      onMouseLeave={() => setIsHeroHovered(false)}
      className="relative rounded-2xl overflow-hidden p-4 md:p-8 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/20 shadow-xl group transition-colors duration-300"
    >
      {/* Background cover */}
      <div
        key={heroTrack.cover}
        className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${heroTrack.cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10 max-w-xl" key={heroTrack.id || heroTrack.videoId}>
        <div className="flex items-center space-x-2 text-[10px] md:text-xs font-semibold text-emerald-400 mb-1.5 md:mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="uppercase tracking-wider">In Evidenza su SuperMusic PRO</span>
          <span className="bg-emerald-500/15 border border-emerald-500/30 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full text-emerald-300 font-bold uppercase tracking-wider">
            Top Tendenza #{heroIndex + 1}
          </span>
        </div>

        <h1 className="text-xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-1 md:mb-2 truncate" title={heroTrack.title}>
          {heroTrack.title}
        </h1>
        <p className="text-slate-300 text-xs md:text-base mb-3 md:mb-5 font-medium truncate" title={heroTrack.artist}>
          {heroTrack.artist}
        </p>

        <div className="flex items-center space-x-2 md:space-x-3">
          <button
            onClick={() => onPlayTrack(heroTrack, heroTracks, { type: 'home', title: 'Ultime Uscite' })}
            className="px-4 md:px-6 py-2 md:py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm shadow-[0_0_20px_rgba(29,185,84,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 md:gap-2 shrink-0"
          >
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-slate-950" />
            <span>Ascolta Ora</span>
          </button>

          <button
            onClick={(e) => handleDownload(heroTrack, e)}
            className="px-3 md:px-4 py-2 md:py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition-colors flex items-center gap-1.5 text-[11px] md:text-xs font-medium"
            title="Scarica per ascolto offline"
          >
            {downloadingIds[heroTrack.videoId || heroTrack.id] === 'done' ? (
              <>
                <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400" />
                <span>Scaricato!</span>
              </>
            ) : (
              <>
                <Download className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400" />
                <span>Scarica</span>
              </>
            )}
          </button>

          <button
            onClick={() => onToggleLike(heroTrack)}
            className="p-2 md:p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition-colors"
            title="Salva nei preferiti"
          >
            <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${likedSongsMap[heroTrack.id] ? 'fill-emerald-400 text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dots Indicator for Trending Banner */}
      {heroTracks.length > 1 && (
        <div className="absolute bottom-4 right-6 z-20 flex items-center space-x-1.5">
          {heroTracks.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setHeroIndex(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === heroIndex 
                  ? 'w-6 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                  : 'w-1.5 bg-slate-700/80 hover:bg-slate-500'
              }`}
              title={`Brano in tendenza ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function HomeView({
  tracks = [],
  selectedCategory,
  setSelectedCategory,
  selectedSource = 'all',
  setSelectedSource,
  onPlayTrack,
  currentTrack,
  isPlaying,
  likedSongsMap,
  onToggleLike,
  onOpenAddToPlaylist
}) {
  const [downloadingIds, setDownloadingIds] = useState({});

  // Trending tracks for the hero carousel
  const heroTracks = React.useMemo(() => (tracks.length > 0 ? tracks.slice(0, 8) : []), [tracks]);

  const handleDownload = async (track, e) => {
    e.stopPropagation();
    const id = track.videoId || track.id;
    setDownloadingIds(prev => ({ ...prev, [id]: 'loading' }));
    const ok = await musicService.downloadTrack(track);
    if (ok) {
      setDownloadingIds(prev => ({ ...prev, [id]: 'done' }));
      setTimeout(() => {
        setDownloadingIds(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 3000);
    } else {
      setDownloadingIds(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 md:px-6 py-3 md:py-6 space-y-4 md:space-y-8 select-none max-w-full">
      {/* Hero Featured Trending Carousel Banner */}
      <HeroBanner
        heroTracks={heroTracks}
        onPlayTrack={onPlayTrack}
        handleDownload={handleDownload}
        downloadingIds={downloadingIds}
        onToggleLike={onToggleLike}
        likedSongsMap={likedSongsMap}
      />

      {/* Open Music Sources Selector - Clean 4-Grid without scrollbar */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fonti Musicali</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Streaming Open</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 md:gap-2 w-full">
          {MUSIC_SOURCES.map((src) => {
            const isSelected = (selectedSource || 'all') === src.id;
            const shortName = 
              src.id === 'all' ? 'Tutte' :
              src.id === 'youtube' ? 'YouTube' :
              src.id === 'spotify' ? 'Spotify' :
              src.id === 'apple' ? 'Apple' : src.name;

            return (
              <button
                key={src.id}
                onClick={() => setSelectedSource && setSelectedSource(src.id)}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 border active:scale-95 text-center ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  src.id === 'youtube' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                  src.id === 'spotify' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' :
                  src.id === 'apple' ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                }`} />
                <span className="truncate tracking-tight font-medium">
                  <span className="sm:hidden">{shortName}</span>
                  <span className="hidden sm:inline">{src.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Picks / Brani in Tendenza */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <span>Ultime Uscite & Tendenze ({selectedSource === 'all' ? 'Tutte le Fonti' : selectedSource === 'youtube' ? 'YouTube Music' : selectedSource === 'spotify' ? 'Spotify & FIMI' : 'Apple Music'})</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Nuove uscite discografiche aggiornate per YouTube Music, Spotify & FIMI e Apple Music
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">{tracks.length > 0 ? `${tracks.length} brani` : 'Caricamento...'}</span>
        </div>

        {tracks.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center gap-2.5 animate-pulse">
                <div className="w-12 h-12 rounded-lg bg-slate-800/70 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-800/80 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-800/50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">
          {tracks.map((track) => {
            const isThisPlaying = Boolean(
              isPlaying && currentTrack && (
                (track.id && currentTrack.id && String(track.id) === String(currentTrack.id)) ||
                (track.videoId && currentTrack.videoId && String(track.videoId) === String(currentTrack.videoId)) ||
                (track.title && currentTrack.title && track.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase() &&
                 track.artist && currentTrack.artist && track.artist.trim().toLowerCase() === currentTrack.artist.trim().toLowerCase())
              )
            );
            const dlState = downloadingIds[track.videoId || track.id];
            const isLiked = !!(likedSongsMap[track.id] || (track.videoId && likedSongsMap[`yt_${track.videoId}`]));

            return (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track, tracks, { type: selectedCategory && selectedCategory !== 'all' ? 'category' : 'home', category: selectedCategory, title: 'Tendenze' })}
                className={`track-item-perf relative p-2.5 rounded-xl transition-colors flex flex-col justify-between gap-2 cursor-pointer group border overflow-hidden ${
                  isThisPlaying
                    ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Upper row: Cover + Title & Artist (full width) */}
                <div className="flex items-center gap-2.5 w-full min-w-0">
                  <div className="relative w-12 h-12 shrink-0">
                    <img
                      src={track.cover}
                      alt={track.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-lg object-cover shadow"
                    />
                    <div className={`absolute inset-0 bg-slate-950/50 rounded-lg flex items-center justify-center ${
                      isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Text container */}
                  <div className="flex-1 min-w-0 py-0.5 overflow-hidden">
                    <MarqueeText
                      text={track.title}
                      className={`text-xs font-semibold ${isThisPlaying ? 'text-emerald-400' : 'text-white'}`}
                    />
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                      <MarqueeText
                        text={track.artist}
                        className="text-[11px] text-slate-400"
                      />
                      {track.source && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0 leading-none ${
                          track.source.includes('Spotify')
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : track.source.includes('Apple')
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                        }`}>
                          {track.source.includes('Spotify') ? 'Spotify' : track.source.includes('Apple') ? 'Apple' : 'YT'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tactile Action Buttons centered immediately below in the card */}
                <div className="flex items-center justify-center space-x-6 pt-1.5 border-t border-slate-800/40 w-full z-10">
                  {onOpenAddToPlaylist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddToPlaylist(track);
                      }}
                      className="w-9 h-8 rounded-lg bg-slate-800/70 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700/60"
                      title="Aggiungi a una playlist"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDownload(track, e)}
                    className={`w-9 h-8 rounded-lg active:scale-90 flex items-center justify-center transition-all border ${
                      dlState === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border-slate-700/60'
                    }`}
                    title="Scarica per ascolto offline"
                  >
                    {dlState === 'loading' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : dlState === 'done' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(track);
                    }}
                    className={`w-9 h-8 rounded-lg active:scale-90 flex items-center justify-center transition-all border ${
                      isLiked
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border-slate-700/60'
                    }`}
                    title={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
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
