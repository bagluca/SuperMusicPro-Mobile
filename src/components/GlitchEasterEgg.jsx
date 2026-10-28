import React, { useState, useEffect, useRef } from 'react';
import { X, Heart } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

export default function GlitchEasterEgg() {
  const [isGlitching, setIsGlitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const activeKeys = useRef(new Set());
  const embedUrl = 'https://drive.google.com/file/d/1f9Y_DbKSNLDNFi37sdq_sDSgvwD7qgmQ/preview';

  const triggerGlitch = () => {
    if (isOpen || isGlitching) return;
    // Pause any playing music immediately when the glitch starts
    try {
      audioEngine.pause();
    } catch (e) {
      console.warn('Audio pause error on glitch trigger:', e);
    }
    setIsGlitching(true);
    activeKeys.current.clear();
    // Glitch animation duration: exactly 4 seconds
    setTimeout(() => {
      setIsGlitching(false);
      setIsOpen(true);
    }, 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in any text box, input, textarea or search bar
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
        activeKeys.current.clear();
        return;
      }

      // Normalize key
      const key = e.key.toUpperCase();
      activeKeys.current.add(key);

      // Auto-clear keys after 350ms so typing sequentially never accumulates
      clearTimeout(window._secretDedicationTimer);
      window._secretDedicationTimer = setTimeout(() => {
        activeKeys.current.clear();
      }, 350);

      // Must be pressed simultaneously: all 4 keys A, R, I, L held down together at the same time
      if (
        activeKeys.current.has('A') &&
        activeKeys.current.has('R') &&
        activeKeys.current.has('I') &&
        activeKeys.current.has('L')
      ) {
        e.preventDefault();
        triggerGlitch();
      }
    };

    const handleKeyUp = (e) => {
      activeKeys.current.delete(e.key.toUpperCase());
    };

    const handleBlur = () => {
      activeKeys.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isOpen, isGlitching]);

  return (
    <>
      {/* Visual Glitch Fullscreen Flash Overlay */}
      {isGlitching && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-xl animate-pulse">
          {/* Cyber scanlines & color shift */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent bg-[length:100%_4px] opacity-70"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-pink-500/30 to-blue-500/20 mix-blend-screen animate-ping"></div>

          <div className="relative text-center px-8 py-8 border-2 border-emerald-400 bg-slate-950/95 rounded-2xl shadow-[0_0_60px_#10b981] space-y-4 max-w-xl mx-4 transform scale-105">
            <div className="text-4xl animate-bounce">⚡ 💖 ⚡</div>
            <div className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-pink-400 to-cyan-400 tracking-wider uppercase font-mono drop-shadow-[0_0_12px_rgba(236,72,153,0.8)]">
              ⚡ SYSTEM GLITCH DETECTED // DEDICA SPECIALE PER ILARIA 💖
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-400 to-pink-500 h-full rounded-full transition-all ease-linear" style={{ width: '100%', animation: 'glitch-timer 4s linear forwards' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Easter Egg Video Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-200">
          <div 
            className="w-full max-w-2xl bg-slate-900 border border-pink-500/40 rounded-2xl shadow-[0_0_50px_rgba(236,72,153,0.35)] overflow-hidden flex flex-col max-h-[94vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-pink-500/30 flex items-center justify-between bg-gradient-to-r from-slate-950 via-pink-950/40 to-slate-950">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(236,72,153,0.4)]">
                  <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Per mia figlia Ilaria</h3>
                    <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/40 font-bold uppercase tracking-wider">
                      Special
                    </span>
                  </div>
                  <p className="text-[11px] text-pink-300/80 font-medium">
                    Glitch Easter Egg sbloccato [A + R + I + L]
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="flex-1 bg-black p-2 flex flex-col items-center justify-center min-h-[460px]">
              <iframe
                src={embedUrl}
                title="Dedica Ilaria Video"
                className="w-full h-[460px] rounded-xl border border-slate-800 bg-black"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Footer with Close Button only */}
            <div className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-end text-xs">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold shadow-md transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
