import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Сторінки рендеряться на Worker при кожному запиті (output: 'server'),
// тому зміни з адмінки видно одразу, а пошуковик усе одно отримує готовий HTML.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
