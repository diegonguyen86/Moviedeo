import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
