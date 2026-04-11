import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          card: '#161b22',
          hover: '#1c2128',
          border: '#30363d',
        },
        brand: {
          buy: '#3fb950',
          sell: '#f85149',
          hold: '#d29922',
          accent: '#58a6ff',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
