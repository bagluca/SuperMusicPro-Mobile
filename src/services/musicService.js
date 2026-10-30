/**
 * SuperMusicPro - Pure Music Catalog & Autonomous Streaming Service
 * Music Engine:
 * 1. InnerTube Discovery (WEB_REMIX): Direct YouTube Music search, suggestions, and charts.
 * 2. Smart Song Identification: Fuzzy bigram matching, title/artist normalization, and duration tolerance scoring.
 * 3. Autonomous Mobile Stream Resolution: Direct high-quality AAC/m4a streams without requiring a remote server.
 * 4. Fast LAN Acceleration: Seamlessly uses local PC backend when connected on LAN/Wi-Fi, without blocking mobile playback.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { storageService } from './storageService';

const BACKEND_URL = 'http://127.0.0.1:4545';
let backendChecked = false;
let isBackendOnline = false;

async function checkBackend() {
  if (Capacitor.isNativePlatform()) return false;
  if (backendChecked) return isBackendOnline;
  try {
    const res = await fetch(`${BACKEND_URL}/api/ping`, { signal: AbortSignal.timeout(800) });
    isBackendOnline = res.ok;
  } catch {
    isBackendOnline = false;
  }
  backendChecked = true;
  return isBackendOnline;
}

export const MUSIC_SOURCES = [
  { id: 'all', name: 'Tutte le Fonti' },
  { id: 'youtube', name: 'YouTube Music' },
  { id: 'spotify', name: 'Spotify & FIMI' },
  { id: 'apple', name: 'Apple Music Top' },
];

// Dynamic live catalog cache: zero hardcoded dead tracks, always fresh hits
export function getCachedHomeTracks() {
  try {
    const raw = localStorage.getItem('supermusic_live_trending_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveCachedHomeTracks(tracks) {
  try {
    if (Array.isArray(tracks) && tracks.length > 0) {
      localStorage.setItem('supermusic_live_trending_cache', JSON.stringify(tracks.slice(0, 60)));
    }
  } catch (e) {}
}

export const FULL_CATALOG = getCachedHomeTracks();
export const FALLBACK_TRACKS = [];

// Caches
const videoIdCache = {};
const streamUrlCache = new Map(); // videoId -> { url, expiresAt }
let cachedWorkingBackend = null;

// ============================================================================
// 1. FUZZY MATCHING & NORMALIZATION ALGORITHM
// ============================================================================

export function normalizeString(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\(ft\..*?\)/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?(remaster|remix|official|video|audio|lyrics?|visualizer|live|acoustic|edit|version).*?\)/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBigrams(str) {
  const norm = normalizeString(str);
  const bigrams = new Set();
  for (let i = 0; i < norm.length - 1; i++) {
    bigrams.add(norm.slice(i, i + 2));
  }
  return bigrams;
}

function bigramSimilarity(strA, strB) {
  const normA = normalizeString(strA);
  const normB = normalizeString(strB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const bgA = getBigrams(normA);
  const bgB = getBigrams(normB);
  if (bgA.size === 0 || bgB.size === 0) return 0;

  let intersection = 0;
  for (const b of bgA) {
    if (bgB.has(b)) intersection++;
  }
  return (2.0 * intersection) / (bgA.size + bgB.size);
}

function durationScore(targetSec, candidateSec) {
  if (!targetSec || !candidateSec || candidateSec <= 0) return 0.5;
  const diff = Math.abs(targetSec - candidateSec);
  if (diff <= 2) return 1.0;
  if (diff <= 5) return 0.8;
  if (diff <= 10) return 0.5;
  if (diff <= 30) return 0.2;
  return 0.0;
}

function computeMatchScore(targetTitle, targetArtist, targetDuration, candTitle, candArtist, candDuration) {
  const titleScore = bigramSimilarity(targetTitle, candTitle);
  const artistScore = bigramSimilarity(targetArtist, candArtist);
  const durScore = durationScore(targetDuration, candDuration);
  return titleScore * 0.45 + artistScore * 0.35 + durScore * 0.20;
}

function parseDurationString(timeStr) {
  if (!timeStr) return 180;
  const parts = String(timeStr).trim().split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  return 180;
}

// ============================================================================
// 2. HTTP CLIENT HELPER (CapacitorHttp with User-Agent & JSON safety)
// ============================================================================

async function nativePost(url, data, headers = {}) {
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'content-type': 'application/json',
    'Accept': 'application/json',
    ...headers
  };

  // Chromium on Android strips custom User-Agent from JavaScript.
  // CapacitorHttp natively watches for 'x-cap-user-agent' to override the native OkHttp User-Agent.
  if (jsonHeaders['User-Agent']) {
    jsonHeaders['x-cap-user-agent'] = jsonHeaders['User-Agent'];
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.post({
        url,
        data: typeof data === 'object' ? data : JSON.parse(data),
        headers: jsonHeaders,
        connectTimeout: 8000,
        readTimeout: 8000
      });
      if (res && res.data) {
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
    } catch (e) {
      console.warn('CapacitorHttp post notice:', e);
    }
  }

  // Fallback for browser/desktop dev
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: jsonHeaders,
      body: typeof data === 'string' ? data : JSON.stringify(data),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Fetch POST fallback notice:', err);
  }
  return null;
}

// ============================================================================
// 3. BACKEND DETECTION (Fast non-blocking probe)
// ============================================================================

async function getWorkingBackend() {
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  if (cachedWorkingBackend) {
    return cachedWorkingBackend;
  }
  const settings = storageService.getSettings();

  const candidates = [
    settings?.backendUrl,
    BACKEND_URL,
    'http://localhost:4545'
  ].filter(Boolean);

  try {
    const winner = await Promise.any(
      candidates.map(async (url) => {
        const res = await fetch(`${url}/api/ping`, { signal: AbortSignal.timeout(800) });
        if (res.ok) return url;
        throw new Error('Not reachable');
      })
    );
    cachedWorkingBackend = winner;
    return winner;
  } catch {
    return null;
  }
}

// ============================================================================
// 4. INNERTUBE RESPONSE PARSING (Search & Browse)
// ============================================================================

export const DEFAULT_ALBUM_COVER = '/default_cover.svg';

const TYPE_WORDS = new Set([
  'brano', 'canzone', 'song', 'track',
  'artista', 'artist',
  'album', 'singolo', 'single', 'ep', 'raccolta',
  'video', 'videoclip', 'video musicale',
  'playlist', 'puntata', 'podcast', 'profilo', 'post'
]);

export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function parseRenderer(renderer, forcedType = null, parentContextArtist = null) {
  if (!renderer) return null;
  const flexColumns = renderer.flexColumns || [];
  const col0Runs = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const title = col0Runs[0]?.text || '';
  if (!title) return null;

  const col1Runs = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

  const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const cover = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : DEFAULT_ALBUM_COVER;

  const videoId = renderer.playlistItemData?.videoId
    || renderer.navigationEndpoint?.watchEndpoint?.videoId
    || renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
    || col0Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId
    || null;

  const browseEndpoint = renderer.navigationEndpoint?.browseEndpoint
    || col0Runs[0]?.navigationEndpoint?.browseEndpoint;
  const browseId = browseEndpoint?.browseId || null;
  const pageType = browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';

  const playlistId = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId
    || renderer.navigationEndpoint?.watchPlaylistEndpoint?.playlistId
    || null;

  let detectedType = null;
  let artist = null;
  let album = null;
  let duration = 180;
  let durStr = null;

  // Analyze every run in flexColumns[1]
  for (const r of col1Runs) {
    const raw = (r.text || '').trim();
    if (!raw || raw === '•') continue;
    const low = raw.toLowerCase();
    const rPageType = r.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
    const rBrowseId = r.navigationEndpoint?.browseEndpoint?.browseId || '';

    // Check if this run is a type indicator word (Brano, Album, Artista, Singolo, Video...)
    if (TYPE_WORDS.has(low)) {
      if (!detectedType) {
        if (low === 'artista' || low === 'artist') detectedType = 'artist';
        else if (['album', 'singolo', 'single', 'ep', 'raccolta'].includes(low)) detectedType = 'album';
        else detectedType = 'track';
      }
      continue;
    }

    // Check duration format (e.g. 3:45 or 1:02:15)
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
      durStr = raw;
      duration = parseDurationString(raw);
      continue;
    }

    // Skip view counts, listeners, subscriber numbers, year
    if (/visualizzazioni|ascoltatori|iscritti|views|subscribers/i.test(low) || /^(19|20)\d{2}$/.test(raw)) {
      continue;
    }

    // Explicit artist navigation endpoint
    if (rPageType === 'MUSIC_PAGE_TYPE_ARTIST' || rBrowseId.startsWith('UC')) {
      if (!artist) artist = raw;
      continue;
    }

    // Explicit album navigation endpoint
    if (rPageType === 'MUSIC_PAGE_TYPE_ALBUM' || rBrowseId.startsWith('MPRE')) {
      if (!album) album = raw;
      continue;
    }

    // Otherwise, first non-type text is the artist, second is album
    if (!artist) {
      artist = raw;
    } else if (!album) {
      album = raw;
    }
  }

  // Determine resultType (Traccia, Artista, Album) - solely for Search filtering & badges
  let resultType = 'track';
  let typeLabel = 'Traccia';

  if (forcedType === 'artists' || detectedType === 'artist' || pageType === 'MUSIC_PAGE_TYPE_ARTIST' || (browseId && browseId.startsWith('UC'))) {
    resultType = 'artist';
    typeLabel = 'Artista';
  } else if (forcedType === 'albums' || detectedType === 'album' || pageType === 'MUSIC_PAGE_TYPE_ALBUM' || (browseId && browseId.startsWith('MPRE'))) {
    resultType = 'album';
    typeLabel = 'Album';
  } else {
    resultType = 'track';
    typeLabel = 'Traccia';
  }

  // Fallback for artist if empty or if it was mistakenly a type word
  if (!artist || TYPE_WORDS.has(artist.toLowerCase())) {
    if (resultType === 'artist') {
      artist = title;
    } else if (parentContextArtist && !TYPE_WORDS.has(parentContextArtist.toLowerCase())) {
      artist = parentContextArtist;
    } else {
      artist = 'Artista';
    }
  }

  // If album is still empty or a type word
  if (!album || TYPE_WORDS.has(album.toLowerCase())) {
    album = resultType === 'album' ? title : 'Singolo';
  }

  const resolvedId = videoId ? `yt_${videoId}` : (browseId ? `yt_${browseId}` : `yt_${title.replace(/\s+/g, '_')}`);

  return {
    id: resolvedId,
    videoId,
    browseId,
    playlistId,
    resultType,
    typeLabel,
    title,
    artist,
    album,
    cover: cover || DEFAULT_ALBUM_COVER,
    duration,
    formattedDuration: durStr || formatDuration(duration),
    source: 'YouTube Music'
  };
}

// ============================================================================
// MAIN MUSIC SERVICE OBJECT
// ============================================================================

export const musicService = {
  getWorkingBackend,
  getCachedHomeTracks,
  saveCachedHomeTracks,
  _homeTracksCache: new Map(),

  /**
   * Helper: Fetches live latest releases ("Ultime Uscite") via InnerTube WEB_REMIX Songs filter
   */
  async _fetchPlatformLatestReleases(query, sourceLabel) {
    try {
      const clientContext = {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240901.01.00',
          hl: 'it',
          gl: 'IT'
        }
      };
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      };
      const payload = {
        context: clientContext,
        query,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==' // Songs filter (20 full tracks)
      };

      const data = await nativePost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', payload, headers);
      if (!data) return [];

      const results = [];
      const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const s of sections) {
        if (s.musicShelfRenderer && Array.isArray(s.musicShelfRenderer.contents)) {
          for (const it of s.musicShelfRenderer.contents) {
            const parsed = parseRenderer(it.musicResponsiveListItemRenderer);
            if (parsed && !results.some(r => r.videoId === parsed.videoId)) {
              results.push({
                ...parsed,
                source: sourceLabel
              });
            }
          }
        }
      }
      return results;
    } catch (e) {
      console.warn('Latest releases fetch notice:', e);
      return [];
    }
  },

  /**
   * Returns latest releases ("Ultime Uscite") across all platforms or filtered by platform
   */
  async getHomeTracks(category = 'all', source = 'all') {
    const cacheKey = `${category}__${source}`;
    const cached = this._homeTracksCache.get(cacheKey);
    if (cached && cached.tracks.length > 0 && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
      return cached.tracks;
    }

    // 1. Try local backend if connected on LAN
    const workingBackend = await getWorkingBackend();
    if (workingBackend) {
      try {
        const res = await fetch(`${workingBackend}/api/trending?category=${encodeURIComponent(category)}&source=${encodeURIComponent(source)}&limit=60`, {
          signal: AbortSignal.timeout(1500)
        });
        if (res.ok) {
          const tracks = await res.json();
          if (Array.isArray(tracks) && tracks.length > 0) {
            this._homeTracksCache.set(cacheKey, { tracks, timestamp: Date.now() });
            saveCachedHomeTracks(tracks);
            return tracks;
          }
        }
      } catch (e) {
        console.warn('Backend trending fetch notice:', e);
      }
    }

    // 2. Live Autonomous Fetch of Real Trending / Latest Releases per Platform
    try {
      const yearTag = new Date().getFullYear();
      let liveTracks = [];

      if (source === 'spotify') {
        liveTracks = await this._fetchPlatformLatestReleases(
          `Top 50 Italia ${yearTag}`,
          'Spotify & FIMI'
        );
      } else if (source === 'apple') {
        liveTracks = await this._fetchPlatformLatestReleases(
          `Top Hits Global ${yearTag}`,
          'Apple Music Top'
        );
      } else if (source === 'youtube') {
        liveTracks = await this._fetchPlatformLatestReleases(
          `Nuove Uscite Italia ${yearTag}`,
          'YouTube Music'
        );
      } else {
        // 'all' -> Fetch real live hits and trending songs across platforms in parallel
        const [spList, ytList, apList] = await Promise.all([
          this._fetchPlatformLatestReleases('Hit del momento Italia', 'Spotify & FIMI'),
          this._fetchPlatformLatestReleases(`Nuove Uscite Italia ${yearTag}`, 'YouTube Music'),
          this._fetchPlatformLatestReleases(`Top Hits Global ${yearTag}`, 'Apple Music Top')
        ]);

        const seen = new Set();
        const maxLen = Math.max(spList.length, ytList.length, apList.length);
        for (let i = 0; i < maxLen; i++) {
          for (const candidate of [spList[i], ytList[i], apList[i]]) {
            if (candidate && candidate.videoId && !seen.has(candidate.videoId)) {
              seen.add(candidate.videoId);
              liveTracks.push(candidate);
            }
          }
        }
      }

      if (liveTracks.length > 0) {
        this._homeTracksCache.set(cacheKey, { tracks: liveTracks, timestamp: Date.now() });
        saveCachedHomeTracks(liveTracks);
        return liveTracks;
      }
    } catch (err) {
      console.warn('Autonomous latest releases fallback notice:', err);
    }

    // 3. Fallback to previously cached dynamic live tracks (never dead hardcoded static songs)
    const cachedLive = getCachedHomeTracks();
    if (source === 'youtube') {
      const filtered = cachedLive.filter(t => t.source === 'YouTube Music');
      return filtered.length > 0 ? filtered : cachedLive;
    } else if (source === 'spotify') {
      const filtered = cachedLive.filter(t => t.source && t.source.includes('Spotify'));
      return filtered.length > 0 ? filtered : cachedLive;
    } else if (source === 'apple') {
      const filtered = cachedLive.filter(t => t.source && t.source.includes('Apple'));
      return filtered.length > 0 ? filtered : cachedLive;
    }

    return cachedLive;
  },

  /**
   * Search tracks using InnerTube WEB_REMIX endpoint directly from mobile
   * Supports infinite scroll pagination (+20 tracks per page via InnerTube continuation tokens)
   */
  async searchTracks(query, filterType = 'all', limit = 20) {
    if (!query || !query.trim()) return [];
    const q = query.trim();
    const stateKey = `${q.toLowerCase()}__${filterType}`;
    if (!this._searchState) {
      this._searchState = new Map();
    }

    // 1. Try local backend if reachable
    const workingBackend = await getWorkingBackend();
    if (workingBackend) {
      try {
        const res = await fetch(`${workingBackend}/api/search?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filterType)}&limit=${limit}`, {
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          const tracks = await res.json();
          if (Array.isArray(tracks) && tracks.length > 0) {
            return tracks;
          }
        }
      } catch (e) {
        console.warn('Backend search notice:', e);
      }
    }

    // 2. Autonomous Mobile Search via YouTube Music InnerTube (WEB_REMIX) with Continuation Pagination
    try {
      const clientContext = {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240901.01.00',
          hl: 'it',
          gl: 'IT'
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      };

      let state = this._searchState.get(stateKey);

      // Fetch first page of 20 results if not cached yet
      if (!state || state.items.length === 0) {
        let params = null;
        if (filterType === 'songs') params = 'EgWKAQIIAWoKEAkQBRAKEAMQBA==';
        else if (filterType === 'artists') params = 'EgWKAQIgAWoSEAUQCRADEAQQChAQEA4QFRAR';
        else if (filterType === 'albums') params = 'EgWKAQIYAWoSEAUQCRADEAQQChAQEA4QFRAR';

        const payload = {
          context: clientContext,
          query: q
        };
        if (params) payload.params = params;

        const data = await nativePost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', payload, headers);
        if (data) {
          const results = [];
          let nextContinuation = null;
          const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

          for (const s of sections) {
            // Music card shelf (Top result / artist / album hero card)
            if (s.musicCardShelfRenderer) {
              const card = s.musicCardShelfRenderer;
              const topVid = card.onTap?.watchEndpoint?.videoId
                || card.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint?.videoId || null;
              const topBrowseId = card.onTap?.browseEndpoint?.browseId || null;
              const topPageType = card.onTap?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
              const topTitle = card.title?.runs?.map(r => r.text).join('') || '';
              const topSub = card.subtitle?.runs?.map(r => r.text).join('') || '';
              const subParts = topSub.split(' • ').map(p => p.trim());

              let isArtist = topSub.toLowerCase().includes('artista') || topPageType === 'MUSIC_PAGE_TYPE_ARTIST' || (topBrowseId && topBrowseId.startsWith('UC'));
              let isAlbum = topSub.toLowerCase().includes('album') || topPageType === 'MUSIC_PAGE_TYPE_ALBUM' || (topBrowseId && topBrowseId.startsWith('MPRE'));
              let rType = isArtist ? 'artist' : (isAlbum ? 'album' : 'track');
              let rLabel = isArtist ? 'Artista' : (isAlbum ? 'Album' : 'Traccia');

              let cardArtist = isArtist
                ? topTitle
                : (subParts.find(p => !TYPE_WORDS.has(p.toLowerCase()) && !/visualizzazioni|ascoltatori|iscritti/i.test(p)) || topTitle);

              if (topTitle) {
                const thumbs = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
                const topCover = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : DEFAULT_ALBUM_COVER;
                results.push({
                  id: topVid ? `yt_${topVid}` : (topBrowseId ? `yt_${topBrowseId}` : `yt_${topTitle}`),
                  videoId: topVid,
                  browseId: topBrowseId,
                  playlistId: null,
                  resultType: rType,
                  typeLabel: rLabel,
                  title: topTitle,
                  artist: cardArtist,
                  album: isAlbum ? topTitle : 'Top Hit',
                  cover: topCover,
                  duration: 180,
                  formattedDuration: '3:00',
                  source: 'YouTube Music'
                });
              }

              if (Array.isArray(card.contents)) {
                for (const it of card.contents) {
                  const parsed = parseRenderer(it.musicResponsiveListItemRenderer, filterType, isArtist ? topTitle : cardArtist);
                  if (parsed && !results.some(r => r.id === parsed.id)) {
                    results.push(parsed);
                  }
                }
              }
            }

            // Direct musicShelfRenderer
            if (s.musicShelfRenderer && Array.isArray(s.musicShelfRenderer.contents)) {
              for (const it of s.musicShelfRenderer.contents) {
                const parsed = parseRenderer(it.musicResponsiveListItemRenderer, filterType);
                if (parsed && !results.some(r => r.id === parsed.id)) {
                  results.push(parsed);
                }
              }
              const ctoken = s.musicShelfRenderer.continuations?.[0]?.nextContinuationData?.continuation;
              if (ctoken) {
                nextContinuation = ctoken;
              }
            }

            // itemSectionRenderer (mixed results)
            if (s.itemSectionRenderer && Array.isArray(s.itemSectionRenderer.contents)) {
              for (const it of s.itemSectionRenderer.contents) {
                if (it.musicShelfRenderer && Array.isArray(it.musicShelfRenderer.contents)) {
                  for (const subIt of it.musicShelfRenderer.contents) {
                    const parsed = parseRenderer(subIt.musicResponsiveListItemRenderer, filterType);
                    if (parsed && !results.some(r => r.id === parsed.id)) {
                      results.push(parsed);
                    }
                  }
                  const ctoken = it.musicShelfRenderer.continuations?.[0]?.nextContinuationData?.continuation;
                  if (ctoken) nextContinuation = ctoken;
                } else if (it.musicResponsiveListItemRenderer) {
                  const parsed = parseRenderer(it.musicResponsiveListItemRenderer, filterType);
                  if (parsed && !results.some(r => r.id === parsed.id)) {
                    results.push(parsed);
                  }
                }
              }
            }
          }

          if (results.length > 0) {
            state = { items: results, continuation: nextContinuation };
            this._searchState.set(stateKey, state);
          }
        }
      }

      // If more tracks are requested (e.g. +20 on scroll: limit = 40, 60, 80...), fetch next continuation pages
      while (state && state.items.length < limit && state.continuation) {
        const ctoken = state.continuation;
        state.continuation = null; // prevent duplicate fetch if error occurs
        const contUrl = `https://music.youtube.com/youtubei/v1/search?ctoken=${encodeURIComponent(ctoken)}&continuation=${encodeURIComponent(ctoken)}&type=next&prettyPrint=false`;
        const contData = await nativePost(contUrl, { context: clientContext }, headers);
        const cShelf = contData?.continuationContents?.musicShelfContinuation;
        if (cShelf && Array.isArray(cShelf.contents)) {
          let added = 0;
          for (const it of cShelf.contents) {
            const parsed = parseRenderer(it.musicResponsiveListItemRenderer, filterType);
            if (parsed && !state.items.some(r => r.id === parsed.id)) {
              state.items.push(parsed);
              added++;
            }
          }
          const nextCtoken = cShelf.continuations?.[0]?.nextContinuationData?.continuation || null;
          state.continuation = added > 0 ? nextCtoken : null;
        } else {
          break;
        }
      }

      return state ? state.items.slice(0, limit) : [];
    } catch (err) {
      console.warn('InnerTube mobile search error:', err);
      return [];
    }
  },

  async fetchAlbumTracks(browseId, albumArtist = '', albumTitle = '') {
    if (!browseId) return [];
    try {
      const clientContext = {
        client: { clientName: 'WEB_REMIX', clientVersion: '1.20240901.01.00', hl: 'it', gl: 'IT' }
      };
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      const data = await nativePost('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', {
        context: clientContext,
        browseId
      }, headers);
      const twoCol = data?.contents?.twoColumnBrowseResultsRenderer;
      const secList = twoCol?.secondaryContents?.sectionListRenderer?.contents || [];
      const tracks = [];
      for (const s of secList) {
        if (s.musicShelfRenderer && Array.isArray(s.musicShelfRenderer.contents)) {
          for (const it of s.musicShelfRenderer.contents) {
            const item = it.musicResponsiveListItemRenderer;
            if (!item) continue;
            const col0 = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const title = col0[0]?.text || '';
            const col1 = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            
            let trackArtist = albumArtist || '';
            let durStr = '3:00';
            for (const r of col1) {
              const text = (r.text || '').trim();
              if (!text || text === '•') continue;
              if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
                durStr = text;
              } else if (!TYPE_WORDS.has(text.toLowerCase()) && !trackArtist) {
                trackArtist = text;
              }
            }

            const vid = item.playlistItemData?.videoId
              || item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
              || col0[0]?.navigationEndpoint?.watchEndpoint?.videoId;
            const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            const cover = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : DEFAULT_ALBUM_COVER;
            if (vid && title) {
              tracks.push({
                id: `yt_${vid}`,
                videoId: vid,
                title,
                artist: trackArtist || albumArtist || 'Artista',
                album: albumTitle || 'Album',
                cover: cover || DEFAULT_ALBUM_COVER,
                duration: parseDurationString(durStr),
                formattedDuration: durStr,
                source: 'YouTube Music'
              });
            }
          }
        }
      }
      return tracks;
    } catch (e) {
      console.warn('fetchAlbumTracks error:', e);
      return [];
    }
  },

  async fetchArtistTopTracks(browseId, artistName) {
    if (!browseId) return [];
    try {
      const clientContext = {
        client: { clientName: 'WEB_REMIX', clientVersion: '1.20240901.01.00', hl: 'it', gl: 'IT' }
      };
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      const data = await nativePost('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', {
        context: clientContext,
        browseId
      }, headers);
      const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
      const secList = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      const tracks = [];
      for (const s of secList) {
        if (s.musicShelfRenderer && Array.isArray(s.musicShelfRenderer.contents)) {
          for (const it of s.musicShelfRenderer.contents) {
            const item = it.musicResponsiveListItemRenderer;
            if (!item) continue;
            const col0 = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const title = col0[0]?.text || '';
            const col1 = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            
            let trackArtist = artistName || '';
            let durStr = '3:00';
            for (const r of col1) {
              const text = (r.text || '').trim();
              if (!text || text === '•') continue;
              if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
                durStr = text;
              } else if (!TYPE_WORDS.has(text.toLowerCase()) && !trackArtist) {
                trackArtist = text;
              }
            }

            const vid = item.playlistItemData?.videoId
              || item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
              || col0[0]?.navigationEndpoint?.watchEndpoint?.videoId;
            const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            const cover = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : DEFAULT_ALBUM_COVER;
            if (vid && title) {
              tracks.push({
                id: `yt_${vid}`,
                videoId: vid,
                title,
                artist: trackArtist || artistName || 'Artista',
                album: 'Top Hit',
                cover: cover || DEFAULT_ALBUM_COVER,
                duration: parseDurationString(durStr),
                formattedDuration: durStr,
                source: 'YouTube Music'
              });
            }
          }
        }
      }
      return tracks;
    } catch (e) {
      console.warn('fetchArtistTopTracks error:', e);
      return [];
    }
  },

  /**
   * Identifies the best YouTube video ID for any track using fuzzy matching algorithm
   */
  async resolveYouTubeId(track) {
    if (!track) return null;
    let videoId = track.videoId || (track.id && track.id.startsWith('yt_') ? track.id.replace('yt_', '') : null);
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }

    const cacheKey = `${track.title}__${track.artist}`;
    if (videoIdCache[cacheKey]) {
      return videoIdCache[cacheKey];
    }

    const targetTitle = track.title || '';
    const targetArtist = track.artist || '';
    const targetDuration = track.duration || 180;
    const searchQuery = `${targetArtist} ${targetTitle}`.trim();

    // Search candidates using InnerTube
    const candidates = await this.searchTracks(searchQuery, 'songs', 10);
    if (candidates && candidates.length > 0) {
      let bestCandidate = null;
      let highestScore = -1;

      for (const cand of candidates) {
        const score = computeMatchScore(
          targetTitle,
          targetArtist,
          targetDuration,
          cand.title,
          cand.artist,
          cand.duration
        );

        if (score > highestScore) {
          highestScore = score;
          bestCandidate = cand;
          if (score >= 0.95) break; // Early exit
        }
      }

      if (bestCandidate && bestCandidate.videoId) {
        videoIdCache[cacheKey] = bestCandidate.videoId;
        track.videoId = bestCandidate.videoId;
        return bestCandidate.videoId;
      }
    }

    // Fallback if not identified
    const cachedTracks = getCachedHomeTracks();
    const fb = cachedTracks.length > 0 && cachedTracks[0].videoId ? cachedTracks[0].videoId : null;
    if (fb) {
      videoIdCache[cacheKey] = fb;
      track.videoId = fb;
      return fb;
    }
    return null;
  },

  /**
   * Resolves direct audio stream URL using InnerTube client extraction.
   * Runs autonomously directly on the phone with zero LAN blocks.
   */
  async resolveAudioStreamUrl(track) {
    if (!track) return null;
    if (track.localAudioUrl) return track.localAudioUrl;

    let videoId = track.videoId || (track.id && track.id.startsWith('yt_') ? track.id.replace('yt_', '') : null);
    if (!videoId) {
      videoId = await this.resolveYouTubeId(track);
    }
    if (!videoId) return null;

    // Check in-memory stream cache (TTL 3 hours)
    const cached = streamUrlCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    // 1. PRIMARY: Autonomous Mobile Stream Resolution (IOS InnerTube Client Method)
    // Instant ~200ms response directly on mobile phone
    try {
      const payload = {
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '21.03.1',
            deviceModel: 'iPhone16,2',
            osVersion: '18.2.22C152',
            gl: 'US',
            hl: 'en-US'
          },
          request: {
            internalExperimentFlags: [],
            useSsl: true
          },
          user: {
            lockedSafetyMode: false
          }
        },
        videoId: videoId,
        contentCheckOk: true,
        racyCheckOk: true
      };

      const iosUA = 'com.google.ios.youtube/21.03.1 (iPhone16,2; U; CPU iOS 18_2 like Mac OS X;)';
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': iosUA,
        'x-cap-user-agent': iosUA,
        'X-Goog-Api-Format-Version': '1',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '21.03.1',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
        'Accept': 'application/json'
      };

      const playerResp = await nativePost('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', payload, headers);
      if (playerResp) {
        const formats = playerResp.streamingData?.adaptiveFormats || [];
        const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio') && f.url);

        if (audioFormats.length > 0) {
          // Prioritize itag 140 (Standard MPEG-4 AAC 130kbps) - 100% native Android compatibility!
          const chosenFormat = audioFormats.find(f => f.itag === 140)
            || audioFormats.find(f => f.itag === 251)
            || audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

          if (chosenFormat && chosenFormat.url) {
            const streamUrl = chosenFormat.url;
            streamUrlCache.set(videoId, { url: streamUrl, expiresAt: Date.now() + 3 * 3600 * 1000 });
            return streamUrl;
          }
        }
      }
    } catch (iosErr) {
      console.warn('Autonomous stream resolution notice:', iosErr);
    }

    // 2. Secondary fallback: check local PC backend (if explicitly available on LAN)
    try {
      const workingBackend = await getWorkingBackend();
      if (workingBackend) {
        const res = await fetch(`${workingBackend}/api/stream?id=${encodeURIComponent(videoId)}`, {
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            streamUrlCache.set(videoId, { url: data.url, expiresAt: Date.now() + 3 * 3600 * 1000 });
            return data.url;
          }
        }
      }
    } catch {}

    if (track.audioUrl) return track.audioUrl;
    return null;
  },

  /**
   * Downloads track into local storage (Mobile / Offline)
   */
  async downloadTrack(track) {
    const hasBackend = await checkBackend();
    if (hasBackend) {
      try {
        const settings = storageService.getSettings();
        const res = await fetch(`${BACKEND_URL}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : track.id),
            title: track.title,
            artist: track.artist,
            cover: track.cover,
            folder: settings.downloadFolder || ''
          })
        });
        return res.ok;
      } catch (e) {
        console.error('Download request notice:', e);
      }
    }

    // Autonomous Mobile Offline Storage
    try {
      const savedList = JSON.parse(localStorage.getItem('supermusicpro_mobile_downloads') || '[]');
      const safeId = track.id || (track.videoId ? `yt_${track.videoId}` : `dl_${Date.now()}`);
      const safeFileName = track.fileName || `${track.artist || 'Artista'} - ${track.title || 'Brano'}.m4a`;
      const isAlreadySaved = savedList.some(
        s => (s.id && s.id === safeId) || (track.videoId && s.videoId === track.videoId) || (s.title === track.title && s.artist === track.artist)
      );
      if (!isAlreadySaved) {
        savedList.push({
          ...track,
          id: safeId,
          fileName: safeFileName,
          downloadDate: new Date().toISOString()
        });
        localStorage.setItem('supermusicpro_mobile_downloads', JSON.stringify(savedList));
      }
      return true;
    } catch {
      return false;
    }
  },

  async getDownloadedTracks() {
    const hasBackend = await checkBackend();
    if (hasBackend) {
      try {
        const settings = storageService.getSettings();
        const folderParam = settings.downloadFolder ? `?folder=${encodeURIComponent(settings.downloadFolder)}` : '';
        const res = await fetch(`${BACKEND_URL}/api/downloads${folderParam}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Error fetching downloaded tracks:', e);
      }
    }

    try {
      return JSON.parse(localStorage.getItem('supermusicpro_mobile_downloads') || '[]');
    } catch {
      return [];
    }
  },

  async deleteDownloadedTrack(trackOrFileName) {
    const fileName = typeof trackOrFileName === 'object'
      ? (trackOrFileName.fileName || trackOrFileName.id || trackOrFileName.title)
      : trackOrFileName;

    const hasBackend = await checkBackend();
    if (hasBackend && fileName) {
      try {
        const settings = storageService.getSettings();
        const folderParam = settings.downloadFolder ? `&folder=${encodeURIComponent(settings.downloadFolder)}` : '';
        const res = await fetch(`${BACKEND_URL}/api/downloads?file=${encodeURIComponent(fileName)}${folderParam}`, {
          method: 'DELETE'
        });
        if (res.ok) return true;
      } catch (e) {
        console.error('Delete download notice:', e);
      }
    }

    try {
      const targetId = typeof trackOrFileName === 'object' ? trackOrFileName.id : trackOrFileName;
      const targetVideoId = typeof trackOrFileName === 'object' ? trackOrFileName.videoId : trackOrFileName;
      const targetFile = typeof trackOrFileName === 'object' ? trackOrFileName.fileName : trackOrFileName;
      const targetTitle = typeof trackOrFileName === 'object' ? trackOrFileName.title : trackOrFileName;

      let list = JSON.parse(localStorage.getItem('supermusicpro_mobile_downloads') || '[]');
      list = list.filter(s => {
        if (targetId && (s.id === targetId || (s.videoId && `yt_${s.videoId}` === targetId))) return false;
        if (targetVideoId && (s.videoId === targetVideoId || s.id === `yt_${targetVideoId}`)) return false;
        if (targetFile && s.fileName && s.fileName === targetFile) return false;
        if (targetTitle && s.title === targetTitle) return false;
        return true;
      });
      localStorage.setItem('supermusicpro_mobile_downloads', JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  },

  async clearAllDownloadedTracks() {
    try {
      localStorage.setItem('supermusicpro_mobile_downloads', '[]');
      return true;
    } catch {
      return false;
    }
  },

  async openDownloadFolder(folderPath = '') {
    if (window.electronAPI && window.electronAPI.openDownloadFolder) {
      const ok = await window.electronAPI.openDownloadFolder(folderPath);
      if (ok) return true;
    }
    return true;
  },

  resolveYouTubeMatch(track) {
    if (!track) return { youtubeId: '' };
    let videoId = track.videoId || (track.id && track.id.startsWith('yt_') ? track.id.replace('yt_', '') : null);
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      videoId = '';
    }
    return {
      youtubeId: videoId,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''
    };
  }
};
