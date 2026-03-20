/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        sand: '#fafafa',
        accent: '#000000',
        line: 'rgba(0, 0, 0, 0.08)',
        mint: '#f5f5f5'
      },
      fontFamily: {
        sans: ['Geist', '"IBM Plex Sans"', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
