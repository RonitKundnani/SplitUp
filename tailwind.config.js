/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary accent = teal (teal-600 for buttons / links).
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          500: '#0d9488', // teal-600 — primary
          600: '#0f766e', // teal-700 — hover
          700: '#115e59', // teal-800 — text on light
        },
      },
    },
  },
  plugins: [],
}
