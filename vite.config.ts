import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/maze-generaiting/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Maze Kids — генератор лабиринтов',
        short_name: 'Maze Kids',
        description: 'PWA приложение для генерации детских лабиринтов разных форм и сложности.',
        theme_color: '#101828',
        background_color: '#f7f7fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/maze-generaiting/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
});
