/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        supermusic: {
          bg: '#0c0f17',
          surface: '#151a24',
          card: '#1c2333',
          cardHover: '#252f44',
          border: '#2a354c',
          accent: '#1db954',
          accentHover: '#1ed760',
          cyan: '#00f2fe',
          purple: '#7928ca',
          pink: '#ff0080',
          textMuted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
