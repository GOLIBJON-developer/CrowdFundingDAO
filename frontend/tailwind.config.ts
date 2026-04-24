import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#09090B',
          card: '#111113',
          elevated: '#18181B',
          border: '#27272A',
        },
        amber: {
          DEFAULT: '#F59E0B',
          dim: '#92400E',
          glow: 'rgba(245,158,11,0.15)',
        },
      },
      animation: {
        'pulse-amber': 'pulse-amber 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fade-up 0.4s ease-out forwards',
      },
      keyframes: {
        'pulse-amber': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config