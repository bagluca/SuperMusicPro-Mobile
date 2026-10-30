import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Heart, 
  FileText, 
  ListMusic, 
  ExternalLink,
  Sparkles,
  RefreshCw,
  Zap,
  Download,
  Clock,
  Check,
  ListPlus
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { musicService } from '../services/musicService';
import MarqueeText from './MarqueeText';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerBar({
  currentTrack,
  isPlaying,
  isLiked,
  onToggleLike,
  onPrev,
  onNext,
  onTogglePlay,
  onOpenLyrics,
  onOpenQueue,
  onOpenOverrideModal,
  isLyricsOpen,
  isQueueOpen,
  audioQuality = 'lossless',
  onOpenSleepTimer,
  sleepTimerMinutes = 0,
  onOpenAddToPlaylist
}) {
  const [downloadStatus, setDownloadStatus] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(null);

  const isDraggingRef = useRef(false);
  const mobileScrubberRef = useRef(null);

  useEffect(() => {
    const unsubTime = audioEngine.on('timeupdate', ({ currentTime: nextTime, duration: nextDur }) => {
      if (!isDraggingRef.current) {
        setCurrentTime(prev => (Math.floor(prev) === Math.floor(nextTime) ? prev : nextTime));
      }
      if (nextDur && !isNaN(nextDur) && nextDur > 0) {
        setDuration(prev => (Math.floor(prev) === Math.floor(nextDur) ? prev : nextDur));
      }
    });

    const unsubMeta = audioEngine.on('loadedmetadata', ({ duration: nextDur }) => {
      if (nextDur && !isNaN(nextDur) && nextDur > 0) setDuration(nextDur);
    });

    const unsubVol = audioEngine.on('volumechange', ({ volume: nextVol, isMuted: nextMuted }) => {
      setVolume(nextVol);
      setIsMuted(nextMuted);
    });

    return () => {
      unsubTime();
      unsubMeta();
      unsubVol();
    };
  }, []);

  const updateScrubFromClientX = (clientX) => {
    const el = mobileScrubberRef.current;
    if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return undefined;
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = ratio * (duration || 180);
    setDragTime(seekTime);
    setCurrentTime(seekTime);
    return seekTime;
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    setIsDragging(true);
    updateScrubFromClientX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateScrubFromClientX(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      const calculated = updateScrubFromClientX(e.clientX);
      const targetTime = calculated !== undefined ? calculated : (dragTime !== null ? dragTime : currentTime);
      audioEngine.seek(targetTime);
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragTime(null);
    }
  };

  const handlePointerCancel = (e) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragTime(null);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    audioEngine.seek(val);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    audioEngine.setVolume(val);
  };

  if (!currentTrack) {
    return (
      <footer className="hidden md:flex h-20 bg-[#0d121c]/95 border-t border-slate-800/80 px-6 items-center justify-between backdrop-blur-md select-none text-slate-500 text-xs flex-shrink-0">
        <div>Nessun brano in riproduzione. Seleziona una canzone da ascoltare.</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500/40"></span>
          <span>Motore audio SuperMusicPro pronto</span>
        </div>
      </footer>
    );
  }

  const effectiveTime = dragTime !== null ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  return (
    <footer className="relative h-14 md:h-22 theme-bg-secondary/95 border-t theme-border px-3 md:px-6 flex items-center justify-between backdrop-blur-xl select-none z-40 flex-shrink-0">
      {/* Mobile-only sleek neon touch-draggable scrubber (hidden in lyrics view) */}
      {!isLyricsOpen && (
        <div 
          ref={mobileScrubberRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="sm:hidden absolute -top-3 left-0 right-0 h-8 flex items-center cursor-pointer select-none touch-none z-30 px-0"
          title="Trascina per scorrere il brano"
        >
          <div className={`w-full bg-slate-800/90 relative transition-all duration-100 ${isDragging ? 'h-2 bg-slate-700' : 'h-1.5'}`}>
            {/* Progress fill */}
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-400 relative shadow-[0_0_12px_rgba(16,185,129,0.95),0_0_3px_#34d399]"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />

            {/* Draggable Neon Thumb Knob */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-emerald-400 pointer-events-none transition-transform ${
                isDragging 
                  ? 'w-5 h-5 scale-125 shadow-[0_0_18px_#10b981,0_0_6px_#fff]' 
                  : 'w-3.5 h-3.5 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
              }`}
              style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />

            {/* Floating Time Preview Tooltip while dragging */}
            {isDragging && (
              <div 
                className="absolute -top-9 -translate-x-1/2 bg-slate-900/95 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/60 shadow-2xl pointer-events-none whitespace-nowrap z-50 flex items-center gap-1 backdrop-blur-md"
                style={{ left: `${Math.min(90, Math.max(10, progressPercent))}%` }}
              >
                <span className="text-emerald-400">{formatTime(effectiveTime)}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{formatTime(duration)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Track details (Left) */}
      <div className="flex items-center space-x-3 flex-1 md:w-1/4 md:flex-initial min-w-0 md:min-w-[210px]">
        <div 
          onClick={onOpenLyrics}
          className="relative group flex-shrink-0 cursor-pointer"
        >
          <img
            src={currentTrack.cover}
            alt={currentTrack.title}
            className={`w-10 h-10 md:w-13 md:h-13 rounded-lg object-cover shadow-lg border border-slate-700/50 transition-transform ${
              isPlaying ? 'scale-100 ring-2 ring-emerald-500/40' : 'scale-95 opacity-80'
            }`}
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-slate-950/40 rounded-lg flex items-center justify-center gap-0.5 pointer-events-none">
              {[10, 18, 14, 20].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-emerald-400 rounded-full animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 cursor-pointer overflow-hidden" onClick={onOpenLyrics}>
          <div className="flex items-center gap-1.5 w-full">
            <MarqueeText
              text={currentTrack.title}
              className="text-xs md:text-sm font-semibold text-white hover:underline"
            />
            {currentTrack.isLossless && (
              <span className="hidden sm:inline text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1 rounded shrink-0">
                FLAC
              </span>
            )}
          </div>
          <MarqueeText
            text={currentTrack.artist}
            className="text-[11px] md:text-xs text-slate-400 hover:text-slate-200"
          />
          <div className="hidden sm:flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-emerald-400/90 font-medium flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Hi-Fi Lossless
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1">
          <button
            onClick={onToggleLike}
            className={`p-2 rounded-full transition-transform active:scale-90 hover:bg-slate-800/60 ${
              isLiked ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isLiked ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-emerald-400' : ''}`} />
          </button>

          {onOpenAddToPlaylist && currentTrack && (
            <button
              onClick={() => onOpenAddToPlaylist(currentTrack)}
              className="p-2 rounded-full text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors"
              title="Aggiungi a playlist"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Center Controls & Scrubber */}
      <div className="flex flex-col items-center flex-shrink-0 md:max-w-xl md:w-2/4 px-1 md:px-4">
        {/* Playback Buttons */}
        <div className="flex items-center space-x-3 md:space-x-4 mb-1">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`hidden md:block p-1.5 rounded-full text-xs transition-colors ${
              isShuffle ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Riproduzione casuale"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="p-1.5 text-slate-300 hover:text-white transition-colors"
            title="Precedente"
          >
            <SkipBack className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            title={isPlaying ? 'Pausa' : 'Riproduci'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 md:w-5 md:h-5 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-slate-950 ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 text-slate-300 hover:text-white transition-colors"
            title="Successivo"
          >
            <SkipForward className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          </button>

          <button
            onClick={() => setIsRepeat(!isRepeat)}
            className={`hidden md:block p-1.5 rounded-full text-xs transition-colors ${
              isRepeat ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Ripeti"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar with Spotify-style neon glow */}
        <div className="hidden sm:flex w-full items-center space-x-2 text-[10px] md:text-[11px] text-slate-400 font-mono">
          <span className="w-8 text-right text-emerald-400/90">{formatTime(effectiveTime)}</span>
          <div className="relative flex-1 flex items-center group cursor-pointer py-1">
            <div className="w-full h-1 group-hover:h-1.5 bg-slate-800 rounded-full overflow-hidden transition-all relative">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-400 rounded-full transition-all duration-100 shadow-[0_0_12px_rgba(16,185,129,0.9),0_0_4px_#34d399] relative"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              >
                {isPlaying && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-pulse" />
                )}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={effectiveTime}
              onMouseDown={() => { isDraggingRef.current = true; setIsDragging(true); }}
              onTouchStart={() => { isDraggingRef.current = true; setIsDragging(true); }}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDragTime(val);
                setCurrentTime(val);
              }}
              onMouseUp={(e) => {
                const val = parseFloat(e.target.value);
                audioEngine.seek(val);
                isDraggingRef.current = false;
                setIsDragging(false);
                setDragTime(null);
              }}
              onTouchEnd={(e) => {
                const val = parseFloat(e.target.value);
                audioEngine.seek(val);
                isDraggingRef.current = false;
                setIsDragging(false);
                setDragTime(null);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Tools (Download, Sleep Timer, Video, DSP, Lyrics, Queue, Volume) */}
      <div className="hidden md:flex items-center justify-end space-x-2.5 w-1/4">
        {/* Download Current Track */}
        <button
          onClick={async () => {
            if (!currentTrack) return;
            setDownloadStatus('loading');
            const ok = await musicService.downloadTrack(currentTrack);
            if (ok) {
              setDownloadStatus('done');
              setTimeout(() => setDownloadStatus(''), 3000);
            } else {
              setDownloadStatus('error');
            }
          }}
          className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border shadow-sm transition-all ${
            downloadStatus === 'done'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700/60'
          }`}
          title="Scarica questo brano per l'ascolto offline (yt_dlp)"
        >
          {downloadStatus === 'done' ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Download className="w-3 h-3 text-emerald-400" />
          )}
          <span className="hidden xl:inline">{downloadStatus === 'done' ? 'Scaricato' : 'Scarica'}</span>
        </button>

        {/* Sleep timer button */}
        <button
          onClick={onOpenSleepTimer}
          className={`p-2 rounded-lg transition-colors ${
            sleepTimerMinutes > 0
              ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
          title={sleepTimerMinutes > 0 ? `Sleep Timer: ${sleepTimerMinutes}m` : 'Imposta Sleep Timer'}
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* Lyrics */}
        <button
          onClick={onOpenLyrics}
          className={`p-2 rounded-lg transition-colors ${
            isLyricsOpen ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
          title="Testi Sincronizzati (LRCLIB)"
        >
          <FileText className="w-4 h-4" />
        </button>

        {/* Queue */}
        <button
          onClick={onOpenQueue}
          className={`p-2 rounded-lg transition-colors ${
            isQueueOpen ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
          title="Coda di riproduzione"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Volume controls */}
        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800/60">
          <button
            onClick={() => audioEngine.toggleMute()}
            className="p-1 text-slate-400 hover:text-white"
            title={isMuted ? 'Riattiva audio' : 'Silenzia'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-18 md:w-22 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>
      </div>
    </footer>
  );
}
