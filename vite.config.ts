import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  server: { port: 5180, host: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          gsap: ['gsap'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  define: {
    // QA forcing (3/4/5 scatters, wild, big win) exists only in development builds;
    // this folds to `false` in production so the whole code path is dropped.
    __DEV_FORCING__: JSON.stringify(mode !== 'production'),
  },
}));
