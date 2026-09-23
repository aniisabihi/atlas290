import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

export const CARS_TABLE = 'TAB3276'

/** TAB3276's own range, read off its frozen metadata: 2002..2025. */
export const CARS_YEARS = Array.from({ length: 2025 - 2002 + 1 }, (_, i) => 2002 + i)

const CARS_CONTENT_LABEL = 'Antal'

/**
 * SCB has already done the division, so this indicator does not.
 *
 * `TAB3276.Agarkategori` is an owner category — women, men, companies, taxis — and two of its
 * seven values are not owner categories at all but per-resident rates SCB computes itself:
 * `050` for privately owned cars and `060` for every car. Taking `060` is a `direct` measure; the
 * question list called this a rate because it assumed the table published only counts.
 *
 * Selected by label rather than by the code `060`, which says nothing about which of the two
 * rates it is.
 */
const CARS_PER_1000 = 'totalt antal bilar per 1 000 invånare'

export const CARS: Indicator = Indicator.parse({
  id: 'cars-per-1000',
  name: { sv: 'Personbilar per 1 000 invånare', en: 'Cars per 1,000 residents' },
  description: {
    sv: 'Antal personbilar i trafik per 1 000 invånare, oavsett vem som äger dem.',
    en: 'Passenger cars in traffic per 1,000 residents, whoever owns them.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: CARS_YEARS[0]!, to: CARS_YEARS[CARS_YEARS.length - 1]! },
  caveat: {
    sv: 'Räknar bilar i trafik, alltså inte avställda. Bilen räknas där ägaren är registrerad, vilket lyfter kommuner med många leasing- och tjänstebilar registrerade på företag — en kommun med ett stort biluthyrningsbolag kan se bilrikare ut än den är. Talet mäter tillgång till bil, inte hur mycket den används.',
    en: 'Counts cars in traffic, so not those taken off the road. A car is counted where its owner is registered, which lifts municipalities with many leased and company cars registered to businesses — a municipality with a large car rental firm can look more car-owning than it is. The figure measures access to a car, not how much it is driven.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: CARS_TABLE,
      contentCode: 'TK1001AB',
      note: { sv: '2002–2025, Agarkategori 060', en: '2002–2025, owner category 060' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB3276 vid ägarkategorin med etiketten ”totalt antal ' +
      'bilar per 1 000 invånare”, som är en kvot som SCB beräknar och inte ett antal. Ingenting ' +
      'delas här. `regions: known` tar bort tabellens 291:a fyrsiffriga kod, `1917 Heby` — den ' +
      'kod Heby hade innan kommunen flyttades från Västmanlands till Uppsala län 2007, där den ' +
      'är 0331.',
    en:
      'One SCB cell per municipality and year: TAB3276 at the owner category labelled "totalt ' +
      'antal bilar per 1 000 invånare", which is a rate SCB computes rather than a count. ' +
      'Nothing is divided here. `regions: known` drops the table’s 291st four-digit code, `1917 ' +
      'Heby` — the code Heby carried before it moved from Västmanland to Uppsala county in ' +
      '2007, where it is 0331.',
  },
})

export function carsDefined(): Definition {
  return {
    indicator: CARS,
    sources: [
      {
        table: CARS_TABLE,
        content: CARS_CONTENT_LABEL,
        years: CARS_YEARS,
        dims: { Agarkategori: { label: CARS_PER_1000 } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export const carsDefinition: IndicatorDefinition = {
  indicator: CARS,
  build: (ctx) => buildDefined(carsDefined(), ctx),
}
