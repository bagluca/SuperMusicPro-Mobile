import React from 'react';
import { X, Play, Trash2, ListMusic, Music, Sparkles } from 'lucide-react';

export default function QueueView({ isOpen, onClose, queue, currentTrack, onPlayTrack, onRemoveFromQueue, onClearQueue }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-[#101522] border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center space-x-2">
          <ListMusic className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm text-white">Coda di riproduzione</h3>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {queue.length} brani
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {queue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
              title="Svuota coda"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Currently playing */}
        {currentTrack && (
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              In Riproduzione
            </div>
            <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <img
                src={currentTrack.cover}
                alt={currentTrack.title}
                className="w-11 h-11 rounded-lg object-cover shadow"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-white truncate">{currentTrack.title}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  {currentTrack.source || 'SuperMusicPro Audio'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Up Next */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Prossimi in Coda
          </div>
          {queue.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              La coda è vuota. I brani successivi verranno generati automaticamente dal motore di raccomandazione SuperMusicPro.
            </div>
          ) : (
            <div className="space-y-1.5">
              {queue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800/60 transition-colors group"
                >
                  <span className="text-[11px] text-slate-500 font-mono w-4 text-center">
                    {idx + 1}
                  </span>
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-9 h-9 rounded object-cover shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                      {track.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{track.artist}</div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onPlayTrack(track)}
                      className="p-1 hover:text-white text-slate-400"
                      title="Riproduci ora"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => onRemoveFromQueue(idx)}
                      className="p-1 hover:text-rose-400 text-slate-400"
                      title="Rimuovi dalla coda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
