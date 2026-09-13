# Research record

Discovery research for the Sweden Data Explorer portfolio project.
All facts were verified against primary sources on **2026-09-10** unless a row says otherwise.
Anything the research could not confirm is tagged **UNVERIFIED** inside the reports; nothing
tagged that way should be relied on without a fresh check.

## Files

| File | What it covers |
| --- | --- |
| [2026-09-10-discovery-report.md](2026-09-10-discovery-report.md) | The synthesis: concept, data, geography, technical challenges, cost traps, prior art, interaction ideas, product directions, recommendation, decide-now vs keep-open |
| [reports/scb-pxweb.md](reports/scb-pxweb.md) | SCB: PxWeb API v1/v2 status, limits, license, verified municipality-level tables with years, DeSO/RegSO, boundary files, code changes, CKM noise, publication lags |
| [reports/other-swedish-sources.md](reports/other-swedish-sources.md) | Kolada, Valmyndigheten, Lantmäteriet, Skolverket, JobTech, Brå, housing sources, dataportal.se, nature geodata, SMHI, Trafikanalys, health, Skatteverket, Wikidata, SKR, Tillväxtverket, PTS and others |
| [reports/boundary-geodata.md](reports/boundary-geodata.md) | Boundary sources compared (Lantmäteriet, SCB, GISCO, OSM, GitHub repos, Natural Earth, geoBoundaries, GADM), measured file sizes, simplification pipeline, projections, historical boundaries |
| [reports/rendering-stack-and-hosting.md](reports/rendering-stack-and-hosting.md) | D3 SVG/Canvas vs MapLibre vs deck.gl decision matrix, chart libraries, in-browser data engines, cartogram tooling, accessibility references, free hosting and CI limits |
| [reports/prior-art.md](reports/prior-art.md) | Swedish and international products surveyed, patterns that work, gaps in the Swedish landscape, differentiation opportunities |
| [reports/ai-options-and-cost-traps.md](reports/ai-options-and-cost-traps.md) | In-browser and build-time AI options evaluated honestly, deterministic alternatives, cost-trap checklist |
| [reports/brainstorm-interactions-and-directions.md](reports/brainstorm-interactions-and-directions.md) | Interaction-model brainstorm and candidate product directions (ideas, not decisions) |

## Source registry

The sources most likely to end up in the product. License wording is quoted from the fetched page; see the reports for URLs of every page read.

| Source | Useful content | Access | License (verified wording) | Limits | Notes |
| --- | --- | --- | --- | --- | --- |
| SCB Statistikdatabasen, PxWeb API v2 `https://statistikdatabasen.scb.se/api/v2/` | Population by age/sex 1968–, births/deaths 1968–, migration 1997–, foreign-born 2000–, income 1999–, education 1985–, labour market (BAS) 2020–, dwellings 1990–, house prices 1981–, rents 2016–, households 2011–, tax rates 2000–2026, density 1991–, cars 2002–, elections 1973–2022, life expectancy, commuting 2004–2021; all at kommun level | REST, no key, CORS on | "licensen Creative commons 0 1.0 Universal, CC0"; recommended credit "Källa: SCB" | 150,000 cells per query; 30 calls per 10 s per IP; ~2,100-char GET URLs (use POST); "tillhandahålls i befintligt skick" | v1 works "fram till årsskiftet 2026/2027". Population tables split at reference year 2025 because of Cell Key Method noise. |
| SCB öppna geodata (WFS `https://geodata.scb.se/geoserver/stat/wfs`) | DeSO 2025 (6,160 areas), RegSO 2025 (3,363), tätorter, 1 km population grid | WFS GetFeature, GeoPackage/GeoJSON, EPSG:3006 | CC0 (same statement covers "vår geodataplattform") | none stated | Small-area statistics exist for population, income, education, labour market, housing. |
| SCB Digitala gränser (`shape_svenska_260225.zip`) | Kommun (290), län (21), LA regions; generalised, land only | Zip download, Shapefile/MapInfo, EPSG:3006 | "Vi använder licensen CC0 för dessa data" | none | Measured 168 KB / 9,748 vertices. SCB: "Gränserna är inte lämpliga för analyser" but made for thematic maps. Updated 2026-02-25. |
| Lantmäteriet "Kommun, län och rike" | Cadastral-precision kommun/län/rike polygons, annual versions, kommunkod/lanskod | Geotorget download or OGC API Features; free account required | CC0 ("använda, sprida, göra om, modifiera och bygga vidare") | Geotorget API rate-limits (HTTP 429) | Polygons extend to the territorial sea limit; must be clipped. Raw kommun layer 23.6 MB in WGS84 (via GioPalusa/SwedenGeoJSON, CC0). |
| Kolada API v3 `https://api.kolada.se/v3/` | 5,000+ KPIs per kommun and region, many back to 1970 | REST, no key | "avgiftsfritt och kräver inget avtal"; must show "Källa: Kolada"; commercial use allowed | none stated; 5,000 rows per page | v2 returns HTTP 410 Gone. KPIs can be removed or revised without notice. |
| Valmyndigheten | Results to valdistrikt level, mandates, turnout, valdistrikt boundaries; 2018, 2022 (XLSX/CSV/JSON), 2026 (JSON in zips) | File downloads, no API | "All data är fri att använda, förutsatt att du anger Valmyndigheten som källa" | none | 2026 election is 13 Sep 2026; preliminary and final files publish that week. |
| Skatteverket skattesatser | Municipal, regional, church and burial rates per parish, multi-year | JSON/CSV/TSV | CC0 (dataportal.se license URI) | none | Complements SCB tax-rate series. |
| Brå tabell 120 | Reported crimes per kommun and per 100k, 2002–2025 | Excel download; no API | "får vidareutnyttjas fritt ... inte heller förenat med några villkor" | none | Preliminary monthly data also available. |
| Skolverket APIs | School units with coordinates, per-school statistics, admissions | REST, no key | "Skolverkets källicens" → CC0 1.0 | 100 per page | Municipality-level grades only via web tool or Kolada. |
| Boverket Bostadsmarknadsenkäten | Annual housing-market survey of all 290 kommuner | Excel | CC BY 4.0 | none | Only open municipal housing-market signal besides SCB prices. |
| Naturvårdsverket, Skogsstyrelsen, SGU | Protected areas, forest, geology geodata | WFS / bulk | CC0 (Skogsstyrelsen and SGU verbatim; Naturvårdsverket via secondary source) | none stated | Basis for any "nature" metric; GIS work required. |
| SMHI open data | Station observations: temperature, precipitation, sunshine (20 stations) | REST, no key | CC BY 4.0, "även för kommersiella ändamål" | no numeric limits; abuse leads to IP blocks | Station-based, needs mapping to kommun. |
| Trafikanalys API `https://api.trafa.se/` | Vehicles per kommun 2001–2025 and more | REST, no key | free under lag 2022:818, attribution | cache recommended | SCB has the same car series 2002–2025. |
| JobTech (Arbetsförmedlingen) | Job ads live and historical since 2006 | REST, no key; bulk zips | Historical ads "Creative Commons CC0" | none stated | Municipal unemployment Excel series exists; its license is UNVERIFIED. |
| Wikidata | Municipality metadata, identifiers, links | SPARQL/REST | CC0 | fair use | Coats of arms on Commons carry per-file licenses and Swedish insignia law restrictions. |
| SKR kommungruppsindelning 2023 | 9 municipality types | Excel/JSON/CSV | no explicit license; SKR says free to use under the 2022 data law | none | Useful for "similar municipalities" and faceting. |
| Natural Earth | Land, coastline, lakes, neighbouring countries | Shapefile | public domain | none | Context layers only. |

### Sources judged not usable

Svensk Mäklarstatistik, Booli, Hemnet, Valueguard (proprietary, no redistribution); GADM (non-commercial, no redistribution); Eurostat GISCO boundaries (EuroGeographics non-commercial clause; Sweden data is available CC0 elsewhere anyway); OpenStreetMap boundaries (ODbL share-alike on served data, and they are SCB imports); geoBoundaries Sweden (2017/2009 vintage); K-samsök (one-week cache rule conflicts with static builds); Folkhälsomyndigheten tables (non-commercial clause; raw data license unclear); Trafiklab GTFS (key plus 50 calls per month); Polisen events (500 latest, no history); Kolada v2 (gone); every hosted free LLM tier (trial-sized, unpublished, or purchase-gated).

## Cross-checks between reports

- SCB's 30 calls per 10 seconds and CC0 license were confirmed independently by two agents.
- Lantmäteriet's product rename to "Kommun, län och rike" (3 Feb 2025), CC0 status and free-account requirement were confirmed independently by two agents.
- Valmyndigheten's attribution-only terms and file formats were confirmed by two agents.
- The cost-trap brief assumed Git LFS 1 GB and 7 GB Actions runners; both are outdated (10 GiB; 4 vCPU/16 GB on public repos).
- Cloudflare Pages' 25 MiB per-file limit was confirmed by two agents; its broken HTTP Range support is documented by Cloudflare itself.

## Open verification items

To resolve during prototyping, not before:

- **Resolved 2026-09-13** (live spike, `kitchen/spikes/open-questions.ts`, TAB638): SCB municipality tables return numeric `0` — not null, and not a parent-inclusive back-cast value — for Knivsta (0330) in 1998–2001, before its 2003-01-01 creation; Knivsta's population figure turns real (12,586) starting with the *2002* row, one year early, because TAB638's own note states year-Y population is reported on the administrative division as of 1 January (Y+1). Uppsala (0380) drops from 191,110 (2001) to 179,673 (2002), a fall of 11,437, in step with Knivsta's appearance — so the parent's flagged split-year break belongs at **2002**, not the nominal 2003 creation year.
- **Resolved 2026-09-13** (live spike, TAB5557, Stockholm 0180, 2025): an aggregated age cell is perturbed independently, not derived by summing already-perturbed single-year cells. Summing all 101 single-year age cells gives 999,237 against a published total (`TOT1`/`TOT5`/`TOT10`/`TotSA`, all identical) of 999,239 (diff −2); summing the 21 five-year-group cells gives 999,228 (diff −11); summing the 11 ten-year-group cells gives 999,234 (diff −5). The same holds at a single age-band: single ages 20–24 sum to 54,253 against a published `'20-24'` cell of 54,255. Derived age-group indicators must therefore be requested from SCB's own coarser Alder codes (e.g. `'20-24'`, or `TOT5`) rather than computed by summing finer, independently-noised cells.
- Start year of Lantmäteriet's annual boundary series, and the exact GeoPackage layer names.
- Thenmap's data license (historical municipality boundaries 1974–).
- Whether SCB's rent table has gaps for small municipalities.
- Whether Cloudflare Pages or Workers static assets now return HTTP 206 for Range requests.
- Size of a Sweden PMTiles extract, only relevant if a basemap is ever wanted.
- Arbetsförmedlingen municipal unemployment Excel license.
