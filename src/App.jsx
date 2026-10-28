import React, { useState, useEffect, useRef } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import PlaylistView from './components/PlaylistView';
import LyricsView from './components/LyricsView';
import DownloadsView from './components/DownloadsView';
import SleepTimerModal from './components/SleepTimerModal';
import SettingsModal from './components/SettingsModal';
import InfoModal from './components/InfoModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import PlaylistsOverviewView from './components/PlaylistsOverviewView';
import QueueView from './components/QueueView';
import GlitchEasterEgg from './components/GlitchEasterEgg';
import MobileNavBar from './components/MobileNavBar';
import SongRecognitionModal from './components/SongRecognitionModal';
import { StatusBar, Style } from '@capacitor/status-bar';

import { musicService, FULL_CATALOG } from './services/musicService';
import { storageService } from './services/storageService';
import { audioEngine } from './services/audioEngine';

const isSameTrack = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (a.videoId && b.videoId && String(a.videoId) === String(b.videoId)) return true;
  if (a.fileName && b.fileName && a.fileName === b.fileName) return true;
  if (a.url && b.url && a.url === b.url) return true;
  const aTitle = (a.title || '').trim().toLowerCase();
  const bTitle = (b.title || '').trim().toLowerCase();
  const aArtist = (a.artist || '').trim().toLowerCase();
  const bArtist = (b.artist || '').trim().toLowerCase();
  if (aTitle && bTitle && aTitle === bTitle && aArtist && bArtist && aArtist === bArtist) {
    return true;
  }
  return false;
};

export default function App() {
  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  const [tracks, setTracks] = useState(FULL_CATALOG);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [playbackContext, setPlaybackContext] = useState({
    type: 'home',
    title: 'Tendenze',
    category: 'all',
    artist: '',
    tracks: []
  });

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const playbackContextRef = useRef(playbackContext);
  playbackContextRef.current = playbackContext;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const [playlists, setPlaylists] = useState(() => storageService.getPlaylists());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [likedSongs, setLikedSongs] = useState(() => storageService.getLikedSongs());
  const [downloadedCount, setDownloadedCount] = useState(0);

  // Modals & overlay states
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isRecognitionOpen, setIsRecognitionOpen] = useState(false);

  // Apply theme to document and body
  useEffect(() => {
    const activeTheme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.body.className = `theme-${activeTheme} font-sans select-none overflow-x-hidden overflow-y-hidden h-[100dvh] w-full max-w-full text-slate-100`;

    // Configure native Android status bar if on Capacitor
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      }
    } catch {}
  }, [settings.theme]);

  // Fast liked map
  const likedSongsMap = React.useMemo(() => {
    const map = {};
    for (const song of likedSongs) {
      map[song.id] = true;
    }
    return map;
  }, [likedSongs]);

  // Load trending tracks from open sources
  useEffect(() => {
    let isMounted = true;
    musicService.getHomeTracks(selectedCategory, selectedSource).then(loaded => {
      if (isMounted && Array.isArray(loaded) && loaded.length > 0) {
        setTracks(loaded);
        if (!currentTrack) {
          setCurrentTrack(loaded[0]);
        }
      }
    });
    return () => { isMounted = false; };
  }, [selectedCategory, selectedSource]);

  // Refresh downloaded count on view change
  const refreshDownloadedCount = async () => {
    try {
      const list = await musicService.getDownloadedTracks();
      setDownloadedCount(list.length);
    } catch {}
  };

  useEffect(() => {
    refreshDownloadedCount();
  }, [settings.downloadFolder]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerMinutes <= 0) return;
    const interval = setInterval(() => {
      setSleepTimerMinutes(prev => {
        if (prev <= 1) {
          audioEngine.pause();
          return 0;
        }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  // Listen to AudioEngine state changes
  useEffect(() => {
    const unsubState = audioEngine.on('statechange', ({ isPlaying }) => {
      setIsPlaying(isPlaying);
    });

    const unsubNext = audioEngine.on('next', () => handleNext());
    const unsubPrev = audioEngine.on('previous', () => handlePrev());

    const unsubEnded = audioEngine.on('ended', () => {
      handleNext();
    });

    const unsubPlayLocal = audioEngine.on('play_local', async () => {
      const downloaded = await musicService.getDownloadedTracks();
      if (downloaded && downloaded.length > 0) {
        handlePlayAll(downloaded, { type: 'local', title: 'Libreria Locale' });
      }
    });

    return () => {
      unsubState();
      unsubNext();
      unsubPrev();
      unsubEnded();
      unsubPlayLocal();
    };
  }, []);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        audioEngine.seek(audioEngine.currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audioEngine.seek(Math.max(0, audioEngine.currentTime - 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        audioEngine.setVolume(Math.min(1, audioEngine.volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        audioEngine.setVolume(Math.max(0, audioEngine.volume - 0.05));
      } else if (e.code === 'KeyM') {
        audioEngine.toggleMute();
      } else if (e.code === 'KeyL') {
        setCurrentView(prev => (prev === 'lyrics' ? 'home' : 'lyrics'));
      } else if (e.code === 'KeyQ') {
        setIsQueueOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrack]);

  const handlePlayTrack = (track, contextTracks = null, contextMeta = null) => {
    if (!track) return;
    setCurrentTrack(track);
    audioEngine.playTrack(track);
    storageService.addToHistory(track);

    let listToUse = contextTracks;
    let metaToUse = contextMeta;

    if (listToUse && Array.isArray(listToUse) && listToUse.length > 0) {
      setPlaybackContext({
        type: metaToUse?.type || 'list',
        title: metaToUse?.title || '',
        category: metaToUse?.category || '',
        artist: metaToUse?.artist || track.artist || '',
        tracks: listToUse
      });
      const currentIndex = listToUse.findIndex(t => isSameTrack(t, track));
      if (currentIndex !== -1) {
        setQueue(listToUse.slice(currentIndex + 1));
      } else {
        setQueue(listToUse.filter(t => !isSameTrack(t, track)));
      }
    } else {
      // Continuation within existing queue or context
      const currentQueue = queueRef.current;
      const inQueueIndex = currentQueue.findIndex(t => isSameTrack(t, track));
      if (inQueueIndex !== -1) {
        setQueue(currentQueue.slice(inQueueIndex + 1));
      } else {
        const ctx = playbackContextRef.current;
        const currentContextTracks = (ctx.tracks && ctx.tracks.length > 0) ? ctx.tracks : tracksRef.current;
        const currentIndex = currentContextTracks.findIndex(t => isSameTrack(t, track));
        if (currentIndex !== -1) {
          setQueue(currentContextTracks.slice(currentIndex + 1));
        } else {
          setQueue([]);
        }
      }
    }
  };

  const handlePlayAll = (songList, contextMeta = null) => {
    if (!songList || songList.length === 0) return;
    const first = songList[0];
    setCurrentTrack(first);
    setPlaybackContext({
      type: contextMeta?.type || 'list',
      title: contextMeta?.title || '',
      category: contextMeta?.category || '',
      artist: contextMeta?.artist || first.artist || '',
      tracks: songList
    });
    setQueue(songList.slice(1));
    audioEngine.playTrack(first);
    storageService.addToHistory(first);
  };

  const handleTogglePlay = () => {
    if (!audioEngine.currentTrack && currentTrack) {
      handlePlayTrack(currentTrack);
    } else if (!currentTrack && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
    } else {
      audioEngine.togglePlay();
    }
  };

  const handleNext = () => {
    const currentQueue = queueRef.current;
    // 1. Consume upcoming song in active queue (strict sequential progression)
    if (currentQueue && currentQueue.length > 0) {
      const nextSong = currentQueue[0];
      setQueue(currentQueue.slice(1));
      setCurrentTrack(nextSong);
      audioEngine.playTrack(nextSong);
      storageService.addToHistory(nextSong);
      return;
    }

    // 2. Queue is exhausted: respect playbackContext strictly and loop back within current list
    const ctx = playbackContextRef.current;
    const activeList = (ctx.tracks && ctx.tracks.length > 0) ? ctx.tracks : tracksRef.current;

    if (activeList && activeList.length > 0) {
      const currentSong = currentTrackRef.current;
      const currentIdx = activeList.findIndex(t => isSameTrack(t, currentSong));
      let nextIdx = 0;
      if (currentIdx !== -1 && currentIdx + 1 < activeList.length) {
        nextIdx = currentIdx + 1;
      }
      const nextSong = activeList[nextIdx];
      setQueue(activeList.slice(nextIdx + 1));
      setCurrentTrack(nextSong);
      audioEngine.playTrack(nextSong);
      storageService.addToHistory(nextSong);
      return;
    }
  };

  const handlePrev = () => {
    if (audioEngine.currentTime > 3) {
      audioEngine.seek(0);
      return;
    }

    const ctx = playbackContextRef.current;
    const activeList = (ctx.tracks && ctx.tracks.length > 0) ? ctx.tracks : tracksRef.current;
    const currentSong = currentTrackRef.current;
    const currentIndex = activeList.findIndex(t => isSameTrack(t, currentSong));

    if (currentIndex > 0) {
      const prevTrack = activeList[currentIndex - 1];
      setCurrentTrack(prevTrack);
      setQueue(activeList.slice(currentIndex));
      audioEngine.playTrack(prevTrack);
      storageService.addToHistory(prevTrack);
    } else if (activeList.length > 0) {
      audioEngine.seek(0);
    }
  };

  const handleToggleLike = (track) => {
    storageService.toggleLikeSong(track);
    setLikedSongs(storageService.getLikedSongs());
  };

  // Playlist Management Handlers
  const handleCreatePlaylist = (name, description = '') => {
    const created = storageService.createPlaylist(name, description);
    setPlaylists(storageService.getPlaylists());
    setSelectedPlaylistId(created.id);
    setCurrentView('playlist');
    return created;
  };

  const handleUpdatePlaylistDetails = (playlistId, updates) => {
    const updated = storageService.updatePlaylist(playlistId, updates);
    setPlaylists([...updated]);
  };

  const handleDeletePlaylist = (playlistId) => {
    const updated = storageService.deletePlaylist(playlistId);
    setPlaylists([...updated]);
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(null);
      setCurrentView('home');
    }
  };

  const handleAddToPlaylist = (playlistId, track) => {
    const updated = storageService.addSongToPlaylist(playlistId, track);
    setPlaylists([...updated]);
  };

  const handleRemoveTrackFromPlaylist = (playlistId, trackId) => {
    const updated = storageService.removeSongFromPlaylist(playlistId, trackId);
    setPlaylists([...updated]);
  };

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-full theme-bg-primary text-slate-100 overflow-hidden font-sans">
      {/* Windows 11 Title Bar */}
      <TitleBar 
        onOpenInfo={() => setIsInfoOpen(true)} 
        onOpenRecognition={() => setIsRecognitionOpen(true)}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          setSelectedPlaylistId={setSelectedPlaylistId}
          likedCount={likedSongs.length}
          downloadedCount={downloadedCount}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenInfo={() => setIsInfoOpen(true)}
          onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
          sleepTimerMinutes={sleepTimerMinutes}
        />

        {/* Dynamic Center View */}
        <main className="flex-1 flex flex-col min-w-0 theme-bg-primary relative overflow-hidden">
          {currentView === 'home' && (
            <HomeView
              tracks={tracks}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedSource={selectedSource}
              setSelectedSource={setSelectedSource}
              onPlayTrack={handlePlayTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongsMap={likedSongsMap}
              onToggleLike={handleToggleLike}
              onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
            />
          )}

          {currentView === 'search' && (
            <SearchView
              onPlayTrack={handlePlayTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongsMap={likedSongsMap}
              onToggleLike={handleToggleLike}
              onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
              onOpenRecognition={() => setIsRecognitionOpen(true)}
            />
          )}

          {currentView === 'downloads' && (
            <DownloadsView
              onPlayTrack={handlePlayTrack}
              onPlayAll={handlePlayAll}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
              onToggleLike={handleToggleLike}
              likedSongsMap={likedSongsMap}
              onDownloadsChanged={refreshDownloadedCount}
            />
          )}

          {currentView === 'liked' && (
            <PlaylistView
              isLikedView={true}
              likedSongs={likedSongs}
              onPlayTrack={handlePlayTrack}
              onPlayAll={handlePlayAll}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongsMap={likedSongsMap}
              onToggleLike={handleToggleLike}
              onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
              onBackToPlaylists={() => setCurrentView('playlists')}
            />
          )}

          {currentView === 'playlist' && selectedPlaylist && (
            <PlaylistView
              playlist={selectedPlaylist}
              likedSongs={likedSongs}
              onPlayTrack={handlePlayTrack}
              onPlayAll={handlePlayAll}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongsMap={likedSongsMap}
              onToggleLike={handleToggleLike}
              onAddTrackToPlaylist={(track) => handleAddToPlaylist(selectedPlaylist.id, track)}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
              onDeletePlaylist={handleDeletePlaylist}
              onUpdatePlaylistDetails={handleUpdatePlaylistDetails}
              onBackToPlaylists={() => setCurrentView('playlists')}
            />
          )}

          {(currentView === 'playlists' || (currentView === 'playlist' && !selectedPlaylist)) && (
            <PlaylistsOverviewView
              playlists={playlists}
              likedCount={likedSongs.length}
              onSelectPlaylist={(pId) => {
                setSelectedPlaylistId(pId);
                setCurrentView('playlist');
              }}
              onOpenLiked={() => {
                setSelectedPlaylistId(null);
                setCurrentView('liked');
              }}
              onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
              onDeletePlaylist={handleDeletePlaylist}
              onPlayAll={handlePlayAll}
            />
          )}

          {currentView === 'lyrics' && (
            <LyricsView
              currentTrack={currentTrack}
              isPlaying={isPlaying}
            />
          )}
        </main>

        {/* Queue Slide-out Panel */}
        <QueueView
          isOpen={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
          queue={queue}
          currentTrack={currentTrack}
          onPlayTrack={handlePlayTrack}
          onRemoveFromQueue={(idx) => setQueue(prev => prev.filter((_, i) => i !== idx))}
          onClearQueue={() => setQueue([])}
        />
      </div>

      {/* Bottom Fixed Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isLiked={currentTrack ? !!likedSongsMap[currentTrack.id] : false}
        onToggleLike={() => currentTrack && handleToggleLike(currentTrack)}
        onPrev={handlePrev}
        onNext={handleNext}
        onTogglePlay={handleTogglePlay}
        onOpenLyrics={() => setCurrentView(prev => prev === 'lyrics' ? 'home' : 'lyrics')}
        onOpenQueue={() => setIsQueueOpen(prev => !prev)}
        isLyricsOpen={currentView === 'lyrics'}
        isQueueOpen={isQueueOpen}
        isQueueOpen={isQueueOpen}
        audioQuality={settings.audioQuality}
        onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
        sleepTimerMinutes={sleepTimerMinutes}
        onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
      />

      {/* Modals */}
      <SongRecognitionModal
        isOpen={isRecognitionOpen}
        onClose={() => setIsRecognitionOpen(false)}
        onPlayTrack={handlePlayTrack}
        likedSongsMap={likedSongsMap}
        onToggleLike={handleToggleLike}
        onOpenAddToPlaylist={(track) => setTrackToAddToPlaylist(track)}
      />

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        currentMinutes={sleepTimerMinutes}
        onSetSleepTimer={(mins) => setSleepTimerMinutes(mins)}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
      />

      <AddToPlaylistModal
        isOpen={!!trackToAddToPlaylist}
        onClose={() => setTrackToAddToPlaylist(null)}
        track={trackToAddToPlaylist}
        playlists={playlists}
        onAddToPlaylist={handleAddToPlaylist}
        onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
        onCreateNewPlaylist={handleCreatePlaylist}
      />

      {/* Mobile Navigation Bar */}
      <MobileNavBar
        currentView={currentView}
        setCurrentView={setCurrentView}
        setSelectedPlaylistId={setSelectedPlaylistId}
        onOpenLyrics={() => {
          setSelectedPlaylistId(null);
          setCurrentView(prev => prev === 'lyrics' ? 'home' : 'lyrics');
        }}
        isLyricsOpen={currentView === 'lyrics'}
      />

      {/* ARIL Glitch Easter Egg */}
      <GlitchEasterEgg />
    </div>
  );
}
