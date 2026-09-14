import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/**
 * Vitest cannot see this class of bug, which is the whole reason this file exists.
 *
 * registry.ts and population.ts import each other by necessity: every indicator module needs
 * the shared machinery in registry.ts, and registry.ts needs each module's finished
 * definition to seed REGISTRY. Reading a definition eagerly at registry.ts's top level
 * therefore depends on which of the two modules the entry point happens to load first.
 * Vitest's module graph resolves that cycle from registry.ts and works; the real CLI reaches
 * population.ts first and dies with "Cannot access 'populationDefinition' before
 * initialization". So a reversion to the eager form leaves the suite fully green while
 * `yarn kitchen publish` cannot start at all — proven by mutation, twice, during Plan 2.
 *
 * This test spawns a real child process that loads the modules in the CLI's order, so the
 * hazard is enforced rather than merely documented in a comment that Tasks 5-13 might not
 * read before adding their own indicator to REGISTRY.
 */
describe('registry module load order', () => {
  it('loads under the real entry point order the CLI uses, not only under vitest', () => {
    const out = execFileSync('yarn', ['tsx', 'kitchen/src/indicators/load-order-probe.mts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(out).toContain('LOADED')
  })
})
