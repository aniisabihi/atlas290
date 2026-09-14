export const SCB_BASE = 'https://statistikdatabasen.scb.se/api/v2'
/** From the live /config endpoint, verified 2026-09-10. */
export const SCB_MAX_CELLS = 150_000
export const SCB_MAX_CALLS = 30
export const SCB_WINDOW_MS = 10_000

export type Lang = 'sv' | 'en'
export type Selection = Record<string, string[]>

export interface TableMeta {
  id: string
  label: string
  variables: Array<{ code: string; label: string; values: Array<{ code: string; label: string }> }>
}

export type Deps = { fetchImpl?: typeof fetch; limiter?: RateLimiter }

export function cellCount(sel: Selection): number {
  return Object.values(sel).reduce((n, values) => n * values.length, 1)
}

/** Splits the variable with the most values in half until every chunk is under the limit. */
export function chunkSelection(sel: Selection, maxCells = SCB_MAX_CELLS): Selection[] {
  if (cellCount(sel) <= maxCells) return [sel]
  const [code, values] = Object.entries(sel).reduce((best, cur) =>
    cur[1].length > best[1].length ? cur : best,
  )
  if (values.length < 2) {
    throw new Error(
      `cannot chunk ${code}: every variable has one value but ${cellCount(sel)} cells`,
    )
  }
  const mid = Math.ceil(values.length / 2)
  return [
    ...chunkSelection({ ...sel, [code]: values.slice(0, mid) }, maxCells),
    ...chunkSelection({ ...sel, [code]: values.slice(mid) }, maxCells),
  ]
}

export class RateLimiter {
  private readonly calls: number[] = []
  constructor(
    private readonly maxCalls = SCB_MAX_CALLS,
    private readonly windowMs = SCB_WINDOW_MS,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  async acquire(): Promise<void> {
    const t = this.now()
    while (this.calls.length && (this.calls[0] ?? 0) <= t - this.windowMs) this.calls.shift()
    if (this.calls.length >= this.maxCalls) {
      const wait = (this.calls[0] ?? t) + this.windowMs - t
      await this.sleep(wait)
      return this.acquire()
    }
    this.calls.push(this.now())
  }
}

export function metadataUrl(tableId: string, lang: Lang): string {
  return `${SCB_BASE}/tables/${tableId}/metadata?lang=${lang}`
}

export function dataUrl(tableId: string, lang: Lang): string {
  return `${SCB_BASE}/tables/${tableId}/data?lang=${lang}&outputFormat=json-stat2`
}

export function toRequestBody(sel: Selection): {
  selection: Array<{ variableCode: string; valueCodes: string[] }>
} {
  return {
    selection: Object.keys(sel)
      .sort()
      .map((variableCode) => ({ variableCode, valueCodes: sel[variableCode] ?? [] })),
  }
}

async function request(url: string, init: RequestInit, deps: Deps): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? fetch
  await deps.limiter?.acquire()
  const res = await fetchImpl(url, {
    ...init,
    headers: { accept: 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `SCB ${init.method ?? 'GET'} ${url} failed: ${res.status} ${text.slice(0, 200)}`,
    )
  }
  return res.json()
}

type JsonStatDimension = {
  label?: string
  category: { index: Record<string, number> | string[]; label?: Record<string, string> }
}

export function parseMetadata(tableId: string, body: unknown): TableMeta {
  const b = body as { id: string[]; label?: string; dimension: Record<string, JsonStatDimension> }
  const variables = b.id.map((code) => {
    const dim = b.dimension[code]
    if (!dim) throw new Error(`metadata for ${tableId} lacks dimension ${code}`)
    const codes = Array.isArray(dim.category.index)
      ? dim.category.index
      : Object.entries(dim.category.index)
          .sort((a, c) => a[1] - c[1])
          .map(([k]) => k)
    return {
      code,
      label: dim.label ?? code,
      values: codes.map((c) => ({ code: c, label: dim.category.label?.[c] ?? c })),
    }
  })
  return { id: tableId, label: b.label ?? tableId, variables }
}

/** Same GET as fetchMetadata, but returns the decoded JSON-stat2 body without parsing it into a TableMeta. */
export async function fetchMetadataRaw(
  tableId: string,
  lang: Lang,
  deps: Deps = {},
): Promise<unknown> {
  return request(metadataUrl(tableId, lang), { method: 'GET' }, deps)
}

// No production caller: the pipeline always uses fetchMetadataRaw + parseMetadata separately
// (freeze.ts freezes the raw response before parsing it). Kept as the convenience one-call
// wrapper the two are equivalent to, and exercised directly by client.test.ts.
export async function fetchMetadata(
  tableId: string,
  lang: Lang,
  deps: Deps = {},
): Promise<TableMeta> {
  return parseMetadata(tableId, await fetchMetadataRaw(tableId, lang, deps))
}

export async function fetchData(
  tableId: string,
  sel: Selection,
  lang: Lang,
  deps: Deps = {},
): Promise<unknown> {
  if (cellCount(sel) > SCB_MAX_CELLS) {
    throw new Error(`selection has ${cellCount(sel)} cells; chunk it first`)
  }
  return request(
    dataUrl(tableId, lang),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toRequestBody(sel)),
    },
    deps,
  )
}
