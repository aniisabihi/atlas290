// Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md): 'fetch' and 'all' used to call
// fetchPopulation() alone, which was correct while population was the only registered
// indicator, but left `yarn kitchen fetch` fetching only one of the ten tables the pantry now
// needs — silently out of step with docs/kitchen.md's own claim that it "downloads the tables
// the indicators need". buildAll() drives every registered indicator's own fetch (population
// included, since it is REGISTRY's first entry), through the network by default (no
// `fetchImpl` override), so this now genuinely fetches and freezes everything `publish` will
// later read offline.
import { buildAll } from './indicators/registry'
import { publish } from './publish'

const stage = process.argv[2]
switch (stage) {
  case 'fetch':
    await buildAll()
    console.log('fetched and frozen')
    break
  case 'publish':
    await publish()
    console.log('pantry written')
    break
  case 'all':
    await buildAll()
    await publish()
    console.log('done')
    break
  default:
    console.error('usage: yarn kitchen <fetch|publish|all>')
    process.exit(1)
}
