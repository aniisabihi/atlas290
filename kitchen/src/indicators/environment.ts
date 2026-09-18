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
