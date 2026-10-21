/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ysbk: {
          primary: '#365E4B',
          'primary-hover': '#294C3A',
          'primary-pale': '#E8EDDF',
          terracotta: '#9B4D36',
          'terracotta-hover': '#813C2A',
          'terracotta-pale': '#F7E7DB',
          gold: '#A87A4C',
          'gold-pale': '#F4EAD2',
          sage: '#819079',
          page: '#F8F5EC',
          paper: '#FFFDF5',
          ink: '#35483C',
          muted: '#64705C',
          border: '#DCDED0',
        },
        brand: {
          red: '#9b4d36',
          'red-hover': '#813c2a',
          'red-soft': '#f7e7db',
          navy: '#365e4b',
          'navy-hover': '#294c3a',
          'navy-soft': '#e8eddf',
          gold: '#a87a4c',
          'gold-soft': '#f4ead2',
          sage: '#819079',
        },
        slate: {
          50: '#f8f5ec', 100: '#f0eee2', 200: '#dcded0', 300: '#c2c9b6',
          400: '#929f89', 500: '#6e7c66', 600: '#58664f', 700: '#45563f',
          800: '#34462f', 900: '#263a27', 950: '#18281b',
        },
      },
      borderRadius: {
        'control': '14px',
        'card': '22px',
        'modal': '24px',
        'tab': '15px',
        'cover': '4px',
      },
      boxShadow: {
        'soft-card': '0 5px 18px rgba(53, 72, 60, 0.08)',
        'soft-btn': '0 3px 10px rgba(53, 72, 60, 0.09)',
        'soft-btn-hover': '0 5px 16px rgba(53, 72, 60, 0.12)',
        'soft-modal': '0 16px 48px rgba(53, 72, 60, 0.16)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Newsreader', 'Lora', 'Georgia', 'serif'],
        handwriting: ['"Dancing Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};
