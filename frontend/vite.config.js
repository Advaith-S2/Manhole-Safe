import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Lets a single ngrok tunnel (pointed at this dev server) serve both the
    // app and its API calls, by forwarding /api and /uploads through to the
    // backend — avoids needing a second simultaneous tunnel, which ngrok's
    // free tier doesn't allow.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
    allowedHosts: true,
  },
});
