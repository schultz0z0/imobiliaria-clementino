import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'motion-vendor': ['motion'],
            'icons-vendor': ['lucide-react'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/content/imoveis/**',
          '**/content/manual/**',
          '**/content/Leads/**',
          '**/public/imoveis/**',
          '**/public/sitemap.xml',
          '**/public/robots.txt',
          '**/dist/**',
          '**/dist-admin/**',
        ],
      },
      proxy: {
        '/api/property-previews': {
          target: process.env.PUBLIC_API_PROXY_TARGET ?? 'http://localhost:4176',
          changeOrigin: true,
        },
        '/api/public': {
          target: process.env.PUBLIC_API_PROXY_TARGET ?? 'http://localhost:4176',
          changeOrigin: true,
        },
      },
    },
});
