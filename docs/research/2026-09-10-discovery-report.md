# Discovery report: Sweden Data Explorer

Date: 2026-09-10. Status: discovery, no decisions taken yet.
Companion documents: [README.md](README.md) (source registry) and the six reports under `reports/`.

## 1. The concept and its strongest versions

The brief is "explore Sweden through interactive data" with an interactive map as the navigation surface. Research sharpened that into three strong versions, which nest inside each other:

**The time machine.** SCB publishes municipality-level population by single year of age back to 1968, house prices to 1981, education to 1985, completed dwellings to 1938 and election results to 1973, all CC0. No live Swedish product animates this. SCB's own Statistikatlas did, a decade ago, and has been retired. A map you can scrub through half a century, with traces for the municipalities you pinned, is both the most visually striking and the least contested space.

**The map that changes shape.** Sweden's choropleth problem is severe: Norrland dominates area while population sits in the south, and the country is three times taller than wide. Nobody in Sweden offers a cartogram view of the 290 municipalities. A continuous morph between the real map and a Dorling or hex cartogram fixes the visual lie and is itself a signature interaction.

**The discovery engine.** Deterministic statistics computed at build time can surface "Sundbyberg has Sweden's youngest population", "Pajala lost a third of its residents since 1968", "Knivsta grew faster than every other municipality this decade". Each fact is a deep link into the exact view that shows it. This turns lookup into exploration without any LLM, and it is the most demonstrable data-engineering work in the project.

Optional layers on top: a preference-based "Var ska jag bo?" ranking, a daily "Gissa kommunen" guessing game, animated migration flows between municipalities, and neighbourhood-level zoom into DeSO areas.

## 2. Data: what is realistically available for free

Full detail with table IDs, years and verbatim license text is in `reports/scb-pxweb.md` and `reports/other-swedish-sources.md`. The short version:

**Backbone: SCB, CC0.** The statistical database and SCB's geodata platform are licensed CC0 (since July 2021). The PxWeb API v2 is live at `https://statistikdatabasen.scb.se/api/v2/`, needs no key, allows 150,000 cells per query and 30 calls per 10 seconds per IP, and serves JSON-stat2 and CSV. API v1 is deprecated and stops at the turn of 2026/2027, so everything must target v2. Municipality-level tables verified for: population by age and sex (1968–), births and deaths (1968–), migration (1997–), country of birth (2000–), income mean and median (1999–), household disposable income (2011–), education level (1985–), labour-market status (2020–, with the older RAMS series ending 2021), dwelling stock (1990–), completed dwellings (1938–), single-family house sale prices (1981–), rents (2016–), household composition (2011–), tax rates (2000–2026), population density (1991–), cars (2002–), election results and turnout (1973–2022), life expectancy (rolling five-year windows), commuting between municipalities (2004–2021).

**SCB caveats that shape the design.** From reference year 2025, population tables carry Cell Key Method noise (small random perturbations, totals need not equal the sum of parts) and are published as separate "CKM" tables, so long series are stitched from two tables. Municipality codes changed in Skåne (1997) and Västra Götaland (1998), and Knivsta (2003), Nykvarn (1999), Bollebygd and Lekeberg (1995), Gnesta and Trosa (1992) were carved out of parents, and Heby moved county in 2007. Income lags about thirteen months; population for a year appears the following February.

**Enrichment sources, all free.** Kolada v3 (5,000+ indicators, no key, requires "Källa: Kolada" attribution, v2 is gone). Valmyndigheten election files down to voting district with attribution only, including the election this Sunday. Skatteverket tax rates (CC0). Brå crime per municipality 2002–2025 (free, no conditions). Skolverket school APIs (CC0). Boverket's housing-market survey (CC BY 4.0). Naturvårdsverket, Skogsstyrelsen and SGU geodata (CC0) for a nature metric. SMHI weather stations (CC BY 4.0). Trafikanalys vehicles (free API). Wikidata (CC0).

**Not usable.** Every commercial housing price source (Mäklarstatistik, Booli, Hemnet, Valueguard). Folkhälsomyndigheten's tables carry a non-commercial clause. K-samsök forbids caching beyond a week. Trafiklab needs a key and allows 50 calls a month. Housing cost therefore comes from SCB's own house-sale and rent tables.

**Small areas.** SCB publishes DeSO (6,160 areas) and RegSO (3,363) boundaries via WFS, CC0, with population, income, education, labour-market and housing statistics attached. Neighbourhood zoom is feasible, but it multiplies polygon count by twenty and is the single biggest scope risk.

## 3. Geographic boundaries

Detail and measured file sizes in `reports/boundary-geodata.md`.

- **Fast path: SCB Digitala gränser.** CC0 shapefile, 290 municipalities and 21 counties, land only, already generalised for thematic maps. Measured at 168 KB and 9,748 vertices. SCB says it is not suitable for analysis, which is fine; it was made for exactly this use. Updated February 2026.
- **Authoritative path: Lantmäteriet "Kommun, län och rike".** CC0, cadastral precision, annual versions per 1 January (good for time travel), requires a free Geotorget account for download. Polygons extend to the territorial sea limit and must be clipped to a coastline; the raw municipality layer is 23.6 MB in WGS84 and needs heavy simplification. A CC0 pre-converted copy exists on GitHub (GioPalusa/SwedenGeoJSON, 2026 vintage).
- **Avoid.** Eurostat GISCO (EuroGeographics non-commercial clause), OpenStreetMap (ODbL share-alike on the served file, and the boundaries are SCB imports anyway), GADM (no redistribution), geoBoundaries (2017 and 2009 vintages).
- **Context.** Natural Earth (public domain) for neighbours, lakes and coast.
- **Historical.** Thenmap serves municipality boundaries from 1974 as GeoJSON/TopoJSON but its license is unverified; Lantmäteriet's annual series is the clean option once its start year is confirmed.

**Rendering recommendation: SVG with D3, no tiles.** Detail in `reports/rendering-stack-and-hosting.md`. Measured tree-shaken bundle for the D3 geo stack is about 27 KB gzipped versus 283 KB for MapLibre and 553 KB for deck.gl. SVG gives native focus, ARIA and keyboard semantics for 311 paths, plus transitions and shape morphing (flubber). Canvas becomes worth its hit-testing and accessibility cost only for DeSO-scale fills or particle animations, and can be added as a second layer under the same projection. MapLibre is justified only if a basemap becomes a requirement, and then with OpenFreeMap tiles (no key). Projection: `geoTransverseMercator` rotated to 15°E reproduces SWEREF 99 TM; or pre-project at build time and render with `geoIdentity`. Charts: Observable Plot or visx, both reusing D3 scales so map and charts share one colour vocabulary.

## 4. Technical challenges and engineering opportunities

These are the places where the repository can show real engineering thinking:

1. **Build-time data pipeline.** Chunk PxWeb v2 queries under the cell and rate limits, stitch pre-2025 and CKM tables, normalise municipality codes across the 1990s recodings and later splits, validate every dataset against a schema, and emit a provenance manifest per dataset (source URL, table ID, query, fetch time, license, row counts). Make the output byte-reproducible: sorted keys, fixed number formatting, no timestamps in data files. Snapshot-test the outputs. This is what guarantees the zero-runtime-API property.
2. **Geometry pipeline.** Reproject, clip to coast, simplify with shape retention, filter skerries by area, quantise to TopoJSON, precompute the adjacency graph from shared arcs (for keyboard navigation), centroids, and the Dorling and hex layouts with a fixed random seed.
3. **Shape morphing at 60 fps on a mid-range phone.** Coastal municipalities are multipolygons (95 of 290 in the GISCO extract); flubber's hole handling is incomplete, so the morph likely runs on each municipality's largest ring with the rest cross-faded. Needs a spike.
4. **URL as the single source of truth.** Indicator, year, selection, comparison and view mode serialised in the URL (the ONS Census Maps pattern), so every state is a shareable link and the state layer is unit-testable in isolation.
5. **Data format and loading.** Roughly 290 × 50 indicators × 50 years is about 725k cells: a few MB as JSON, under 1 MB as columnar typed arrays or Parquet read with hyparquet (19 KB). Load per indicator, lazily. DuckDB-WASM is not justified at this scale (36 MB binary, also over Cloudflare's per-file cap).
6. **Accessible map.** Arrow-key navigation between geographic neighbours, a live region announcing name, value and rank, a sortable table twin of every view, colour-blind-safe scales, reduced-motion fallbacks, and an audit against Chartability's heuristics. Sonification of an indicator north to south is cheap with the Web Audio API and genuinely rare.
7. **Deterministic facts engine.** Z-scores, Tukey fences, rank movers, streaks and change points over the indicator matrix, with bilingual templates and fixture-based tests. No LLM in the reproducible path.
8. **Sweden's aspect ratio.** Tall-narrow layout choices (insets for the three metro areas, split panels, rotation, or cartogram-by-default on mobile) are a real design problem worth documenting.
9. **Bilingual UI** from day one, since indicator names, templates and SEO all depend on it.
10. **Testing pyramid.** Unit tests for pipeline, statistics and state; component tests; Playwright visual and interaction tests; axe in CI; Lighthouse budgets.

## 5. Anything that could introduce cost or unstable dependencies

Full checklist with quotes in `reports/ai-options-and-cost-traps.md` and the hosting section of `reports/rendering-stack-and-hosting.md`.

- **Vercel Hobby** is "restricted to non-commercial personal use only", and Vercel defines commercial broadly enough that a portfolio used to solicit work is a grey zone. Prefer GitHub Pages or Cloudflare for the production URL.
- **GitHub Pages**: 1 GB site, soft 100 GB/month bandwidth, public repo required on the free plan, gzip only (no Brotli), and not for running a business. Fine for this.
- **Cloudflare Pages/Workers static assets**: unlimited static requests, but 25 MiB per file and broken HTTP Range requests (rules out self-hosted PMTiles and DuckDB-WASM there). Cloudflare steers new projects to Workers.
- **Netlify** free is now a hard 300-credit cap, roughly 15 GB of bandwidth a month. Avoid.
- **GitHub Actions** is free for public repos, but scheduled workflows are disabled after 60 days without repository activity. A monthly data-refresh job must commit its output or it silently dies.
- **Keyed tile providers** (Mapbox, MapTiler, Stadia) have quotas, non-commercial clauses or overage billing. Not needed with a vector-only map.
- **Hosted LLM free tiers** are all trial-sized, unpublished or purchase-gated. In-browser models cost users 0.7 to 3.4 GB downloads and crash on iOS. If any AI is ever used, it runs at build time with a local model and never in the reproducible path.
- **Smaller traps**: Google Fonts CDN (GDPR ruling; self-host instead), Sentry and Algolia quotas (use nothing or local search), Supabase pausing after a week of inactivity (no backend needed anyway), Git LFS bandwidth counting every visitor download (keep data files small and in git directly).
- **Data terms to honour**: Kolada requires "Källa: Kolada"; Valmyndigheten requires attribution; SCB asks that derived figures not be attributed to SCB; Lantmäteriet needs a free account at build time only.

## 6. Prior art and how to be different

Detail in `reports/prior-art.md`.

**Closest competitor: Kommunatlas.se.** Map coloured by any of 81 Kolada indicators, municipality pages with rank, a Gapminder-style bubble chart for 2020–2025, comparisons restricted to same-county or large-city pairs. Utilitarian, Kolada-only, no time depth before 2020, no cartogram, no narrative, no game.

**Institutional tools.** SCB "Kommuner i siffror" (13 indicators, compare, geolocate), Kolada Jämföraren (dense, expert-facing, no map), SCB Kartor (ArcGIS, one topic per map), SCB Statistikatlas (animated time, traces, stories; retired), regional Power BI dashboards. All analyst-grade or directory-grade.

**Independent Swedish work.** valresultat.org and jakobohlsson's early-voting map show what a single developer can ship on election data; medborgardata.se shows the data exists but in Power BI; several SEO directories exist. No Swedish product is designed for delight, offers a cartogram, a preference ranking, a data game, migration flows, any-pair comparison or auto-surfaced facts. Several predecessors died with their servers (Statistikatlas, CBS in uw buurt, Teleport), which makes a static, open-source, snapshot-based site a durability argument in itself.

**International patterns worth borrowing.** ONS Census Maps: URL as application state, zero-backend flat files. SSB Kommunefakta: one big number per card. Census Reporter: every number shown in context. Movemap: preferences update a live match count before showing the map. Worldle and Tradle: daily guess with distance, direction and a spoiler-free share grid. Datawrapper: use a cartogram when the story is "how many people", label heavily because readers first see "just circles". Flowmap.blue: origin–destination flows with animation.

## 7. Interaction models beyond conventional maps and charts

Ideas, not requirements; see `reports/brainstorm-interactions-and-directions.md` for the full list.

- **Morphing geography**: real map to Dorling circles to hex tiles as one continuous transition; spike map for absolutes, fill for rates.
- **Time as a physical control**: drag on the map scrubs the year; "since you were born" personalises every indicator; ghost trails on scatter views.
- **Comparison as a gesture**: pin two, get a versus card with per-indicator winners; "municipalities most like X" by nearest neighbour on standardised indicators; drag any chart onto the map to make it the colour encoding.
- **Discovery over querying**: build-time facts with deep links; rank movers as a bump chart; extremes ribbon under the map; a "Slumpa" button.
- **Preference elicitation that is not a form**: weighted sliders with live re-ranking and visible contribution bars; pairwise "this or that" rounds that infer weights, with the inferred weights shown and editable.
- **Games**: daily "Gissa kommunen" from shape plus three indicators; higher-or-lower.
- **Narrative**: a handful of scroll-driven stories driving the same components; per-municipality profiles that read like a short article generated from rules.
- **Non-visual**: keyboard neighbour navigation, live-region announcements, sonification north to south, a table twin of every view.
- **Semantic zoom** into DeSO neighbourhoods when a municipality is selected.
- **Flows**: animated domestic migration between municipalities, where WebGL may finally be justified.
- **Sweden as a strip**: the country unfolds into a latitude-ordered dot chart, so the map literally becomes the chart.

## 8. Product directions, focused to ambitious

1. **Kommunkartan (focused).** One vector map, 15 to 25 curated indicators, time scrubber with traces, profile drawer, compare any two, URL state, bilingual. Finishable, but risks reading as a dashboard unless time and motion lead.
2. **Kommunkartan + discovery (recommended vision).** Adds the map-to-cartogram morph, the deterministic facts engine with deep links, similar-municipality search, and rule-generated profile text. This is what turns lookup into exploration and shows the pipeline work.
3. **+ Var ska jag bo?** Weighted ranking with explainability, possibly pairwise elicitation. Memorable and product-minded, but the honest data for it is thinner than it looks: housing cost only via SCB sale prices and a survey-based rent table with likely gaps, nature requiring real GIS work, commuting data ending in 2021.
4. **+ Gissa kommunen.** Cheap once the data model exists, shareable, drives repeat visits; must not eclipse the engineering story.
5. **+ DeSO semantic zoom.** Most technically ambitious, unique in Sweden, forces Canvas and columnar loading. Also the biggest scope and accessibility risk.
6. **Stories-first.** Highest emotional impact per hour, naturally avoids the dashboard trap, but content-heavy and dates quickly; the explorer becomes secondary.

## 9. Recommendation

Adopt direction 2 as the product vision and build direction 1 as the first vertical slice. Then add increments in an order chosen deliberately, each with an ADR: facts engine, cartogram morph, then either the preference ranking or the game, with DeSO zoom as a later spike.

Why this is the strongest portfolio piece:

- **It is different from what exists.** Kommunatlas owns map-plus-compare on Kolada data. Time depth to 1968, a morphing cartogram, deterministic facts and any-pair comparison are all absent from the Swedish landscape.
- **Every feature reuses one core.** One data model, one URL state machine, one set of view components. The repository reads as architecture rather than a pile of features.
- **The pipeline is the proof.** A tested, documented, reproducible build-time pipeline with provenance is where data engineering, determinism and the zero-cost guarantee are all demonstrated at once.
- **It is finishable.** Direction 1 is a few weeks of focused work; every later increment is independently shippable.
- **Two challenges to the brief.** First, "Where should I live?" is the most product-shaped idea but should not drive v1 architecture; the ranking primitives it needs fall out of direction 2 anyway. Second, SCB (CC0) rather than Kolada should be the backbone, because it avoids the attribution requirement and indicator churn, and because Kolada-first is exactly what the closest competitor did.

## 10. Decide now versus keep open

**Decide now** (each becomes an ADR):

1. Product vision and first vertical slice (this is the first question to you).
2. Zero-runtime-API principle: all data fetched and transformed at build time, the site is static, no keys in the bundle.
3. Data backbone: SCB CC0 primary, Kolada and others as enrichment; boundaries from SCB's shapefile first, Lantmäteriet later.
4. Municipality as the unit for v1, county as grouping; DeSO explicitly deferred.
5. Vector rendering without tiles; SVG with D3 as the default, Canvas layer only if a spike proves it necessary.
6. Language strategy (Swedish, English or both from day one).
7. Hosting target and framework family, given the Vercel Hobby clause and the static nature of the app.
8. Project name and repository.

**Keep open until prototyped or investigated:**

- SVG versus a Canvas hybrid for the morph (spike on a mid-range phone).
- Dorling versus hex cartogram, and the tall-narrow layout strategy.
- Exact indicator list beyond the first ten.
- The scoring model and elicitation UX for any preference feature.
- Whether the game, flows or DeSO zoom are ever built.
- Any use of AI at all (default: none).
- Story content and visual design language.
- Refresh cadence for data and how the scheduled job stays alive.
