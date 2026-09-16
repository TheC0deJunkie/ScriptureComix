import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { scripturePatchPlugin } from './scripts/scripturePatchPlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // Dev only: writes repaired verses back into public/data so the dataset stays consistent
      scripturePatchPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false, // Do NOT enable SW in dev — prevents HMR conflicts
        },
        manifest: {
          name: 'ScriptureComix',
          short_name: 'ScriptureComix',
          description: 'Read scripture as comics — offline, free, all traditions',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // ONLY cache app shell files via globPatterns — NEVER include /data/
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Scripture, quizzes, context and scene pictures live under /data and
          // are cached at runtime (CacheFirst below), never precached
          globIgnores: ['**/data/**'],

          // Pre-cache canon manifests on install (per locked decision: "Canon manifests pre-cached on install")
          additionalManifestEntries: [
            { url: '/data/protestant/manifest.json', revision: null },
            { url: '/data/catholic/manifest.json', revision: null },
            { url: '/data/ethiopian/manifest.json', revision: null },
            { url: '/data/quran/manifest.json', revision: null },
          ],

          // Runtime caching: CacheFirst for all scripture data files (per-book JSON)
          runtimeCaching: [
            {
              urlPattern: /^\/data\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'scripture-data-v1',
                expiration: {
                  maxEntries: 2000, // ~550 book files + 4 manifests + headroom
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
