import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works on GitHub Pages (/<repo>/) and any other host.
// Build stamp shown in the app, so it's obvious which version a device is running.
const BUILD_ID = process.env.BUILD_ID || new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // GitHub Pages build sets BASE_PATH=/<repo>/ (absolute paths survive URLs without trailing slash)
  base: process.env.BASE_PATH || './',
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/*', 'icons/*'],
      manifest: {
        name: 'itmX Spielewelt',
        short_name: 'Spielewelt',
        description: 'Die interaktive Action-Spielewelt für Sales-Helden. Erstes Spiel: Hau den Legacy!',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#0b0f1a',
        theme_color: '#0b0f1a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // songs are NOT handled by the service worker: Safari/iPadOS plays media unreliably through it
        // a new deploy replaces the old one right away
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
});
