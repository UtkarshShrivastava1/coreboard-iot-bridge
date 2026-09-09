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
      }
    },
  },
  plugins: [],
}

