/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3368A0',
          secondary: '#66A3BF',
          mint: '#C8DFDB',
          sand: '#F2EFE7',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.4))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.8))' },
        }
      }
    },
  },
  plugins: [],
}

