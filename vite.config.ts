import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSegment } from './shared/slug'

/**
 * Serves `/{lang}/{slug}-{code}/` from that language's entry page while developing.
 *
 * In production those 580 files exist on disk, written after the build by
 * `tools/build-pages.mjs`. Without this middleware every one of those URLs would 404 under
 * `yarn dev` and work once deployed, which is the worst way round: the failure shows up only
 * where it is hardest to notice and impossible to debug.
 *
 * The code is checked against the pantry so an unknown one 404s here exactly as it will in
 * production, rather than silently rendering the front page and looking like a bug in the app.
 */
function municipalityPages(): Plugin {
  return {
    name: 'municipality-pages',
    configureServer(server) {
      let codes: Set<string> | null = null
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? ''
        const match = /^\/(sv|en)\/([^/]+)\/?$/.exec(path)
        if (!match) return next()
        const code = match[2] ? parseSegment(match[2]) : null

        codes ??= new Set(
          (
            JSON.parse(
              readFileSync(
                resolve(import.meta.dirname, 'public/pantry/data/indicators.json'),
                'utf8',
              ),
            ) as { municipalities: Array<{ code: string }> }
          ).municipalities.map((m) => m.code),
        )

        if (!code || !codes.has(code)) {
          // Not `next()`. Vite's SPA fallback would answer 200 with the root page, while
          // production has no such file and answers 404 — and a route that only fails once
          // deployed is the hardest kind to notice.
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(`No municipality page at ${path}`)
          return
        }

        const html = readFileSync(resolve(import.meta.dirname, `${match[1]}/index.html`), 'utf8')
        server.transformIndexHtml(req.url ?? path, html).then(
          (transformed) => {
            res.setHeader('Content-Type', 'text/html')
            res.end(transformed)
          },
          () => next(),
        )
      })
    },
  }
}

/**
 * Three entry pages, not one. The language lives in the path (`/sv/`, `/en/`) so each page can
 * declare its own `lang` and its own title before any JavaScript runs — which is what a search
 * engine indexes and what a screen reader announces on arrival. The root page is a static
 * language picker and must be listed here too, or it never reaches `dist` and the bare domain
 * 404s in production while working perfectly in development.
 */
export default defineConfig({
  plugins: [react(), municipalityPages()],
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
