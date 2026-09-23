import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

export const TURNOUT_TABLE = 'TAB2707'

/**
 * Sweden votes every four years, and the table says so: fifteen `Tid` values across fifty years.
 *
 * This is the series plan 19's whole first half exists for. `coverage.years` carries all fifteen
 * so the index can say which years have data before any series is fetched, the slider marks
 * them, and the thirty-five years in between explain themselves instead of drawing 290 grey
 * shapes. Written out rather than derived: decision 0014 D4's import-cycle rule.
 *
 * 1994 and 1998 are three and four years apart rather than the usual three — Sweden moved from
 * three-year to four-year terms in 1994 — so this genuinely cannot be generated from a step.
 */
export const ELECTION_YEARS = [
  1973, 1976, 1979, 1982, 1985, 1988, 1991, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
] as const

/**
 * Two of `TAB2707`'s three content codes. The third is the REGIONAL election, left out: a third
 * near-identical map would say what the first two already say.
 *
 * Both of these ship as indicators, and the gap as a third — the same shape as
 * [0016](../../../docs/decisions/0016-the-fifteen.md) D6, which published both education splits
 * because a gap nobody can check against its two operands is a number a reader has to trust.
 */
const GENERAL = 'Valdeltagande i riksdagsval, procent'
const MUNICIPAL = 'Valdeltagande i kommunfullmäktigval, procent'

const SHARED_CAVEAT_SV =
  'Valdeltagandet avser andelen av de röstberättigade som röstade, och vem som är röstberättigad skiljer sig mellan valen: i kommunfullmäktigval röstar även utländska medborgare som varit folkbokförda i Sverige i tre år, vilket inte gäller riksdagsvalet. Serien har ett värde per valår och ingenting däremellan.'
const SHARED_CAVEAT_EN =
  'Turnout is the share of those entitled to vote who voted, and who is entitled differs between the two elections: in municipal elections foreign citizens registered in Sweden for three years may also vote, which is not true of the general election. The series has one value per election year and nothing in between.'

export const TURNOUT: Indicator = Indicator.parse({
  id: 'turnout-general-election',
  name: { sv: 'Valdeltagande i riksdagsval', en: 'Turnout, general election' },
  description: {
    sv: 'Andel av de röstberättigade i kommunen som röstade i riksdagsvalet.',
    en: 'Share of those entitled to vote in the municipality who voted in the general election.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: ELECTION_YEARS[0],
    to: ELECTION_YEARS[ELECTION_YEARS.length - 1]!,
    years: [...ELECTION_YEARS],
  },
  caveat: {
    sv: `${SHARED_CAVEAT_SV} Talet räknas där väljaren är folkbokförd, inte där rösten lades.`,
    en: `${SHARED_CAVEAT_EN} The figure counts a voter where they are registered as resident, not where the vote was cast.`,
  },
  sensitivity: 'none',
  sources: [
    {
      table: TURNOUT_TABLE,
      contentCode: 'ME0104B8',
      note: { sv: '1973–2022, valår', en: '1973–2022, election years' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och valår. `regions: known` tar bort tabellens 291:a fyrsiffriga ' +
      'kod, `1229 Bara`, som gick upp i Svedala 1977 – tabellen börjar 1973, så koden är ' +
      'verklig historia och inget fel.',
    en:
      'One SCB cell per municipality and election year. `regions: known` drops the table’s ' +
      '291st four-digit code, `1229 Bara`, which was merged into Svedala in 1977 – this table ' +
      'starts in 1973, so the code is real history rather than an error.',
  },
})

export const TURNOUT_MUNICIPAL: Indicator = Indicator.parse({
  id: 'turnout-municipal-election',
  name: { sv: 'Valdeltagande i kommunfullmäktigval', en: 'Turnout, municipal election' },
  description: {
    sv: 'Andel av de röstberättigade i kommunen som röstade i kommunfullmäktigvalet.',
    en: 'Share of those entitled to vote in the municipality who voted in the municipal election.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: ELECTION_YEARS[0],
    to: ELECTION_YEARS[ELECTION_YEARS.length - 1]!,
    years: [...ELECTION_YEARS],
  },
  caveat: {
    sv: `${SHARED_CAVEAT_SV} Den här väljarkåren är större än riksdagsvalets, eftersom även utländska medborgare med tre års folkbokföring får rösta – så ett lägre deltagande här behöver inte betyda att färre personer röstade.`,
    en: `${SHARED_CAVEAT_EN} This electorate is larger than the general election’s, because foreign citizens registered for three years may also vote – so a lower turnout here does not necessarily mean fewer people voted.`,
  },
  sensitivity: 'none',
  sources: [
    {
      table: TURNOUT_TABLE,
      contentCode: 'ME0104C6',
      note: { sv: '1973–2022, valår', en: '1973–2022, election years' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och valår, ur samma tabell som riksdagsvalet. Publiceras i egen ' +
      'rätt så att skillnaden nedan kan kontrolleras mot båda halvorna.',
    en:
      'One SCB cell per municipality and election year, from the same table as the general ' +
      'election. Published in its own right so the gap below can be checked against both ' +
      'halves.',
  },
})

export const TURNOUT_GAP: Indicator = Indicator.parse({
  id: 'turnout-gap-general-municipal',
  name: {
    sv: 'Skillnad i valdeltagande, riksdag mot kommun',
    en: 'Turnout gap, general against municipal',
  },
  description: {
    sv: 'Valdeltagandet i riksdagsvalet minus valdeltagandet i kommunfullmäktigvalet, i procentenheter. Positivt tal betyder att fler röstade till riksdagen.',
    en: 'Turnout in the general election minus turnout in the municipal election, in percentage points. A positive figure means more people voted for the parliament.',
  },
  unit: 'percentage-points',
  priceBasis: 'none',
  scale: { kind: 'diverging', breaks: [] },
  coverage: {
    from: ELECTION_YEARS[0],
    to: ELECTION_YEARS[ELECTION_YEARS.length - 1]!,
    years: [...ELECTION_YEARS],
  },
  caveat: {
    sv: `Skillnaden är i procentenheter, inte procent. Den är nästan alltid positiv – i fyra av 4 288 mätpunkter är den negativ, och alla fyra ligger inom en tiondels procentenhet från noll – och en stor del av den är inte ointresse för kommunen: valen hålls samma dag och på samma ställe, men de röstberättigade är inte samma personer. ${SHARED_CAVEAT_SV}`,
    en: `The difference is in percentage points, not percent. It is almost always positive – four of 4,288 points are negative, and all four sit within a tenth of a point of zero – and much of it is not indifference to the municipality: the elections are held on the same day in the same place, but the two electorates are not the same people. ${SHARED_CAVEAT_EN}`,
  },
  sensitivity: 'none',
  sources: [
    {
      table: TURNOUT_TABLE,
      contentCode: 'ME0104B8',
      note: { sv: 'riksdagsval', en: 'general elections' },
    },
    {
      table: TURNOUT_TABLE,
      contentCode: 'ME0104C6',
      note: { sv: 'kommunfullmäktigval', en: 'municipal elections' },
    },
  ],
  derivation: {
    sv:
      'turnout-general-election minus turnout-municipal-election, cell för cell, ur den här ' +
      'datamängdens egna två publicerade serier i stället för ur en tredje hämtning. Där någon ' +
      'av sidorna saknas saknas också skillnaden.',
    en:
      'turnout-general-election minus turnout-municipal-election, cell by cell, from this ' +
      'pantry’s own two published series rather than from a third fetch. Where either side is ' +
      'absent, so is the gap.',
  },
})

function turnoutSource(content: string) {
  return {
    table: TURNOUT_TABLE,
    content,
    years: [...ELECTION_YEARS],
    dims: {},
    regions: 'known' as const,
  }
}

export function turnoutDefined(): Definition {
  return { indicator: TURNOUT, sources: [turnoutSource(GENERAL)], spec: { kind: 'direct' } }
}

export function turnoutMunicipalDefined(): Definition {
  return {
    indicator: TURNOUT_MUNICIPAL,
    sources: [turnoutSource(MUNICIPAL)],
    spec: { kind: 'direct' },
  }
}

export function turnoutGapDefined(): Definition {
  return {
    indicator: TURNOUT_GAP,
    sources: [],
    spec: { kind: 'difference', of: TURNOUT.id, minus: TURNOUT_MUNICIPAL.id },
  }
}

export const turnoutDefinition: IndicatorDefinition = {
  indicator: TURNOUT,
  build: (ctx) => buildDefined(turnoutDefined(), ctx),
}

export const turnoutMunicipalDefinition: IndicatorDefinition = {
  indicator: TURNOUT_MUNICIPAL,
  build: (ctx) => buildDefined(turnoutMunicipalDefined(), ctx),
}

export const turnoutGapDefinition: IndicatorDefinition = {
  indicator: TURNOUT_GAP,
  build: (ctx) => buildDefined(turnoutGapDefined(), ctx),
}
