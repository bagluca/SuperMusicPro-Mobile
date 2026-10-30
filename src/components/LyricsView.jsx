import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics } from '../services/lyricsService';
import { audioEngine } from '../services/audioEngine';
import { Loader2, ArrowDownCircle, RefreshCw } from 'lucide-react';
import MarqueeText from './MarqueeText';

export default function LyricsView({ currentTrack, isPlaying }) {
  const [lyricsData, setLyricsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [syncOffset, setSyncOffset] = useState(0); // Offset in seconds
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try {
      return Number(localStorage.getItem('supermusicpro_lyrics_fontsize')) || 22;
    } catch {
      return 22;
    }
  });

  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userInteractionTimeoutRef = useRef(null);

  const handleUpdateFontSize = (newSize) => {
    setFontSize(newSize);
    try {
      localStorage.setItem('supermusicpro_lyrics_fontsize', String(newSize));
    } catch {}
  };

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setSyncOffset(0);
    setActiveIndex(-1);
    setIsUserInteracting(false);

    const vid = currentTrack.videoId || (currentTrack.id?.startsWith('yt_') ? currentTrack.id.replace('yt_', '') : null);
    fetchLyrics(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration,
      vid,
      currentTrack.album || ''
    ).then((data) => {
      if (isMounted) {
        setLyricsData(data);
        setLoading(false);
        if (data?.isSynced && data?.lines?.length > 0 && audioEngine.currentTime > 0) {
          const curr = audioEngine.currentTime;
          let idx = -1;
          for (let i = 0; i < data.lines.length; i++) {
            if (curr >= data.lines[i].time) idx = i;
            else break;
          }
          setActiveIndex(idx);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, currentTrack?.title]);

  // Synchronize active line with audio playback
  useEffect(() => {
    const unsub = audioEngine.on('timeupdate', ({ currentTime: curr }) => {
      if (!lyricsData || !lyricsData.isSynced || !lyricsData.lines || lyricsData.lines.length === 0) {
        return;
      }

      const effectiveTime = curr + syncOffset;

      // Before first line starts (intro)
      if (effectiveTime < lyricsData.lines[0].time) {
        setActiveIndex((prev) => (prev === -1 ? prev : -1));
        return;
      }

      let bestIdx = 0;
      for (let i = 0; i < lyricsData.lines.length; i++) {
        if (effectiveTime >= lyricsData.lines[i].time) {
          bestIdx = i;
        } else {
          break;
        }
      }

      setActiveIndex((prev) => (prev === bestIdx ? prev : bestIdx));
    });

    return () => unsub();
  }, [lyricsData, syncOffset]);

  // Smooth local container scroll (NEVER scrolls parent or window)
  useEffect(() => {
    if (!lyricsData?.isSynced || activeIndex < 0 || isUserInteracting) return;

    const container = containerRef.current;
    const activeEl = lineRefs.current[activeIndex];

    if (container && activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeIndex, lyricsData?.isSynced, isUserInteracting]);

  // Detect user touch/scroll to temporarily prevent auto-scroll fight
  const handleUserTouchStart = () => {
    setIsUserInteracting(true);
    if (userInteractionTimeoutRef.current) clearTimeout(userInteractionTimeoutRef.current);
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 4500);
  };

  const resumeAutoScroll = () => {
    setIsUserInteracting(false);
    if (userInteractionTimeoutRef.current) clearTimeout(userInteractionTimeoutRef.current);
    if (containerRef.current && lineRefs.current[activeIndex]) {
      const container = containerRef.current;
      const activeEl = lineRefs.current[activeIndex];
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  };

  const handleLineClick = (lineTime) => {
    if (lineTime !== undefined && lyricsData?.isSynced) {
      audioEngine.seek(Math.max(0, lineTime - syncOffset));
      setIsUserInteracting(false);
    }
  };

  if (!currentTrack) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 select-none">
        <p className="text-base font-medium text-slate-400">Nessun brano in riproduzione</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-[#090d14] via-[#0a0e17] to-[#070a10] select-none">
      {/* Background ambient glow from album art */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${currentTrack.cover})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      {/* Floating Header Controls */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        {/* Track Title and Sync Badge */}
        <div className="flex items-center space-x-2.5 min-w-0">
          {lyricsData?.isSynced ? (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/40 font-semibold tracking-wide flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sincronizzato
            </span>
          ) : lyricsData && lyricsData.lines?.length > 0 ? (
            <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/40 font-semibold tracking-wide shrink-0">
              Testo Statico
            </span>
          ) : null}
          <div className="flex-1 min-w-0 overflow-hidden">
            <MarqueeText
              text={`${currentTrack.title} • ${currentTrack.artist || 'Artista'}`}
              className="text-xs text-slate-300 font-medium"
            />
          </div>
        </div>

        {/* Sync Offset and Font Size Controls */}
        <div className="flex items-center space-x-2">
          {lyricsData?.isSynced && (
            <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 text-xs">
              <span className="text-[10px] text-slate-400 font-bold mr-1">SYNC</span>
              <button
                onClick={() => setSyncOffset((prev) => Math.round((prev - 0.5) * 10) / 10)}
                className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs active:scale-95"
                title="Anticipa (-0.5s)"
              >
                -
              </button>
              <button
                onClick={() => setSyncOffset(0)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-emerald-400 hover:bg-slate-700 transition-colors"
                title="Azzera offset (0s)"
              >
                {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
              </button>
              <button
                onClick={() => setSyncOffset((prev) => Math.round((prev + 0.5) * 10) / 10)}
                className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs active:scale-95"
                title="Ritarda (+0.5s)"
              >
                +
              </button>
            </div>
          )}

          {/* Font Size */}
          <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => handleUpdateFontSize(Math.max(16, fontSize - 2))}
              className="px-1.5 py-0.5 font-bold text-slate-300 hover:text-white active:scale-95"
              title="Testo più piccolo"
            >
              A-
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1">{fontSize}</span>
            <button
              onClick={() => handleUpdateFontSize(Math.min(42, fontSize + 2))}
              className="px-1.5 py-0.5 font-bold text-slate-300 hover:text-white active:scale-95"
              title="Testo più grande"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Re-sync Floating Toast Button */}
      {isUserInteracting && lyricsData?.isSynced && activeIndex >= 0 && (
        <button
          onClick={resumeAutoScroll}
          className="absolute bottom-6 right-6 z-30 flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl transition-all transform active:scale-95 animate-bounce"
        >
          <ArrowDownCircle className="w-4 h-4" />
          <span>Ripristina Sincronizzazione</span>
        </button>
      )}

      {/* Main lyrics scroll area */}
      <div
        ref={containerRef}
        onTouchStart={handleUserTouchStart}
        onWheel={handleUserTouchStart}
        onMouseDown={handleUserTouchStart}
        className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-20 py-16 space-y-6 z-10 flex flex-col items-center touch-pan-y"
        style={{ overscrollBehavior: 'contain' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center my-auto space-y-3 text-slate-400">
            <Loader2 className="w-9 h-9 animate-spin text-emerald-400" />
            <p className="text-sm font-semibold text-slate-300">Caricamento testo e sincronizzazione...</p>
          </div>
        ) : lyricsData && lyricsData.lines && lyricsData.lines.length > 0 ? (
          <div className="w-full max-w-2xl space-y-5 text-center my-auto">
            {lyricsData.isSynced ? (
              // Synchronized Karaoke Lyrics
              lyricsData.lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPassed = idx < activeIndex;

                return (
                  <p
                    key={idx}
                    ref={(el) => (lineRefs.current[idx] = el)}
                    onClick={() => handleLineClick(line.time)}
                    style={{
                      fontSize: isActive ? `${fontSize * 1.25}px` : `${fontSize}px`,
                    }}
                    className={`cursor-pointer transition-all duration-300 leading-relaxed select-text ${
                      isActive
                        ? 'font-extrabold text-white scale-105 drop-shadow-[0_0_24px_rgba(255,255,255,0.7)]'
                        : isPassed
                        ? 'font-medium text-slate-500 hover:text-slate-300'
                        : 'font-medium text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              // Static Lyrics (no false jumps, clean reading format)
              lyricsData.lines.map((line, idx) => (
                <p
                  key={idx}
                  style={{ fontSize: `${fontSize}px` }}
                  className="font-medium text-slate-300 leading-relaxed select-text"
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center my-auto text-center space-y-2 text-slate-400 p-6">
            <p className="text-base font-semibold text-slate-300">Nessun testo trovato per questo brano</p>
            <p className="text-xs text-slate-500 max-w-sm">
              I database di testi non contengono ancora il testo per questo titolo o il brano è strumentale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
