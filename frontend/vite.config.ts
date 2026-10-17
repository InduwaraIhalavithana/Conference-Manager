/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Docker sets VITE_API_TARGET to the backend container; locally the API runs on 127.0.0.1.
const API = process.env.VITE_API_TARGET || 'http://127.0.0.1:8002';

export default defineConfig({
  plugins: [react()],
  server: {
    // 127.0.0.1 explicitly: "localhost" made Vite listen on IPv6 only.
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': API,
      '/auth': API,
      '/uploads': API,
    },
  },
  // Pre-bundle the lazily loaded map and QR libraries, so the first visit to those pages
  // does not make Vite re-optimize and reload the whole app.
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet', 'qrcode', 'jsqr'],
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
