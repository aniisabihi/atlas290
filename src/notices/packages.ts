/**
 * Every package in the site's runtime dependency tree, with its licence.
 *
 * ISC and MIT both require their copyright notice to travel with a distribution, so this list is
 * a licence obligation rather than a courtesy. `packages.test.ts` checks it against
 * `package.json`'s own `dependencies`, so a package added without being listed here fails the
 * build instead of quietly shipping unattributed.
 *
 * Over-listing is harmless — crediting a library that tree-shaking removed costs nothing — while
 * under-listing is the violation, so this errs towards listing.
 */
export const SHIPPED_PACKAGES: ReadonlyArray<{ name: string; licence: string }> = [
  { name: 'commander', licence: 'MIT' },
  { name: 'd3-array', licence: 'ISC' },
  { name: 'd3-color', licence: 'ISC' },
  { name: 'd3-geo', licence: 'ISC' },
  { name: 'd3-interpolate', licence: 'ISC' },
  { name: 'd3-scale-chromatic', licence: 'ISC' },
  { name: 'internmap', licence: 'ISC' },
  { name: 'react', licence: 'MIT' },
  { name: 'react-dom', licence: 'MIT' },
  { name: 'scheduler', licence: 'MIT' },
  { name: 'topojson-client', licence: 'ISC' },
  { name: 'zod', licence: 'MIT' },
]
