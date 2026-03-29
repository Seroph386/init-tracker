import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

function normalizeBasePath(value: string | undefined): string {
  if (!value) {
    return '/init-tracker/'
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
    base: normalizeBasePath(env.VITE_APP_BASE_PATH),
    build: {
      cssMinify: 'esbuild', // Use esbuild instead of lightningcss to avoid @property warnings
    },
    test: {
      globals: true,
      environment: 'jsdom',
    }
  }
})
