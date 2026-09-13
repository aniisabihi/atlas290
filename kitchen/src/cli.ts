import { fetchPopulation } from './indicators/population'
import { publish } from './publish'

const stage = process.argv[2]
switch (stage) {
  case 'fetch':
    await fetchPopulation()
    console.log('fetched and frozen')
    break
  case 'publish':
    await publish()
    console.log('pantry written')
    break
  case 'all':
    await fetchPopulation()
    await publish()
    console.log('done')
    break
  default:
    console.error('usage: yarn kitchen <fetch|publish|all>')
    process.exit(1)
}
