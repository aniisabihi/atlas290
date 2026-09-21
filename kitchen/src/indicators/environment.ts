import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
// Read only inside the definition function's body, never at this module's own top level — the
// same reasoning every other module that divides by population documents for this import.
import { POPULATION } from './population'

export const EMISSIONS_TABLE = 'TAB4357'

/**
 * TAB4357's own range, read off its frozen metadata: 2008..2022.
 *
 * It ends three years before every other series in this pantry that reaches 2025. That is the
 * table, not a gap here: emissions inventories are compiled slowly, and SCB publishes the
 * municipal breakdown well behind the national one.
 */
export const EMISSIONS_YEARS = Array.from({ length: 2022 - 2008 + 1 }, (_, i) => 2008 + i)

/** TAB4357 carries a single ContentsCode, labelled `Ämne`. */
const EMISSIONS_CONTENT_LABEL = 'Ämne'

/**
 * The substance, resolved by its own Swedish label rather than by the code `GHG`.
 *
 * TAB4357 publishes sixteen substances in three different units — kilotonnes, tonnes, and tonnes
 * of CO2 equivalent — and the label is the only place the unit is stated. Taking the wrong one
 * would publish a number in the wrong unit with nothing to show it.
 */
const GREENHOUSE_GASES = 'växthusgaser, kiloton koldioxidekvivalenter'

export const EMISSIONS: Indicator = Indicator.parse({
  id: 'greenhouse-gas-per-resident',
  name: { sv: 'Växthusgasutsläpp per invånare', en: 'Greenhouse gas emissions per resident' },
  description: {
    sv: 'Territoriella utsläpp av växthusgaser inom kommunen, i ton koldioxidekvivalenter per invånare.',
    en: 'Territorial greenhouse gas emissions within the municipality, in tonnes of CO2 equivalent per resident.',
  },
  unit: 'tonnes-per-resident',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: EMISSIONS_YEARS[0]!, to: EMISSIONS_YEARS[EMISSIONS_YEARS.length - 1]! },
  caveat: {
    sv: 'Territoriella utsläpp: de räknas där de sker, inte där de orsakas. En kommun med ett stort industriverk eller en motorväg genom sig bär utsläppen även när varorna och resorna hör hemma någon annanstans, och den konsumtion invånarna står för räknas i det land där den tillverkas. Talet säger därför mer om vad som ligger i kommunen än om hur dess invånare lever. Serien slutar 2022, tre år före de flesta andra i denna databas, eftersom utsläppsinventeringen tar tid att sammanställa.',
    en: 'Territorial emissions: counted where they happen, not where they are caused. A municipality with a large industrial plant or a motorway through it carries those emissions even when the goods and the journeys belong elsewhere, and what its residents consume is counted in the country where it is made. The figure therefore says more about what sits inside the municipality than about how its people live. The series ends in 2022, three years before most others here, because the emissions inventory takes time to compile.',
  },
  sensitivity: 'none',
  sources: [{ table: EMISSIONS_TABLE, contentCode: '000000KY', note: '2008–2022, GHG' }],
  derivation:
    'Kilotonnes of CO2 equivalent over the population of the same year, times 1,000 — which ' +
    'converts kilotonnes per person into tonnes per person, so the published unit is the one a ' +
    'reader can hold. The substance is selected by its full Swedish label rather than by the ' +
    'code, because that label is the only place the unit is stated and this table publishes ' +
    'sixteen substances in three different units. The denominator is this pantry’s own ' +
    'published population.',
})

export function emissionsDefined(): Definition {
  return {
    indicator: EMISSIONS,
    sources: [
      {
        table: EMISSIONS_TABLE,
        content: EMISSIONS_CONTENT_LABEL,
        years: EMISSIONS_YEARS,
        dims: { AmneMiljo: { label: GREENHOUSE_GASES } },
        regions: 'known',
      },
    ],
    // kiloton / people * 1000 = tonnes per person.
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
  }
}

export const emissionsDefinition: IndicatorDefinition = {
  indicator: EMISSIONS,
  build: (ctx) => buildDefined(emissionsDefined(), ctx),
}

export const NATURE_TABLE = 'TAB4422'

/** TAB4422's own range, read off its frozen metadata: 2013..2025, annually. */
export const NATURE_YEARS = Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i)

/**
 * The mean distance, because the shares this table advertises do not exist at municipal level.
 *
 * TAB4422's metadata offers six content codes: the share of residents within 300 m, 1 km, 3 km,
 * 5 km and 10 km of protected nature, and a mean distance. The question list picked the 1 km
 * share, `000000PL`, on the strength of the metadata.
 *
 * Every one of the five share codes returns null for every municipality in every year — 3,770
 * cells, all empty. SCB publishes those shares only at a coarser geography. The mean distance,
 * `000000PK`, is complete: 3,770 cells, not one of them null.
 *
 * The lesson is worth the comment: a content code existing in the metadata is not the same as
 * that code having values at the geography you want, and only fetching tells you which.
 */
const NATURE_CONTENT_LABEL = 'Medelavstånd, meter i jämna 100-tal'

export const NATURE: Indicator = Indicator.parse({
  id: 'distance-to-protected-nature',
  name: {
    sv: 'Avstånd till skyddad natur',
    en: 'Distance to protected nature',
  },
  description: {
    sv: 'Genomsnittligt avstånd från invånarnas bostäder till närmaste skyddade natur — nationalpark, naturreservat eller motsvarande.',
    en: 'Mean distance from residents’ homes to the nearest protected nature — a national park, nature reserve or equivalent.',
  },
  unit: 'metres',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: NATURE_YEARS[0]!, to: NATURE_YEARS[NATURE_YEARS.length - 1]! },
  caveat: {
    sv: 'Fågelvägen från bostaden till gränsen för ett skyddat område, inte gångavstånd: en kilometer över en motorväg eller ett vatten räknas lika. Genomsnittet vägs över invånarna, så det beskriver var människorna bor snarare än hur kommunens yta ser ut — därför kan en stor och glest befolkad kommun ha LÄNGRE medelavstånd än en tät stad, eftersom stadens invånare klumpar ihop sig intill det reservat som finns. Skyddad natur är en juridisk kategori: ett litet reservat mitt i en stad räknas, en stor oskyddad skog räknas inte. SCB avrundar till jämna hundratal meter.',
    en: 'As the crow flies from the home to the boundary of a protected area, not walking distance: a kilometre across a motorway or a stretch of water counts the same. The mean is weighted over residents, so it describes where people live rather than what the municipality looks like — which is why a large, sparsely populated municipality can be FURTHER from protected nature on average than a dense city, whose residents cluster beside the one reserve there is. Protected nature is a legal category: a small reserve in the middle of a city counts, a large unprotected forest does not. SCB rounds to even hundreds of metres.',
  },
  sensitivity: 'none',
  sources: [{ table: NATURE_TABLE, contentCode: '000000PK', note: '2013–2025' }],
  derivation:
    'One SCB cell per municipality and year: TAB4422’s "Medelavstånd, meter i jämna 100-tal" ' +
    'content code, resolved by its stable Swedish label. SCB computes the mean and rounds it; ' +
    'nothing is derived here. The five share-within-a-distance codes the same table offers were ' +
    'tried first and are empty at municipal level.',
})

export function natureDefined(): Definition {
  return {
    indicator: NATURE,
    sources: [
      {
        table: NATURE_TABLE,
        content: NATURE_CONTENT_LABEL,
        years: NATURE_YEARS,
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export const natureDefinition: IndicatorDefinition = {
  indicator: NATURE,
  build: (ctx) => buildDefined(natureDefined(), ctx),
}
