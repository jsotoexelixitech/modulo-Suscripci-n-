import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * El HMR vía WebSocket tiene dos escenarios:
 *
 *  1. Acceso local (http://localhost:5180)            → ws://localhost:5180  ← default Vite
 *  2. Acceso vía Cloudflare Tunnel (https://*.trycloudflare.com)
 *                                                     → wss://<dominio>:443
 *
 * Para no fallar en el caso 1, NO forzamos `protocol: 'wss'` ni `clientPort: 443`
 * por defecto. Solo se activan cuando se exporta `VITE_HMR_TUNNEL=1`
 * (lo hace `start-dev.sh --tunnel`).
 */
export default defineConfig(({ mode }) => {
  const env    = loadEnv(mode, process.cwd(), '')
  const tunnel = env.VITE_HMR_TUNNEL === '1' || env.VITE_HMR_TUNNEL === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    build: {
      minify: true,

      rollupOptions: {
        output: {
          // Nombre de chunk sin contenido semántico
          chunkFileNames:  'assets/[hash].js',
          entryFileNames:  'assets/[hash].js',
          assetFileNames:  'assets/[hash][extname]',
          // Code-splitting automático por vendor para mejor cache
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          },
        },
      },

      // Avisos de chunks grandes (umbral 700 KB)
      chunkSizeWarningLimit: 700,
    },

    server: {
      host: true,
      port: 5180,
      allowedHosts: true,
      hmr: tunnel
        ? { clientPort: 443, protocol: 'wss' }
        : true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/files': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
