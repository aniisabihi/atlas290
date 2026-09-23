import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Indicator, IndicatorSeries, Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import {
  buildAll,
  REGISTRY,
  totalOrDeclaredSum,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../publish'

/** Minimal fake TableMeta, mirroring population.test.ts's fakeMeta helper. */
function fakeMeta(id: string, values: Record<string, string[]>): TableMeta {
  return {
    id,
    label: id,
    variables: Object.entries(values).map(([code, codes]) => ({
      code,
      label: code,
      values: codes.map((c) => ({ code: c, label: c })),
    })),
  }
}

describe('totalOrDeclaredSum: the 1+2 sex total (ruling R1, Task 5)', () => {
  it("selects the '1+2' Kon total instead of falling through to summing '1' and '2'", () => {
    // TAB628 is not in SUM_SAFE for Kon, so if '1+2' were not recognised as a total code this
    // would throw rather than silently sum — proving the result really is the selected total,
    // not a same-shaped coincidence of a summing fallback.
    const meta = fakeMeta('TAB628', { Kon: ['1', '2', '1+2'] })
    expect(totalOrDeclaredSum(meta, 'Kon')).toEqual(['1+2'])
  })
})

/**
 * Minimal fake SCB backend covering exactly what the real REGISTRY (population, for now)
 * needs: TAB638 (sv+en metadata, data), TAB5557 (sv metadata, data), TAB2017 (tax rate) and
 * TAB628 (density) — sv metadata only for the latter two, since neither derives municipality
 * names — for one municipality. Adapted from population.test.ts's fetchPopulation fake — this
 * proves buildAll() drives every real registered definition end to end, not a stand-in.
 */
const oldMetaSv = {
  id: ['Region', 'Civilstand', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Civilstand: { category: { index: ['OG', 'G'] } },
    // 'tot' is population's own pick (its age TOTAL); '65' and '100+' are additionally here so
    // derived.ts's share-65-plus TAB638 source (which selects single ages 65
    // and over rather than the total) has something real to select in this same fake table —
    // adding them does not change population's own fetch, which still picks 'tot' via
    // totalOrDeclaredSum regardless of what else the dimension carries.
    Alder: { category: { index: ['tot', '65', '100+'] } },
    Kon: { category: { index: ['1', '2'] } },
    ContentsCode: {
      category: { index: ['BE0101N1'], label: { BE0101N1: 'Folkmängd' } },
    },
    Tid: { category: { index: ['2024'] } },
  },
}
const oldMetaEn = {
  id: ['Region'],
  dimension: { Region: { category: { index: ['0180'], label: { '0180': 'Stockholm' } } } },
}
const newMetaSv = {
  id: ['Region', 'Civilstand', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Civilstand: { category: { index: ['SC', 'OG', 'G'] } },
    // 'TotSA' is population's own pick (its age TOTAL); '65' and '100+1' are additionally here
    // for the same reason as oldMetaSv's extra Alder codes above — the TAB5557 source needs
    // real single-year-65+ codes to select, without disturbing population's own 'TotSA' pick.
    Alder: { category: { index: ['TotSA', '65', '100+1'] } },
    Kon: { category: { index: ['TotSa'] } },
    ContentsCode: {
      category: { index: ['000007ME'], label: { '000007ME': 'Folkmängd' } },
    },
    Tid: { category: { index: ['2025'] } },
  },
}
const taxMetaSv = {
  id: ['Region', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    ContentsCode: {
      category: { index: ['OE0101D1'], label: { OE0101D1: 'Skattesats, total kommunal' } },
    },
    Tid: { category: { index: ['2024'] } },
  },
}
const densityMetaSv = {
  id: ['Region', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Kon: { category: { index: ['1+2'] } },
    ContentsCode: {
      category: {
        index: ['BE0101U1', 'BE0101U3'],
        label: {
          BE0101U1: 'Invånare per kvadratkilometer',
          BE0101U3: 'Landareal i kvadratkilometer',
        },
      },
    },
    Tid: { category: { index: ['2024'] } },
  },
}

const migrationOldMetaSv = {
  id: ['Region', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Alder: { category: { index: ['tot'] } },
    Kon: { category: { index: ['1', '2'] } },
    ContentsCode: {
      category: { index: ['BE0101C5'], label: { BE0101C5: 'Flyttningsöverskott' } },
    },
    Tid: { category: { index: ['1990'] } },
  },
}
const migrationMidMetaSv = {
  id: ['Region', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Alder: { category: { index: ['tot'] } },
    Kon: { category: { index: ['1', '2'] } },
    ContentsCode: {
      category: { index: ['BE0101AZ'], label: { BE0101AZ: 'Flyttningsöverskott' } },
    },
    Tid: { category: { index: ['2010'] } },
  },
}
const migrationNewMetaSv = {
  id: ['Region', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Alder: { category: { index: ['TOT1'] } },
    Kon: { category: { index: ['TotSa'] } },
    ContentsCode: {
      category: { index: ['00000868'], label: { '00000868': 'Flyttningsöverskott' } },
    },
    Tid: { category: { index: ['2025'] } },
  },
}

const incomeMetaSv = {
  id: ['Region', 'Kon', 'Alder', 'Inkomstklass', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Kon: { category: { index: ['1+2'] } },
    Alder: { category: { index: ['tot16+'] } },
    Inkomstklass: { category: { index: ['TOT'] } },
    ContentsCode: {
      category: { index: ['HE0110J8'], label: { HE0110J8: 'Medianinkomst, tkr' } },
    },
    Tid: { category: { index: ['2024'] } },
  },
}
const housingMetaSv = {
  id: ['Region', 'Fastighetstyp', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Fastighetstyp: {
      category: {
        index: ['220', '221'],
        label: { '220': 'permanentbostad (ej tomträtt)', '221': 'fritidshus' },
      },
    },
    ContentsCode: {
      category: {
        index: ['BO0501C1', 'BO0501C2'],
        label: { BO0501C1: 'Antal', BO0501C2: 'Köpeskilling, medelvärde i tkr' },
      },
    },
    Tid: {
      category: { index: Array.from({ length: 2025 - 1981 + 1 }, (_, i) => String(1981 + i)) },
    },
  },
}
const educationMetaSv = {
  id: ['Region', 'Alder', 'UtbildningsNiva', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Alder: { category: { index: ['tot16-74'] } },
    UtbildningsNiva: {
      category: {
        index: ['1', '2', '3', '4', '5', '6', '7', 'US'],
        label: {
          '1': 'förgymnasial utbildning kortare än 9 år',
          '2': 'förgymnasial utbildning, 9 (10) år',
          '3': 'gymnasial utbildning, högst 2 år',
          '4': 'gymnasial utbildning, 3 år',
          '5': 'eftergymnasial utbildning, mindre än 3 år',
          '6': 'eftergymnasial utbildning, 3 år eller mer',
          '7': 'forskarutbildning',
          US: 'uppgift om utbildningsnivå saknas',
        },
      },
    },
    Kon: { category: { index: ['1', '2'] } },
    ContentsCode: { category: { index: ['UF0506A1'], label: { UF0506A1: 'Antal' } } },
    Tid: { category: { index: ['2024'] } },
  },
}
const meanAgeMetaSv = {
  id: ['Region', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Kon: { category: { index: ['1', '2', '1+2'] } },
    ContentsCode: { category: { index: ['BE0101G9'], label: { BE0101G9: 'Medelålder' } } },
    Tid: { category: { index: ['2024'] } },
  },
}
// CPI's fetchCpi (unlike every other indicator here) reads its own year list straight off the
// table's metadata rather than a hardcoded range (cpi.ts has no Region dimension to iterate
// over), so this fake's Tid list must cover every year EITHER income.ts's INCOME_YEARS (1999-
// 2024) OR housing.ts's HOUSING_YEARS (1981-2025) actually requests — otherwise toCurrentKronor
// would throw for the years left out, and this fake backend would be failing to exercise the
// real registry end to end for no reason related to the code under test. 1981-2025 covers both.
const cpiMetaSv = {
  id: ['ContentsCode', 'Tid'],
  dimension: {
    ContentsCode: { category: { index: ['000000KL'], label: { '000000KL': 'Index' } } },
    Tid: {
      category: { index: Array.from({ length: 2025 - 1981 + 1 }, (_, i) => String(1981 + i)) },
    },
  },
}

function fakeFetchImpl() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as {
        selection: Array<{ variableCode: string; valueCodes: string[] }>
      }
      const ids = body.selection.map((s) => s.variableCode)
      const sizes = body.selection.map((s) => s.valueCodes.length)
      const dimension: Record<string, { category: { index: string[] } }> = {}
      for (const s of body.selection)
        dimension[s.variableCode] = { category: { index: s.valueCodes } }
      const total = sizes.reduce((n, s) => n * s, 1)
      return json({
        id: ids,
        size: sizes,
        dimension,
        value: Array.from({ length: total }, () => 100),
      })
    }
    if (u.includes('/TAB638/metadata') && u.includes('lang=sv')) return json(oldMetaSv)
    if (u.includes('/TAB638/metadata') && u.includes('lang=en')) return json(oldMetaEn)
    if (u.includes('/TAB5557/metadata') && u.includes('lang=sv')) return json(newMetaSv)
    if (u.includes('/TAB2017/metadata') && u.includes('lang=sv')) return json(taxMetaSv)
    if (u.includes('/TAB628/metadata') && u.includes('lang=sv')) return json(densityMetaSv)
    if (u.includes('/TAB1211/metadata') && u.includes('lang=sv')) return json(migrationOldMetaSv)
    if (u.includes('/TAB1212/metadata') && u.includes('lang=sv')) return json(migrationMidMetaSv)
    if (u.includes('/TAB6640/metadata') && u.includes('lang=sv')) return json(migrationNewMetaSv)
    if (u.includes('/TAB3554/metadata') && u.includes('lang=sv')) return json(incomeMetaSv)
    if (u.includes('/TAB4352/metadata') && u.includes('lang=sv')) return json(cpiMetaSv)
    if (u.includes('/TAB1169/metadata') && u.includes('lang=sv')) return json(housingMetaSv)
    if (u.includes('/TAB3981/metadata') && u.includes('lang=sv')) return json(educationMetaSv)
    if (u.includes('/TAB637/metadata') && u.includes('lang=sv')) return json(meanAgeMetaSv)
    // Any other table's Swedish metadata is served from the COMMITTED frozen copy under
    // kitchen/raw/, not fabricated.
    //
    // The hand-written fixtures above exist to shape a one-municipality world this test can
    // reason about, and each was worth writing while there were ten indicators. Plan 16 takes
    // the pantry past twenty, and hand-copying another dozen tables' dimension lists would add
    // a dozen more chances to write down a codelist that does not match the real one — the very
    // drift `Source.verify` exists to catch. Reading the frozen file cannot drift from the real
    // table, because it IS what was fetched from it.
    const table = /tables\/([A-Z0-9]+)\/metadata/.exec(u)?.[1]
    if (table && u.includes('lang=sv')) {
      const frozen = join('kitchen/raw', table, 'sv', 'metadata.json')
      if (existsSync(frozen)) {
        return json((JSON.parse(readFileSync(frozen, 'utf8')) as { response: unknown }).response)
      }
    }
    throw new Error(`unexpected request: ${init?.method ?? 'GET'} ${u}`)
  })
}

describe('buildAll (real REGISTRY)', () => {
  it('returns one series per registered indicator, each with one row per municipality, and unique ids', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'registry-raw-'))
    const result = await buildAll({
      rawDir,
      deps: { fetchImpl: fakeFetchImpl() as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    })

    expect(result.series).toHaveLength(REGISTRY.length)
    expect(result.indicators).toHaveLength(REGISTRY.length)
    expect(result.municipalities).toHaveLength(1)

    for (const s of result.series) {
      expect(s.values).toHaveLength(result.municipalities.length)
      expect(s.status).toHaveLength(result.municipalities.length)
    }

    const ids = result.indicators.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.series.map((s) => s.indicator).sort()).toEqual([...ids].sort())
    // Generous, and deliberately so. Serving each table's REAL frozen metadata means the
    // selections this builds are the real ones — 290 regions, every declared year, chunked the
    // way SCB's 150,000-cell limit forces — so the fake responses are large and there are many
    // of them. That cost buys a test that cannot pass against a codelist the real tables do not
    // have.
  }, 120_000)
})

/** A fake registry lets us test the integrity guards without a network round trip. */
describe('buildAll (fake registries: integrity guards)', () => {
  const fakeMunicipalities: Municipality[] = [
    { code: '0001', name: { sv: 'A', en: 'A' }, county: '00' },
    { code: '0002', name: { sv: 'B', en: 'B' }, county: '00' },
  ]

  function fakeSeries(id: string, rows: number): IndicatorSeries {
    return {
      indicator: id,
      years: [2024],
      values: Array.from({ length: rows }, () => [1]),
      status: Array.from({ length: rows }, () => [0]),
    }
  }

  function fakeIndicator(id: string): Indicator {
    return {
      id,
      name: { sv: id, en: id },
      description: { sv: id, en: id },
      unit: 'count',
      priceBasis: 'none',
      scale: { kind: 'sequential', breaks: [] },
      coverage: { from: 2024, to: 2024 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [],
      derivation: { sv: '', en: '' },
    }
  }

  /** Seeds ctx.municipalities the way the real population definition does. */
  const seed: IndicatorDefinition = {
    indicator: fakeIndicator('seed'),
    build: async (ctx: BuildContext) => {
      ctx.municipalities.push(...fakeMunicipalities)
      return fakeSeries('seed', fakeMunicipalities.length)
    },
  }

  it("throws, naming the offending indicator, when a definition's series has the wrong row count", async () => {
    const broken: IndicatorDefinition = {
      indicator: fakeIndicator('broken'),
      build: async () => fakeSeries('broken', 1), // wrong: 1 row for 2 municipalities
    }
    await expect(buildAll({}, [seed, broken])).rejects.toThrow(/broken/)
  })

  it('throws, naming the id, when two registered indicators share the same id', async () => {
    const dup: IndicatorDefinition = {
      indicator: fakeIndicator('dup'),
      build: async () => fakeSeries('dup', fakeMunicipalities.length),
    }
    const dupAgain: IndicatorDefinition = {
      indicator: fakeIndicator('dup'),
      build: async () => fakeSeries('dup', fakeMunicipalities.length),
    }
    await expect(buildAll({}, [seed, dup, dupAgain])).rejects.toThrow(/dup/)
  })

  it('does not throw when every definition reports the right row count with unique ids', async () => {
    const other: IndicatorDefinition = {
      indicator: fakeIndicator('other'),
      build: async () => fakeSeries('other', fakeMunicipalities.length),
    }
    const result = await buildAll({}, [seed, other])
    expect(result.series).toHaveLength(2)
    expect(result.indicators.map((i) => i.id)).toEqual(['seed', 'other'])
  })
})

describe('build order', () => {
  it('throws naming the indicator when one builds before municipalities exist', async () => {
    // A definition that publishes rows without ever establishing ctx.municipalities — the
    // shape of a REGISTRY where population is not first. The row-count check cannot catch
    // this on its own, because zero rows and zero municipalities agree.
    const premature: IndicatorDefinition = {
      indicator: {
        id: 'premature',
        name: { sv: 'För tidig', en: 'Premature' },
        unit: { sv: 'st', en: 'count' },
        description: { sv: 'test', en: 'test' },
        priceBasis: 'nominal',
        scale: 'sequential',
        sources: [],
        derivation: { sv: 'test', en: 'test' },
      } as unknown as Indicator,
      build: async () =>
        ({
          indicatorId: 'premature',
          years: [2000],
          values: [],
          status: [],
        }) as unknown as IndicatorSeries,
    }
    // Assert the ordering guard's own wording, not merely that *something* threw with this
    // indicator's name in it. Removing the guard still produces a throw — quantileBreaks
    // refuses an all-null column and names the same indicator — so a loose /premature/
    // matcher passes either way and cannot fail. Verified by mutation: with the guard
    // deleted, this expectation fails and the loose one does not.
    await expect(buildAll({}, [premature])).rejects.toThrow(/population must come first/)
  })
})

describe('a difference between two shares is in percentage points', () => {
  // The editorial pass found three indicators whose descriptions said "i procentenheter" /
  // "in percentage points" while their unit said 'percent', so the site printed the gap between
  // 65+ shares as "−5,64 %": a relative change, which it is not. The description and the unit
  // are the same claim made twice and must agree. Read from the published pantry, because
  // REGISTRY fills lazily inside buildAll and is empty at collection time — and what ships is the
  // claim that matters.
  const { indicators } = readPantryParts(DEFAULT_PANTRY_DIR)

  it.each(indicators.map((i) => [i.id, i] as const))('%s', (_id, indicator) => {
    const saysPoints = /procentenheter/.test(indicator.description.sv)
    expect(/percentage points/.test(indicator.description.en), 'English agrees').toBe(saysPoints)
    expect(indicator.unit === 'percentage-points').toBe(saysPoints)
  })

  it('covers exactly the three differences the pantry publishes', () => {
    expect(
      indicators
        .filter((i) => i.unit === 'percentage-points')
        .map((i) => i.id)
        .sort(),
    ).toEqual([
      'post-secondary-education-gap',
      'share-65-plus-vs-country',
      'turnout-gap-general-municipal',
    ])
  })
})

describe('every published piece of indicator prose is in both languages', () => {
  // Issue #48. "Both languages or neither" was the house rule and the contract let two fields
  // break it. The shape is enforced by the schema now; this checks the CONTENT, which a schema
  // cannot: a Swedish slot holding the English text would pass any shape check.
  const { indicators } = readPantryParts(DEFAULT_PANTRY_DIR)
  /** Four lowercase letters in a row is a word someone would have had to translate. */
  const hasWords = (text: string) => /\p{Ll}{4,}/u.test(text)

  it.each(indicators.map((i) => [i.id, i] as const))('%s', (_id, indicator) => {
    const d = indicator.derivation
    expect(d.sv.length, 'Swedish derivation').toBeGreaterThan(0)
    expect(d.en.length, 'English derivation').toBeGreaterThan(0)
    expect(d.sv, 'the Swedish derivation is not the English one').not.toBe(d.en)
    for (const { note } of indicator.sources) {
      // A note may read the same in both languages only when it has nothing to translate —
      // "1968–2024", "2015, 2020, 200 m", "Kon=2".
      if (note.sv === note.en)
        expect(hasWords(note.sv), `untranslated note '${note.sv}'`).toBe(false)
    }
  })

  it('never lets a Swedish thousand break across two lines', () => {
    // "gånger 1 000" wrapped as "1" at the end of one line and "000" at the start of the next,
    // because the group separator was an ordinary space. Intl writes a non-breaking one; the
    // hand-written prose now does too.
    const swedish = indicators.flatMap((i) => [
      i.name.sv,
      i.description.sv,
      i.caveat.sv,
      i.derivation.sv,
      ...i.sources.map((s) => s.note.sv),
    ])
    expect(swedish.filter((text) => /\d \d{3}(?!\d)/.test(text))).toEqual([])
  })

  it('sets every dash as a spaced en dash that never starts a line', () => {
    // ADR-0025 D10: Swedish and British typesetting use a spaced en dash, and the space before it
    // is non-breaking so no line of prose begins with one. An unspaced en dash is a range.
    const prose = indicators.flatMap((i) =>
      (['sv', 'en'] as const).flatMap((lang) => [
        i.name[lang],
        i.description[lang],
        i.caveat[lang],
        i.derivation[lang],
        ...i.sources.map((s) => s.note[lang]),
      ]),
    )
    expect(prose.filter((text) => /—| – /.test(text))).toEqual([])
  })

  it('sets English apostrophes the way the rest of the site does', () => {
    // The site's own English uses the typographic apostrophe; the pantry's mixed 71 of those with
    // 32 straight ones, nearly all in derivations. A straight one between two letters is a slip.
    const english = indicators.flatMap((i) => [
      i.name.en,
      i.description.en,
      i.caveat.en,
      i.derivation.en,
      ...i.sources.map((s) => s.note.en),
    ])
    const straight = english.filter((text) => /\p{L}'\p{L}|s' /u.test(text))
    expect(straight).toEqual([])
  })
})
