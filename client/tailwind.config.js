/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        line: '#00B900',
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF8C19',
          600: '#EA7E0E',
          700: '#C2660A',
          800: '#9A4F08',
          900: '#7C3F06',
        },
      },
      fontFamily: {
        display: ['Outfit', 'Noto Sans TC', 'sans-serif'],
        body: ['Noto Sans TC', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
