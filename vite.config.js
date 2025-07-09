import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  // plugins: [react(), basicSsl()],
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      }
    },
    allowedHosts: ['all', 'manoswara.loca.lt'],
    // Added specific ngrok domain to allowedHosts
    // The dynamic CORS configuration in server.js already supports ngrok domains
  }
})
