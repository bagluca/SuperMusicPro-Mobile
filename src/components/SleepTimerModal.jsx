import React, { useState } from 'react';
import { X, Clock, Moon, Check, PowerOff } from 'lucide-react';

export default function SleepTimerModal({ isOpen, onClose, currentMinutes, onSetSleepTimer }) {
  if (!isOpen) return null;

  const options = [15, 30, 45, 60, 90];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121824] border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Sleep Timer</h3>
              <p className="text-[11px] text-slate-400">Interrompi la musica automaticamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-2">
          {options.map((mins) => (
            <button
              key={mins}
              onClick={() => {
                onSetSleepTimer(mins);
                onClose();
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                currentMinutes === mins
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/50 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{mins} minuti</span>
              {currentMinutes === mins && <Check className="w-4 h-4 text-amber-400" />}
            </button>
          ))}

          {currentMinutes > 0 && (
            <button
              onClick={() => {
                onSetSleepTimer(0);
                onClose();
              }}
              className="w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-400 bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-1.5"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Disattiva Sleep Timer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
