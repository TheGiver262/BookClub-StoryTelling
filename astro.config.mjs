import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  },
});
