import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  chunkSelection,
  dataUrl,
  fetchData,
  fetchMetadataRaw,
  metadataUrl,
  RateLimiter,
  type Deps,
  type Lang,
  type Selection,
  toRequestBody,
} from './client'
import { isJsonStat2, type JsonStat2 } from './jsonstat'

export const DEFAULT_RAW_DIR = 'kitchen/raw'

export interface FrozenData {
  kind: 'data'
  table: string
  lang: Lang
  url: string
  selection: Selection
  fetchedAt: string
  response: JsonStat2
}

export interface FrozenMeta {
  kind: 'metadata'
  table: string
  lang: Lang
  url: string
  fetchedAt: string
  response: unknown
}

export type FreezeOpts = { rawDir?: string; deps?: Deps; clock?: () => string }

export function selectionKey(sel: Selection): string {
  return createHash('sha256')
    .update(JSON.stringify(toRequestBody(sel)))
    .digest('hex')
    .slice(0, 16)
}

export function rawPath(rawDir: string, table: string, lang: Lang, key: string): string {
  return join(rawDir, table, lang, `${key}.json`)
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

const sharedLimiter = new RateLimiter()

export async function freezeMetadata(
  table: string,
  lang: Lang,
  opts: FreezeOpts = {},
): Promise<FrozenMeta> {
  const rawDir = opts.rawDir ?? DEFAULT_RAW_DIR
  const path = rawPath(rawDir, table, lang, 'metadata')
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as FrozenMeta
  const deps: Deps = { limiter: sharedLimiter, ...opts.deps }
  const response = await fetchMetadataRaw(table, lang, deps)
  const frozen: FrozenMeta = {
    kind: 'metadata',
    table,
    lang,
    url: metadataUrl(table, lang),
    fetchedAt: (opts.clock ?? (() => new Date().toISOString()))(),
    response,
  }
  writeJson(path, frozen)
  return frozen
}

export async function freezeData(
  table: string,
  sel: Selection,
  lang: Lang,
  opts: FreezeOpts = {},
): Promise<FrozenData[]> {
  const rawDir = opts.rawDir ?? DEFAULT_RAW_DIR
  const deps: Deps = { limiter: sharedLimiter, ...opts.deps }
  const clock = opts.clock ?? (() => new Date().toISOString())
  const out: FrozenData[] = []
  for (const chunk of chunkSelection(sel)) {
    const path = rawPath(rawDir, table, lang, selectionKey(chunk))
    if (existsSync(path)) {
      out.push(JSON.parse(readFileSync(path, 'utf8')) as FrozenData)
      continue
    }
    const response = await fetchData(table, chunk, lang, deps)
    if (!isJsonStat2(response)) throw new Error(`${table}: response is not JSON-stat2`)
    const frozen: FrozenData = {
      kind: 'data',
      table,
      lang,
      url: dataUrl(table, lang),
      selection: chunk,
      fetchedAt: clock(),
      response,
    }
    writeJson(path, frozen)
    out.push(frozen)
  }
  return out
}
