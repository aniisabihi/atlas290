/**
 * Loaded by registry.load-order.test.ts in a real child process. Imports the two modules in
 * the order the CLI reaches them — population.ts first, then registry.ts — which is the
 * order that crashes if registry.ts ever reads a definition eagerly at its top level again.
 * Not a test itself; it exists so the test can observe a real module-resolution order that
 * Vitest's own graph never reproduces.
 */
const population = await import('./population')
const registry = await import('./registry')

if (typeof population.buildPopulationSeries !== 'function') {
  throw new Error('population.ts did not finish initialising')
}
if (!Array.isArray(registry.REGISTRY)) {
  throw new Error('registry.ts did not finish initialising')
}
console.log('LOADED')
