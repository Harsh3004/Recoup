/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './frontend/index.html',
    './frontend/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          dark: '#070b12',
          card: 'rgba(15, 23, 42, 0.75)',
          cardHover: 'rgba(30, 41, 59, 0.85)',
          glass: 'rgba(255, 255, 255, 0.03)',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          accent: 'rgba(99, 102, 241, 0.4)',
        },
        emerald: {
          glow: 'rgba(16, 185, 129, 0.2)',
        },
        indigo: {
          glow: 'rgba(99, 102, 241, 0.2)',
        },
        razorpay: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
};
