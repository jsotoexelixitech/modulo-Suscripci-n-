import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5180,
    allowedHosts: true,
    hmr: {
      // Cuando el frontend se expone a través de un proxy/túnel (Cloudflare,
      // ngrok, etc.) el WebSocket de HMR debe usar el puerto externo (443 HTTPS)
      // y protocolo wss, no el puerto interno de Vite.
      clientPort: 443,
      protocol: 'wss',
    },
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
})
