/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf5',
          100: '#d6f9e6',
          500: '#13a463',
          600: '#0f8a52',
          700: '#0c6f43',
        },
      },
    },
  },
  plugins: [],
}
