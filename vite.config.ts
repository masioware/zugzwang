/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import localAssets from './scripts/local-assets';

const COLOR = '#09090b';
const icon = (src: string, sizes: string, purpose?: string) => ({ src, sizes, type: 'image/png', ...(purpose && { purpose }) });

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localAssets(),
    VitePWA({
      // A new version waits for the user's OK (see UpdatePrompt): reloading by itself could end a game in progress.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Zugzwang',
        short_name: 'Zugzwang',
        description: 'Análise de partidas, estatísticas e treino de xadrez — tudo no seu aparelho.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: COLOR,
        theme_color: COLOR,
        categories: ['games', 'education'],
        icons: [
          icon('/icons/icon-192.png', '192x192'),
          icon('/icons/icon-512.png', '512x512'),
          icon('/icons/maskable-192.png', '192x192', 'maskable'),
          icon('/icons/maskable-512.png', '512x512', 'maskable'),
        ],
        // Long-press shortcuts on the home-screen icon (Android).
        shortcuts: [
          { name: 'Jogar contra o bot', short_name: 'Jogar', url: '/play', icons: [icon('/icons/icon-192.png', '192x192')] },
          { name: 'Puzzles', url: '/puzzles', icons: [icon('/icons/icon-192.png', '192x192')] },
          { name: 'Partidas', url: '/games', icons: [icon('/icons/icon-192.png', '192x192')] },
        ],
      },
      workbox: {
        // Installed up front: the app, the engine (game review works offline) and the opening data.
        globPatterns: [
          '**/*.{js,css,html,svg,png,woff2}',
          'stockfish/*.{js,wasm}',
          'engine/*.js',
          'data/openings.json',
          'data/theory.json',
          'data/puzzles/index.json',
        ],
        globIgnores: ['pieces/local/**', 'boards/local/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(data|stockfish|engine|pieces|boards)\//],
        runtimeCaching: [
          {
            // Puzzle buckets (11 MB in all): kept as they're used, served from the cache and refreshed behind it.
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/puzzles/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'puzzle-buckets', expiration: { maxEntries: 40 } },
          },
          {
            // The user's own piece sets and boards (git-ignored folders) and their listing.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && /^\/((pieces|boards)\/local\/|local-assets\.json$)/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'local-assets' },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});
