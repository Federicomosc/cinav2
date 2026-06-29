import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// PWA offline-first: app shell + font mappa + tile locali (cina.pmtiles, routing pbf).
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg', 'fonts/**/*', 'phrases/**/*', 'places/**/*'],
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
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
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
