/**
 * SuperMusicPro - Ultra-Fast Synchronized Lyrics Engine (Android Edition)
 * Multi-tier synchronized-first lyrics discovery:
 * 1. Persistent 2-Level Cache (In-Memory LRU + localStorage) for instantaneous 0ms loading
 * 2. High-Speed LRCLIB Parallel Race (Exact match + Smart search candidates executed concurrently)
 * 3. KuGou Synchronized Engine (Extensive global & Italian catalog fallback with Base64 LRC decoding)
 * 4. Advanced Title/Artist Normalization & "Artist - Title" splitting
 * 5. High-precision timestamp parser & credit line sanitizer
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

// 1. Dual-level cache: In-memory Map + localStorage
const lyricsMemoryCache = new Map();
const MAX_MEMORY_CACHE = 100;
const STORAGE_PREFIX = 'smpro_lrc_';

function getCachedLyrics(key) {
  if (!key) return null;
  if (lyricsMemoryCache.has(key)) {
    const val = lyricsMemoryCache.get(key);
    lyricsMemoryCache.delete(key);
    lyricsMemoryCache.set(key, val);
    return val;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.lines && parsed.lines.length > 0) {
        lyricsMemoryCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}

function setCachedLyrics(key, val) {
  if (!key || !val || !val.lines || val.lines.length === 0) return;
  if (lyricsMemoryCache.size >= MAX_MEMORY_CACHE) {
    const oldest = lyricsMemoryCache.keys().next().value;
    lyricsMemoryCache.delete(oldest);
  }
  lyricsMemoryCache.set(key, val);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(val));
  } catch {}
}

const TITLE_CLEANUP_PATTERNS = [
  /\s*\(.*?(official|video|audio|lyrics?|lyric|visualizer|hd|hq|4k|remaster|remix|live|acoustic|version|edit|extended|radio|clean|explicit|clip|videoclip|testo).*?\)/gi,
  /\s*\[.*?(official|video|audio|lyrics?|lyric|visualizer|hd|hq|4k|remaster|remix|live|acoustic|version|edit|extended|radio|clean|explicit|clip|videoclip|testo).*?\]/gi,
  /\s*【.*?】/g,
  /\s*\|.*$/g,
  /\s*-\s*(official|video|audio|lyrics?|lyric|visualizer).*$/gi,
  /\s*\(feat\..*?\)/gi,
  /\s*\(ft\..*?\)/gi,
  /\s*\(prod\..*?\)/gi,
  /\s*feat\..*$/gi,
  /\s*ft\..*$/gi,
  /\s+(feat\.?|ft\.?|featuring)\s+.*/gi
];

const ARTIST_SEPARATORS = [
  ' & ', ' and ', ', ', ' x ', ' X ', ' feat. ', ' feat ', ' ft. ', ' ft ', ' featuring ', ' with ', ' vs ', ' vs. '
];

const CREDIT_LINE_PATTERNS = [
  /^(synced|synchronized|lyrics|music|written|composed|arranged|produced|mixed|mastered|edited|transcribed|uploaded|by)\s*[:：by]/i,
  /^(paroles|testo|musica|produzione|artista|titolo|album)\s*[:：]/i,
  /(www\.|http:\/\/|https:\/\/|lrc\s*by|lrclib|megalobiz|rentanadviser)/i,
  /^[@#]\w+$/
];

export function cleanTitle(title = '') {
  let cleaned = String(title).trim();
  if (cleaned.includes(' - ') && !cleaned.toLowerCase().includes('official')) {
    const parts = cleaned.split(' - ');
    if (parts.length === 2 && parts[1].trim().length > 1) {
      cleaned = parts[1].trim();
    }
  }
  for (const pattern of TITLE_CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function cleanArtist(artist = '') {
  let cleaned = String(artist)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim();
  for (const sep of ARTIST_SEPARATORS) {
    const idx = cleaned.toLowerCase().indexOf(sep.toLowerCase());
    if (idx !== -1) {
      cleaned = cleaned.substring(0, idx);
      break;
    }
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function cleanLyricLineText(rawText = '') {
  return String(rawText)
    .replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, '')
    .replace(/\{agent:[^}]*\}/gi, '')
    .replace(/\{bg\}|\[bg:[^\]]*\]/gi, '')
    .replace(/^(v\d+|bg)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCreditLine(text = '', index = 0, totalLines = 1) {
  const trimmed = String(text).trim();
  if (!trimmed) return true;
  if (index <= 4 || index >= totalLines - 4) {
    for (const regex of CREDIT_LINE_PATTERNS) {
      if (regex.test(trimmed)) return true;
    }
  }
  return false;
}

export function parseLRC(lrcText) {
  if (!lrcText) return [];
  const rawLines = lrcText.split(/\r?\n/);
  const tempResult = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\[(ti|ar|al|au|by|offset|length|re|ve|tool|id):/i.test(trimmed)) continue;

    let match;
    const times = [];
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      times.push(min * 60 + sec + ms / 1000);
    }

    const text = cleanLyricLineText(trimmed.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, ''));
    if (text && times.length > 0) {
      for (const time of times) {
        tempResult.push({ time, text });
      }
    }
  }

  const sorted = tempResult.sort((a, b) => a.time - b.time);
  return sorted.filter((item, idx) => !isCreditLine(item.text, idx, sorted.length));
}

export function parseTTML(ttmlString) {
  if (!ttmlString || typeof ttmlString !== 'string') return [];
  const result = [];
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(ttmlString)) !== null) {
    const attrs = match[1] || '';
    const innerHtml = match[2] || '';
    const beginMatch = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/i);
    if (!beginMatch) continue;

    const timeStr = beginMatch[1].trim();
    let time = null;
    if (timeStr.endsWith('ms')) {
      time = parseFloat(timeStr.slice(0, -2)) / 1000;
    } else if (timeStr.endsWith('s')) {
      time = parseFloat(timeStr.slice(0, -1));
    } else {
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 3) time = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) time = parts[0] * 60 + parts[1];
    }
    if (time === null || isNaN(time)) continue;

    const text = cleanLyricLineText(
      innerHtml
        .replace(/<span[^>]*ttm:role=["']x-bg["'][^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
    );
    if (text) {
      result.push({ time, text });
    }
  }

  const sorted = result.sort((a, b) => a.time - b.time);
  return sorted.filter((item, idx) => !isCreditLine(item.text, idx, sorted.length));
}

const LRCLIB_USER_AGENT = 'SuperMusicPRO/2.4.1 (Android; Mobile; +https://github.com/lucab/SuperMusicPro)';

async function httpGet(url, responseType = 'json', customHeaders = {}) {
  const headers = {
    'User-Agent': LRCLIB_USER_AGENT,
    'Accept': responseType === 'json' ? 'application/json' : '*/*',
    ...customHeaders
  };

  if (Capacitor?.isNativePlatform?.()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': LRCLIB_USER_AGENT,
          'Accept': 'application/json',
          ...customHeaders
        },
        connectTimeout: 3500,
        readTimeout: 3500
      });
      if (res && res.status >= 200 && res.status < 300) {
        if (responseType === 'json' && typeof res.data === 'string') {
          try { return JSON.parse(res.data); } catch { return null; }
        }
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', ...customHeaders },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      return responseType === 'json' ? await res.json() : await res.text();
    }
  } catch {}
  return null;
}

function raceLrcLibCandidates(urls, targetDuration = null) {
  return new Promise((resolve) => {
    let pending = urls.length;
    let bestFallback = null;
    let resolved = false;

    for (const url of urls) {
      httpGet(url, 'json')
        .then((data) => {
          if (resolved || !data) return;

          if (Array.isArray(data) && data.length > 0) {
            const syncedCandidates = data.filter((t) => t && t.syncedLyrics && !t.instrumental);
            if (syncedCandidates.length > 0) {
              let best = syncedCandidates[0];
              if (targetDuration && Number(targetDuration) > 0) {
                let minDiff = Math.abs((best.duration || 0) - targetDuration);
                for (const item of syncedCandidates) {
                  const diff = Math.abs((item.duration || 0) - targetDuration);
                  if (diff < minDiff) {
                    best = item;
                    minDiff = diff;
                  }
                }
              }
              resolved = true;
              resolve({
                isSynced: true,
                lines: parseLRC(best.syncedLyrics),
                raw: best.syncedLyrics,
                source: 'LRCLIB (Sincronizzato)'
              });
              return;
            }

            if (!bestFallback) {
              const plain = data.find((t) => t && t.plainLyrics);
              if (plain) bestFallback = plain;
            }
          } else if (data.syncedLyrics) {
            resolved = true;
            resolve({
              isSynced: true,
              lines: parseLRC(data.syncedLyrics),
              raw: data.syncedLyrics,
              source: 'LRCLIB (Sincronizzato)'
            });
            return;
          } else if (data.plainLyrics && !bestFallback) {
            bestFallback = data;
          }
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0 && !resolved) {
            if (bestFallback && bestFallback.plainLyrics) {
              const rawLines = bestFallback.plainLyrics
                .split(/\r?\n/)
                .map((l) => cleanLyricLineText(l))
                .filter(Boolean);
              resolve({
                isSynced: false,
                lines: rawLines.map((text) => ({ text })),
                raw: bestFallback.plainLyrics,
                source: 'LRCLIB (Testo Statico)'
              });
            } else {
              resolve(null);
            }
          }
        });
    }
  });
}

async function queryKuGou(title, artist, duration = null) {
  try {
    const cTitle = cleanTitle(title);
    const cArtist = cleanArtist(artist);
    const query = `${cArtist} ${cTitle}`.trim();
    const durSec = duration ? Math.round(Number(duration)) : null;

    const searchUrl = `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=5&showtype=0&keyword=${encodeURIComponent(query)}`;
    const songData = await httpGet(searchUrl);
    const songs = songData?.data?.info || [];
    if (songs.length === 0) return null;

    let candidate = null;
    if (durSec && durSec > 0) {
      candidate =
        songs.find((s) => Math.abs((s.duration || 0) - durSec) <= 4) ||
        songs.find((s) => Math.abs((s.duration || 0) - durSec) <= 10) ||
        songs[0];
    } else {
      candidate = songs[0];
    }

    if (!candidate || !candidate.hash) return null;

    const lyricsSearchUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(query)}&hash=${candidate.hash}`;
    const lyricsData = await httpGet(lyricsSearchUrl);
    const candidates = lyricsData?.candidates || [];
    if (candidates.length === 0) return null;

    const bestCand = candidates[0];
    const downloadUrl = `https://lyrics.kugou.com/download?ver=1&client=pc&id=${bestCand.id}&accesskey=${bestCand.accesskey}&fmt=lrc&charset=utf8`;
    const dlData = await httpGet(downloadUrl);

    if (dlData && dlData.content) {
      let lrcText = '';
      try {
        if (typeof atob === 'function') {
          lrcText = decodeURIComponent(escape(atob(dlData.content)));
        }
      } catch {
        try { lrcText = atob(dlData.content); } catch {}
      }

      if (lrcText && lrcText.length > 20) {
        const parsed = parseLRC(lrcText);
        if (parsed.length > 0) {
          return {
            isSynced: true,
            lines: parsed,
            raw: lrcText,
            source: 'KuGou (Sincronizzato)'
          };
        }
      }
    }
  } catch {}
  return null;
}

export async function fetchLyrics(trackTitle, artistName, duration = null, videoId = null, albumName = '') {
  if (!trackTitle) return null;

  const cTitle = cleanTitle(trackTitle);
  const cArtist = cleanArtist(artistName);
  const cacheKey = videoId
    ? `vid_${videoId}`
    : `${cTitle.toLowerCase()}__${cArtist.toLowerCase()}`;

  const cached = getCachedLyrics(cacheKey);
  if (cached) {
    return cached;
  }

  const lrclibUrls = [
    `https://lrclib.net/api/get?track_name=${encodeURIComponent(cTitle)}&artist_name=${encodeURIComponent(cArtist)}`,
    `https://lrclib.net/api/search?q=${encodeURIComponent(`${cArtist} ${cTitle}`.trim())}`
  ];

  if (artistName && (artistName.includes(',') || artistName.includes('&') || artistName.includes('feat'))) {
    const rawFirstArtist = artistName.split(/[,&]/)[0].trim();
    if (rawFirstArtist && rawFirstArtist !== cArtist) {
      lrclibUrls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(`${rawFirstArtist} ${cTitle}`)}`);
    }
  }

  const lrcResult = await raceLrcLibCandidates(lrclibUrls, duration);
  if (lrcResult && lrcResult.isSynced) {
    setCachedLyrics(cacheKey, lrcResult);
    return lrcResult;
  }

  const kuGouResult = await queryKuGou(trackTitle, artistName, duration);
  if (kuGouResult && kuGouResult.isSynced) {
    setCachedLyrics(cacheKey, kuGouResult);
    return kuGouResult;
  }

  if (lrcResult && !lrcResult.isSynced && lrcResult.lines?.length > 0) {
    setCachedLyrics(cacheKey, lrcResult);
    return lrcResult;
  }

  if (cArtist && cTitle) {
    try {
      const ovhData = await httpGet(`https://api.lyrics.ovh/v1/${encodeURIComponent(cArtist)}/${encodeURIComponent(cTitle)}`);
      if (ovhData && ovhData.lyrics) {
        const plainLines = ovhData.lyrics
          .split(/\r?\n/)
          .map((l) => cleanLyricLineText(l))
          .filter(Boolean);
        if (plainLines.length > 0) {
          const ovhResult = {
            isSynced: false,
            lines: plainLines.map((text) => ({ text })),
            raw: ovhData.lyrics,
            source: 'LyricsOVH (Testo Statico)'
          };
          setCachedLyrics(cacheKey, ovhResult);
          return ovhResult;
        }
      }
    } catch {}
  }

  return {
    isSynced: false,
    lines: [],
    raw: '',
    source: ''
  };
}
