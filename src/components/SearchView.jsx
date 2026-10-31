import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, X, Play, Heart, Disc, Music2, Download, Check, Plus, 
  RefreshCw, Mic, Clock, Trash2, User, Disc3, Volume2 
} from 'lucide-react';
import { musicService, FALLBACK_TRACKS } from '../services/musicService';
import { storageService } from '../services/storageService';
import { DEFAULT_ALBUM_COVER } from '../constants/assets';
import MarqueeText from './MarqueeText';

const FILTER_TABS = [
  { id: 'all', label: 'Tutti', icon: null },
  { id: 'songs', label: 'Brani', icon: Music2 },
  { id: 'artists', label: 'Artisti', icon: User },
  { id: 'albums', label: 'Album', icon: Disc3 },
];

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
  onOpenRecognition,
  searchState,
  setSearchState
}) {
  // If searchState is passed from parent App.jsx, use it; otherwise fallback to local state
  const [localSearchState, setLocalSearchState] = useState({
    query: '',
    results: [],
    filterType: 'all',
    limit: 20,
    hasMore: true
  });

  const state = searchState || localSearchState;
  const updateState = (updater) => {
    if (setSearchState) {
      setSearchState(updater);
    } else {
      setLocalSearchState(updater);
    }
  };

  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [recentSearches, setRecentSearches] = useState(() => storageService.getRecentSearches());

  const scrollContainerRef = useRef(null);
  const playingItemRef = useRef(null);
  const searchReqIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  // Refresh recent searches when component is shown
  useEffect(() => {
    setRecentSearches(storageService.getRecentSearches());
  }, []);

  // Debounced search when query or filterType changes
  useEffect(() => {
    const trimmed = (state.query || '').trim();
    if (!trimmed) {
      updateState(prev => ({
        ...prev,
        results: [],
        hasMore: true,
        limit: 20
      }));
      setIsSearching(false);
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
      return;
    }

    // Instant local preview while typing
    const lowQ = trimmed.toLowerCase();
    const instantHits = FALLBACK_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(lowQ) ||
        t.artist.toLowerCase().includes(lowQ)
    );
    if (instantHits.length > 0 && (!state.results || state.results.length === 0)) {
      updateState(prev => ({ ...prev, results: instantHits }));
    }

    setIsSearching(true);
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
    const reqId = ++searchReqIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const hits = await musicService.searchTracks(trimmed, state.filterType || 'all', 20);
        if (reqId === searchReqIdRef.current) {
          updateState(prev => ({
            ...prev,
            results: hits,
            limit: 20,
            hasMore: hits.length >= 15
          }));
          // Persist in recent searches
          const updatedRecent = storageService.addRecentSearch(trimmed);
          setRecentSearches(updatedRecent);
        }
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        if (reqId === searchReqIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [state.query, state.filterType]);

  // Auto-scroll to currently playing track if present in search results
  useEffect(() => {
    if (playingItemRef.current) {
      try {
        playingItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }
  }, [currentTrack?.id, currentTrack?.videoId, state.results?.length]);

  const handleSearch = (val) => {
    updateState(prev => ({ ...prev, query: val }));
  };

  const handleFilterChange = (newFilter) => {
    if (state.filterType === newFilter) return;
    updateState(prev => ({ ...prev, filterType: newFilter, results: [] }));
  };

  const handleSelectRecent = (queryText) => {
    handleSearch(queryText);
  };

  const handleRemoveRecent = (e, queryText) => {
    e.stopPropagation();
    const updated = storageService.removeRecentSearch(queryText);
    setRecentSearches(updated);
  };

  const handleClearAllRecent = (e) => {
    e.stopPropagation();
    storageService.clearRecentSearches();
    setRecentSearches([]);
  };

  const handleSelectGenre = (genreQuery) => {
    handleSearch(genreQuery);
  };

  const handleLoadMore = async () => {
    const trimmed = (state.query || '').trim();
    if (isSearching || isLoadingMore || loadingMoreRef.current || !state.hasMore || !trimmed) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextLimit = (state.limit || 20) + 20;
      const hits = await musicService.searchTracks(trimmed, state.filterType || 'all', nextLimit);
      if (hits.length <= (state.results || []).length) {
        updateState(prev => ({ ...prev, hasMore: false }));
      } else {
        updateState(prev => ({
          ...prev,
          results: hits,
          limit: nextLimit,
          hasMore: hits.length >= nextLimit - 5
        }));
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 280 && !isSearching && !loadingMoreRef.current && state.hasMore && (state.query || '').trim()) {
      handleLoadMore();
    }
  };

  const handleItemClick = async (item) => {
    if (!item) return;

    if (item.resultType === 'album' && item.browseId) {
      setLoadingItemId(item.id);
      try {
        const albumTracks = await musicService.fetchAlbumTracks(item.browseId, item.artist, item.title);
        if (albumTracks && albumTracks.length > 0) {
          onPlayTrack(albumTracks[0], albumTracks, {
            type: 'search',
            title: `Album: ${item.title}`
          });
        }
      } catch (e) {
        console.warn('Error playing album:', e);
      } finally {
        setLoadingItemId(null);
      }
    } else if (item.resultType === 'artist' && item.browseId) {
      setLoadingItemId(item.id);
      try {
        const artistTracks = await musicService.fetchArtistTopTracks(item.browseId, item.artist || item.title);
        if (artistTracks && artistTracks.length > 0) {
          onPlayTrack(artistTracks[0], artistTracks, {
            type: 'search',
            title: `Artista: ${item.title}`
          });
        }
      } catch (e) {
        console.warn('Error playing artist top tracks:', e);
      } finally {
        setLoadingItemId(null);
      }
    } else {
      // Track item: play with all tracks in current results as queue context
      const trackResults = (state.results || []).filter(r => r.resultType === 'track');
      onPlayTrack(item, trackResults.length > 0 ? trackResults : [item], {
        type: 'search',
        title: state.query || 'Risultati di Ricerca'
      });
    }
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

  const formatDurationStr = (s) => {
    if (!s || isNaN(s)) return '3:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const isQueryActive = Boolean((state.query || '').trim());
  const results = state.results || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden select-none max-w-full">
      {/* Fixed Search Header */}
      <div className="shrink-0 px-3 md:px-6 pt-3 md:pt-4 pb-3 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md z-10 space-y-2.5">
        {/* Search Input Bar + Song Recognition Button */}
        <div className="flex items-center gap-2 max-w-2xl w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={state.query || ''}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cerca brani, artisti, album..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-full pl-11 pr-10 py-2.5 md:py-2.5 text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-400 absolute left-3.5 top-2.5 md:top-3" />
            {(state.query || '') && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3.5 top-2.5 md:top-2.5 p-1 text-slate-400 hover:text-white transition-colors"
                title="Cancella ricerca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {onOpenRecognition && (
            <button
              onClick={onOpenRecognition}
              className="h-10 px-3.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)] active:scale-95 transition-all flex-shrink-0"
              title="Riconosci canzone dall'ambiente"
            >
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="hidden xs:inline">Riconosci</span>
            </button>
          )}
        </div>

        {/* Filter Tabs: Tutti, Brani, Artisti, Album */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          {FILTER_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isTabActive = (state.filterType || 'all') === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all shrink-0 active:scale-95 border ${
                  isTabActive
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Results Header (Fixed at top when searching) */}
        {isQueryActive && (
          <div className="flex items-center justify-between pt-0.5">
            <h2 className="text-xs md:text-sm font-semibold text-white flex items-center gap-2 truncate">
              <span className="truncate">Risultati per "{state.query}"</span>
              <span className="text-xs font-normal text-slate-400 shrink-0">
                {isSearching ? '(ricerca in corso...)' : `(${results.length} risultati)`}
              </span>
            </h2>
          </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={scrollContainerRef} 
        onScroll={handleScroll} 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-6 py-3 md:py-4 select-none"
      >
        {isQueryActive ? (
          <div>
            {results.length === 0 && !isSearching ? (
              <div className="p-12 text-center text-slate-500">
                <Music2 className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">Nessun risultato trovato con questo termine.</p>
                <p className="text-xs text-slate-500 mt-1">Prova a cercare per nome artista, titolo brano o album.</p>
              </div>
            ) : (
              <>
                {/* Visual Legend for Reference Dots */}
                <div className="flex items-center space-x-4 px-2 py-1 mb-2 text-[10px] text-slate-400 select-none">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>Brano</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]"></span>Artista</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]"></span>Album</span>
                </div>

                <div className="space-y-2">
                {results.map((item, idx) => {
                  const isThisPlaying = Boolean(
                    isPlaying && currentTrack && (
                      (item.id && currentTrack.id && String(item.id) === String(currentTrack.id)) ||
                      (item.videoId && currentTrack.videoId && String(item.videoId) === String(currentTrack.videoId)) ||
                      (item.title && currentTrack.title && item.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase() &&
                       item.artist && currentTrack.artist && item.artist.trim().toLowerCase() === currentTrack.artist.trim().toLowerCase())
                    )
                  );

                  const isItemLoading = loadingItemId === item.id;
                  const dlState = downloadingIds[item.videoId || item.id];

                  return (
                  <div
                    key={item.id || idx}
                    ref={isThisPlaying ? playingItemRef : null}
                    onClick={() => handleItemClick(item)}
                    className={`track-item-perf flex flex-col p-2.5 md:p-3 rounded-xl transition-all cursor-pointer group border ${
                      isThisPlaying
                        ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50'
                        : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    {/* Top Row: Index, Artwork, Title & Artist, Duration */}
                    <div className="flex items-center space-x-3 md:space-x-4 w-full min-w-0">
                      {/* Index or Live Playing Icon */}
                      <div className="w-5 text-center shrink-0 flex items-center justify-center">
                        {isThisPlaying ? (
                          <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Artwork with Standard Fallback on Error */}
                      <div className="relative w-11 h-11 shrink-0">
                        <img
                          src={item.cover || DEFAULT_ALBUM_COVER}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_ALBUM_COVER;
                          }}
                          className={`w-full h-full object-cover shadow-sm bg-slate-800 ${
                            item.resultType === 'artist' ? 'rounded-full' : 'rounded-lg'
                          }`}
                        />
                        <div className={`absolute inset-0 bg-slate-950/50 flex items-center justify-center transition-opacity ${
                          item.resultType === 'artist' ? 'rounded-full' : 'rounded-lg'
                        } ${
                          isThisPlaying || isItemLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          {isItemLoading ? (
                            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Metadata & Reference Colored Dot */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Pallino colorato di riferimento: Verde per Brano, Viola per Artista, Arancione per Album */}
                          {item.resultType === 'track' && (
                            <span 
                              className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_#10b981]" 
                              title="Brano" 
                            />
                          )}
                          {item.resultType === 'artist' && (
                            <span 
                              className="w-2 h-2 rounded-full bg-purple-400 shrink-0 shadow-[0_0_6px_#c084fc]" 
                              title="Artista" 
                            />
                          )}
                          {item.resultType === 'album' && (
                            <span 
                              className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_#fbbf24]" 
                              title="Album" 
                            />
                          )}

                          <MarqueeText
                            text={item.title}
                            className={`font-semibold text-xs ${isThisPlaying ? 'text-emerald-400' : 'text-white'}`}
                          />
                        </div>

                        <MarqueeText
                          text={
                            item.resultType === 'artist'
                              ? 'Profilo Artista'
                              : `${item.artist}${item.album && item.album !== 'Singolo' && item.album !== 'Album' ? ` • ${item.album}` : ''}`
                          }
                          className="text-[11px] text-slate-400 mt-0.5"
                        />
                      </div>

                      {/* Formatted Duration */}
                      {item.resultType === 'track' && (
                        <span className="text-xs text-slate-400 font-mono shrink-0 font-medium px-1">
                          {item.formattedDuration || formatDurationStr(item.duration)}
                        </span>
                      )}
                    </div>

                    {/* Tactile Action Buttons centered immediately below inside the card */}
                    {item.resultType === 'track' && (
                      <div className="flex items-center justify-center space-x-6 mt-2 pt-2 border-t border-slate-800/50 w-full z-10">
                        {onOpenAddToPlaylist && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAddToPlaylist(item);
                            }}
                            className="w-9 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm"
                            title="Aggiungi a playlist"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDownload(item, e)}
                          className="w-9 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-slate-300 hover:text-emerald-400 transition-all border border-slate-700/60 shadow-sm"
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
                            onToggleLike(item);
                          }}
                          className={`w-9 h-8 rounded-lg active:scale-90 flex items-center justify-center transition-all border shadow-sm ${
                            likedSongsMap && likedSongsMap[item.id]
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border-slate-700/60'
                          }`}
                          title={likedSongsMap && likedSongsMap[item.id] ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                          <Heart className={`w-3.5 h-3.5 ${likedSongsMap && likedSongsMap[item.id] ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-5 space-x-2.5 text-xs text-emerald-400">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="font-semibold">Caricamento altri risultati...</span>
              </div>
            )}

            {!state.hasMore && results.length >= 20 && (
              <div className="text-center py-6 text-xs text-slate-500 font-medium">
                • Hai raggiunto la fine dei risultati ({results.length} caricati) •
              </div>
            )}
            </>
          )}
        </div>
      ) : (
        /* Empty Query State: Show Recent Searches + Browse Genres */
        <div className="space-y-6">
          {/* Section: Ultime Ricerche */}
          {recentSearches && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Ultime Ricerche</span>
                </div>
                <button
                  onClick={handleClearAllRecent}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center space-x-1 transition-colors"
                  title="Cancella tutte le ricerche recenti"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancella cronologia</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectRecent(item)}
                    className="group flex items-center space-x-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/50 px-3.5 py-2 rounded-full cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-xs text-slate-200 group-hover:text-white font-medium">
                      {item}
                    </span>
                    <button
                      onClick={(e) => handleRemoveRecent(e, item)}
                      className="p-0.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors ml-1"
                      title="Rimuovi"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Sfoglia per Genere & Categoria */}
          <div>
            <h2 className="text-sm md:text-base font-bold text-white mb-3 flex items-center space-x-2">
              <Disc className="w-4 h-4 text-emerald-400" />
              <span>Sfoglia per Genere & Categoria</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-8">
              {GENRE_CARDS.map((card) => (
                <div
                  key={card.name}
                  onClick={() => handleSelectGenre(card.query)}
                  className={`h-24 p-4 rounded-xl bg-gradient-to-br ${card.color} shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all flex flex-col justify-between group overflow-hidden relative border border-white/10`}
                >
                  <span className="font-bold text-sm text-white z-10 leading-tight">
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
        </div>
      )}
      </div>
    </div>
  );
}
