/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns';

// On Windows "localhost" resolves to ::1 first, which would make Vite listen on IPv6 only.
dns.setDefaultResultOrder('ipv4first');

// Docker sets VITE_API_TARGET to the backend container; locally the API runs on 127.0.0.1.
const API = process.env.VITE_API_TARGET || 'http://127.0.0.1:8002';

export default defineConfig({
  plugins: [react()],
  server: {
    // Served as http://localhost:5174 like the other projects; ipv4first (above) makes Vite
    // bind 127.0.0.1, so http://127.0.0.1:5174 keeps working too.
    host: 'localhost',
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
