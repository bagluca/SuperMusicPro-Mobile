import React, { useRef, useState, useEffect } from 'react';

/**
 * MarqueeText: Automatically detects text overflow (including when system font size is enlarged)
 * and scrolls the text smoothly so the entire title or artist can be read without being cut off.
 */
export default function MarqueeText({
  text = '',
  className = '',
  containerClassName = '',
  speed = 28 // pixels per second for reading comfort
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(6);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const cWidth = container.clientWidth;
      const tWidth = textEl.scrollWidth;
      const diff = tWidth - cWidth;

      if (diff > 4) {
        setOverflow(true);
        setDistance(diff);
        // Duration: reading pause (approx 2s at each end) + movement proportional to distance
        const animDuration = Math.max(4.5, Math.round(diff / speed) + 3);
        setDuration(animDuration);
      } else {
        setOverflow(false);
        setDistance(0);
      }
    };

    // Small delay to ensure layout & custom fonts are rendered
    const timer = setTimeout(measure, 60);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => measure());
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', measure);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text, speed]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative w-full ${containerClassName}`}
    >
      <div
        ref={textRef}
        style={
          overflow
            ? {
                '--marquee-dist': `-${distance}px`,
                animation: `marquee-bounce ${duration}s ease-in-out infinite alternate`
              }
            : undefined
        }
        className={`whitespace-nowrap inline-block max-w-none will-change-transform ${className}`}
        title={text}
      >
        {text}
      </div>
    </div>
  );
}
