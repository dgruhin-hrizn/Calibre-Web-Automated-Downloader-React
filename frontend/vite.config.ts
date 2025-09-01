import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections (for Docker)
    port: 5173,
    proxy: {
      // Proxy API requests to Flask backend
      '/api': {
        target: process.env.NODE_ENV === 'development' && process.env.DOCKER_ENV 
          ? 'http://flask-backend:8084'  // Docker container name
          : 'http://localhost:8084',     // Local development
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
