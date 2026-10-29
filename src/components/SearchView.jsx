import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Play, Heart, Disc, Music2, Download, Check, Sparkles, Filter, Plus, RefreshCw, Loader2, Mic } from 'lucide-react';
import { musicService, FALLBACK_TRACKS } from '../services/musicService';
import MarqueeText from './MarqueeText';

const GENRE_CARDS = [
  { name: 'Pop Hits', color: 'from-pink-600 to-rose-700', query: 'pop hits' },
  { name: 'Hip Hop & Urban', color: 'from-amber-600 to-orange-700', query: 'hip hop' },
  { name: 'Musica Italiana', color: 'from-emerald-600 to-teal-700', query: 'musica italiana' },
  { name: 'Electronic & Dance', color: 'from-cyan-600 to-blue-700', query: 'electronic dance' },
  { name: 'Rock & Alternative', color: 'from-red-700 to-rose-900', query: 'rock classics' },
  { name: 'Lo-Fi & Chill', color: 'from-purple-600 to-indigo-800', query: 'lo-fi chill beats' },
  { name: 'Latino & Reggaeton', color: 'from-orange-500 to-rose-600', query: 'reggaeton latino' },
  { name: 'Trap Italia', color: 'from-violet-600 to-purple-800', query: 'trap italia' },
  { name: 'R&B & Soul', color: 'from-fuchsia-700 to-purple-900', query: 'r&b soul' },
  { name: 'Anni 80 & 90', color: 'from-teal-600 to-emerald-800', query: 'musica anni 80 90' },
  { name: 'Musica Classica', color: 'from-blue-700 to-slate-900', query: 'musica classica' },
  { name: 'Jazz & Blues', color: 'from-amber-700 to-stone-800', query: 'jazz blues' },
  { name: 'Metal & Hard Rock', color: 'from-stone-700 to-zinc-900', query: 'heavy metal hard rock' },
  // 7 Nuovi stili musicali
  { name: 'Indie & Cantautori', color: 'from-lime-600 to-emerald-800', query: 'indie cantautori' },
  { name: 'Techno & Club', color: 'from-fuchsia-600 to-indigo-900', query: 'techno club festival' },
  { name: 'Reggae & Dub', color: 'from-emerald-600 via-amber-600 to-red-600', query: 'reggae dub roots' },
  { name: 'Country & Folk', color: 'from-amber-600 to-yellow-800', query: 'country folk' },
  { name: 'Colonne Sonore & Film', color: 'from-slate-700 to-cyan-900', query: 'soundtrack colonne sonore' },
  { name: 'Funk & Disco', color: 'from-yellow-500 to-pink-600', query: 'funk discomusic' },
  { name: 'Acustico & Live', color: 'from-teal-500 to-cyan-800', query: 'acoustic live unplugged' },
];

export default function SearchView({
  onPlayTrack,
  currentTrack,
  isPlaying,
  likedSongsMap,
  onToggleLike,
  onOpenAddToPlaylist,
  onOpenRecognition
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState({});
  const scrollContainerRef = useRef(null);
  const searchReqIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
      setLimit(20);
      setHasMore(true);
      return;
    }

    // Instant local preview while typing for zero-latency responsiveness
    const lowQ = trimmed.toLowerCase();
    const instantHits = FALLBACK_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(lowQ) ||
        t.artist.toLowerCase().includes(lowQ)
    );
    if (instantHits.length > 0 && results.length === 0) {
      setResults(instantHits);
    }

    setIsSearching(true);
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
    const reqId = ++searchReqIdRef.current;
    const timer = setTimeout(async () => {
      const hits = await musicService.searchTracks(trimmed, 'songs', 20);
      if (reqId === searchReqIdRef.current) {
        setResults(hits);
        setIsSearching(false);
        setLimit(20);
        setHasMore(hits.length >= 15);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (val) => {
    setQuery(val);
  };

  const handleLoadMore = async () => {
    if (isSearching || isLoadingMore || loadingMoreRef.current || !hasMore || !query.trim()) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextLimit = limit + 20;
      const hits = await musicService.searchTracks(query.trim(), 'songs', nextLimit);
      if (hits.length <= results.length) {
        setHasMore(false);
      } else {
        setResults(hits);
        setLimit(nextLimit);
        if (hits.length < nextLimit - 5) {
          setHasMore(false);
        }
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 260 && !isSearching && !loadingMoreRef.current && hasMore && query.trim()) {
      handleLoadMore();
    }
  };

  const handleSelectGenre = (genreQuery) => {
    handleSearch(genreQuery);
  };

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
    }
  };

  const formatDuration = (s) => {
    if (!s) return '3:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden select-none max-w-full">
      {/* Fixed Search Header */}
      <div className="shrink-0 px-3 md:px-6 pt-3 md:pt-5 pb-3 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10 space-y-2.5">
        {/* Search Input Bar + Song Recognition Button */}
        <div className="flex items-center gap-2 max-w-xl w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cerca brani, artisti, album..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-full pl-11 pr-10 py-2.5 md:py-3 text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-colors shadow-inner"
            />
            <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-400 absolute left-3.5 top-3 md:top-3.5" />
            {query && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3.5 top-2.5 md:top-3.5 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {onOpenRecognition && (
            <button
              onClick={onOpenRecognition}
              className="h-10 md:h-11 px-3.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)] active:scale-95 transition-all flex-shrink-0"
              title="Riconosci canzone dall'ambiente"
            >
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Riconosci</span>
            </button>
          )}
        </div>

        {/* Results Header (Fixed at top) */}
        {query.trim() && (
          <div className="flex items-center justify-between">
            <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2 truncate">
              <span className="truncate">Risultati per "{query}"</span>
              <span className="text-xs font-normal text-slate-400 shrink-0">
                {isSearching ? '(ricerca in corso...)' : `(${results.length} brani)`}
              </span>
            </h2>
          </div>
        )}
      </div>

      {/* Scrollable Results / Genre Area */}
      <div 
        ref={scrollContainerRef} 
        onScroll={handleScroll} 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-6 py-3 md:py-4 select-none"
      >
        {query.trim() ? (
          <div>
            {results.length === 0 && !isSearching ? (
              <div className="p-12 text-center text-slate-500">
                <Music2 className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">Nessun brano trovato con questo termine.</p>
                <p className="text-xs text-slate-500 mt-1">Prova a cercare per nome artista o titolo canzone.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                {results.map((track, idx) => {
                  const isThisPlaying = Boolean(
                    isPlaying && currentTrack && (
                      (track.id && currentTrack.id && String(track.id) === String(currentTrack.id)) ||
                      (track.videoId && currentTrack.videoId && String(track.videoId) === String(currentTrack.videoId)) ||
                      (track.title && currentTrack.title && track.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase() &&
                       track.artist && currentTrack.artist && track.artist.trim().toLowerCase() === currentTrack.artist.trim().toLowerCase())
                    )
                  );
                  const dlState = downloadingIds[track.videoId || track.id];

                  return (
                  <div
                    key={track.id || idx}
                    onClick={() => onPlayTrack(track, results, { type: 'search', title: query || 'Risultati di Ricerca' })}
                    className={`track-item-perf flex items-center space-x-4 p-3 rounded-xl transition-colors cursor-pointer group border ${
                      isThisPlaying
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <span className="text-xs text-slate-500 font-mono w-4 text-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="relative w-11 h-11 shrink-0">
                      <img
                        src={track.cover}
                        alt={track.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full rounded-lg object-cover shadow-sm"
                      />
                      <div className={`absolute inset-0 bg-slate-950/50 rounded-lg flex items-center justify-center ${
                        isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <MarqueeText
                        text={track.title}
                        className={`font-semibold text-xs ${isThisPlaying ? 'text-emerald-400' : 'text-white'}`}
                      />
                      <MarqueeText
                        text={`${track.artist}${track.album && track.album !== 'Singolo' ? ` • ${track.album}` : ''}`}
                        className="text-[11px] text-slate-400 mt-0.5"
                      />
                    </div>

                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Tactile Action Buttons */}
                    <div className="flex items-center space-x-1 flex-shrink-0 z-10">
                      {onOpenAddToPlaylist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddToPlaylist(track);
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700/50"
                          title="Aggiungi a playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={(e) => handleDownload(track, e)}
                        className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-all border border-slate-700/50"
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
                        className={`w-8 h-8 rounded-lg active:scale-90 flex items-center justify-center transition-all border ${
                          likedSongsMap[track.id]
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                            : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border-slate-700/50'
                        }`}
                        title={likedSongsMap[track.id] ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${likedSongsMap[track.id] ? 'fill-emerald-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-5 space-x-2.5 text-xs text-emerald-400">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="font-semibold">Caricamento altri 20 brani...</span>
              </div>
            )}

            {!hasMore && results.length >= 20 && (
              <div className="text-center py-6 text-xs text-slate-500 font-medium">
                • Hai raggiunto la fine dei risultati ({results.length} brani caricati) •
              </div>
            )}
            </>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-base font-bold text-white mb-4">Sfoglia per Genere & Categoria</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-8">
            {GENRE_CARDS.map((card) => (
              <div
                key={card.name}
                onClick={() => handleSelectGenre(card.query)}
                className={`h-24 p-4 rounded-xl bg-gradient-to-br ${card.color} shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all flex flex-col justify-between group overflow-hidden relative border border-white/10`}
              >
                <span className="font-bold text-sm text-white z-10">
                  {card.name}
                </span>
                <span className="text-[11px] text-white/80 z-10 font-medium">
                  Esplora genere
                </span>
                <Disc className="w-16 h-16 text-white/10 absolute -right-2 -bottom-2 group-hover:rotate-45 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
