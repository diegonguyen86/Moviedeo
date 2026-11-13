import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// Máy dev: chạy luôn API /api/tmdb (trên Vercel thì file api/tmdb.js tự thành serverless function)
const devApiTmdb = (env) => ({
  name: 'dev-api-tmdb',
  configureServer(server) {
    process.env.TMDB_KEY = process.env.TMDB_KEY || env.TMDB_KEY || env.VITE_TMDB_KEY;
    server.middlewares.use('/api/tmdb', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/tmdb.js');
      req.url = '/api/tmdb' + (req.url || '');
      return handler(req, res);
    });
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [
    react(), 
    tailwindcss(),
    devApiTmdb(loadEnv(mode, process.cwd(), '')),
  ],
  base: "/",
  // Bản build production: không xuất sourcemap (khó đọc ngược mã nguồn hơn) và bỏ các console.log/info/debug
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Tách thư viện ra file riêng: code web đổi thì người dùng chỉ tải lại phần code web,
        // còn Firebase / React đã nằm sẵn trong bộ nhớ đệm trình duyệt.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  esbuild: {
    pure: ["console.log", "console.info", "console.debug"],
    drop: ["debugger"],
    legalComments: "none",
  },
  server: {
    proxy: {
      '/phim-proxy': {
        target: 'https://phimapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/phim-proxy/, ''), 
      }
    }
  }
}))
