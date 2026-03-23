import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss()],
  base: mode === 'github-pages' ? '/init-tracker/' : '/',
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    cssMinify: 'esbuild', // Use esbuild instead of lightningcss to avoid @property warnings
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'vmThreads',
  }
}))
