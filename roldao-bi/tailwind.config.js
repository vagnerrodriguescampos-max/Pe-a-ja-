/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          surface2: 'var(--surface-2)',
          border: 'var(--border)',
          text: 'var(--text)',
          muted: 'var(--muted)',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#b7d9ff',
          300: '#84beff',
          400: '#4a9aff',
          500: '#1f74f5',
          600: '#0f57d1',
          700: '#0d44a8',
          800: '#0e3a86',
          900: '#0f316b',
          950: '#0a1f47',
        },
        good: '#16c784',
        warn: '#f5a623',
        bad: '#f0475b',
        info: '#3ab7ff',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,15,30,.06), 0 8px 24px -12px rgba(10,15,30,.12)',
        glow: '0 0 0 1px rgba(31,116,245,.25), 0 0 24px rgba(31,116,245,.18)',
      },
      borderRadius: {
        xl2: '1.1rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: 1 }, '50%': { opacity: .55 } },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
