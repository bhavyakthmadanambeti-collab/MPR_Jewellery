/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FAF6EF', 50: '#FFFDF9', 100: '#FAF6EF', 200: '#F3ECE1', 300: '#EADFCF' },
        pearl: '#FFFDF8',
        beige: { DEFAULT: '#EFE5D6', dark: '#E2D4BF' },
        cocoa: { DEFAULT: '#2B1D14', 50: '#6E5A4B', 100: '#5A4535', 200: '#46342A', 300: '#3A2A1F', 400: '#2B1D14', 500: '#1E140E' },
        ink: '#161110',
        gold: { DEFAULT: '#B8893B', light: '#D9BD85', champagne: '#E8D6B0', deep: '#8A6320', dark: '#6E4E18' },
        success: '#3F6B45',
        danger: '#9B3B2E',
        warning: '#9A6A12',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Switzer', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,29,20,0.04), 0 8px 24px -12px rgba(43,29,20,0.14)',
        lift: '0 2px 4px rgba(43,29,20,0.05), 0 18px 40px -18px rgba(43,29,20,0.28)',
        ring: '0 0 0 1px rgba(184,137,59,0.25)',
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C79E55 0%, #E4CD98 45%, #B8893B 100%)',
        'gold-sheen': 'linear-gradient(90deg, rgba(184,137,59,0) 0%, rgba(184,137,59,0.55) 50%, rgba(184,137,59,0) 100%)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        slideIn: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'none' } },
        slideInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'none' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        fadeUp: 'fadeUp .5s cubic-bezier(.2,.7,.2,1) both',
        slideIn: 'slideIn .32s cubic-bezier(.2,.7,.2,1) both',
        slideInRight: 'slideInRight .32s cubic-bezier(.2,.7,.2,1) both',
        marquee: 'marquee 40s linear infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
