const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Plus Jakarta Sans', ...defaultTheme.fontFamily.sans],
        mono:    ['JetBrains Mono', 'Fira Code', ...defaultTheme.fontFamily.mono],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          50: '#ECFDF7', 100: '#D1FAE5', 200: '#A7F3D0',
          300: '#6EE7B7', 400: '#34D399', 500: '#10B981',
          600: '#0C6B52', 700: '#0A5A45', 800: '#065F46', 900: '#064E3B',
        },
        danger: {
          50: '#FEF2F2', 100: '#FEE2E2', 400: '#F87171',
          500: '#DC2626', 600: '#B91C1C', 700: '#991B1B',
        },
      },
      transitionDuration: { '180': '180ms' },
      transitionTimingFunction: { 'spring': 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        fadeInUp:    { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInRight:{ '0%': { opacity: '0', transform: 'translateX(20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:     { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseDot:    { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(0.75)' } },
        shimmer:     { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        countUp:     { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in-up':     'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in':        'fadeIn 0.2s ease-out both',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left':  'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':       'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-dot':      'pulseDot 2s ease-in-out infinite',
        'shimmer':        'shimmer 1.5s ease-in-out infinite',
        'count-up':       'countUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'spin-slow':      'spin 3s linear infinite',
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(12,107,82,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(12,107,82,0.06)',
        'modal':      '0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
        'sidebar':    '2px 0 16px rgba(0,0,0,0.06)',
        'topbar':     '0 1px 0 rgba(0,0,0,0.06)',
        'input':      '0 0 0 3px rgba(12,107,82,0.12)',
        'input-err':  '0 0 0 3px rgba(220,38,38,0.12)',
      },
    },
  },
  plugins: [],
};