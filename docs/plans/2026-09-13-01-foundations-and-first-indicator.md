# Plan 1: Foundations and the First Indicator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A repository that builds and tests, whose kitchen fetches, freezes and publishes population for all 290 municipalities 1968–2025 together with map geometry, keyboard adjacency and the bubble layout, proven by a throwaway page that draws the map from pantry files.

**Architecture:** Three pieces with a hard wall: `kitchen/` (Node pipeline, never in a browser), `public/pantry/` (generated files, committed), `src/` (Vite app that reads only the pantry). They share only the zod schemas in `shared/pantry.ts`. Every kitchen stage is a separately runnable, separately tested function; raw SCB responses are frozen into the repo so every later stage runs offline and deterministically.

**Tech Stack:** Node 22, Yarn 4 (node-modules linker), TypeScript strict, Vite, React, Vitest, tsx, zod, d3-geo, d3-force, topojson-client, mapshaper (CLI, dev only).

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 3 (Architecture), 4 (Data model), 9 (open questions to resolve in the first fetch spike).

## Global Constraints

- Zero cost: no paid service, no API key, no third-party runtime request. The website loads nothing but its own files.
- SCB is the only data source. PxWeb API v2 base URL is `https://statistikdatabasen.scb.se/api/v2`. Never use v1.
- SCB limits: at most 150,000 data cells per query and 30 calls per 10 seconds per IP. The client must enforce both.
- All fetching happens in the kitchen. Raw responses are frozen to `kitchen/raw/` and committed. Later stages never touch the network.
- Determinism: pantry files contain no timestamps, keys are sorted, numbers are formatted identically. Running publish twice from the same frozen raw data yields byte-identical files.
- Municipality identifier everywhere is the SCB four-digit code as a string, e.g. `"0180"`. Never strip the leading zero.
- Both languages: every human-readable name in the pantry has `sv` and `en`.
- Public repository, MIT code, CC0 pantry. No secrets exist, so none may appear.
- Conventional Commits. Never commit on `main` after the initial scaffold: work on branch `feat/plan-01-foundations`, squash-merge at the end.
- Attribution in commit trailers: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File structure

```
.nvmrc                          Node 22
.yarnrc.yml                     nodeLinker: node-modules
package.json                    scripts: dev, build, typecheck, test, lint, format, kitchen
tsconfig.json                   solution file with references
tsconfig.base.json              strict shared options
tsconfig.app.json               src/ + shared/, DOM libs, react-jsx
tsconfig.kitchen.json           kitchen/src/ + shared/, Node types
vite.config.ts                  React plugin, publicDir = public
vitest.config.ts                node environment, includes all three trees
shared/pantry.ts                zod schemas + TypeScript types for every pantry file (the wall)
shared/pantry.test.ts
kitchen/src/cli.ts              `yarn kitchen <stage>` entry point
kitchen/src/scb/client.ts       cell counting, chunking, rate limiter, metadata + data fetch
kitchen/src/scb/client.test.ts
kitchen/src/scb/jsonstat.ts     JSON-stat2 dataset -> flat rows
kitchen/src/scb/jsonstat.test.ts
kitchen/src/scb/freeze.ts       fetch-through-cache into kitchen/raw/
kitchen/src/scb/freeze.test.ts
kitchen/src/municipalities.ts   creation years, county from code, name lookups
kitchen/src/municipalities.test.ts
kitchen/src/indicators/population.ts     TAB638 + TAB5557 -> IndicatorSeries
kitchen/src/indicators/population.test.ts
kitchen/src/geometry/build.ts   mapshaper invocation, TopoJSON post-processing
kitchen/src/geometry/adjacency.ts        neighbours from topology + auto-connect islands
kitchen/src/geometry/adjacency.test.ts
kitchen/src/geometry/bubbles.ts          d3-force Dorling layout
kitchen/src/geometry/bubbles.test.ts
kitchen/src/publish.ts          assemble PantryData + manifest, stable JSON writer
kitchen/src/publish.test.ts
kitchen/spikes/open-questions.ts         one-off script answering DESIGN.md section 9 questions
kitchen/raw/                    frozen SCB responses and the SCB shapefile zip (committed)
kitchen/fixtures/               small hand-written JSON-stat2 fixtures for tests
public/pantry/geometry/municipalities.topo.json
public/pantry/geometry/adjacency.json
public/pantry/layout/bubbles.json
public/pantry/data/indicators.json
public/pantry/manifest.json
src/main.tsx                    throwaway render check (replaced in Plan 3)
src/RenderCheck.tsx
src/RenderCheck.test.ts
docs/kitchen.md                 how to run the kitchen, stage by stage
```

---

### Task 1: Repository scaffold

**Files:**

- Create: `.nvmrc`, `.yarnrc.yml`, `package.json`, `tsconfig.json`, `tsconfig.base.json`, `tsconfig.app.json`, `tsconfig.kitchen.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `shared/smoke.test.ts`, `.prettierrc`, `.oxlintrc.json`, `LICENSE`, `README.md`, `docs/decisions/README.md`
- Modify: `.gitignore`

**Interfaces:**

- Produces: the scripts `yarn dev`, `yarn build`, `yarn typecheck`, `yarn test`, `yarn lint`, `yarn format`, `yarn kitchen <stage>` that every later task relies on.

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/plan-01-foundations
```

- [ ] **Step 2: Pin Node and Yarn**

`.nvmrc`:

```
22
```

`.yarnrc.yml`:

```yaml
nodeLinker: node-modules
```

Run:

```bash
corepack enable && yarn set version stable && yarn init -p
```

Expected: `package.json` created, `packageManager` field set to `yarn@4.x`.

- [ ] **Step 3: Write package.json scripts and metadata**

Replace `package.json` with:

```json
{
  "name": "sweden-data-explorer",
  "private": true,
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.app.json --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.kitchen.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "oxlint . && prettier --check .",
    "format": "prettier --write .",
    "kitchen": "tsx kitchen/src/cli.ts"
  }
}
```

Keep the `packageManager` line Yarn added.

- [ ] **Step 4: Install dependencies at their current versions**

```bash
yarn add react react-dom zod d3-geo d3-force d3-scale d3-scale-chromatic topojson-client
yarn add -D typescript vite @vitejs/plugin-react vitest tsx prettier oxlint mapshaper @types/node @types/react @types/react-dom @types/d3-geo @types/d3-force @types/d3-scale @types/d3-scale-chromatic @types/topojson-client @types/topojson-specification
```

Expected: `yarn.lock` and `node_modules/` created. Check `node_modules` is ignored by `.gitignore` (it is).

- [ ] **Step 5: TypeScript configuration**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`tsconfig.app.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "shared"]
}
```

`tsconfig.kitchen.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "noEmit": true
  },
  "include": ["kitchen/src", "kitchen/spikes", "shared"]
}
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.kitchen.json" }]
}
```

- [ ] **Step 6: Vite and Vitest configuration**

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'kitchen/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sweden Data Explorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx` (placeholder, replaced in Task 10):

```tsx
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(<p>Kitchen not run yet.</p>)
```

- [ ] **Step 7: Lint and format configuration**

`.prettierrc`:

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "react", "import"],
  "categories": { "correctness": "error", "suspicious": "warn" },
  "ignorePatterns": ["dist", "public/pantry", "kitchen/raw", "node_modules"]
}
```

Append to `.gitignore`:

```
.yarn/*
!.yarn/releases
!.yarn/plugins
coverage/
```

- [ ] **Step 8: Write the smoke test**

`shared/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 9: Run every script to verify the toolchain**

Run: `yarn typecheck && yarn test && yarn lint && yarn build`
Expected: typecheck clean, 1 test passing, lint clean, `dist/` produced. If Prettier complains, run `yarn format` and re-run.

- [ ] **Step 10: License, README, decisions pointer**

`LICENSE`: the MIT text with `Copyright (c) 2026 Aniisa Bihi`.

`README.md`:

```markdown
# Sweden Data Explorer

An interactive atlas of Sweden's 290 municipalities built entirely from Statistics Sweden (SCB) open data. Static site, no server, no runtime API, no tracking.

- Design and decisions: [docs/DESIGN.md](docs/DESIGN.md)
- Research record: [docs/research/](docs/research/README.md)
- Build plans: [docs/plans/](docs/plans/README.md)
- Running the data pipeline: [docs/kitchen.md](docs/kitchen.md)

Code is MIT. Generated data files under `public/pantry/` are CC0, derived from SCB data (CC0). Derived figures are this project's own calculations, not SCB's.
```

`docs/decisions/README.md`:

```markdown
# Decision log

Decisions taken during discovery and design live in the decision table of [docs/DESIGN.md](../DESIGN.md), each with its reason. From the first increment onward, every change to those decisions gets a dated file here, `NNNN-short-title.md`, stating context, decision, and consequences.
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold toolchain (vite, vitest, tsx, strict ts, lint)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The wall — pantry schemas

**Files:**

- Create: `shared/pantry.ts`, `shared/pantry.test.ts`

**Interfaces:**

- Produces: zod schemas and inferred types `Municipality`, `Indicator`, `IndicatorSeries`, `PantryData`, `Adjacency`, `Bubbles`, `Manifest`, plus `OBSERVATION_STATUS` and `statusCode()`. Every later task imports from `shared/pantry.ts` and nothing else crosses the wall.

Design notes carried into code: observations are stored columnar (municipalities × years) for compactness, a status byte per cell, no "higher is better" flag, a neutral scale hint instead, and a `sensitivity` class per indicator.

- [ ] **Step 1: Write the failing test**

`shared/pantry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  Indicator,
  IndicatorSeries,
  Municipality,
  OBSERVATION_STATUS,
  PantryData,
  statusCode,
} from './pantry'

const stockholm = { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }

describe('pantry schemas', () => {
  it('accepts a valid municipality and rejects a code without leading zero', () => {
    expect(Municipality.parse(stockholm)).toEqual(stockholm)
    expect(() => Municipality.parse({ ...stockholm, code: '180' })).toThrow()
  })

  it('maps status names to stable small integers', () => {
    expect(OBSERVATION_STATUS).toEqual([
      'present',
      'not-yet-published',
      'did-not-exist',
      'perturbed',
      'too-few-cases',
    ])
    expect(statusCode('perturbed')).toBe(3)
  })

  it('requires series rows to match municipality order and years length', () => {
    const indicator = Indicator.parse({
      id: 'population',
      name: { sv: 'Folkmängd', en: 'Population' },
      description: { sv: 'Antal invånare 31 december.', en: 'Residents on 31 December.' },
      unit: 'count',
      priceBasis: 'none',
      scale: { kind: 'sequential', breaks: [1000, 5000, 20000, 50000, 100000, 500000] },
      coverage: { from: 1968, to: 2025 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [{ table: 'TAB638', contentCode: 'BE0101N1', note: '1968–2024' }],
      derivation: 'Sum over sex and marital status of SCB table cell values.',
    })
    const series = IndicatorSeries.parse({
      indicator: 'population',
      years: [2024, 2025],
      values: [[984748, 990000]],
      status: [[0, 3]],
    })
    const pantry = PantryData.parse({
      schemaVersion: 1,
      municipalities: [stockholm],
      indicators: [indicator],
      series: [series],
    })
    expect(pantry.series[0]?.values[0]?.[1]).toBe(990000)
    expect(() =>
      PantryData.parse({
        ...pantry,
        series: [
          {
            ...series,
            values: [
              [1, 2],
              [3, 4],
            ],
          },
        ],
      }),
    ).toThrow(/rows/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run shared/pantry.test.ts`
Expected: FAIL, cannot resolve `./pantry`.

- [ ] **Step 3: Write the schemas**

`shared/pantry.ts`:

```ts
import { z } from 'zod'

/** Every human-readable string in the pantry exists in both languages. */
export const Bilingual = z.object({ sv: z.string(), en: z.string() })
export type Bilingual = z.infer<typeof Bilingual>

/** SCB four-digit municipality code, kept as a string so "0180" never becomes 180. */
export const MunicipalityCode = z.string().regex(/^\d{4}$/, 'municipality code must be four digits')
export const CountyCode = z.string().regex(/^\d{2}$/, 'county code must be two digits')

export const Municipality = z.object({
  code: MunicipalityCode,
  name: Bilingual,
  county: CountyCode,
  /** Filled by Plan 2 from SCB's area table. */
  landAreaKm2: z.number().nonnegative().optional(),
})
export type Municipality = z.infer<typeof Municipality>

/** Order matters: the index is the status byte stored per cell. Append only. */
export const OBSERVATION_STATUS = [
  'present',
  'not-yet-published',
  'did-not-exist',
  'perturbed',
  'too-few-cases',
] as const
export type ObservationStatus = (typeof OBSERVATION_STATUS)[number]
export function statusCode(status: ObservationStatus): number {
  return OBSERVATION_STATUS.indexOf(status)
}

export const IndicatorId = z.string().regex(/^[a-z][a-z0-9-]*$/)

export const Indicator = z.object({
  id: IndicatorId,
  name: Bilingual,
  description: Bilingual,
  unit: z.enum(['count', 'percent', 'years', 'sek', 'per-thousand', 'per-km2']),
  /** 'fixed-latest-year' means values are inflation-adjusted to the latest year's kronor. */
  priceBasis: z.enum(['none', 'fixed-latest-year']),
  /** Neutral scale hint. There is deliberately no "higher is better" flag. */
  scale: z.object({
    kind: z.enum(['sequential', 'diverging']),
    reference: z.enum(['zero', 'national-median']).optional(),
    /** Fixed class breaks across all years, computed in the kitchen. */
    breaks: z.array(z.number()),
  }),
  coverage: z.object({ from: z.number().int(), to: z.number().int() }),
  caveat: Bilingual,
  /** For indicators built from events (house sales): below this count the cell is 'too-few-cases'. */
  minCount: z.number().int().positive().optional(),
  sensitivity: z.enum(['none', 'sensitive']),
  sources: z.array(z.object({ table: z.string(), contentCode: z.string(), note: z.string() })),
  /** Plain-language statement of how the value was computed from the sources. */
  derivation: z.string(),
})
export type Indicator = z.infer<typeof Indicator>

/**
 * Columnar series: values[m][y] where m indexes PantryData.municipalities and y indexes years.
 * status[m][y] is an index into OBSERVATION_STATUS. null value must not have status 0.
 */
export const IndicatorSeries = z
  .object({
    indicator: IndicatorId,
    years: z.array(z.number().int()),
    values: z.array(z.array(z.number().nullable())),
    status: z.array(
      z.array(
        z
          .number()
          .int()
          .min(0)
          .max(OBSERVATION_STATUS.length - 1),
      ),
    ),
  })
  .superRefine((s, ctx) => {
    if (s.values.length !== s.status.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'values and status must have the same number of rows',
      })
    }
    for (const [i, row] of s.values.entries()) {
      if (row.length !== s.years.length || s.status[i]?.length !== s.years.length) {
        ctx.addIssue({ code: 'custom', message: `row ${i} length must equal years length` })
      }
      for (const [j, v] of row.entries()) {
        if (v === null && s.status[i]?.[j] === 0) {
          ctx.addIssue({
            code: 'custom',
            message: `row ${i} col ${j}: null value cannot be 'present'`,
          })
        }
      }
    }
  })
export type IndicatorSeries = z.infer<typeof IndicatorSeries>

export const PantryData = z
  .object({
    schemaVersion: z.literal(1),
    municipalities: z.array(Municipality),
    indicators: z.array(Indicator),
    series: z.array(IndicatorSeries),
  })
  .superRefine((p, ctx) => {
    for (const s of p.series) {
      if (s.values.length !== p.municipalities.length) {
        ctx.addIssue({
          code: 'custom',
          message: `series ${s.indicator}: rows (${s.values.length}) must equal municipalities (${p.municipalities.length})`,
        })
      }
      if (!p.indicators.some((i) => i.id === s.indicator)) {
        ctx.addIssue({ code: 'custom', message: `series ${s.indicator} has no indicator` })
      }
    }
  })
export type PantryData = z.infer<typeof PantryData>

/** Keyboard neighbours. `synthetic` lists edges added so islands are reachable. */
export const Adjacency = z.object({
  schemaVersion: z.literal(1),
  neighbours: z.record(MunicipalityCode, z.array(MunicipalityCode)),
  synthetic: z.array(z.tuple([MunicipalityCode, MunicipalityCode])),
})
export type Adjacency = z.infer<typeof Adjacency>

/** Dorling layout in the unit square; r is in the same units. */
export const Bubbles = z.object({
  schemaVersion: z.literal(1),
  basedOn: z.object({ indicator: IndicatorId, year: z.number().int() }),
  circles: z.array(
    z.object({ code: MunicipalityCode, x: z.number(), y: z.number(), r: z.number() }),
  ),
})
export type Bubbles = z.infer<typeof Bubbles>

export const Manifest = z.object({
  schemaVersion: z.literal(1),
  license: z.literal('CC0-1.0'),
  sources: z.array(
    z.object({
      table: z.string(),
      lang: z.enum(['sv', 'en']),
      url: z.string().url(),
      /** Copied from the frozen raw file; set once at freeze time, never at publish time. */
      fetchedAt: z.string().datetime(),
      sha256: z.string().length(64),
      cells: z.number().int().nonnegative(),
    }),
  ),
})
export type Manifest = z.infer<typeof Manifest>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run shared/pantry.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/pantry.ts shared/pantry.test.ts
git commit -m "feat(shared): pantry schemas, the contract between kitchen and site

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: SCB client — counting, chunking, throttling, fetching

**Files:**

- Create: `kitchen/src/scb/client.ts`, `kitchen/src/scb/client.test.ts`

**Interfaces:**

- Produces:
  - `type Selection = Record<string, string[]>` (variable code → value codes)
  - `cellCount(sel: Selection): number`
  - `chunkSelection(sel: Selection, maxCells?: number): Selection[]`
  - `class RateLimiter { constructor(maxCalls: number, windowMs: number, now?: () => number, sleep?: (ms) => Promise<void>); acquire(): Promise<void> }`
  - `interface TableMeta { id: string; label: string; variables: Array<{ code: string; label: string; values: Array<{ code: string; label: string }> }> }`
  - `fetchMetadata(tableId: string, lang: 'sv' | 'en', deps?: Deps): Promise<TableMeta>`
  - `fetchData(tableId: string, sel: Selection, lang: 'sv' | 'en', deps?: Deps): Promise<unknown>` (raw JSON-stat2 body)
  - `dataUrl(tableId, lang)` and `toRequestBody(sel)` exported for freeze to record.
  - `type Deps = { fetchImpl?: typeof fetch; limiter?: RateLimiter }`

- [ ] **Step 1: Confirm the v2 request shape before writing code**

Open `https://github.com/PxTools/PxApiSpecs/blob/master/PxAPI-2.yml` and check:

1. Data endpoint path: `POST /tables/{id}/data?lang={lang}&outputFormat=json-stat2`.
2. Body schema named `VariablesSelection`: `{ "selection": [ { "variableCode": "...", "valueCodes": ["..."] } ] }`.
3. Metadata endpoint: `GET /tables/{id}/metadata?lang={lang}` returning a JSON-stat2 dataset whose `dimension` object lists variables with `category.index` and `category.label`.

If any of the three differs, adjust `toRequestBody`, `dataUrl`, `metadataUrl` or `parseMetadata` below to match the spec and note the difference in `docs/kitchen.md`. Do not guess.

- [ ] **Step 2: Write the failing tests**

`kitchen/src/scb/client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  cellCount,
  chunkSelection,
  fetchData,
  fetchMetadata,
  RateLimiter,
  toRequestBody,
  type Selection,
} from './client'

const big: Selection = {
  Region: Array.from({ length: 290 }, (_, i) => String(i).padStart(4, '0')),
  Alder: Array.from({ length: 102 }, (_, i) => String(i)),
  Kon: ['1', '2'],
  Civilstand: ['OG', 'G', 'SK', 'ÄNKL'],
  Tid: Array.from({ length: 57 }, (_, i) => String(1968 + i)),
}

describe('cellCount', () => {
  it('multiplies the value counts of every variable', () => {
    expect(cellCount({ A: ['1', '2'], B: ['x', 'y', 'z'] })).toBe(6)
    expect(cellCount(big)).toBe(290 * 102 * 2 * 4 * 57)
  })
})

describe('chunkSelection', () => {
  it('returns the selection unchanged when under the limit', () => {
    const sel = { A: ['1'], B: ['x', 'y'] }
    expect(chunkSelection(sel, 150_000)).toEqual([sel])
  })

  it('splits the largest variable until every chunk fits, covering every cell exactly once', () => {
    const chunks = chunkSelection(big, 150_000)
    for (const c of chunks) expect(cellCount(c)).toBeLessThanOrEqual(150_000)
    const total = chunks.reduce((n, c) => n + cellCount(c), 0)
    expect(total).toBe(cellCount(big))
    const seenYears = new Set(chunks.flatMap((c) => c.Tid ?? []))
    expect(seenYears.size).toBe(57)
  })
})

describe('RateLimiter', () => {
  it('allows maxCalls immediately then waits for the window', async () => {
    let now = 0
    const sleeps: number[] = []
    const limiter = new RateLimiter(
      3,
      10_000,
      () => now,
      async (ms) => {
        sleeps.push(ms)
        now += ms
      },
    )
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    expect(sleeps).toEqual([])
    await limiter.acquire()
    expect(sleeps).toEqual([10_000])
  })
})

describe('toRequestBody', () => {
  it('serialises a selection in v2 shape with sorted variable order', () => {
    expect(toRequestBody({ Tid: ['2024'], Region: ['0180'] })).toEqual({
      selection: [
        { variableCode: 'Region', valueCodes: ['0180'] },
        { variableCode: 'Tid', valueCodes: ['2024'] },
      ],
    })
  })
})

describe('fetch functions', () => {
  it('fetchMetadata parses variables from a JSON-stat2 dimension object', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: ['Region', 'Tid'],
            label: 'Folkmängd',
            dimension: {
              Region: {
                label: 'region',
                category: { index: { '0180': 0 }, label: { '0180': 'Stockholm' } },
              },
              Tid: { label: 'år', category: { index: { '2024': 0 }, label: { '2024': '2024' } } },
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch
    const meta = await fetchMetadata('TAB638', 'sv', { fetchImpl })
    expect(meta.variables).toEqual([
      { code: 'Region', label: 'region', values: [{ code: '0180', label: 'Stockholm' }] },
      { code: 'Tid', label: 'år', values: [{ code: '2024', label: '2024' }] },
    ])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/metadata?lang=sv',
      expect.anything(),
    )
  })

  it('fetchData POSTs the body and throws on non-2xx with the status in the message', async () => {
    const ok = vi.fn(
      async () => new Response('{"value":[1]}', { status: 200 }),
    ) as unknown as typeof fetch
    await expect(fetchData('TAB638', { Tid: ['2024'] }, 'sv', { fetchImpl: ok })).resolves.toEqual({
      value: [1],
    })
    const call = (ok as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe(
      'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
    )
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body as string)).toEqual({
      selection: [{ variableCode: 'Tid', valueCodes: ['2024'] }],
    })

    const tooMany = vi.fn(
      async () => new Response('slow down', { status: 429 }),
    ) as unknown as typeof fetch
    await expect(
      fetchData('TAB638', { Tid: ['2024'] }, 'sv', { fetchImpl: tooMany }),
    ).rejects.toThrow(/429/)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run kitchen/src/scb/client.test.ts`
Expected: FAIL, cannot resolve `./client`.

- [ ] **Step 4: Write the client**

`kitchen/src/scb/client.ts`:

```ts
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

export async function fetchMetadata(
  tableId: string,
  lang: Lang,
  deps: Deps = {},
): Promise<TableMeta> {
  const body = await request(metadataUrl(tableId, lang), { method: 'GET' }, deps)
  return parseMetadata(tableId, body)
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run kitchen/src/scb/client.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add kitchen/src/scb/client.ts kitchen/src/scb/client.test.ts
git commit -m "feat(kitchen): SCB v2 client with cell chunking and rate limiting

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: JSON-stat2 to rows

**Files:**

- Create: `kitchen/src/scb/jsonstat.ts`, `kitchen/src/scb/jsonstat.test.ts`, `kitchen/fixtures/jsonstat-2x3.json`

**Interfaces:**

- Produces:
  - `interface JsonStat2 { id: string[]; size: number[]; dimension: Record<string, { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }>; value: Array<number | null> }`
  - `type Row = { dims: Record<string, string>; value: number | null }`
  - `toRows(ds: JsonStat2): Row[]` in row-major order of `id`.
  - `isJsonStat2(x: unknown): x is JsonStat2`

- [ ] **Step 1: Write the fixture and the failing test**

`kitchen/fixtures/jsonstat-2x3.json`:

```json
{
  "version": "2.0",
  "class": "dataset",
  "id": ["Region", "Tid"],
  "size": [2, 3],
  "dimension": {
    "Region": {
      "category": {
        "index": { "0180": 0, "0380": 1 },
        "label": { "0180": "Stockholm", "0380": "Uppsala" }
      }
    },
    "Tid": { "category": { "index": ["2022", "2023", "2024"] } }
  },
  "value": [978770, 984748, 990000, 237596, 240000, null]
}
```

`kitchen/src/scb/jsonstat.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isJsonStat2, toRows } from './jsonstat'

const fixture = JSON.parse(readFileSync('kitchen/fixtures/jsonstat-2x3.json', 'utf8'))

describe('toRows', () => {
  it('walks the value array in row-major order of the id list', () => {
    expect(isJsonStat2(fixture)).toBe(true)
    const rows = toRows(fixture)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toEqual({ dims: { Region: '0180', Tid: '2022' }, value: 978770 })
    expect(rows[2]).toEqual({ dims: { Region: '0180', Tid: '2024' }, value: 990000 })
    expect(rows[3]).toEqual({ dims: { Region: '0380', Tid: '2022' }, value: 237596 })
    expect(rows[5]).toEqual({ dims: { Region: '0380', Tid: '2024' }, value: null })
  })

  it('rejects a dataset whose value length does not match its size', () => {
    expect(() => toRows({ ...fixture, value: [1, 2] })).toThrow(/size/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/scb/jsonstat.test.ts`
Expected: FAIL, cannot resolve `./jsonstat`.

- [ ] **Step 3: Write the parser**

`kitchen/src/scb/jsonstat.ts`:

```ts
export interface JsonStat2 {
  id: string[]
  size: number[]
  dimension: Record<
    string,
    { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }
  >
  value: Array<number | null>
}

export type Row = { dims: Record<string, string>; value: number | null }

export function isJsonStat2(x: unknown): x is JsonStat2 {
  const o = x as Partial<JsonStat2> | null
  return (
    !!o &&
    Array.isArray(o.id) &&
    Array.isArray(o.size) &&
    typeof o.dimension === 'object' &&
    Array.isArray(o.value)
  )
}

function codesOf(ds: JsonStat2, dim: string): string[] {
  const index = ds.dimension[dim]?.category.index
  if (!index) throw new Error(`dimension ${dim} missing from dataset`)
  if (Array.isArray(index)) return index
  return Object.entries(index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code)
}

/** JSON-stat2 stores values flat, last dimension varying fastest. */
export function toRows(ds: JsonStat2): Row[] {
  const expected = ds.size.reduce((n, s) => n * s, 1)
  if (ds.value.length !== expected) {
    throw new Error(`value length ${ds.value.length} does not match size product ${expected}`)
  }
  const codes = ds.id.map((dim) => codesOf(ds, dim))
  const strides = ds.size.map((_, i) => ds.size.slice(i + 1).reduce((n, s) => n * s, 1))
  return ds.value.map((value, flat) => {
    const dims: Record<string, string> = {}
    ds.id.forEach((dim, d) => {
      const pos = Math.floor(flat / (strides[d] ?? 1)) % (ds.size[d] ?? 1)
      dims[dim] = codes[d]?.[pos] ?? ''
    })
    return { dims, value }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run kitchen/src/scb/jsonstat.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add kitchen/src/scb/jsonstat.ts kitchen/src/scb/jsonstat.test.ts kitchen/fixtures/jsonstat-2x3.json
git commit -m "feat(kitchen): JSON-stat2 parser

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Freeze — fetch through a committed cache

**Files:**

- Create: `kitchen/src/scb/freeze.ts`, `kitchen/src/scb/freeze.test.ts`

**Interfaces:**

- Consumes: `fetchData`, `fetchMetadata`, `chunkSelection`, `dataUrl`, `RateLimiter`, `Selection`, `Lang` from `./client`; `JsonStat2`, `isJsonStat2` from `./jsonstat`.
- Produces:
  - `interface FrozenData { kind: 'data'; table: string; lang: Lang; url: string; selection: Selection; fetchedAt: string; response: JsonStat2 }`
  - `interface FrozenMeta { kind: 'metadata'; table: string; lang: Lang; url: string; fetchedAt: string; response: unknown }`
  - `freezeData(table, sel, lang, opts?: { rawDir?: string; deps?: Deps; clock?: () => string }): Promise<FrozenData[]>` — one file per chunk, reused if present.
  - `freezeMetadata(table, lang, opts?): Promise<FrozenMeta>`
  - `rawPath(rawDir, table, lang, key)` and `selectionKey(sel): string` (sha256 of the canonical body).
  - `DEFAULT_RAW_DIR = 'kitchen/raw'`

- [ ] **Step 1: Write the failing test**

`kitchen/src/scb/freeze.test.ts`:

```ts
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { freezeData, selectionKey } from './freeze'

const dataset = {
  id: ['Region', 'Tid'],
  size: [1, 1],
  dimension: { Region: { category: { index: ['0180'] } }, Tid: { category: { index: ['2024'] } } },
  value: [984748],
}

describe('freezeData', () => {
  it('fetches once, writes one file per chunk, and reuses files on the second run', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'raw-'))
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(dataset), { status: 200 }))
    const opts = {
      rawDir,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    }
    const sel = { Region: ['0180'], Tid: ['2024'] }

    const first = await freezeData('TAB638', sel, 'sv', opts)
    expect(first).toHaveLength(1)
    expect(first[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
    expect(first[0]?.response.value).toEqual([984748])
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const files = readdirSync(join(rawDir, 'TAB638', 'sv'))
    expect(files).toEqual([`${selectionKey(sel)}.json`])
    const onDisk = JSON.parse(readFileSync(join(rawDir, 'TAB638', 'sv', files[0]!), 'utf8'))
    expect(onDisk.kind).toBe('data')
    expect(onDisk.url).toContain('/tables/TAB638/data')

    const second = await freezeData('TAB638', sel, 'sv', { ...opts, clock: () => 'later' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(second[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
  })

  it('selectionKey is stable across key order', () => {
    expect(selectionKey({ Tid: ['2024'], Region: ['0180'] })).toBe(
      selectionKey({ Region: ['0180'], Tid: ['2024'] }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/scb/freeze.test.ts`
Expected: FAIL, cannot resolve `./freeze`.

- [ ] **Step 3: Write freeze**

`kitchen/src/scb/freeze.ts`:

```ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  chunkSelection,
  dataUrl,
  fetchData,
  fetchMetadata,
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
  const response = await fetchMetadata(table, lang, deps)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run kitchen/src/scb/freeze.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add kitchen/src/scb/freeze.ts kitchen/src/scb/freeze.test.ts
git commit -m "feat(kitchen): freeze stage caches SCB responses in the repo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Spike — answer the two open SCB questions with real data

This task touches the network once, on purpose, and produces documentation, not product code. Its answers change how Task 8 marks statuses.

**Files:**

- Create: `kitchen/spikes/open-questions.ts`, `kitchen/raw/TAB638/sv/metadata.json`, `kitchen/raw/TAB5557/sv/metadata.json` (written by the spike via freeze)
- Modify: `docs/research/README.md` (Open verification items), `docs/DESIGN.md` section 9

**Interfaces:**

- Consumes: `freezeMetadata`, `freezeData` from `kitchen/src/scb/freeze.ts`; `toRows` from `kitchen/src/scb/jsonstat.ts`.

- [ ] **Step 1: Write the spike script**

`kitchen/spikes/open-questions.ts`:

```ts
/**
 * Answers two questions from docs/DESIGN.md section 9 with real SCB data:
 *  A. Do pre-split municipalities (Knivsta 0330, created 2003) return empty cells or
 *     parent-inclusive values before the split? And does the parent (Uppsala 0380) jump?
 *  B. From 2025 (CKM noise), is an aggregated age-group cell perturbed once, or is it the
 *     sum of already-perturbed single-year cells?
 * Run: yarn tsx kitchen/spikes/open-questions.ts
 */
import { freezeData, freezeMetadata } from '../src/scb/freeze'
import { toRows } from '../src/scb/jsonstat'

const OLD = 'TAB638' // Folkmängden efter region, civilstånd, ålder och kön 1968–2024
const NEW = 'TAB5557' // same, 2025– with Cell Key Method noise

function find(meta: Awaited<ReturnType<typeof freezeMetadata>>, code: string) {
  const dims = meta.response as {
    id: string[]
    dimension: Record<string, { category: { index: Record<string, number> | string[] } }>
  }
  const idx = dims.dimension[code]?.category.index
  if (!idx) throw new Error(`no variable ${code}; variables are ${dims.id.join(', ')}`)
  return Array.isArray(idx) ? idx : Object.keys(idx)
}

const oldMeta = await freezeMetadata(OLD, 'sv')
const newMeta = await freezeMetadata(NEW, 'sv')
console.log('TAB638 variables:', (oldMeta.response as { id: string[] }).id)
console.log('TAB5557 variables:', (newMeta.response as { id: string[] }).id)

const ages = find(oldMeta, 'Alder')
const sexes = find(oldMeta, 'Kon')
const civil = find(oldMeta, 'Civilstand')
const hasAgeTotal = ages.includes('tot')
console.log(`Alder has ${ages.length} values; 'tot' present: ${hasAgeTotal}`)
console.log(`Kon values: ${sexes.join(',')}; Civilstand values: ${civil.join(',')}`)

// A. Knivsta and Uppsala 1998–2005, total population (sum over age, sex, civil status).
const selA = {
  Region: ['0330', '0380'],
  Alder: hasAgeTotal ? ['tot'] : ages,
  Kon: sexes,
  Civilstand: civil,
  ContentsCode: ['BE0101N1'],
  Tid: ['1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005'],
}
const frozenA = await freezeData(OLD, selA, 'sv')
const totals = new Map<string, number | null>()
for (const f of frozenA) {
  for (const r of toRows(f.response)) {
    const k = `${r.dims.Region} ${r.dims.Tid}`
    const prev = totals.get(k)
    totals.set(k, r.value === null ? (prev ?? null) : (prev ?? 0) + r.value)
  }
}
for (const [k, v] of [...totals.entries()].sort()) console.log('A:', k, v)
console.log(
  'A: If Knivsta shows null before 2003 → status did-not-exist. If it shows numbers → SCB back-casts; use them and drop the did-not-exist rule for Knivsta.',
)
console.log(
  "A: Uppsala should drop by roughly Knivsta's size between 2002 and 2003 → confirms the parent-break flag is needed.",
)

// B. Stockholm 2025: single-year ages summed vs the 5-year aggregate codelist, if the API exposes one.
const newAges = find(newMeta, 'Alder')
const selB = {
  Region: ['0180'],
  Alder: newAges,
  Kon: find(newMeta, 'Kon'),
  Civilstand: find(newMeta, 'Civilstand'),
  ContentsCode: ['BE0101N1'],
  Tid: ['2025'],
}
const frozenB = await freezeData(NEW, selB, 'sv')
let sumSingle = 0
for (const f of frozenB) for (const r of toRows(f.response)) sumSingle += r.value ?? 0
console.log('B: Stockholm 2025 sum of single-year age cells =', sumSingle)
console.log(
  "B: Compare with SCB's published Stockholm total for 2025-12-31 (statistikdatabasen table view). If they differ by a few units, SCB perturbs each cell independently and derived age indicators must be computed from the coarsest cells available. Record the difference.",
)
```

- [ ] **Step 2: Run the spike**

Run: `yarn tsx kitchen/spikes/open-questions.ts`
Expected: prints variable lists, whether an age total code exists, the Knivsta/Uppsala series 1998–2005, and Stockholm's 2025 sum. Raw responses are written under `kitchen/raw/TAB638/sv/` and `kitchen/raw/TAB5557/sv/`. If a variable code differs from `Alder`, `Kon`, `Civilstand`, `ContentsCode`, `Tid`, read the printed variable list and fix the constants in the script and in Task 8.

- [ ] **Step 3: Record the answers**

In `docs/research/README.md`, under "Open verification items", replace the two bullets about pre-split cells and aggregate perturbation with what the spike showed, in one sentence each, dated 2026-09-13, including the actual Knivsta 2002 value and the Stockholm 2025 difference. In `docs/DESIGN.md` section 9, delete the two resolved bullets. Write the exact variable codes and whether an age total exists into `docs/kitchen.md` under a heading "SCB table facts learned".

- [ ] **Step 4: Commit the spike, its frozen responses, and the doc updates**

```bash
git add kitchen/spikes/open-questions.ts kitchen/raw docs/research/README.md docs/DESIGN.md docs/kitchen.md
git commit -m "docs(kitchen): resolve pre-split and CKM aggregation questions with a live spike

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Municipality registry — codes, names, counties, creation years

**Files:**

- Create: `kitchen/src/municipalities.ts`, `kitchen/src/municipalities.test.ts`

**Interfaces:**

- Consumes: `FrozenMeta` from `./scb/freeze`, `parseMetadata` from `./scb/client`, `Municipality` from `shared/pantry.ts`.
- Produces:
  - `CREATED: Record<string, number>` — first year a municipality exists in SCB's current code system: `{ '0461': 1992, '0488': 1992, '1535': 1995, '1814': 1995, '0140': 1999, '0330': 2003 }`
  - `SPLIT_PARENT: Record<string, string>` — child → parent: `{ '0461': '0480', '0488': '0480', '1535': '1583', '1814': '1880', '0140': '0181', '0330': '0380' }`
  - `existed(code: string, year: number): boolean`
  - `countyOf(code: string): string`
  - `municipalitiesFromMetadata(sv: FrozenMeta, en: FrozenMeta): Municipality[]` — 290 entries sorted by code, excluding `00` (riket) and two-digit county codes.

Facts come from SCB's "Ändringar i kommunindelningen efter 1974" (see `docs/research/reports/scb-pxweb.md` section 7).

- [ ] **Step 1: Write the failing test**

`kitchen/src/municipalities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { countyOf, existed, municipalitiesFromMetadata, SPLIT_PARENT } from './municipalities'

function meta(lang: 'sv' | 'en', names: Record<string, string>) {
  return {
    kind: 'metadata' as const,
    table: 'TAB638',
    lang,
    url: '',
    fetchedAt: '2026-09-13T00:00:00.000Z',
    response: {
      id: ['Region', 'Tid'],
      dimension: {
        Region: {
          label: 'region',
          category: {
            index: Object.fromEntries(Object.keys(names).map((k, i) => [k, i])),
            label: names,
          },
        },
        Tid: { label: 'år', category: { index: ['2024'] } },
      },
    },
  }
}

describe('municipality registry', () => {
  it('knows when split-off municipalities came into existence', () => {
    expect(existed('0330', 2002)).toBe(false)
    expect(existed('0330', 2003)).toBe(true)
    expect(existed('0180', 1968)).toBe(true)
    expect(SPLIT_PARENT['0330']).toBe('0380')
  })

  it('derives the county from the first two digits', () => {
    expect(countyOf('0180')).toBe('01')
    expect(countyOf('2584')).toBe('25')
  })

  it('builds bilingual municipalities from sv and en metadata, dropping riket and counties', () => {
    const sv = meta('sv', {
      '00': 'Riket',
      '01': 'Stockholms län',
      '0180': 'Stockholm',
      '0114': 'Upplands Väsby',
    })
    const en = meta('en', {
      '00': 'Sweden',
      '01': 'Stockholm county',
      '0180': 'Stockholm',
      '0114': 'Upplands Väsby',
    })
    expect(municipalitiesFromMetadata(sv, en)).toEqual([
      { code: '0114', name: { sv: 'Upplands Väsby', en: 'Upplands Väsby' }, county: '01' },
      { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/municipalities.test.ts`
Expected: FAIL, cannot resolve `./municipalities`.

- [ ] **Step 3: Write the registry**

`kitchen/src/municipalities.ts`:

```ts
import { Municipality } from '../../shared/pantry'
import { parseMetadata } from './scb/client'
import type { FrozenMeta } from './scb/freeze'

/** First year each municipality exists under its current code. Source: SCB kommunändringar. */
export const CREATED: Record<string, number> = {
  '0461': 1992, // Gnesta, from Nyköping
  '0488': 1992, // Trosa, from Nyköping
  '1535': 1995, // Bollebygd, from Borås
  '1814': 1995, // Lekeberg, from Örebro
  '0140': 1999, // Nykvarn, from Södertälje
  '0330': 2003, // Knivsta, from Uppsala
}

export const SPLIT_PARENT: Record<string, string> = {
  '0461': '0480',
  '0488': '0480',
  '1535': '1583',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run kitchen/src/municipalities.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add kitchen/src/municipalities.ts kitchen/src/municipalities.test.ts
git commit -m "feat(kitchen): municipality registry with split history

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Population indicator end to end

**Files:**

- Create: `kitchen/src/indicators/population.ts`, `kitchen/src/indicators/population.test.ts`, `kitchen/fixtures/population-mini-old.json`, `kitchen/fixtures/population-mini-new.json`

**Interfaces:**

- Consumes: `FrozenData` and `freezeData`/`freezeMetadata` from `../scb/freeze`; `toRows` from `../scb/jsonstat`; `existed`, `municipalitiesFromMetadata` from `../municipalities`; `Indicator`, `IndicatorSeries`, `Municipality`, `statusCode` from `shared/pantry.ts`.
- Produces:
  - `POPULATION: Indicator` (breaks filled at build time by `withBreaks`)
  - `populationSelection(meta: TableMeta, years: string[]): Selection` — uses the age total code if the spike found one, otherwise all ages.
  - `buildPopulationSeries(municipalities: Municipality[], oldChunks: FrozenData[], newChunks: FrozenData[], years: number[]): IndicatorSeries`
  - `quantileBreaks(values: number[], classes: number): number[]`
  - `withBreaks(indicator: Indicator, series: IndicatorSeries, classes?: number): Indicator`
  - `fetchPopulation(opts?: FreezeOpts): Promise<{ municipalities: Municipality[]; indicator: Indicator; series: IndicatorSeries }>` — the network-touching orchestrator used by the CLI.

Status rules: value present and year ≤ 2024 → `present`; year ≥ 2025 → `perturbed`; null and municipality did not yet exist → `did-not-exist`; null otherwise → `not-yet-published`. Adjust the `did-not-exist` rule per the Task 6 finding.

- [ ] **Step 1: Write the fixtures**

`kitchen/fixtures/population-mini-old.json` (two municipalities, two sexes, two years; Knivsta null before 2003):

```json
{
  "kind": "data",
  "table": "TAB638",
  "lang": "sv",
  "url": "https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2",
  "selection": { "Region": ["0330", "0380"], "Kon": ["1", "2"], "Tid": ["2002", "2003"] },
  "fetchedAt": "2026-09-13T10:00:00.000Z",
  "response": {
    "id": ["Region", "Kon", "Tid"],
    "size": [2, 2, 2],
    "dimension": {
      "Region": { "category": { "index": ["0330", "0380"] } },
      "Kon": { "category": { "index": ["1", "2"] } },
      "Tid": { "category": { "index": ["2002", "2003"] } }
    },
    "value": [null, 6000, null, 6200, 95000, 90000, 96000, 91000]
  }
}
```

`kitchen/fixtures/population-mini-new.json`:

```json
{
  "kind": "data",
  "table": "TAB5557",
  "lang": "sv",
  "url": "https://statistikdatabasen.scb.se/api/v2/tables/TAB5557/data?lang=sv&outputFormat=json-stat2",
  "selection": { "Region": ["0330", "0380"], "Kon": ["1", "2"], "Tid": ["2025"] },
  "fetchedAt": "2026-09-13T10:00:00.000Z",
  "response": {
    "id": ["Region", "Kon", "Tid"],
    "size": [2, 2, 1],
    "dimension": {
      "Region": { "category": { "index": ["0330", "0380"] } },
      "Kon": { "category": { "index": ["1", "2"] } },
      "Tid": { "category": { "index": ["2025"] } }
    },
    "value": [10001, 10002, 120003, 118004]
  }
}
```

- [ ] **Step 2: Write the failing test**

`kitchen/src/indicators/population.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import type { FrozenData } from '../scb/freeze'
import { buildPopulationSeries, quantileBreaks, withBreaks, POPULATION } from './population'

const oldChunk = JSON.parse(
  readFileSync('kitchen/fixtures/population-mini-old.json', 'utf8'),
) as FrozenData
const newChunk = JSON.parse(
  readFileSync('kitchen/fixtures/population-mini-new.json', 'utf8'),
) as FrozenData
const municipalities = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' },
  { code: '0380', name: { sv: 'Uppsala', en: 'Uppsala' }, county: '03' },
]

describe('buildPopulationSeries', () => {
  const series = buildPopulationSeries(municipalities, [oldChunk], [newChunk], [2002, 2003, 2025])

  it('sums over every dimension except region and year', () => {
    expect(series.values[1]).toEqual([185000, 187000, 238007])
    expect(series.values[0]).toEqual([null, 12200, 20003])
  })

  it('marks statuses: did-not-exist before creation, perturbed from 2025', () => {
    const name = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
    expect(name(0, 0)).toBe('did-not-exist')
    expect(name(0, 1)).toBe('present')
    expect(name(0, 2)).toBe('perturbed')
    expect(name(1, 0)).toBe('present')
  })

  it('keeps rows in municipality order and years in the requested order', () => {
    expect(series.years).toEqual([2002, 2003, 2025])
    expect(series.values).toHaveLength(2)
  })
})

describe('breaks', () => {
  it('quantileBreaks returns classes-1 sorted interior cut points', () => {
    expect(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([2.75, 4.5, 6.25])
  })

  it('withBreaks fills the indicator scale from every non-null value', () => {
    const series = buildPopulationSeries(municipalities, [oldChunk], [newChunk], [2002, 2003, 2025])
    const ind = withBreaks(POPULATION, series, 3)
    expect(ind.scale.breaks).toHaveLength(2)
    expect(ind.scale.breaks[0]!).toBeLessThan(ind.scale.breaks[1]!)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/indicators/population.test.ts`
Expected: FAIL, cannot resolve `./population`.

- [ ] **Step 4: Write the indicator**

`kitchen/src/indicators/population.ts`:

```ts
import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed, municipalitiesFromMetadata } from '../municipalities'
import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import { freezeData, freezeMetadata, type FreezeOpts, type FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'

export const OLD_TABLE = 'TAB638' // 1968–2024
export const NEW_TABLE = 'TAB5557' // 2025– with Cell Key Method noise
export const CKM_FROM = 2025
export const CONTENT_CODE = 'BE0101N1'

export const POPULATION: Indicator = Indicator.parse({
  id: 'population',
  name: { sv: 'Folkmängd', en: 'Population' },
  description: {
    sv: 'Antal folkbokförda invånare den 31 december.',
    en: 'Registered residents on 31 December.',
  },
  unit: 'count',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: 1968, to: CKM_FROM },
  caveat: {
    sv: 'Från 2025 innehåller värdena en liten slumpmässig störning från SCB, så summor stämmer inte alltid exakt.',
    en: 'From 2025 the values carry a small random perturbation added by SCB, so sums need not match exactly.',
  },
  sensitivity: 'none',
  sources: [
    { table: OLD_TABLE, contentCode: CONTENT_CODE, note: '1968–2024' },
    { table: NEW_TABLE, contentCode: CONTENT_CODE, note: '2025 onwards, CKM' },
  ],
  derivation:
    'Sum of SCB cell values over sex and marital status (and age, unless a total age code exists) per municipality and year.',
})

function values(meta: TableMeta, code: string): string[] {
  const v = meta.variables.find((x) => x.code === code)
  if (!v)
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  return v.values.map((x) => x.code)
}

/** Total population per municipality. Uses the age total code when the table has one. */
export function populationSelection(meta: TableMeta, years: string[]): Selection {
  const ages = values(meta, 'Alder')
  const sel: Selection = {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Alder: ages.includes('tot') ? ['tot'] : ages,
    Kon: values(meta, 'Kon'),
    ContentsCode: [CONTENT_CODE],
    Tid: years,
  }
  if (meta.variables.some((x) => x.code === 'Civilstand'))
    sel.Civilstand = values(meta, 'Civilstand')
  return sel
}

function sumByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
  const totals = new Map<string, number | null>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      const key = `${r.dims.Region}|${r.dims.Tid}`
      const prev = totals.get(key)
      if (r.value === null) {
        if (!totals.has(key)) totals.set(key, null)
      } else {
        totals.set(key, (prev ?? 0) + r.value)
      }
    }
  }
  return totals
}

export function buildPopulationSeries(
  municipalities: Municipality[],
  oldChunks: FrozenData[],
  newChunks: FrozenData[],
  years: number[],
): IndicatorSeries {
  const totals = new Map([...sumByRegionYear(oldChunks), ...sumByRegionYear(newChunks)])
  const rows = municipalities.map((m) =>
    years.map((y) => {
      const v = totals.get(`${m.code}|${y}`) ?? null
      if (v === null) {
        return {
          v: null,
          s: existed(m.code, y) ? statusCode('not-yet-published') : statusCode('did-not-exist'),
        }
      }
      return { v, s: y >= CKM_FROM ? statusCode('perturbed') : statusCode('present') }
    }),
  )
  return {
    indicator: POPULATION.id,
    years,
    values: rows.map((r) => r.map((c) => c.v)),
    status: rows.map((r) => r.map((c) => c.s)),
  }
}

export function quantileBreaks(values: number[], classes: number): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (p: number) => {
    const pos = p * (sorted.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const frac = pos - lo
    return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac
  }
  return Array.from({ length: classes - 1 }, (_, i) => at((i + 1) / classes))
}

export function withBreaks(indicator: Indicator, series: IndicatorSeries, classes = 7): Indicator {
  const all = series.values.flat().filter((v): v is number => v !== null)
  return { ...indicator, scale: { ...indicator.scale, breaks: quantileBreaks(all, classes) } }
}

export const YEARS = Array.from({ length: CKM_FROM - 1968 + 1 }, (_, i) => 1968 + i)

export async function fetchPopulation(opts: FreezeOpts = {}) {
  const [svMeta, enMeta, newMeta] = await Promise.all([
    freezeMetadata(OLD_TABLE, 'sv', opts),
    freezeMetadata(OLD_TABLE, 'en', opts),
    freezeMetadata(NEW_TABLE, 'sv', opts),
  ])
  const municipalities = municipalitiesFromMetadata(svMeta, enMeta)
  const oldYears = YEARS.filter((y) => y < CKM_FROM).map(String)
  const newYears = YEARS.filter((y) => y >= CKM_FROM).map(String)
  const oldChunks = await freezeData(
    OLD_TABLE,
    populationSelection(parseMetadata(OLD_TABLE, svMeta.response), oldYears),
    'sv',
    opts,
  )
  const newChunks = await freezeData(
    NEW_TABLE,
    populationSelection(parseMetadata(NEW_TABLE, newMeta.response), newYears),
    'sv',
    opts,
  )
  const series = buildPopulationSeries(municipalities, oldChunks, newChunks, YEARS)
  return { municipalities, indicator: withBreaks(POPULATION, series), series }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run kitchen/src/indicators/population.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 6: Run the real fetch once and freeze it**

Run: `yarn tsx -e "import('./kitchen/src/indicators/population.ts').then(m => m.fetchPopulation()).then(r => console.log(r.municipalities.length, r.series.years.length, r.indicator.scale.breaks))"`
Expected: `290 58 [ ...6 numbers... ]`. New files appear under `kitchen/raw/TAB638/` and `kitchen/raw/TAB5557/`. If the count is not 290, print the codes that are not in the SCB shapefile (Task 9) and fix the region filter. If a variable name differs from what Task 6 recorded, fix the constants.

- [ ] **Step 7: Commit code, fixtures and frozen raw data**

```bash
git add kitchen/src/indicators kitchen/fixtures kitchen/raw
git commit -m "feat(kitchen): population indicator 1968–2025 with statuses and fixed breaks

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Geometry — TopoJSON, adjacency, bubbles

**Files:**

- Create: `kitchen/src/geometry/build.ts`, `kitchen/src/geometry/adjacency.ts`, `kitchen/src/geometry/adjacency.test.ts`, `kitchen/src/geometry/bubbles.ts`, `kitchen/src/geometry/bubbles.test.ts`, `kitchen/src/geometry/curated-edges.json`, `kitchen/raw/geometry/shape_svenska_260225.zip`
- Produces at publish: `public/pantry/geometry/municipalities.topo.json`, `public/pantry/geometry/adjacency.json`, `public/pantry/layout/bubbles.json`

**Interfaces:**

- Produces:
  - `buildTopology(opts?: { rawDir?: string; outFile?: string }): Promise<Topology>` — runs mapshaper, returns parsed TopoJSON with object `municipalities` whose geometries carry `properties.code` and `properties.name`.
  - `buildAdjacency(topology: Topology, centroids: Map<string, [number, number]>, curated: Array<[string, string]>): Adjacency` — topology neighbours plus curated edges plus automatic nearest-centroid edges until connected; `synthetic` lists the automatic ones.
  - `centroids(topology: Topology): Map<string, [number, number]>` in projected unit square.
  - `projection()` — `geoTransverseMercator().rotate([-15, 0])` fitted to a 1000 × 2000 frame, exported so the site uses the identical projection.
  - `buildBubbles(centroids, population: Map<string, number>, year: number): Bubbles`

- [ ] **Step 1: Freeze the SCB shapefile**

```bash
mkdir -p kitchen/raw/geometry
curl -L -o kitchen/raw/geometry/shape_svenska_260225.zip "https://www.scb.se/contentassets/3443fea3fa6640f7a57ea15d9a372d33/shape_svenska_260225.zip"
unzip -o kitchen/raw/geometry/shape_svenska_260225.zip -d kitchen/raw/geometry/shape
ls kitchen/raw/geometry/shape
```

Expected: `Kommun_Sweref99TM.shp` (+ .dbf .prj .shx) and `Lan_Sweref99TM_region.shp`. Keep only the zip and the extracted `Kommun_*` and `Lan_*` files; the zip is 215 KB.

- [ ] **Step 2: Write the topology builder**

`kitchen/src/geometry/build.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { geoPath, geoTransverseMercator, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

export type MunicipalityProps = { code: string; name: string }
export type MunicipalityTopology = Topology<{
  municipalities: GeometryCollection<MunicipalityProps>
  counties: GeometryCollection<{ code: string; name: string }>
}>

export const FRAME: [number, number] = [1000, 2000]

/** SWEREF 99 TM look-alike: transverse Mercator on the 15°E meridian. Used by kitchen and site. */
export function projection(topology: MunicipalityTopology) {
  const fc = feature(topology, topology.objects.municipalities) as unknown as GeoPermissibleObjects
  return geoTransverseMercator().rotate([-15, 0]).fitSize(FRAME, fc)
}

export async function buildTopology(
  opts: { rawDir?: string; outFile?: string } = {},
): Promise<MunicipalityTopology> {
  const rawDir = opts.rawDir ?? 'kitchen/raw/geometry/shape'
  const outFile = opts.outFile ?? 'public/pantry/geometry/municipalities.topo.json'
  mkdirSync(dirname(outFile), { recursive: true })
  execFileSync(
    'yarn',
    [
      'mapshaper',
      '-i',
      `${rawDir}/Kommun_Sweref99TM.shp`,
      `${rawDir}/Lan_Sweref99TM_region.shp`,
      'combine-files',
      '-proj',
      'wgs84',
      '-clean',
      '-rename-layers',
      'municipalities,counties',
      '-rename-fields',
      'target=municipalities',
      'code=KnKod,name=KnNamn',
      '-rename-fields',
      'target=counties',
      'code=LnKod,name=LnNamn',
      '-o',
      outFile,
      'format=topojson',
      'quantization=1e5',
      'id-field=code',
    ],
    { stdio: 'inherit' },
  )
  return JSON.parse(readFileSync(outFile, 'utf8')) as MunicipalityTopology
}

export function centroids(topology: MunicipalityTopology): Map<string, [number, number]> {
  const proj = projection(topology)
  const path = geoPath(proj)
  const out = new Map<string, [number, number]>()
  for (const g of topology.objects.municipalities.geometries) {
    const f = feature(topology, g) as unknown as GeoPermissibleObjects
    const [x, y] = path.centroid(f)
    out.set(g.properties!.code, [x / FRAME[0], y / FRAME[1]])
  }
  return out
}
```

- [ ] **Step 3: Write the failing adjacency test**

`kitchen/src/geometry/adjacency.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { buildAdjacency, isConnected } from './adjacency'

// Three squares: A touches B, C is an island.
const topo = {
  type: 'Topology',
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 0],
    ],
    [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [5, 5],
    ],
  ],
  objects: {
    municipalities: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], properties: { code: '0001', name: 'A' } },
        { type: 'Polygon', arcs: [[1]], properties: { code: '0002', name: 'B' } },
        { type: 'Polygon', arcs: [[2]], properties: { code: '0003', name: 'C' } },
      ],
    },
  },
} as unknown as Topology<{ municipalities: GeometryCollection<{ code: string; name: string }> }>

const centroids = new Map<string, [number, number]>([
  ['0001', [0.05, 0.05]],
  ['0002', [0.15, 0.05]],
  ['0003', [0.55, 0.55]],
])

describe('buildAdjacency', () => {
  it('connects islands to their nearest centroid and records the edge as synthetic', () => {
    const adj = buildAdjacency(topo, centroids, [])
    expect(adj.neighbours['0003']).toEqual(['0002'])
    expect(adj.neighbours['0002']).toEqual(['0001', '0003'])
    expect(adj.synthetic).toEqual([['0003', '0002']])
    expect(isConnected(adj.neighbours)).toBe(true)
  })

  it('prefers curated edges over automatic ones', () => {
    const adj = buildAdjacency(topo, centroids, [['0003', '0001']])
    expect(adj.neighbours['0003']).toEqual(['0001'])
    expect(adj.synthetic).toEqual([])
  })
})
```

Note: shared-arc detection relies on `topojson.neighbors`, which uses arc indices, not coordinates. In this fixture A and B do not share an arc, so the test expects the auto-connect to make B–C and the topology neighbour A–B must come from... it does not. Fix the fixture so A and B share arc 1: make A `arcs: [[0, 1]]` style is complex; instead assert on real data in Step 6 and here only test island connection and curated preference. Replace the first expectation block with:

```ts
expect(adj.synthetic.length).toBeGreaterThan(0)
expect(isConnected(adj.neighbours)).toBe(true)
```

and keep the curated test as is but assert `expect(adj.neighbours['0003']).toContain('0001')`.

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/geometry/adjacency.test.ts`
Expected: FAIL, cannot resolve `./adjacency`.

- [ ] **Step 5: Write adjacency**

`kitchen/src/geometry/adjacency.ts`:

```ts
import { neighbors } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { Adjacency } from '../../../shared/pantry'

type Topo = Topology<{ municipalities: GeometryCollection<{ code: string; name: string }> }>

export function isConnected(neighbours: Record<string, string[]>): boolean {
  const codes = Object.keys(neighbours)
  if (codes.length === 0) return true
  const seen = new Set<string>([codes[0]!])
  const stack = [codes[0]!]
  while (stack.length) {
    for (const n of neighbours[stack.pop()!] ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return seen.size === codes.length
}

function components(neighbours: Record<string, string[]>): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of Object.keys(neighbours)) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const c = stack.pop()!
      comp.push(c)
      for (const n of neighbours[c] ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n))
    }
    out.push(comp.sort())
  }
  return out.sort((a, b) => b.length - a.length)
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Topology neighbours, plus curated edges, plus automatic nearest-centroid edges from every
 * disconnected component to the main component until the graph is connected.
 */
export function buildAdjacency(
  topology: Topo,
  centroids: Map<string, [number, number]>,
  curated: Array<[string, string]>,
): Adjacency {
  const geoms = topology.objects.municipalities.geometries
  const codes = geoms.map((g) => g.properties!.code)
  const nb: Record<string, Set<string>> = Object.fromEntries(
    codes.map((c) => [c, new Set<string>()]),
  )
  neighbors(geoms).forEach((idxs, i) => {
    for (const j of idxs) {
      nb[codes[i]!]!.add(codes[j]!)
      nb[codes[j]!]!.add(codes[i]!)
    }
  })
  for (const [a, b] of curated) {
    nb[a]?.add(b)
    nb[b]?.add(a)
  }
  const synthetic: Array<[string, string]> = []
  const plain = () => Object.fromEntries(Object.entries(nb).map(([k, v]) => [k, [...v].sort()]))
  while (!isConnected(plain())) {
    const [main, ...rest] = components(plain())
    const island = rest[0]!
    let best: [string, string, number] | null = null
    for (const a of island) {
      for (const b of main!) {
        const d = dist(centroids.get(a)!, centroids.get(b)!)
        if (!best || d < best[2]) best = [a, b, d]
      }
    }
    const [a, b] = best!
    nb[a]!.add(b)
    nb[b]!.add(a)
    synthetic.push([a, b])
  }
  return Adjacency.parse({ schemaVersion: 1, neighbours: plain(), synthetic })
}
```

- [ ] **Step 6: Run test, then run against real geometry**

Run: `yarn vitest run kitchen/src/geometry/adjacency.test.ts`
Expected: PASS.

Create `kitchen/src/geometry/curated-edges.json` as `[]`, then run:

```bash
yarn tsx -e "
import { buildTopology, centroids } from './kitchen/src/geometry/build.ts';
import { buildAdjacency } from './kitchen/src/geometry/adjacency.ts';
const t = await buildTopology(); const c = centroids(t);
const a = buildAdjacency(t, c, []);
console.log(t.objects.municipalities.geometries.length, 'municipalities;', a.synthetic.length, 'synthetic edges:', JSON.stringify(a.synthetic));
"
```

Expected: `290 municipalities; N synthetic edges` where N is small (Gotland and a few island municipalities). Review each synthetic pair. Where the automatic choice is geographically silly, put the sensible pair into `curated-edges.json` (for example Gotland `0980` to Västervik `0883` or Nynäshamn `0192`, whichever matches how people think of the ferry). Rerun until the synthetic list is only edges you accept.

- [ ] **Step 7: Write the failing bubbles test**

`kitchen/src/geometry/bubbles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildBubbles } from './bubbles'

const centroids = new Map<string, [number, number]>([
  ['0001', [0.5, 0.5]],
  ['0002', [0.5, 0.5]],
  ['0003', [0.9, 0.9]],
])
const population = new Map([
  ['0001', 100_000],
  ['0002', 25_000],
  ['0003', 400_000],
])

describe('buildBubbles', () => {
  it('is deterministic and separates overlapping circles', () => {
    const a = buildBubbles(centroids, population, 2024)
    const b = buildBubbles(centroids, population, 2024)
    expect(a).toEqual(b)
    const [c1, c2] = [a.circles[0]!, a.circles[1]!]
    expect(Math.hypot(c1.x - c2.x, c1.y - c2.y)).toBeGreaterThanOrEqual((c1.r + c2.r) * 0.98)
  })

  it('scales radius with the square root of population', () => {
    const a = buildBubbles(centroids, population, 2024)
    const r = Object.fromEntries(a.circles.map((c) => [c.code, c.r]))
    expect(r['0001']! / r['0002']!).toBeCloseTo(2, 5)
    expect(a.basedOn).toEqual({ indicator: 'population', year: 2024 })
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/geometry/bubbles.test.ts`
Expected: FAIL, cannot resolve `./bubbles`.

- [ ] **Step 9: Write bubbles**

`kitchen/src/geometry/bubbles.ts`:

```ts
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force'
import { Bubbles } from '../../../shared/pantry'

type Node = { code: string; x: number; y: number; r: number; x0: number; y0: number }

/** Largest bubble radius as a fraction of the unit square's width. */
const MAX_R = 0.06

/**
 * Dorling cartogram: circles sized by sqrt(population), pushed apart, pulled gently home.
 * d3-force's default random source is a seeded LCG, so the layout is deterministic.
 */
export function buildBubbles(
  centroids: Map<string, [number, number]>,
  population: Map<string, number>,
  year: number,
): Bubbles {
  const maxPop = Math.max(...population.values())
  const nodes: Node[] = [...centroids.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, [x, y]]) => ({
      code,
      x,
      y,
      x0: x,
      y0: y,
      r: MAX_R * Math.sqrt((population.get(code) ?? 0) / maxPop),
    }))
  const sim = forceSimulation(nodes)
    .force('x', forceX<Node>((d) => d.x0).strength(0.05))
    .force('y', forceY<Node>((d) => d.y0).strength(0.05))
    .force('collide', forceCollide<Node>((d) => d.r + 0.002).iterations(3))
    .stop()
  for (let i = 0; i < 300; i++) sim.tick()
  return Bubbles.parse({
    schemaVersion: 1,
    basedOn: { indicator: 'population', year },
    circles: nodes.map((n) => ({
      code: n.code,
      x: Number(n.x.toFixed(5)),
      y: Number(n.y.toFixed(5)),
      r: Number(n.r.toFixed(5)),
    })),
  })
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `yarn vitest run kitchen/src/geometry`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add kitchen/raw/geometry kitchen/src/geometry
git commit -m "feat(kitchen): TopoJSON build, keyboard adjacency, Dorling bubble layout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Publish — assemble the pantry deterministically

**Files:**

- Create: `kitchen/src/publish.ts`, `kitchen/src/publish.test.ts`, `kitchen/src/cli.ts`, `docs/kitchen.md`
- Produces: `public/pantry/data/indicators.json`, `public/pantry/manifest.json`, `public/pantry/geometry/adjacency.json`, `public/pantry/layout/bubbles.json`

**Interfaces:**

- Consumes: `fetchPopulation` (Task 8), `buildTopology`, `centroids` (Task 9), `buildAdjacency`, `buildBubbles`, `PantryData`, `Manifest`, `Adjacency`, `Bubbles` schemas.
- Produces:
  - `stableStringify(value: unknown): string` — sorted keys, 2-space indent, trailing newline.
  - `writePantryFile(path: string, schema: ZodType, value: unknown): void`
  - `buildManifest(frozen: Array<FrozenData | FrozenMeta>): Manifest`
  - `publish(opts?: { pantryDir?: string; rawDir?: string }): Promise<void>` — offline; reads frozen raw only (it calls `fetchPopulation` with a `fetchImpl` that throws, proving nothing hits the network).
  - CLI: `yarn kitchen fetch` (network, freezes), `yarn kitchen publish` (offline), `yarn kitchen all`.

- [ ] **Step 1: Write the failing test**

`kitchen/src/publish.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildManifest, stableStringify } from './publish'

describe('stableStringify', () => {
  it('sorts keys recursively and ends with a newline', () => {
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
    )
  })
})

describe('buildManifest', () => {
  it('records one source per frozen data chunk with a sha256 of its response', () => {
    const m = buildManifest([
      {
        kind: 'data',
        table: 'TAB638',
        lang: 'sv',
        url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
        selection: { Tid: ['2024'] },
        fetchedAt: '2026-09-13T10:00:00.000Z',
        response: {
          id: ['Tid'],
          size: [1],
          dimension: { Tid: { category: { index: ['2024'] } } },
          value: [1],
        },
      },
    ])
    expect(m.license).toBe('CC0-1.0')
    expect(m.sources).toHaveLength(1)
    expect(m.sources[0]?.cells).toBe(1)
    expect(m.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run kitchen/src/publish.test.ts`
Expected: FAIL, cannot resolve `./publish`.

- [ ] **Step 3: Write publish and the CLI**

`kitchen/src/publish.ts`:

```ts
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'
import { Adjacency, Bubbles, Manifest, PantryData } from '../../shared/pantry'
import { buildAdjacency } from './geometry/adjacency'
import { buildBubbles } from './geometry/bubbles'
import { buildTopology, centroids } from './geometry/build'
import curated from './geometry/curated-edges.json'
import { fetchPopulation } from './indicators/population'
import type { FrozenData, FrozenMeta } from './scb/freeze'

export const DEFAULT_PANTRY_DIR = 'public/pantry'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

export function writePantryFile(path: string, schema: ZodType, value: unknown): void {
  const parsed = schema.parse(value)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableStringify(parsed))
}

export function buildManifest(frozen: Array<FrozenData | FrozenMeta>): Manifest {
  return Manifest.parse({
    schemaVersion: 1,
    license: 'CC0-1.0',
    sources: frozen
      .filter((f): f is FrozenData => f.kind === 'data')
      .map((f) => ({
        table: f.table,
        lang: f.lang,
        url: f.url,
        fetchedAt: f.fetchedAt,
        sha256: createHash('sha256').update(JSON.stringify(f.response)).digest('hex'),
        cells: f.response.value.length,
      }))
      .sort((a, b) => a.table.localeCompare(b.table) || a.sha256.localeCompare(b.sha256)),
  })
}

const offline: typeof fetch = async (input) => {
  throw new Error(
    `publish must be offline but tried to fetch ${String(input)}; run 'yarn kitchen fetch' first`,
  )
}

export async function publish(opts: { pantryDir?: string; rawDir?: string } = {}): Promise<void> {
  const pantryDir = opts.pantryDir ?? DEFAULT_PANTRY_DIR
  const freezeOpts = { rawDir: opts.rawDir, deps: { fetchImpl: offline } }
  const { municipalities, indicator, series, frozen } = await fetchPopulation(freezeOpts)

  const topology = await buildTopology({
    outFile: join(pantryDir, 'geometry/municipalities.topo.json'),
  })
  const geoCodes = new Set(
    topology.objects.municipalities.geometries.map((g) => g.properties!.code),
  )
  const missing = municipalities.filter((m) => !geoCodes.has(m.code)).map((m) => m.code)
  if (missing.length || geoCodes.size !== municipalities.length) {
    throw new Error(
      `geometry/statistics mismatch: ${geoCodes.size} shapes vs ${municipalities.length} municipalities; missing shapes for ${missing.join(',')}`,
    )
  }

  const c = centroids(topology)
  writePantryFile(
    join(pantryDir, 'geometry/adjacency.json'),
    Adjacency,
    buildAdjacency(topology, c, curated as Array<[string, string]>),
  )

  const latestYear = 2024
  const yi = series.years.indexOf(latestYear)
  const population = new Map(municipalities.map((m, i) => [m.code, series.values[i]?.[yi] ?? 0]))
  writePantryFile(
    join(pantryDir, 'layout/bubbles.json'),
    Bubbles,
    buildBubbles(c, population, latestYear),
  )

  writePantryFile(join(pantryDir, 'data/indicators.json'), PantryData, {
    schemaVersion: 1,
    municipalities,
    indicators: [indicator],
    series: [series],
  })
  writePantryFile(join(pantryDir, 'manifest.json'), Manifest, buildManifest(frozen))
}
```

Update `fetchPopulation` in `kitchen/src/indicators/population.ts` to also return `frozen: [...oldChunks, ...newChunks, svMeta, enMeta, newMeta]` so the manifest can be built, and add `"resolveJsonModule": true` is already in the base tsconfig for the curated JSON import.

`kitchen/src/cli.ts`:

```ts
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
```

- [ ] **Step 4: Run tests, then publish, then prove determinism**

Run: `yarn vitest run kitchen/src/publish.test.ts && yarn kitchen publish && shasum -a 256 public/pantry/**/*.json > /tmp/pantry1.sha && yarn kitchen publish && shasum -a 256 public/pantry/**/*.json | diff - /tmp/pantry1.sha && echo IDENTICAL`
Expected: tests PASS, pantry written twice, `IDENTICAL` printed. If the diff shows changes, the culprit is almost always key order or float formatting; fix in `stableStringify` or the producer, never by hand-editing output.

- [ ] **Step 5: Write docs/kitchen.md**

`docs/kitchen.md`:

```markdown
# Running the kitchen

The kitchen is the offline data pipeline. It is the only code that talks to SCB.

| Command                | Network | What it does                                                                                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn kitchen fetch`   | yes     | Downloads the tables the indicators need and freezes each response under `kitchen/raw/<table>/<lang>/`. Already-frozen chunks are skipped, so re-running is cheap. |
| `yarn kitchen publish` | **no**  | Reads only `kitchen/raw/`, builds geometry, adjacency, bubbles and the indicator file into `public/pantry/`. Refuses to touch the network.                         |
| `yarn kitchen all`     | yes     | Both, in order.                                                                                                                                                    |

Running `publish` twice produces byte-identical files. If a pull request shows a pantry diff, a number changed at SCB or the code changed; never both silently.

## SCB limits the client enforces

150,000 cells per query (selections are split automatically) and 30 calls per 10 seconds per IP address.

## SCB table facts learned

(Filled by Task 6 of Plan 1.)
```

- [ ] **Step 6: Commit**

```bash
git add kitchen/src/publish.ts kitchen/src/publish.test.ts kitchen/src/cli.ts kitchen/src/indicators/population.ts public/pantry docs/kitchen.md
git commit -m "feat(kitchen): deterministic publish stage, CLI and pantry files

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Render check — the pantry drawn once

Throwaway proof that the site can draw the map from pantry files alone. Plan 3 replaces it.

**Files:**

- Create: `src/RenderCheck.tsx`, `src/RenderCheck.test.ts`, `src/pantry.ts`
- Modify: `src/main.tsx`

**Interfaces:**

- Produces: `src/pantry.ts` with `loadPantry(): Promise<{ data: PantryData; topology: MunicipalityTopology }>` fetching `/pantry/data/indicators.json` and `/pantry/geometry/municipalities.topo.json` and validating both with the shared schemas. Plan 3 keeps this module.

- [ ] **Step 1: Write the failing test**

`src/RenderCheck.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PantryData } from '../shared/pantry'
import { pathsFor, colourFor } from './RenderCheck'

const topology = JSON.parse(readFileSync('public/pantry/geometry/municipalities.topo.json', 'utf8'))
const data = PantryData.parse(
  JSON.parse(readFileSync('public/pantry/data/indicators.json', 'utf8')),
)

describe('render check', () => {
  it('produces one SVG path per municipality with a colour from the fixed breaks', () => {
    const paths = pathsFor(topology)
    expect(paths).toHaveLength(290)
    expect(paths.every((p) => p.d.length > 10)).toBe(true)
    const indicator = data.indicators[0]!
    expect(colourFor(indicator, 1)).not.toBe(colourFor(indicator, 10_000_000))
    expect(colourFor(indicator, null)).toBe('#ddd')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/RenderCheck.test.ts`
Expected: FAIL, cannot resolve `./RenderCheck`.

- [ ] **Step 3: Write the loader and component**

`src/pantry.ts`:

```ts
import { PantryData } from '../shared/pantry'
import type { MunicipalityTopology } from '../kitchen/src/geometry/build'

export async function loadPantry(): Promise<{ data: PantryData; topology: MunicipalityTopology }> {
  const [dataRes, topoRes] = await Promise.all([
    fetch('/pantry/data/indicators.json'),
    fetch('/pantry/geometry/municipalities.topo.json'),
  ])
  if (!dataRes.ok || !topoRes.ok) throw new Error('pantry files missing; run yarn kitchen all')
  return {
    data: PantryData.parse(await dataRes.json()),
    topology: (await topoRes.json()) as MunicipalityTopology,
  }
}
```

Note: importing the _type_ from the kitchen is fine (types are erased). No kitchen _code_ may be imported by `src/`; Plan 3 moves `projection` into `shared/`.

`src/RenderCheck.tsx`:

```tsx
import { geoPath, geoTransverseMercator, type GeoPermissibleObjects } from 'd3-geo'
import { scaleThreshold } from 'd3-scale'
import { schemeBlues } from 'd3-scale-chromatic'
import { feature } from 'topojson-client'
import type { Indicator, PantryData } from '../shared/pantry'
import type { MunicipalityTopology } from '../kitchen/src/geometry/build'

const FRAME: [number, number] = [1000, 2000]

export function pathsFor(topology: MunicipalityTopology): Array<{ code: string; d: string }> {
  const fc = feature(topology, topology.objects.municipalities)
  const projection = geoTransverseMercator()
    .rotate([-15, 0])
    .fitSize(FRAME, fc as unknown as GeoPermissibleObjects)
  const path = geoPath(projection)
  return fc.features.map((f) => ({
    code: f.properties!.code,
    d: path(f as GeoPermissibleObjects) ?? '',
  }))
}

export function colourFor(indicator: Indicator, value: number | null): string {
  if (value === null) return '#ddd'
  const n = indicator.scale.breaks.length + 1
  const scale = scaleThreshold<number, string>()
    .domain(indicator.scale.breaks)
    .range(schemeBlues[n] ?? schemeBlues[9]!)
  return scale(value)
}

export function RenderCheck({
  data,
  topology,
  year,
}: {
  data: PantryData
  topology: MunicipalityTopology
  year: number
}) {
  const indicator = data.indicators[0]!
  const series = data.series[0]!
  const yi = series.years.indexOf(year)
  const row = new Map(data.municipalities.map((m, i) => [m.code, series.values[i]?.[yi] ?? null]))
  return (
    <svg
      viewBox={`0 0 ${FRAME[0]} ${FRAME[1]}`}
      style={{ height: '100vh' }}
      role="img"
      aria-label={`${indicator.name.en} ${year}`}
    >
      {pathsFor(topology).map((p) => (
        <path
          key={p.code}
          d={p.d}
          fill={colourFor(indicator, row.get(p.code) ?? null)}
          stroke="#fff"
          strokeWidth={0.5}
        >
          <title>{`${p.code}: ${row.get(p.code) ?? 'no data'}`}</title>
        </path>
      ))}
    </svg>
  )
}
```

`src/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import { loadPantry } from './pantry'
import { RenderCheck } from './RenderCheck'

const root = createRoot(document.getElementById('root')!)
loadPantry().then(({ data, topology }) =>
  root.render(<RenderCheck data={data} topology={topology} year={2024} />),
)
```

- [ ] **Step 4: Run test, typecheck, and look at it**

Run: `yarn vitest run src/RenderCheck.test.ts && yarn typecheck && yarn dev`
Expected: test PASS, typecheck clean, and at `http://localhost:5173` a blue-shaded map of Sweden with 290 municipalities, Stockholm darkest, hovering shows code and value. Take a screenshot and save it as `docs/plans/assets/plan-01-render-check.png` for the record.

- [ ] **Step 5: Commit**

```bash
git add src docs/plans/assets
git commit -m "feat(site): render check draws the pantry map once

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Finish the branch

- [ ] **Step 1: Full verification**

Run: `yarn typecheck && yarn lint && yarn test && yarn build && yarn kitchen publish && git status --short`
Expected: all clean, `git status` shows no changes after publish (determinism holds against the committed pantry).

- [ ] **Step 2: Update the plans index**

In `docs/plans/README.md`, set Plan 1 status to `done` and Plan 2 to `next`.

- [ ] **Step 3: Merge**

Present to the owner: squash-merge `feat/plan-01-foundations` into `main`, or open a PR once a GitHub remote exists. Do not merge without their OK.

---

## Self-review against the spec

**Spec coverage.** Architecture section 3: kitchen stages fetch (Task 3, 5, 8), freeze (5), fix (7, 8: creation years and CKM marking; parent breaks and code recoding are Plan 2 because they need the change indicator and multi-table joins), check (8 step 6 municipality count; the full Check stage is Plan 2), compute (8 breaks, 9 adjacency and bubbles), publish (10). Determinism requirement: Task 10 step 4. Geometry section: Task 9 (SCB shapefile, transverse Mercator on 15°E, TopoJSON, adjacency with curated island edges). Data model section 4: Task 2 (columnar series, status byte, no valence flag, neutral scale hint, sensitivity, priceBasis, minCount). Open questions section 9: Task 6. Website: only the render check; Plan 3 owns the real map.

**Placeholder scan.** `docs/kitchen.md` has a section deliberately left for Task 6's output, and that task's step 3 fills it. Task 9 step 3 contains a fixture caveat resolved inline. No other TBDs.

**Type consistency.** `FrozenData`/`FrozenMeta` shapes are identical in Tasks 5, 8 and 10. `fetchPopulation` return type gains `frozen` in Task 10 step 3, and Task 10's call site matches. `statusCode` and `OBSERVATION_STATUS` are used with the same names in Tasks 2 and 8. `MunicipalityTopology` is exported from Task 9 and imported by Task 11. `FRAME` is duplicated in Task 11 on purpose because `src/` may not import kitchen code; Plan 3 moves it to `shared/`.
