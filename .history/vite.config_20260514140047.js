import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    // --- 🛡️ LỆNH TỰ HỦY PWA TẬN GỐC ---
    VitePWA({
      selfDestroying: true, // Khi điện thoại nhận được bản build này, nó sẽ tự xóa Service Worker
    })
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