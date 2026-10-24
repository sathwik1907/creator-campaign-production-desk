import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Keep the development proxy in sync with BackEnd/.env.example (PORT=4000).
const backendPort = process.env.VITE_BACKEND_PORT || '4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
