import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend runs on :8000. Proxying /api avoids CORS and works for the EEG WebSocket too.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
