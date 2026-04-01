import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env* server-side variables (no VITE_ prefix restriction)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],

    server: {
      // In development, proxy /api/* to the backend so the browser never
      // sees a different origin (avoids CORS issues entirely).
      // Override the target by setting API_TARGET in .env.local
      proxy: {
        '/api': {
          target: env.API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          // Uncomment if your backend requires removing the /api prefix:
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
