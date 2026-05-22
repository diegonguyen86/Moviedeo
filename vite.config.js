import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss()
  ],
  base: "/", 
  server: {
    proxy: {
      '/phim-proxy': {
        target: 'https://phimapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/phim-proxy/, ''), 
      }
    }
  }
})
