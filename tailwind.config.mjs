/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#9b4d36',
          'red-hover': '#813c2a',
          'red-soft': '#f7e7db',
          navy: '#365e4b',
          'navy-hover': '#294c3a',
          'navy-soft': '#e8eddf',
          gold: '#a87a4c',
          'gold-soft': '#f4ead2',
        },
        slate: {
          50: '#f8f5ec', 100: '#f0eee2', 200: '#dcded0', 300: '#c2c9b6',
          400: '#929f89', 500: '#6e7c66', 600: '#58664f', 700: '#45563f',
          800: '#34462f', 900: '#263a27', 950: '#18281b',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
