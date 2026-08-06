import { defineConfig } from 'vite';

// Minimal Vite config. The dev server serves index.html for unknown paths
// (SPA fallback), so deep links like /groutcho-lit resolve to the router.
export default defineConfig({
  server: { port: 5173 }
});
