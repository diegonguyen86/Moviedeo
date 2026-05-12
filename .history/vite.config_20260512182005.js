import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    // --- 🛡️ CẤU HÌNH BIẾN WEB THÀNH APP (PWA) ---
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'PHIM HAY QUÁ TRỜI',
        short_name: 'PhimHay',
        description: 'Xem phim đã đời, không lo giật lag',
        theme_color: '#111111',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png', // Nhớ file này trong thư mục public nhé
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // File 500x500 ông giáo đổi tên thành cái này cũng được
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Giúp icon đẹp hơn trên Android
          }
        ]
      }
    })
  ],
  base: "/", 
  server: {
    proxy: {
      // Mỗi khi code gọi đến /api, nó sẽ trỏ về máy chủ NguonC
      '/api': {
        target: 'https://phim.nguonc.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), 
      }
    }
  }
})