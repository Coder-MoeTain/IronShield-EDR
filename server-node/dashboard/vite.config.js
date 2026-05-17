/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.warn(
              '[Vite proxy] Backend unreachable — start API: cd server-node && npm run dev',
              err?.message || err
            );
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: {
                    code: 'BACKEND_UNAVAILABLE',
                    message:
                      'API backend is not running on port 3000. Start it with: cd server-node && npm run dev',
                  },
                })
              );
            }
          });
        },
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
});
