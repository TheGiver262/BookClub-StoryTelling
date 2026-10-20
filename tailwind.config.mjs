/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#C62828',
          'red-hover': '#B71C1C',
          'red-soft': '#FFEBEE',
          navy: '#151879',
          'navy-hover': '#0D105A',
          'navy-soft': '#E8EAF6',
          gold: '#F59E0B',
          'gold-soft': '#FEF3C7',
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
