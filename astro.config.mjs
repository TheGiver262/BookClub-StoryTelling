import {defineConfig} from 'astro/config';
import tailwind from '@astrojs/tailwind';

process.env.PUBLIC_LANDING_ONLY = 'true';
export default defineConfig({
  output: 'static', srcDir: './landing', publicDir: './public', outDir: './dist-landing',
  integrations: [tailwind({applyBaseStyles: true})],
  vite: {build: {sourcemap: false}},
});
