import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 4175,
    proxy: {
      '/api': {
        target: process.env.ADMIN_API_PROXY_TARGET ?? 'http://localhost:4176',
      },
    },
  },
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
  },
});
