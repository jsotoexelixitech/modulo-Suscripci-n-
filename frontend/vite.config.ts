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
  const isProd = mode === 'production'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    // ── Ofuscación en producción ──────────────────────────────────────────
    // Terser viene incluido en Vite — no necesita instalación extra.
    // En dev se usa esbuild (más rápido) para que HMR no sufra.
    build: {
      minify: isProd ? 'terser' : 'esbuild',
      terserOptions: isProd ? {
        compress: {
          // Eliminar console.* en producción
          drop_console:  true,
          drop_debugger: true,
          // Ofuscación de flujo de control
          passes:        2,
          pure_getters:  true,
          unsafe:        true,
          unsafe_arrows: true,
        },
        mangle: {
          // Renombrar variables/funciones internas
          toplevel: true,
          safari10: true,
        },
        format: {
          // Eliminar comentarios
          comments: false,
        },
      } : undefined,

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
