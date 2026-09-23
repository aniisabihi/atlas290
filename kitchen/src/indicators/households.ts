import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
import { neutral } from './prose'

export const HOUSEHOLD_TABLE = 'TAB4374'

/** TAB4374's own range, read off its frozen metadata: 2011..2025. */
export const HOUSEHOLD_YEARS = Array.from({ length: 2025 - 2011 + 1 }, (_, i) => 2011 + i)

/**
 * TAB4374 publishes five content codes and this is the one that is already a ratio.
 *
 * The table also carries the population, the number of households, and how complete the household
 * register is for that municipality — so resolving by label matters more than usual here: taking
 * the wrong code would publish a count of households as though it were a household size.
 */
const HOUSEHOLD_CONTENT_LABEL = 'Antal personer per hushåll'

export const HOUSEHOLD_SIZE: Indicator = Indicator.parse({
  id: 'persons-per-household',
  name: { sv: 'Personer per hushåll', en: 'Persons per household' },
  description: {
    sv: 'Genomsnittligt antal personer per hushåll.',
    en: 'Average number of people per household.',
  },
  unit: 'persons-per-household',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: HOUSEHOLD_YEARS[0]!, to: HOUSEHOLD_YEARS[HOUSEHOLD_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser registrerade hushåll: SCB kan bara bilda hushåll för personer vars bostad går att knyta till en lägenhet, och täckningen är inte fullständig i varje kommun. Måttet är känsligt för studentbostäder och äldreboenden, som båda består av många små hushåll, och det säger ingenting om trångboddhet — ett stort hushåll i ett stort hus och ett stort hushåll i en tvåa ser likadana ut här. Serien börjar 2011, när det registerbaserade hushållsbegreppet infördes.',
    en: 'Registered households: SCB can only form a household for people whose home can be tied to a dwelling, and coverage is not complete in every municipality. The measure is sensitive to student housing and elderly accommodation, both of which are many small households, and it says nothing about overcrowding — a large household in a large house and a large household in a two-room flat look identical here. The series starts in 2011, when the register-based household definition began.',
  },
  sensitivity: 'none',
  sources: [{ table: HOUSEHOLD_TABLE, contentCode: '000000M5', note: neutral('2011–2025') }],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB4374:s innehållskod ”Antal personer per hushåll”, ' +
      'utpekad genom sin stabila svenska etikett. SCB beräknar medelvärdet; det härleds inte ' +
      'här ur de antal personer och hushåll som samma tabell också publicerar.',
    en:
      'One SCB cell per municipality and year: TAB4374’s "Antal personer per hushåll" content ' +
      'code, resolved by its stable Swedish label. SCB computes the average; it is not derived ' +
      'here from the population and household counts the same table also publishes.',
  },
})

export function householdSizeDefined(): Definition {
  return {
    indicator: HOUSEHOLD_SIZE,
    sources: [{ table: HOUSEHOLD_TABLE, content: HOUSEHOLD_CONTENT_LABEL, years: HOUSEHOLD_YEARS }],
    spec: { kind: 'direct' },
  }
}

export const householdSizeDefinition: IndicatorDefinition = {
  indicator: HOUSEHOLD_SIZE,
  build: (ctx) => buildDefined(householdSizeDefined(), ctx),
}
