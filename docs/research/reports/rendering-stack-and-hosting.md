# Stack & Hosting Research — Sweden municipality map app (zero-cost, static)

Researched 2026-09-10. Versions from the npm registry (`npm view`, same day). Bundle sizes: bundlephobia API where it answered, otherwise measured locally with esbuild (`--bundle --minify --format=esm`, gzip -9) on 2026-09-10 — marked "(measured)". Anything I could not confirm from a primary source is marked **UNVERIFIED**.

---

## TOPIC A — Rendering technology

### 1. D3 (SVG vs Canvas)

- **Versions:** `d3` 7.9.0 (published 2024-03-12, ISC); `d3-geo` 3.1.1, `d3-selection` 3.0.0, `d3-transition` 3.0.1, `d3-interpolate` 3.0.1. Stable, no v8 in sight.
- **Tree-shaken size (measured):** `d3-geo + d3-selection + d3-transition + d3-interpolate + d3-scale + d3-scale-chromatic + topojson-client` = **73 KB min / 27 KB gzip**. Full `import * as d3` = 277 KB / 93 KB gzip. Import modules individually.
- **SVG at this scale:** 290 municipality `<path>`s + 21 county outlines ≈ 311 DOM nodes — trivial. ~6,000 DeSO paths in SVG renders fine statically; the cost appears when you restyle/transition thousands of nodes per frame or re-bind on every hover (assessment, consistent with the freeCodeCamp/D3-canvas guidance that "several thousand elements" is where SVG "may start to struggle" and Canvas "can achieve impressive performance with tens of thousands of data points" — https://www.freecodecamp.org/news/d3-and-canvas-in-3-steps-8505c8b27444/).
- **Canvas hit-testing:** no DOM, so you need either (a) the hidden-canvas colour-picking technique — draw each feature in a unique colour on an offscreen canvas, `getImageData()` under the cursor, map colour→datum (same article), or (b) geometric test with `CanvasRenderingContext2D.isPointInPath`/`Path2D` per feature, or `d3.geoContains` on unprojected coords. Both are extra code you don't write with SVG.
- **Accessibility:** SVG nodes can carry `role`, `aria-label`, `tabindex`, `<title>/<desc>`; SVG 2 adopts HTML's tabindex/focus model (W3C wiki: https://www.w3.org/wiki/SVG_Accessibility/Navigation; SVG-AAM: https://www.w3.org/TR/svg-aam-1.0/). Canvas: MDN — "Canvas content is not exposed to accessibility tools as semantic HTML is. In general, you should avoid using canvas in an accessible website or app." (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas). A Canvas map therefore needs a parallel HTML/ARIA structure (see Data Navigator, §8).
- **Animation/morphing:** `d3-transition` + `d3-interpolate` interpolate paths only when point counts match; for arbitrary shape morphing use **flubber** 0.4.2 (MIT, last publish 2022-06, 52 KB min / 18 KB gzip measured). Flubber README goal: "a best-guess interpolation for any two arbitrary shapes … that results in a reasonably smooth animation"; open TODO: "Deal with holes?" — relevant because many Swedish coastal municipalities are multipolygons (use `separate`/`combine`/`interpolateAll`, or morph the largest ring only). https://github.com/veltman/flubber

### 2. Observable Plot

- **Version** 0.6.17 (2026-04-06, ISC). Still 0.x. Full import **384 KB min / 130 KB gzip (measured; includes its D3 dependencies)** — it bundles D3 internally, so pairing Plot with your own D3 map shares code only if the bundler dedupes matching `d3-*` versions.
- **Geo:** `Plot.geo` "draws geographic features — polygons, lines, points, and other geometry — often as thematic maps" and "works with Plot's projection system"; choropleth via the `fill` channel. Tooltips: "when you use the **tip** option, the centroid transform is implicitly applied on the geometries to compute the tip position". https://observablehq.com/plot/marks/geo
- **Interaction:** `pointer`/`pointerX`/`pointerY` transforms — "only focuses the closest point if it is within 40 pixels of the pointer" (default `maxRadius`). No transitions/animation; re-render on data change. https://observablehq.com/plot/interactions/pointer
- **React fit:** docs recommend `useRef` + `useEffect`, and to update "simply throw away the old plot using *element*.remove and then replace it with a new one"; SSR/virtual-DOM via the `document` option. https://observablehq.com/plot/getting-started
- **Verdict:** excellent for the *charts* (bars, lines, small multiples, faceting) with D3-identical scales/colour; not the right tool for a custom animated, keyboard-navigable map.

### 3. MapLibre GL JS

- **Version** 6.9.0 (published 2026-09-09; 6.0.0 on 2026-07-22). License **BSD-3-Clause** ("Copyright (c) 2023, MapLibre contributors"; includes Mapbox ≤v1.13 notice) https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt. Size (bundlephobia): **1,063 KB min / 283 KB gzip** — roughly 10× the D3 map stack.
- **GeoJSON only, no basemap, no cost:** yes. The style spec says "Except for layers of the `background` type, each layer needs to refer to a source" — so a style with a `background` layer plus a `geojson` source and `fill`/`line` layers is valid and fetches nothing external. https://maplibre.org/maplibre-style-spec/root/ . No key, no server, $0.
- **Free tile options (only if you want a basemap):**
  - **OpenFreeMap** — "completely free: there are no limits on the number of map views or requests"; no registration/API keys; commercial use "Yes" with attribution ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap"); funded by donations — "the plan is to keep renting servers until they cover the bandwidth". MIT code, weekly planet dumps for self-hosting. https://openfreemap.org/ . Risk: single volunteer-run service with no SLA.
  - **Protomaps PMTiles self-hosted** — planet "roughly 120 gigabytes, including zoom levels from 0 to 15"; "Each additional zoom level roughly doubles the size of the file"; tiles are ODbL Produced Work (OSM attribution). https://docs.protomaps.com/basemaps/downloads . Extract: `pmtiles extract INPUT OUTPUT --bbox=… --maxzoom=…` https://docs.protomaps.com/pmtiles/cli . **Sweden extract size: UNVERIFIED** — no published figure found (the "project-nomad-maps-europe" repo lists Sweden as "coming soon"; the only size datapoint in go-pmtiles #68 is US+Mexico z0–15 ≈ 17 GB). Measure with `pmtiles extract … --maxzoom=10` and a Sweden bbox (~10.5,55.0,24.2,69.1) before committing. Hosting: Protomaps docs — "GitHub pages supports repositories up to 1 GB. If your PMTiles file fits, it's an easy way to host." and "PMTiles is designed to work on any S3-compatible cloud storage platform that supports HTTP Range Requests"; Cloudflare R2 "recommended … because it does not have bandwidth fees". https://docs.protomaps.com/pmtiles/cloud-storage . **Cloudflare Pages is a problem:** docs say "Pages currently returns `200` responses for HTTP range requests; however, the team is working on adding spec-compliant `206` partial responses" (https://developers.cloudflare.com/pages/configuration/serving-pages/); the MapLibre demotiles site found "Cloudflare corrupts the HTTP Range responses `.pmtiles` files rely on" (issue opened 2026-06-08, worked around with R2 + Worker, https://github.com/maplibre/demotiles/issues/35); workers-sdk #3861 was closed "completed" 2026-04-15 with no resolution comment — treat 206 support on Pages/Workers static assets as **UNVERIFIED**. Also the **25 MiB per-file cap** applies.
  - **MapTiler Cloud Free:** "5k/month" map sessions, "100k/month" API requests, "Suitable for testing, personal or non-commercial use", "MapTiler logo on the map", API key required, "FREE plans do not require billing information". https://www.maptiler.com/cloud/pricing/ — **risk: key + non-commercial + quota.**
  - **Stadia Maps Free:** "200,000 credits/month", "Commercial use not allowed". https://stadiamaps.com/pricing/ — **risk.**
  - **Mapbox:** "Up to 50,000" web map loads/month, Vector Tiles API "Up to 200,000" requests free; access token required; card requirement **UNVERIFIED**. https://www.mapbox.com/pricing — **risk: token + overage billing.**

### 4. deck.gl / kepler.gl / Three.js / regl

- **deck.gl** 9.4.0 (2026-09-05, MIT): full package **1,996 KB min / 553 KB gzip**. Its own perf guide: basic layers render "fluidly at 60 FPS … up to about 1M (one million) data items", dropping to "10-20FPS when the data sets approach 10M". https://deck.gl/docs/developer-guide/performance . 290 or even 6,000 polygons is three to four orders of magnitude below where WebGL earns its bundle.
- **kepler.gl** 3.3.0-alpha.10 — a whole Redux app on deck.gl; not a library for this.
- **Three.js** 0.186.0 (181 KB gzip), **regl** 2.1.1 (37 KB gzip, last publish 2024-11).
- **Where WebGL is justified here:** only migration flow/particle animation with >~50–100k simultaneous particles. Canvas 2D comfortably animates a few thousand particles per frame (assessment). If you go there, regl or a raw WebGL2 shader is the small option; deck.gl's `ArcLayer`/`TripsLayer` are the batteries-included option at +550 KB.

### 5. Non-map charts (versions, gzip size, fit with a D3 map)

| Lib | Version | gzip | Paradigm | Fit |
|---|---|---|---|---|
| Observable Plot | 0.6.17 | 130 KB (measured, incl. D3) | SVG, declarative, D3 scales | **Best** — same colour/scale vocabulary as the map |
| visx | 4.0.0 (2026-06) | modular (UNVERIFIED total) | React components over d3-* primitives, SVG | **Good** if you want charts fully in JSX; shares d3-scale/d3-shape |
| Recharts | 3.10.1 | 148 KB (+Redux Toolkit, react-redux, immer deps) | React SVG | OK, heavier deps, less control |
| Nivo | @nivo/core 0.99.0 | 147 KB core + per-chart pkgs | React SVG/Canvas, react-spring | OK, opinionated theming |
| Vega-Lite | 6.4.3 | 87 KB + vega 6.4.0 178 KB | own runtime, Canvas/SVG | Duplicates a rendering paradigm |
| ECharts | 6.1.0 | 368 KB full (tree-shakable) | Canvas (zrender) | Duplicates paradigm; a11y weaker |

**Recommend:** Observable Plot for standard charts (fast to author, faceting, tooltips) or visx if you want everything React-declarative and typed; both reuse the `d3-scale`/`d3-scale-chromatic` instances your map uses so legends and colours stay consistent. Skip Vega/ECharts to avoid a second rendering engine.

### 6. In-browser data engines

- **DuckDB-WASM** `@duckdb/duckdb-wasm` latest tag 1.33.1-dev57.0 (MIT; dev tags on `latest`). WASM binaries on jsDelivr (measured 2026-09-10): `duckdb-eh.wasm` **35.9 MB**, `duckdb-mvp.wasm` 41.3 MB, `duckdb-coi.wasm` 35.6 MB uncompressed; users report "the current binary is 35mb which got squezed to 4.8 mb" with Brotli (2026-06-04) https://github.com/duckdb/duckdb-wasm/discussions/1469 . Note: **35.9 MB > Cloudflare's 25 MiB per-file limit** — you must load it from jsDelivr, not self-host on Pages/Workers. JS wrapper alone 45 KB gzip + apache-arrow.
- **Apache Arrow JS** 21.2.0 (Apache-2.0): 53 KB gzip. **hyparquet** 1.30.0 (MIT): **18.8 KB gzip, zero deps** — reads Parquet in the browser without WASM. **parquet-wasm** 0.7.2 (MIT/Apache).
- **When justified:** 290 × 50 × 50 ≈ **725k cells** ≈ 3–6 MB as JSON, <1 MB as columnar typed arrays or Parquet (zstd) — plain columnar JSON or Parquet via hyparquet is the right call; DuckDB is not (5–10 MB download to query 725k numbers). DeSO-scale (6k × 50 × 50 ≈ 15M cells) with *user-driven ad-hoc* aggregation is where DuckDB-WASM starts to pay for itself; even then, precomputing aggregates at build time and shipping per-indicator Parquet/Arrow files is cheaper for a static site.

### 7. Cartogram / hex tooling

- **cartogram-chart** 1.4.4 (MIT, 2025-03) — contiguous (Dougenik) cartogram from TopoJSON; **topogram** 1.0.1 (MIT, 2022) — same algorithm, older. https://www.npmjs.com/package/cartogram-chart
- **Dorling:** `d3-force` with `forceCollide` + weak `forceX/forceY` toward true centroids (Observable examples: https://observablehq.com/@joewdavies/dorling-cartogram-configuration , https://observablehq.com/@observablehq/dorling-cartograms-in-plot-with-d3-force). No extra dependency.
- **Hex tile maps:** `d3-hexbin` 0.2.2 (BSD-3; ~1 KB) is for *binning points*, not tile maps. For a UK-style hex tile map use the ODI **HexJSON** format + **d3-hexjson** (BSD-3; `renderHexJSON`, `getGridForHexJSON`, boundary helpers) https://github.com/olihawkins/d3-hexjson ; layout the 290 hexes by hand/heuristic once at build time. (open-innovations.org returned 403 — HexJSON spec page **UNVERIFIED** this session.) `d3-hexgrid` (larsvers) for filled-hex grids.
- **Morphing real map ↔ cartogram:** flubber `interpolateAll` between the projected path strings; precompute both geometries at build time.

### 8. Accessibility references (interactive maps/charts)

- **W3C WAI, Complex images tutorial** — "a two-part text alternative is required": short description + long description (data table) via adjacent link, `<figure>/<figcaption>` or `aria-describedby`. https://www.w3.org/WAI/tutorials/images/complex/ (W3C has no separate "Charts" tutorial; this is the one.)
- **Chartability** (Frank Elavsky) — "a lightweight, high-level audit for catching data experience design failures related to accessibility"; 50 heuristics across 7 principles (Perceivable, Operable, Understandable, Robust, Compromising, Assistive, Flexible), 14 critical. https://chartability.github.io/POUR-CAF/
- **Data Navigator** (CMU DIG / Elavsky, MIT) — "enables keyboard, screen reader, and multi-modal navigation of data structures and visualizations" and "works with any rendering technology — SVG, Canvas, images, or WebGL" — the practical way to make a choropleth keyboard-navigable (arrow keys between neighbouring municipalities, up to county). https://github.com/cmudig/data-navigator
- **W3C SVG Accessibility/Navigation** (tabindex model, arrow keys within groups) https://www.w3.org/wiki/SVG_Accessibility/Navigation ; **SVG-AAM** https://www.w3.org/TR/svg-aam-1.0/
- **Highcharts** accessibility module (keyboard nav, screen-reader region) and `sonification.js` as prior art: https://www.highcharts.com/docs/accessibility/accessibility-module , https://www.highcharts.com/docs/sonification/getting-started . **License trap:** free only for personal/educational non-commercial use under the EULA; commercial license otherwise (https://www.highcharts.com/blog/news/our-new-eula-makes-free-usage-clearer/). Use as reference, not dependency. Sonification for D3 can be done with Web Audio + `d3-scale` in <100 lines.

### Decision matrix — map rendering (1 = poor, 5 = excellent)

| Criterion | SVG + D3 | Canvas + D3 | MapLibre + own GeoJSON | MapLibre + tiles | deck.gl |
|---|---|---|---|---|---|
| Zero-cost safety | 5 (no services) | 5 | 5 (no tiles, no key) | 2–4 (OpenFreeMap 4, self-host PMTiles 3, MapTiler/Stadia/Mapbox 2) | 5 |
| Accessibility | 5 (native DOM/ARIA/focus) | 2 (needs parallel HTML layer) | 2 (WebGL canvas) | 2 | 1–2 |
| Animation / morphing | 5 (d3-transition, flubber) | 4 (manual rAF, flubber OK) | 2 (feature-state + paint transitions; no shape morph) | 2 | 3 (layer transitions) |
| DeSO-scale perf (~6k polygons) | 3 (static OK; per-frame restyle heavy) | 5 | 5 | 5 | 5 |
| Dev complexity (React+TS) | 5 (low) | 3 (hit-testing, redraw mgmt) | 3 (style JSON, map lifecycle in React) | 2 (tiles pipeline, hosting caveats) | 2 (big API, 550 KB) |
| Portfolio impressiveness | 4 (craft shows in motion + a11y) | 4 | 3 (looks like every map app) | 4 (basemap polish) | 4 (only if flows/particles) |
| Bundle (gzip) | ~27 KB | ~27 KB | ~283 KB | ~283 KB + pmtiles 8 KB | ~553 KB |

**Recommendation:** SVG + D3 for the 290-municipality map (a11y and morphing are where it wins and where it will be judged). Add a Canvas layer (same projection) only for DeSO-level fills and for particle/flow animations; keep the SVG layer for outlines, focus rings and ARIA. Use MapLibre only if a basemap becomes a requirement, and then with OpenFreeMap tiles (no key) rather than a keyed provider. deck.gl is not justified.

---

## TOPIC B — Free hosting/CI and real limits (quotes, fetched 2026-09-10)

| Provider | Storage / files | Bandwidth | Builds | Functions | Commercial use | Other |
|---|---|---|---|---|---|---|
| **GitHub Pages** | "Published GitHub Pages sites may be no larger than 1 GB"; repo "recommended limit of 1 GB" | "*soft* bandwidth limit of 100 GB per month" | "*soft* limit of 10 builds per hour"; deploy timeout 10 min | none (static only) | "not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service" | Free plan: "GitHub Pages in public repositories" only (private needs Pro+). Gzip only — no Brotli (community discussion open since 2019, last confirmation 2024-06-14). Range requests: work per Protomaps docs. Custom domains: yes. |
| **Cloudflare Pages** | "maximum file size for a single Cloudflare Pages site asset is 25 MiB"; Free "up to 20,000 files"; 100 projects/account | "requests to static assets are free and unlimited" (no bandwidth cap stated) | Free: "500" builds/month | "Requests to your Pages Functions count towards your quota for the Workers Free plan … 100,000 daily request usage" | No non-commercial clause found in Pages/Workers docs (**UNVERIFIED** vs. legal text); 2023 ToS update explicitly moved the old §2.8 content restriction to CDN-only terms and named Pages/Workers/R2 as designed for non-HTML content | Docs: "Start new projects with Workers." Range requests "currently returns `200`" (see §3). Serves "Gzip and Brotli responses whenever possible". |
| **Cloudflare Workers static assets** | "25 MiB" per file, "20,000" files per version (Free); Worker 64 MiB | "Requests to static assets are free and unlimited" | Workers Builds Free: "3,000 per month" minutes, "1" concurrent, 20-min timeout | Free: "100,000/day", "10 ms" CPU per request | as above | Successor to Pages for new projects. |
| **Vercel Hobby** | 200 projects | "Fast Data Transfer — Up to 100 GB" (guideline); 1M edge requests | 100 deployments/day; 2 vCPU builds | 1M invocations, 4 CPU-hrs, 360 GB-hrs, 300 s max duration | **"Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan."** Commercial = "financial gain of **anyone** involved in **any part of the production** of the project, including a paid employee or consultant writing the code"; ads/AdSense count; "Asking for Donations **does not** fall under commercial usage." | Exceed a limit → "wait until 30 days have passed". A personal portfolio with no ads/payments is within the rules; a portfolio used to solicit consulting work is a grey zone — ask support. |
| **Netlify Free** | — | 1 GB = 20 credits → ~15 GB/month if all credits go to bandwidth | 1 production deploy = 15 credits → ~20 deploys/month | 1 GB-hr compute = 10 credits; 10k requests = 2 credits | none stated | **"300 credits/month with a hard limit"**, "no auto recharge option", "$0/month, forever". Old "100 GB / 300 build-minutes" model is gone for new accounts. Tightest of the four. |

**Details with sources**

9. **GitHub Pages** — limits https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ; plan availability https://docs.github.com/get-started/learning-about-github/githubs-products ; Brotli https://github.com/orgs/community/discussions/21655 ; range requests https://docs.protomaps.com/pmtiles/cloud-storage . No serverless.
10. **Cloudflare Pages / Workers** — https://developers.cloudflare.com/pages/platform/limits/ , https://developers.cloudflare.com/pages/functions/pricing/ , https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ , https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/ , https://blog.cloudflare.com/updated-tos/ .
11. **Vercel Hobby** — https://vercel.com/docs/plans/hobby (updated 2026-08-31), https://vercel.com/docs/limits/fair-use-guidelines (updated 2026-07-29).
12. **Netlify** — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ , https://www.netlify.com/pricing/ .
13. **GitHub Actions** — "GitHub Actions usage is **free** for **self-hosted runners** and for **public repositories** that use standard GitHub-hosted runners." Private repos on Free: 2,000 min/month, 500 MB artifacts. https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions . **Cron trap:** "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." Also "run on the latest commit on the default branch", "can be delayed during periods of high loads", min interval 5 min. https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows . Mitigation for a monthly data refresh: have the workflow commit the refreshed data (counts as activity) or add a keep-alive step.
14. **Optional backend** — Cloudflare Workers Free "100,000/day"; **KV** Free "100,000 reads per day", "1,000 writes per day", "1 GB" storage, value ≤ "25 MiB" https://developers.cloudflare.com/kv/platform/limits/ ; **D1** Free "5 million / day" rows read, "100,000 / day" rows written, "5 GB (total)" https://developers.cloudflare.com/d1/platform/pricing/ . **Supabase Free:** "500 MB database size", "5 GB egress", "Limit of 2 active projects", **"Free projects are paused after 1 week of inactivity."** https://supabase.com/pricing . **Neon Free:** "0.5 GB/project", "100 CU-hours/project", scale-to-zero "After 5 min" (cold start, not pausing; "Suspended (scaled-to-zero) compute = $0") https://neon.com/pricing . Inactivity semantics: Supabase = hard pause (manual unpause); Neon = auto-resume with cold-start latency; Cloudflare = none.
15. **CI testing** — **Chromatic** free: "5,000 billed snapshots" per month, Chrome only, "Unlimited projects & users" https://www.chromatic.com/pricing . **Lighthouse CI** (`@lhci/cli` 0.15.1, Apache-2.0): free; `temporary-public-storage` is "*temporary* and *public*", "retained … anywhere from 3 days to 5 weeks depending on available capacity", and "considered public information" https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/services-disclaimer.md — fine for a public portfolio; self-host LHCI server if you want history. **Playwright** `@playwright/test` 1.63.0 (Apache-2.0), **axe-core** 4.13.0 (MPL-2.0), **Storybook** 10.6.0 (MIT) — all open source, no usage limits; they run inside free public-repo Actions minutes.

---

## Cost traps (free now, but with pricing / inactivity / commercial-use risk)

1. **Vercel Hobby non-commercial clause** — broad definition ("financial gain of anyone involved in any part of the production"); ads or "hire me" monetisation can trip it. Prefer GitHub Pages or Cloudflare for the production URL; Vercel only for previews.
2. **GitHub Pages "not … your online business"** clause — a portfolio is fine; a SaaS pivot is not. Soft 100 GB/month can be hit by a viral map with large TopoJSON/Parquet — keep assets small and cache-busted.
3. **GitHub Actions cron disabled after 60 days inactivity** — a monthly refresh job dies silently on a finished portfolio. Make the job commit, or ping it.
4. **Netlify 300-credit hard limit** — ~15 GB bandwidth or ~20 deploys per month; a busy month stops the site until reset.
5. **Cloudflare Pages 25 MiB per file** — blocks self-hosting DuckDB-WASM (35.9 MB) and any non-trivial PMTiles; plus range requests return 200 (whole file) — PMTiles on Pages is effectively broken/inefficient. Cloudflare also steers new projects to Workers; Pages could stagnate.
6. **Keyed tile providers (MapTiler, Stadia, Mapbox)** — non-commercial-only free tiers, session/load quotas, keys visible in a static bundle, overage billing (Mapbox). Avoid; use own GeoJSON or OpenFreeMap.
7. **OpenFreeMap** — free with no limits *today*, donation-funded, no SLA; keep a fallback style with no basemap.
8. **Supabase Free pauses after 1 week inactivity** — unsuitable for an occasionally visited portfolio backend. Neon cold-starts after 5 min (latency, not outage). Cloudflare KV/D1 free tiers have no pausing.
9. **Highcharts** (if tempted for its a11y/sonification) — personal/educational use free, anything commercial needs a license; also a paid-product dependency in a portfolio.
10. **Chromatic 5,000 snapshots/month, Chrome-only** — a Storybook with many stories × viewports × PRs burns it fast; use TurboSnap and limit to `main` + PRs.
11. **DuckDB-WASM `latest` tag points at `-dev` builds** (1.33.1-dev57.0) — pin an exact version; loading from jsDelivr adds a third-party runtime dependency (~5–10 MB compressed).
12. **Lighthouse CI temporary-public-storage** — reports are public and expire in 3 days–5 weeks; don't rely on it for history.

---

## Sources (all fetched 2026-09-10)

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/get-started/learning-about-github/githubs-products
- https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions
- https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
- https://github.com/orgs/community/discussions/21655
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://blog.cloudflare.com/updated-tos/
- https://github.com/cloudflare/workers-sdk/issues/3861 (via GitHub API: closed 2026-04-15, state_reason completed, 1 comment)
- https://github.com/maplibre/demotiles/issues/35
- https://thomasgauvin.com/writing/static-protomaps-on-cloudflare/
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://www.netlify.com/pricing/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- https://supabase.com/pricing
- https://neon.com/pricing
- https://www.chromatic.com/pricing
- https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md
- https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/services-disclaimer.md
- https://openfreemap.org/
- https://docs.protomaps.com/basemaps/downloads
- https://docs.protomaps.com/pmtiles/cli
- https://docs.protomaps.com/pmtiles/cloud-storage
- https://github.com/protomaps/go-pmtiles/issues/68
- https://github.com/whitespring/project-nomad-maps-europe
- https://www.maptiler.com/cloud/pricing/
- https://stadiamaps.com/pricing/
- https://www.mapbox.com/pricing
- https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt
- https://maplibre.org/maplibre-style-spec/root/
- https://observablehq.com/plot/marks/geo
- https://observablehq.com/plot/interactions/pointer
- https://observablehq.com/plot/getting-started
- https://duckdb.org/docs/current/clients/wasm/overview.html
- https://github.com/duckdb/duckdb-wasm/discussions/1469
- https://data.jsdelivr.com/v1/packages/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0?structure=flat (wasm file sizes)
- https://deck.gl/docs/developer-guide/performance
- https://github.com/veltman/flubber
- https://www.npmjs.com/package/cartogram-chart
- https://github.com/olihawkins/d3-hexjson
- https://observablehq.com/@joewdavies/dorling-cartogram-configuration
- https://observablehq.com/@observablehq/dorling-cartograms-in-plot-with-d3-force
- https://www.freecodecamp.org/news/d3-and-canvas-in-3-steps-8505c8b27444/
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas
- https://www.w3.org/WAI/tutorials/images/complex/
- https://chartability.github.io/POUR-CAF/
- https://github.com/cmudig/data-navigator
- https://www.w3.org/wiki/SVG_Accessibility/Navigation
- https://www.w3.org/TR/svg-aam-1.0/
- https://www.highcharts.com/docs/accessibility/accessibility-module
- https://www.highcharts.com/docs/sonification/getting-started
- https://www.highcharts.com/blog/news/our-new-eula-makes-free-usage-clearer/
- npm registry (`npm view <pkg> version license time`) for all version/date claims; bundlephobia.com API for maplibre-gl, deck.gl, echarts, vega, vega-lite, recharts, @nivo/core, apache-arrow, hyparquet, pmtiles, three, regl, flubber, d3-geo; local esbuild measurement for d3 modules, full d3, @observablehq/plot, flubber, d3-hexbin.

**Not confirmed this session (UNVERIFIED):** Sweden PMTiles extract size; whether Cloudflare Pages/Workers static assets now return 206 for Range requests; Mapbox card requirement; HexJSON spec page (403); visx total bundle size; explicit Cloudflare legal text on commercial use of the free tier (none found in product docs).
