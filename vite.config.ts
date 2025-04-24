import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: { // Add this server configuration
    proxy: {
      // Proxy requests from /ask to http://localhost:3000/ask
      '/ask': {
        target: 'http://localhost:3000',
        changeOrigin: true, // Recommended for virtual hosted sites
        secure: false,      // Optional: If target is https and has self-signed cert
        // rewrite: (path) => path.replace(/^\/ask/, '/ask') // Usually not needed if backend expects /ask
      }
    }
  }
})
