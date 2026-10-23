import type { Config } from 'tailwindcss';

// Valores idénticos a las variables CSS del diseño aprobado (tracking.css)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lm: {
          red: '#EA1D3B',
          black: '#141414',
          white: '#FFFFFF',
          cream: '#FAF7F2',
          paper: '#FFFDFA',
          gray: '#6B6B6B',
          border: '#EAE5DD',
        },
      },
      fontFamily: {
        brick: ['Brick', 'sans-serif'],
        marker: ['"Permanent Marker"', 'Chelsea Market', 'cursive'],
        chelsea: ['"Chelsea Market"', 'cursive', '-apple-system', 'sans-serif'],
      },
      borderRadius: { lm: '14px' },
      boxShadow: {
        'lm-map': '0 6px 18px rgba(20, 18, 18, 0.14)',
        'lm-card': '0 3px 10px rgba(20, 18, 18, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      },
    },
  },
  plugins: [],
};

export default config;
