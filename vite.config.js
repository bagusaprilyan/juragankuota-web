import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend → GitHub Pages (custom domain juragankuota.id).
// base '/' karena pakai custom domain (bukan /juragankuota-web/).
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:5000' } },
  build: { outDir: 'dist', sourcemap: false }
})
