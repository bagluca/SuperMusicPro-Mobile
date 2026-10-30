/**
 * Autonomous Audio Engine for SuperMusicPro Android
 * Uses Android Native Media3 / ExoPlayer running in a foreground service
 * with OkHttpDataSource, bypassing WebView audio limits completely.
 * On non-native platforms, falls back to direct HTML5 Audio.
 */

import { musicService } from './musicService';
import { registerPlugin, Capacitor } from '@capacitor/core';

const MusicNotification = registerPlugin('MusicNotification');

class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.currentTrack = null;
    this.isPlaying = false;
    this.duration = 180;
    this.currentTime = 0;
    this.volume = 0.8;
    this.isMuted = false;

    this.listeners = new Set();
    this.setupAudioListeners();
    this.setupNativeMediaListener();
  }

  setupNativeMediaListener() {
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.addListener('onMediaAction', (data) => {
          const action = data?.action;
          if (action === 'play') {
            this.isPlaying = true;
            this.emit('statechange', { isPlaying: true });
          } else if (action === 'pause' || action === 'stop') {
            this.isPlaying = false;
            this.emit('statechange', { isPlaying: false });
          } else if (action === 'next') {
            this.emit('next');
          } else if (action === 'previous' || action === 'prev') {
            this.emit('previous');
          } else if (action === 'play_local') {
            this.emit('play_local');
          } else if (action === 'back_button') {
            this.emit('back_button');
          }
        });

        MusicNotification.addListener('onPlaybackProgress', (data) => {
          if (data && typeof data.currentTime === 'number') {
            this.currentTime = data.currentTime;
            if (data.duration && !isNaN(data.duration) && data.duration > 0) {
              this.duration = data.duration;
            }
            this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration });
            this.updatePositionState();
          }
        });

        MusicNotification.addListener('onPlaybackState', (data) => {
          if (data && typeof data.isPlaying === 'boolean') {
            this.isPlaying = data.isPlaying;
            if ('mediaSession' in navigator) {
              try {
                navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
              } catch {}
            }
            this.emit('statechange', { isPlaying: this.isPlaying });
          }
        });

        MusicNotification.addListener('onPlaybackError', (data) => {
          console.warn('Native ExoPlayer error:', data?.error);
        });

        MusicNotification.addListener('onNativeTrackChanged', (data) => {
          if (data) {
            this.emit('nativetrackchange', data);
          }
        });
      } catch (err) {
        console.warn('Error setting up MusicNotification listeners:', err);
      }
    }
  }

  notifyNativePlayback(track, isPlaying) {
    if (Capacitor.isNativePlatform() && track) {
      try {
        MusicNotification.updatePlayback({
          title: track.title || 'SuperMusic PRO',
          artist: track.artist || 'SuperMusic Artist',
          cover: track.cover || '',
          isPlaying: isPlaying
        }).catch(() => {});
      } catch {}
    }
  }

  syncAppData(queue = [], currentIndex = 0, favorites = [], playlists = [], catalog = []) {
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.syncAppData({
          queue: (queue || []).slice(0, 100),
          currentIndex: currentIndex || 0,
          favorites: (favorites || []).slice(0, 100),
          playlists: (playlists || []).slice(0, 50),
          catalog: (catalog || []).slice(0, 40)
        }).catch(() => {});
      } catch {}
    }
  }

  minimizeApp() {
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.minimizeApp().catch(() => {});
      } catch {}
    }
  }

  setupAudioListeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (!Capacitor.isNativePlatform() && this.audio.src && !this.audio.paused) {
        this.currentTime = this.audio.currentTime;
        this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration });
        this.updatePositionState();
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (!Capacitor.isNativePlatform()) {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
          this.duration = this.audio.duration;
        } else if (this.currentTrack && this.currentTrack.duration) {
          this.duration = this.currentTrack.duration;
        }
        this.emit('loadedmetadata', { duration: this.duration });
        this.updatePositionState();
      }
    });

    this.audio.addEventListener('play', () => {
      if (!Capacitor.isNativePlatform()) {
        this.isPlaying = true;
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
        this.emit('statechange', { isPlaying: true });
      }
    });

    this.audio.addEventListener('pause', () => {
      if (!Capacitor.isNativePlatform()) {
        this.isPlaying = false;
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        }
        this.emit('statechange', { isPlaying: false });
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!Capacitor.isNativePlatform()) {
        if (this.currentTime > 1) {
          this.isPlaying = false;
          if ('mediaSession' in navigator) {
            try { navigator.mediaSession.playbackState = 'none'; } catch {}
          }
          this.emit('ended');
        }
      }
    });

    this.audio.addEventListener('error', (e) => {
      if (!Capacitor.isNativePlatform()) {
        const err = this.audio ? this.audio.error : null;
        console.warn('HTML5 Audio playback error:', err ? `${err.code}: ${err.message}` : e);
      }
    });
  }

  updateMediaSession(track) {
    if (Capacitor.isNativePlatform()) return;
    if ('mediaSession' in navigator && track) {
      try {
        const coverUrl = track.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'SuperMusic PRO',
          artist: track.artist || 'SuperMusic Artist',
          album: track.album || 'SuperMusic PRO',
          artwork: [
            { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        });

        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.emit('previous'));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.emit('next'));
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) this.seek(details.seekTime);
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          this.seek(Math.max(0, this.currentTime - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          this.seek(Math.min(this.duration, this.currentTime + skip));
        });
      } catch (e) {
        console.warn('MediaSession notice:', e);
      }
    }
  }

  updatePositionState() {
    if (Capacitor.isNativePlatform()) return;
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (this.duration && !isNaN(this.duration) && this.duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, this.duration),
            playbackRate: 1,
            position: Math.max(0, Math.min(this.duration, this.currentTime || 0))
          });
        }
      } catch (e) {}
    }
  }

  async playTrack(track) {
    this.currentTrack = track;
    this.currentTime = 0;
    if (track.duration && !isNaN(track.duration)) {
      this.duration = track.duration;
    }
    this.emit('trackchange', track);
    this.updateMediaSession(track);

    // Stop any current HTML5 audio
    try {
      this.audio.pause();
      this.audio.src = '';
    } catch {}

    let videoId = track.videoId || (track.id && track.id.startsWith('yt_') ? track.id.replace('yt_', '') : '');

    if (Capacitor.isNativePlatform()) {
      try {
        this.isPlaying = true;
        this.emit('statechange', { isPlaying: true });

        // Instant dispatch to native MusicPlayerService (ExoPlayer + native stream resolver)
        await MusicNotification.playTrack({
          url: track.localAudioUrl || '',
          videoId: videoId,
          title: track.title || 'SuperMusic PRO',
          artist: track.artist || 'Artista',
          cover: track.cover || '',
          duration: this.duration
        });
        return;
      } catch (nativeErr) {
        console.warn('Native ExoPlayer play error, attempting fallback:', nativeErr);
      }
    }

    // Fallback for desktop / web browser
    const audioStreamUrl = await musicService.resolveAudioStreamUrl(track);
    if (audioStreamUrl) {
      this.audio.src = audioStreamUrl;
      this.audio.volume = this.isMuted ? 0 : this.volume;

      try {
        await this.audio.play();
        this.isPlaying = true;
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
        this.emit('statechange', { isPlaying: true });
        return;
      } catch (err) {
        console.warn('HTML5 audio playback error:', err);
      }
    }

    console.warn('Unable to resolve direct audio stream for:', track.title);
    this.isPlaying = false;
    this.notifyNativePlayback(track, false);
    this.emit('statechange', { isPlaying: false });
  }

  async play() {
    this.isPlaying = true;
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await MusicNotification.resume();
        this.emit('statechange', { isPlaying: true });
        return;
      } catch (e) {
        console.warn('Native resume error:', e);
      }
    }

    if (this.audio && this.audio.src) {
      try {
        await this.audio.play();
        this.emit('statechange', { isPlaying: true });
        return;
      } catch (e) {
        console.warn('Audio play notice:', e);
      }
    }

    if (this.currentTrack) {
      await this.playTrack(this.currentTrack);
      return;
    }

    this.emit('statechange', { isPlaying: true });
  }

  pause() {
    this.isPlaying = false;
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
    }

    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.pause().catch(() => {});
      } catch {}
    }

    try { this.audio.pause(); } catch {}
    this.emit('statechange', { isPlaying: false });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(seconds) {
    this.currentTime = seconds;
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.seek({ position: seconds }).catch(() => {});
      } catch {}
    } else if (this.audio && this.audio.src && !this.audio.src.endsWith('/null') && this.audio.src !== window.location.href) {
      this.audio.currentTime = seconds;
    }
    this.updatePositionState();
    this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration });
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    const effectiveVol = this.isMuted ? 0 : this.volume;
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.setVolume({ volume: effectiveVol }).catch(() => {});
      } catch {}
    }
    if (this.audio && this.audio.src) {
      this.audio.volume = effectiveVol;
    }
    this.emit('volumechange', { volume: this.volume, isMuted: this.isMuted });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    const effectiveVol = this.isMuted ? 0 : this.volume;
    if (Capacitor.isNativePlatform()) {
      try {
        MusicNotification.setVolume({ volume: effectiveVol }).catch(() => {});
      } catch {}
    }
    if (this.audio && this.audio.src) {
      this.audio.volume = effectiveVol;
    }
    this.emit('volumechange', { volume: this.volume, isMuted: this.isMuted });
  }

  getFrequencyData() {
    return Array.from({ length: 8 }, () => Math.floor(Math.random() * 20 + 4));
  }

  async recognizeSong() {
    if (this.isPlaying) {
      this.pause();
    }
    if (Capacitor.isNativePlatform()) {
      return await MusicNotification.recognizeSong();
    }
    throw new Error('Riconoscimento audio disponibile su dispositivo Android');
  }

  async cancelRecognition() {
    if (Capacitor.isNativePlatform()) {
      try {
        await MusicNotification.cancelRecognition();
      } catch {}
    }
  }

  on(event, callback) {
    this.listeners.add({ event, callback });
    return () => this.off(event, callback);
  }

  off(event, callback) {
    for (const listener of this.listeners) {
      if (listener.event === event && listener.callback === callback) {
        this.listeners.delete(listener);
        break;
      }
    }
  }

  emit(event, data) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        listener.callback(data);
      }
    }
  }
}

export const audioEngine = new AudioEngine();
