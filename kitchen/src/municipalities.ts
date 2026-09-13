import { Municipality } from '../../shared/pantry'
import { parseMetadata } from './scb/client'
import type { FrozenMeta } from './scb/freeze'

/**
 * First year each split-off municipality appears in SCB's data (source: TAB638), NOT its
 * formal creation date. SCB reports a year-Y population figure using the administrative
 * division as of 1 January of year Y+1 (stated in TAB638's own dataset note, for 1983
 * onward), so every one of these reads one year earlier than the formal date below.
 * Formal creation dates, per "Ändringar i kommunindelningen efter 1974"
 * (docs/research/reports/scb-pxweb.md section 7):
 *   0461 Gnesta / 0488 Trosa, from Nyköping: 1992-01-01
 *   1443 Bollebygd, from Borås: 1995-01-01
 *   1814 Lekeberg, from Örebro: 1995-01-01
 *   0140 Nykvarn, from Södertälje: 1999-01-01
 *   0330 Knivsta, from Uppsala: 2003-01-01
 *
 * All six were verified empirically against live TAB638 data by
 * kitchen/spikes/verify-split-years.ts (see kitchen/spikes/verify-split-years-output.txt
 * for the captured run): for each pair, the last year the child reads literal 0, the
 * first year it reads a real population, and the parent's matching drop that same year.
 * All six years below MATCH ruling R15 — no year needed correcting.
 *
 * One CODE did need correcting, though: the brief and ruling R15 give Bollebygd as '1535'
 * and Borås as '1583'. Those were the codes assigned when Bollebygd was formally created
 * in 1995, but they do not exist in TAB638's current metadata — the API rejects them
 * outright with "Non-existent value". Västra Götaland county was formed 1998-01-01 and
 * every municipality code in it was renumbered (docs/research/reports/scb-pxweb.md section
 * 7: "1998-01-01 skedde kodändringar av kommuner till följd av länssammanslagningar").
 * TAB638 presents its whole 1968–2024 series under CURRENT codes, so Bollebygd is '1443'
 * and Borås is '1490' below — the codes municipalitiesFromMetadata will actually produce
 * from live metadata. Using '1535'/'1583' here would silently never match any real
 * municipality code in the registry, so existed() would default to "always existed" for
 * 1443 (via the `?? -Infinity` fallback) instead of correctly gating its pre-1994 years.
 */
export const CREATED: Record<string, number> = {
  '0461': 1991, // Gnesta, from Nyköping (formal 1992-01-01)
  '0488': 1991, // Trosa, from Nyköping (formal 1992-01-01)
  '1443': 1994, // Bollebygd, from Borås (formal 1995-01-01) — code corrected from '1535', see above
  '1814': 1994, // Lekeberg, from Örebro (formal 1995-01-01)
  '0140': 1998, // Nykvarn, from Södertälje (formal 1999-01-01)
  '0330': 2002, // Knivsta, from Uppsala (formal 2003-01-01)
}

export const SPLIT_PARENT: Record<string, string> = {
  '0461': '0480',
  '0488': '0480',
  '1443': '1490', // corrected from '1535': '1583', see CREATED comment above
  '1814': '1880',
  '0140': '0181',
  '0330': '0380',
}

export function existed(code: string, year: number): boolean {
  return year >= (CREATED[code] ?? -Infinity)
}

export function countyOf(code: string): string {
  return code.slice(0, 2)
}

export function municipalitiesFromMetadata(sv: FrozenMeta, en: FrozenMeta): Municipality[] {
  const region = (m: FrozenMeta) => {
    const v = parseMetadata(m.table, m.response).variables.find((x) => x.code === 'Region')
    if (!v) throw new Error(`${m.table} ${m.lang}: no Region variable`)
    return new Map(v.values.map((x) => [x.code, x.label]))
  }
  const svNames = region(sv)
  const enNames = region(en)
  return [...svNames.keys()]
    .filter((code) => /^\d{4}$/.test(code))
    .sort()
    .map((code) =>
      Municipality.parse({
        code,
        name: { sv: svNames.get(code) ?? code, en: enNames.get(code) ?? svNames.get(code) ?? code },
        county: countyOf(code),
      }),
    )
}
