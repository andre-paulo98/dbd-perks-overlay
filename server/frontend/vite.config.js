import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// In production this app is served by nginx, which proxies /api, /perks,
// and /ws to the backend container (see frontend/nginx.conf). This dev
// server proxy just mirrors that locally so `npm run dev` works against
// a plain `node src/index.js` backend on port 3001 with no CORS setup needed.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/perks': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
