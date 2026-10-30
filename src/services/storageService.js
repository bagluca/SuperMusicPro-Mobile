/**
 * Local Storage Service for SuperMusicPro
 * Manages liked songs, custom playlists, play history, settings, and YouTube match overrides
 */

const KEYS = {
  LIKED_SONGS: 'supermusicpro_liked_songs',
  PLAYLISTS: 'supermusicpro_playlists',
  HISTORY: 'supermusicpro_history',
  SETTINGS: 'supermusicpro_settings',
  MATCH_OVERRIDES: 'supermusicpro_match_overrides',
  MATCH_CACHE: 'supermusicpro_match_cache',
  LAST_TRACK: 'supermusicpro_last_track',
  RECENT_SEARCHES: 'supermusicpro_recent_searches',
};

const DEFAULT_SETTINGS = {
  audioQuality: 'high', // 'low' | 'high' | 'lossless'
  theme: 'dark', // 'dark' | 'midnight' | 'cyberpunk' | 'emerald' | 'sunset'
  accentColor: '#10b981',
  downloadFolder: '',
  backendUrl: '',
  eqPreset: 'Flat',
  volume: 0.8,
  discordRpc: false,
  autoPlayNext: true,
};

export const storageService = {
  getSettings() {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.backendUrl === 'http://192.168.1.33:4545') {
          parsed.backendUrl = '';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  getLikedSongs() {
    try {
      const data = localStorage.getItem(KEYS.LIKED_SONGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  isSongLiked(songId) {
    const list = this.getLikedSongs();
    return list.some(s => s.id === songId || (s.videoId && `yt_${s.videoId}` === songId));
  },

  toggleLikeSong(song) {
    if (!song) return false;
    let list = this.getLikedSongs();
    const matchSong = (s) =>
      (song.id && s.id === song.id) ||
      (song.videoId && s.videoId && s.videoId === song.videoId) ||
      (song.title && song.artist && s.title === song.title && s.artist === song.artist);
    const exists = list.some(matchSong);
    if (exists) {
      list = list.filter(s => !matchSong(s));
    } else {
      const safeId = song.id || (song.videoId ? `yt_${song.videoId}` : `liked_${Date.now()}`);
      list = [{ ...song, id: safeId, likedAt: Date.now() }, ...list];
    }
    localStorage.setItem(KEYS.LIKED_SONGS, JSON.stringify(list));
    return !exists;
  },

  getPlaylists() {
    try {
      const data = localStorage.getItem(KEYS.PLAYLISTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(p => !((p.id === 'pl-favorites' || p.id === 'pl-night-vibes') && (!p.songs || p.songs.length === 0)));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(filtered));
          }
          return filtered;
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  createPlaylist(name, description = '') {
    const playlists = this.getPlaylists();
    const newPlaylist = {
      id: `pl-${Date.now()}`,
      name,
      description,
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
      songs: [],
      createdAt: Date.now(),
    };
    playlists.push(newPlaylist);
    localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    return newPlaylist;
  },

  addSongToPlaylist(playlistId, song) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && song) {
      if (!pl.songs) pl.songs = [];
      const safeId = song.id || (song.videoId ? `yt_${song.videoId}` : `song_${Date.now()}`);
      const alreadyIn = pl.songs.some(
        s => (s.id && s.id === safeId) || (song.videoId && s.videoId === song.videoId) || (s.title === song.title && s.artist === song.artist)
      );
      if (!alreadyIn) {
        pl.songs.push({ ...song, id: safeId });
        if (song.cover && (!pl.cover || pl.cover.includes('unsplash'))) {
          pl.cover = song.cover;
        }
        localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
      }
    }
    return playlists;
  },

  removeSongFromPlaylist(playlistId, songOrId) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && Array.isArray(pl.songs)) {
      const targetId = typeof songOrId === 'object' ? songOrId.id : songOrId;
      const targetVideoId = typeof songOrId === 'object' ? songOrId.videoId : songOrId;
      const targetTitle = typeof songOrId === 'object' ? songOrId.title : null;
      pl.songs = pl.songs.filter(s => {
        if (targetId && (s.id === targetId || (s.videoId && `yt_${s.videoId}` === targetId))) return false;
        if (targetVideoId && (s.videoId === targetVideoId || s.id === `yt_${targetVideoId}`)) return false;
        if (targetTitle && s.title === targetTitle) return false;
        return true;
      });
      localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    }
    return playlists;
  },

  updatePlaylist(playlistId, updates) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl) {
      Object.assign(pl, updates);
      localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    }
    return playlists;
  },

  deletePlaylist(playlistId) {
    let playlists = this.getPlaylists();
    playlists = playlists.filter(p => p.id !== playlistId);
    localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    return playlists;
  },

  getHistory() {
    try {
      const data = localStorage.getItem(KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addToHistory(song) {
    try {
      let list = this.getHistory();
      list = list.filter(s => s.id !== song.id);
      list = [{ ...song, playedAt: Date.now() }, ...list].slice(0, 50);
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(list));
      this.saveLastTrack(song);
    } catch (e) {
      console.error('History save error:', e);
    }
  },

  getLastTrack() {
    try {
      const data = localStorage.getItem(KEYS.LAST_TRACK);
      if (data) return JSON.parse(data);
      const history = this.getHistory();
      if (history && history.length > 0) return history[0];
      return null;
    } catch {
      return null;
    }
  },

  saveLastTrack(track) {
    if (!track) return;
    try {
      localStorage.setItem(KEYS.LAST_TRACK, JSON.stringify(track));
    } catch (e) {
      console.error('Failed to save last track:', e);
    }
  },

  // Manual YouTube Match Overrides (Signature SuperMusicPro feature)
  getMatchOverride(trackId) {
    try {
      const data = localStorage.getItem(KEYS.MATCH_OVERRIDES);
      const overrides = data ? JSON.parse(data) : {};
      return overrides[trackId] || null;
    } catch {
      return null;
    }
  },

  setMatchOverride(trackId, youtubeIdOrUrl, title = '') {
    try {
      const data = localStorage.getItem(KEYS.MATCH_OVERRIDES);
      const overrides = data ? JSON.parse(data) : {};
      overrides[trackId] = {
        youtubeIdOrUrl,
        title,
        updatedAt: Date.now()
      };
      localStorage.setItem(KEYS.MATCH_OVERRIDES, JSON.stringify(overrides));
    } catch (e) {
      console.error('Failed to set override:', e);
    }
  },

  getMatchCache() {
    try {
      const data = localStorage.getItem(KEYS.MATCH_CACHE);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  setMatchCache(key, ytData) {
    try {
      const cache = this.getMatchCache();
      cache[key] = ytData;
      localStorage.setItem(KEYS.MATCH_CACHE, JSON.stringify(cache));
    } catch (e) {
      console.error('Failed to update match cache:', e);
    }
  },

  getRecentSearches() {
    try {
      const data = localStorage.getItem(KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addRecentSearch(query) {
    if (!query || typeof query !== 'string') return [];
    const trimmed = query.trim();
    if (!trimmed) return [];
    try {
      const current = this.getRecentSearches();
      const filtered = current.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 15);
      localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to add recent search:', e);
      return [];
    }
  },

  removeRecentSearch(query) {
    try {
      const current = this.getRecentSearches();
      const updated = current.filter(item => item.toLowerCase() !== (query || '').trim().toLowerCase());
      localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to remove recent search:', e);
      return [];
    }
  },

  clearRecentSearches() {
    try {
      localStorage.removeItem(KEYS.RECENT_SEARCHES);
      return [];
    } catch (e) {
      console.error('Failed to clear recent searches:', e);
      return [];
    }
  }
};
