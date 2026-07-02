import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// PWA offline-first: app shell + font UI (bundled) + glyph mappa + tile locali.
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // 'autoUpdate': ad ogni nuovo deploy il service worker si aggiorna e la
      // pagina si ricarica da sé (niente banner). Compromesso noto: un reload può
      // capitare mentre si compila un form — scelto su richiesta per non dover
      // svuotare la cache a mano. Vedi src/lib/pwa-update.svelte.ts.
      registerType: 'autoUpdate',
      // NB: non elencare qui font/phrases/places: sono già coperti da
      // `workbox.globPatterns` (woff2/pbf/m4a/jpg). Duplicarli genera due voci
      // di precache per file (una URL-encoded, una no) → manifest gonfio.
      includeAssets: ['app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cina Tour 2026',
        short_name: 'Cina 2026',
        description: 'Compagno di viaggio offline-first per la Cina (30 Lug – 18 Ago 2026)',
        lang: 'it',
        theme_color: '#0c0907',
        background_color: '#0c0907',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,pbf,pmtiles,m4a,mp3,jpg,jpeg,webp}'],
        navigateFallback: 'index.html',
        globIgnores: ['**/tiles/_part_*.pmtiles'],
        maximumFileSizeToCacheInBytes: 120 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/phrases\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'phrase-audio',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/tiles\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-map-tiles',
              expiration: { maxEntries: 8000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
          {
            urlPattern: /\/fonts\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-glyphs',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.(?:png|jpe?g|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'img',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Fallback online se i tile locali non sono stati generati
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
