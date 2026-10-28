import React, { useState, useEffect } from 'react';
import { Mic, X, Play, Heart, Plus, RefreshCw, Sparkles, Disc3, Trash2, AlertCircle } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

const HISTORY_KEY = 'supermusicpro_recognition_history';

function loadRecognitionHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecognitionHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export default function SongRecognitionModal({
  isOpen,
  onClose,
  onPlayTrack,
  likedSongsMap = {},
  onToggleLike,
  onOpenAddToPlaylist
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'matched' | 'nomatch' | 'error'
  const [matchedTrack, setMatchedTrack] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [history, setHistory] = useState(() => loadRecognitionHistory());

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      audioEngine.cancelRecognition();
      setStatus('idle');
      setElapsedSec(0);
    }
    return () => {
      audioEngine.cancelRecognition();
    };
  }, [isOpen]);

  useEffect(() => {
    if (status !== 'listening') {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const startListening = async () => {
    setStatus('listening');
    setMatchedTrack(null);
    setErrorMessage('');
    setElapsedSec(0);

    try {
      const res = await audioEngine.recognizeSong();
      if (res && res.matched && res.title) {
        const track = {
          id: res.id || (res.videoId ? `yt_${res.videoId}` : `shazam_${Date.now()}`),
          videoId: res.videoId || '',
          title: res.title,
          artist: res.artist || 'Artista',
          album: res.album || 'Singolo Riconosciuto',
          cover: res.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
          duration: res.duration || 200,
          source: 'Shazam Match'
        };
        setMatchedTrack(track);
        setStatus('matched');

        const updated = [
          track,
          ...history.filter((h) => h.title !== track.title || h.artist !== track.artist)
        ].slice(0, 20);
        setHistory(updated);
        saveRecognitionHistory(updated);
      } else {
        setStatus('nomatch');
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('annullato')) {
        setStatus('idle');
      } else {
        setErrorMessage(msg);
        setStatus('error');
      }
    }
  };

  const handleClose = () => {
    audioEngine.cancelRecognition();
    onClose();
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveRecognitionHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Mic className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Riconoscimento Brani</h3>
              <p className="text-[10px] text-emerald-400 font-medium">Motore Audio Fingerprinting SuperMusic PRO</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {status === 'listening' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="relative flex items-center justify-center w-28 h-28 mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="absolute inset-3 rounded-full bg-emerald-500/30 animate-pulse" />
                <button
                  onClick={() => {
                    audioEngine.cancelRecognition();
                    setStatus('idle');
                  }}
                  className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Mic className="w-9 h-9 stroke-[2.2]" />
                </button>
              </div>
              <h4 className="text-base font-bold text-white">In ascolto... ({elapsedSec}s)</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Avvicina il telefono alla fonte musicale. Generazione impronta acustica in corso...
              </p>
            </div>
          )}

          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-5 text-center">
              <button
                onClick={startListening}
                className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                <Mic className="w-9 h-9" />
              </button>
              <h4 className="text-sm font-bold text-white">Tocca per riconoscere una canzone</h4>
              <p className="text-xs text-slate-400 mt-1">
                Individua qualsiasi brano intorno a te e ascoltalo subito
              </p>
            </div>
          )}

          {status === 'matched' && matchedTrack && (
            <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4 space-y-4 shadow-lg">
              <div className="flex items-center space-x-2 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Brano Individuato!</span>
              </div>

              <div className="flex items-center space-x-3.5">
                <img
                  src={matchedTrack.cover}
                  alt={matchedTrack.title}
                  className="w-16 h-16 rounded-xl object-cover shadow-md border border-slate-700 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-extrabold text-white truncate">{matchedTrack.title}</h4>
                  <p className="text-xs text-slate-300 font-medium truncate mt-0.5">{matchedTrack.artist}</p>
                  {matchedTrack.album && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{matchedTrack.album}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    onPlayTrack(matchedTrack);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Riproduci Ora</span>
                </button>

                {onToggleLike && (
                  <button
                    onClick={() => onToggleLike(matchedTrack)}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      likedSongsMap[matchedTrack.id]
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title="Aggiungi ai preferiti"
                  >
                    <Heart className={`w-4 h-4 ${likedSongsMap[matchedTrack.id] ? 'fill-emerald-400' : ''}`} />
                  </button>
                )}

                {onOpenAddToPlaylist && (
                  <button
                    onClick={() => onOpenAddToPlaylist(matchedTrack)}
                    className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Aggiungi a playlist"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={startListening}
                  className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 transition-colors"
                  title="Riconosci un altro brano"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {status === 'nomatch' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-center space-y-3">
              <Disc3 className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">Nessuna corrispondenza trovata</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Assicurati che la musica sia ben udibile e riprova.
                </p>
              </div>
              <button
                onClick={startListening}
                className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Riprova Ascolto</span>
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">Impossibile completare l'ascolto</h4>
                <p className="text-xs text-rose-300 mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={startListening}
                className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs inline-flex items-center space-x-1.5 border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Riprova</span>
              </button>
            </div>
          )}

          {/* Recognition History */}
          {history.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Cronologia Riconoscimenti ({history.length})
                </span>
                <button
                  onClick={handleClearHistory}
                  className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Cancella</span>
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {history.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      onPlayTrack(item);
                      onClose();
                    }}
                    className="flex items-center space-x-3 p-2 rounded-xl bg-slate-950/50 hover:bg-slate-800/70 border border-slate-800/60 cursor-pointer transition-colors"
                  >
                    <img
                      src={item.cover}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.artist}</div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 flex-shrink-0 mr-1" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
