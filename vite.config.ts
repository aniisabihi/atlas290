import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

/**
 * Three entry pages, not one. The language lives in the path (`/sv/`, `/en/`) so each page can
 * declare its own `lang` and its own title before any JavaScript runs — which is what a search
 * engine indexes and what a screen reader announces on arrival. The root page is a static
 * language picker and must be listed here too, or it never reaches `dist` and the bare domain
 * 404s in production while working perfectly in development.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        root: resolve(import.meta.dirname, 'index.html'),
        sv: resolve(import.meta.dirname, 'sv/index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
})
