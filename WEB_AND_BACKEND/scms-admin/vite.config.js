import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // leaflet.heat is a legacy UMD/IIFE global plugin (expects window.L).
    // Excluding it from Vite's pre-bundling prevents the transform hang.
    exclude: ['leaflet.heat'],
  },
  build: {
    commonjsOptions: {
      // Allow Vite to process legacy CJS modules that use globals
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Ensure hot reload works correctly
    hmr: true,
  }
})
