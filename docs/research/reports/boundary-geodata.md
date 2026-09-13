# Open boundary data for Sweden (290 kommuner / 21 län) in a static browser map

Research date: 2026-09-10. Every fact below comes from a page or file fetched during this session (URLs in "Sources"). Items I could not confirm are marked **UNVERIFIED**. Byte sizes marked "measured" were read from HTTP `Content-Length` headers or from files downloaded and parsed locally.

## 1. Lantmäteriet — "Kommun, län och rike" (formerly "Administrativ indelning")

- **Product change.** Lantmäteriet's newsletter 1/2025: the products "Kommun, Län och Rike" "lanserades den 3 februari 2025" and "ersätter Administrativ indelning Nedladdning, vektor och Geografisk indelning Direkt"; the old products were discontinued November 2025. So the name "Administrativ indelning" is obsolete.
- **Open data status.** The product list filtered on "Öppna data" includes *Kommun, län och rike Nedladdning*, *Topografi 10/50/100/250/1M Nedladdning, vektor*, *Distriktsindelning Nedladdning, vektor* ("2523 områden") and *Sverigekartor* (1:5M, 1:10M, 1:20M).
- **License wording.** lantmateriet.se/oppnadata: "du får använda, sprida, göra om, modifiera och bygga vidare på Lantmäteriets öppna data" (CC0; attribution encouraged, not required). The Geotorget access page for Topografi 250 states the product is free under "Creative Commons, CC0". The Direkt product page (Geotorget link) lists CC0 as well.
- **Access.** Geotorget page: "För att beställa måste du skapa ett konto i Geotorget." Topografi 250 access page: "I Geotorget kan du ladda ner producerade filer manuellt i din webbläsare eller via Geotorgets API för nedladdning." FAQ mentions HTTP 429 "API Limit Reached" rate limiting and a limit of five accounts per organisation. So: free, CC0, but a (free) account is needed — you download once at build time, never from the browser.
- **Content and geometry (Nationell informationsspecifikation Kommun, län och rike, v1.0 Test 1, 2025-01-14, 26 pp).**
  - "Datamängden baseras på geometri för fastigheter som finns i fastighetsregistret. Kommunernas ytor skapas från fastighetsgränser, länens ytor aggregeras från kommunernas ytor och rike aggregeras från länens ytor." → cadastral-precision polygons, not a generalised map scale. (Old "1:10k/50k/250k" scale tiers now live in the Topografi products, whose *Administrativ indelning* theme also has Länsyta/Kommunyta layers — Topografi 250 GEODOK confirms this, "Utgående" version 2023.02.)
  - Sea: "rike: konungariket Sveriges territorium, begränsat av riksgräns och sjöterritoriets gräns i havet" and "Läns- och kommungränser i allmänt vatten fastställs av Kammarkollegiet". Since rike is aggregated from län from kommun, kommun polygons fill out to the 12-nautical-mile territorial limit — i.e. **they include the sea**; you must clip to a coastline if you want land shapes. Lakes are inside the polygons (attributes landareal/vattenareal/totalareal exist).
  - Exclaves "redovisas med multipla geometrier"; attributes `lanskod` ("tvåsiffrig kod för län"), `kommunkod` ("fyrsiffrig kod för kommun"), referensdatum från/till.
  - CRS: "Plan ESPG:3006" (SWEREF 99 TM). Annual versions "Per den 1 januari respektive år"; "saknas arealuppgifter för vissa år före 2024"; historical years are reconstructed "med stöd av bland annat äldre kartmaterial, folk- och bostadsräkningar". Start year of the annual series: **UNVERIFIED**.
  - Församling/distrikt are **not** in this dataset (separate open product *Distriktsindelning*).
- **Formats.** Direkt: "OGC API Features", GeoJSON (Geotorget link page). Nedladdning: GeoPackage — the Geotorget product page is JS-rendered and could not be fetched; GeoPackage is confirmed for the sibling Topografi products (".gpkg … SWEREF 99 TM (EPSG 3006)") and by the SwedenGeoJSON repo, which describes converting the product's "Original GeoPackage format". Treat as near-certain but **not read from the product page itself**.
- **Size reality check.** GioPalusa/SwedenGeoJSON's unsimplified WGS84 conversion of the 2026 kommun layer is **23.6 MB** (measured via GitHub API) — far too big for a browser without simplification.

## 2. SCB — "Digitala gränser" and öppna geodata

- Page: scb.se … /regionala-indelningar/digitala-granser/. Downloads: `shape_svenska_260225.zip` and `tab_svenska_260225.zip` ("Län, kommuner och LA-regioner", ArcView-shape / MapInfo TAB). Measured: 214,808 bytes, `Last-Modified: 25 Feb 2026` → current for 2026.
- **License, verbatim:** "Du kan använda SCB:s öppna data utan kostnad. Vi använder licensen CC0 för dessa data, vilket innebär att du får använda och sprida eller tillgängliggöra sådana data utan krav på att ange källa." Recommended credit "Källa: SCB".
- **Detail level, verbatim:** "filerna innehåller enkla kommun- och länsgränser anpassade för tematisering av statistik" and "Gränserna är inte lämpliga för analyser." For exact boundaries SCB points to Lantmäteriet.
- **Measured contents (parsed locally):** `Kommun_Sweref99TM.shp`: 290 records, 314 rings, **9,748 vertices**, 168 KB; fields `KnKod`, `KnNamn`. `Lan_Sweref99TM_region.shp`: 21 records, 51 rings, 3,849 vertices, 62 KB; fields `LnKod`, `LnNamn`. `LAomraden_2024.shp`: 66 LA regions. CRS SWEREF 99 TM (`.prj`: Transverse_Mercator, Central_Meridian 15.0, Scale_Factor 0.9996, False_Easting 500000, EPSG 3006). Summed polygon area 436,796 km² vs Sweden's 450,295 km² → **no sea, heavily generalised coast (few islands)**.
- Not on that page: DeSO, RegSO, valdistrikt, NUTS. DeSO (6,160 areas) and RegSO (3,363) are separate open geodata (new versions early 2025) via WFS/WMS at `https://geodata.scb.se/geoserver/stat/wfs`. Tätorter: see §8. Valdistrikt come from Valmyndigheten (§8).

## 3. Eurostat GISCO — NUTS and LAU

- **LAU** (= kommuner for Sweden; my extract has exactly 290 SE features): years 2011–2024, **one scale only, 01M**; formats GeoPackage, SHP, TopoJSON, GeoJSON, PBF, SVG, CSV; CRS EPSG 3035 / 4326 / 3857. File pattern `LAU_RG_01M_2024_4326.geojson`. Whole-Europe files only (no per-country LAU; `LAU_LB` label points do not exist — HTTP 404). Measured: GeoJSON 4326 **149.9 MB**, TopoJSON **44.7 MB**.
- **Sweden extract (measured, 290 features):** 2.35 MB minified GeoJSON, 58,847 vertices, 4,422 polygon parts; attributes `GISCO_ID` (e.g. `SE_1981`), `CNTR_CODE`, `LAU_NAME`, `POP_2024`, `POP_DENS_2024`, `AREA_KM2`, `YEAR`. Summed geometry area 446,123 km² → land + lakes, no sea. Population attribute is a free bonus for Dorling cartograms.
- **NUTS** 2024 (also 2021, 2016, 2013, 2010, 2006, 2003): levels 0–3, scales 01M/03M/10M/20M/60M, RG/BN/LB geometry types, same formats/CRS. Measured NUTS3 (= län) LEVL_3 4326 GeoJSON: 01M 27.6 MB (all Europe), 03M 6.6 MB, 10M 2.4 MB; NUTS LB label points 707 KB.
- **License, verbatim (statistical-units page):** "…non-exclusive and non-transferable right to use and process the Eurostat/GISCO geographical data downloaded from this page … The permission to use the data is granted on condition that: the data will not be used for commercial purposes; the source will be acknowledged. A copyright notice, as specified below, must be visible on any printed or electronic publication…", "EN: © EuroGeographics for the administrative boundaries", and "If you intend to use the data commercially, please contact EuroGeographics". Country-specific notices (Turkstat/Kartverket/swisstopo/Kosovo): I grepped the page — **no such text present**; **UNVERIFIED** whether they exist elsewhere. Swedish boundaries fall under the EuroGeographics notice; the non-commercial clause is the real constraint.

## 4. OpenStreetMap-derived boundaries

- **Verified via OSM API:** Skåne län relation 54409 has `admin_level=4`, `ref:SE:scb=12`, `ref:nuts=SE224`, `source=SCB`; Ale kommun relation 935506 has `admin_level=7`, `KNKOD=1440`, `ref:scb=1440`, `source=SCB`. Wiki table (Tag:boundary=administrative, Sweden row): 4 = Län (21), 6 = Sameby, 7 = Kommun (290), 8 = Distrikt, 9/10 = stadsdelsområde/stadsdel. Wiki "Sweden/Kommuner" lists all 290 relation IDs ("Denna sida blev klar 2010").
- **Sources:** Geofabrik `sweden-latest.osm.pbf` 778 MB, daily, "License: ODbL 1.0". osm-boundaries.com: OSM login required, "import data from OpenStreetMap on a monthly basis", free tier plus paid plans, offers historical versions to dodge bad edits.
- **ODbL implications (OSMF Produced Work guideline):** a Produced Work is "a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents"; you "can release your map under any license that you like", but if the published result is "intended for the extraction of the original data, then it is a database and not a Produced Work" — a TopoJSON file served to browsers is arguably a derived database → ODbL share-alike + attribution. Boundaries in OSM are themselves imported from SCB (source tags), so using OSM adds licence friction without adding authority.

## 5. Ready-made GitHub repositories (metadata via GitHub API)

| Repo | Content | Source | License | Last push | Current? |
|---|---|---|---|---|---|
| GioPalusa/SwedenGeoJSON | Rike, 21 län, 290 kommuner; WGS84; unsimplified (kommun.geojson 23.6 MB + 290 per-kommun files) | Lantmäteriet "Kommun, län och rike", annual 2026 (1 Jan 2026) | CC0-1.0 | 2026-03-23 | Yes |
| stefur/swemaps | kommun, län, valdistrikt, FA-regions as GeoParquet (Python pkg), WGS84 | SCB, Tillväxtverket, Valmyndigheten | MIT | 2026-08-15 | Yes |
| okfse/sweden-geojson | 290 kommuner (818,064 B; measured 19,691 vertices, 304 parts; props `id`, `kom_namn`, `lan_code`, `geo_point_2d`), regions 48 KB; mapshaper "2%"/"10%" | OpenDataSoft (from Valmyndigheten) + jnordgren | none stated | 2020-06-07 | 290/21 but 2020 vintage |
| jnordgren/swedish_data_map_geojson | län 3.1 MB, landskap 465 KB, no kommuner | OSM (ODbL) + Natural Earth | ODbL for counties | 2014-08-24 | Stale |
| perliedman/svenska-landskap | 25 landskap only | Lantmäteriet Distriktskarta | CC0 | 2022-03-22 | n/a |
| deldersveld/topojson | (had sweden-counties.json) | — | — | repo **gone** (API 404; react-simple-maps issue #360) | No |
| junkka/histmaps | R pkg, parishes/counties/municipalities 1600–1990 | Riksarkivet historical GIS (data CC0) | MIT (code) | 2023-11-06 | historical |
| peterk/kartogram_sverige_kommun | population cartogram shapefile (SCB 2021) | SCB digitala gränser | none stated | 2023 | n/a |

## 6. Natural Earth, geoBoundaries, GADM

- **Natural Earth:** "All versions of Natural Earth raster + vector map data found on this website are in the public domain." Admin 2 is "limited to United States"; Admin 1 (14.22 MB) may include län — **UNVERIFIED**. No kommun level.
- **geoBoundaries** (site: CC BY 4.0 overall). API for SWE ADM2: 290 units, `boundaryYearRepresented` **2017**, source "geoBoundaries and Wikimedia Commons", license "CC0 1.0", meanVertices 88, files 1.21 MB / simplified 0.97 MB (measured). SWE ADM1: 21 units, year **2009**, CC BY 3.0, source "Erik Frohne", 27.9 MB. Stale and of uncertain provenance → avoid.
- **GADM:** "The data are freely available for academic use and other non-commercial use. Redistribution or commercial use is not allowed without prior permission." → unusable for a redistributed static app.

## 7. Pipeline, sizes, islands, projections, layout

- **Tooling (mapshaper reference, verbatim):** `-proj wgs84` ("Convert a projected Shapefile to WGS84 coordinates"), EPSG codes accepted; `-simplify` methods `dp`, `visvalingam`, `weighted` (default — "produces generalizations that look good enough for most web maps"); amounts `percentage=`/`interval=`/`resolution=`; `planar`; `keep-shapes` ("retain at least one ring per multipart feature, regardless of how aggressive the simplification is"); `-filter-islands min-area=` ("e.g. 10km2") / `min-vertices=`; `-clean`; `-o format=topojson quantization=` ("By default, mapshaper applies quantization equivalent to 0.02 of the average segment length"). A single command chain: `mapshaper kommun.gpkg -proj wgs84 -simplify weighted 5% keep-shapes -filter-islands min-area=2km2 -clean -o format=topojson quantization=1e4`. (Not run here — mapshaper is not installed locally.)
- **Real size anchors:** SCB kommun shp 168 KB / 9,748 vertices; okfse 2% GeoJSON 818 KB / 19,691 vertices; GISCO SE 1:1M GeoJSON 2.35 MB / 58,847 vertices; Lantmäteriet full-detail GeoJSON 23.6 MB. My quantised (1e4 grid) delta-encoded re-encoding of the GISCO SE extract came to ~446 KB **without** shared-arc deduplication, so a true TopoJSON of that data should land roughly 250–400 KB (**estimate**); the SCB vertices would yield well under 100 KB (**estimate**). Gzip/brotli halves these again (**estimate**).
- **Islands.** Sweden has "267 570 insjö- och havsöar" and "96 000 insjöar" (sv.wikipedia). In the GISCO SE extract 95 of 290 municipalities are MultiPolygons; 4,422 parts, of which 3,773 (85%) are < 1 km² and hold 20,905 of 58,060 vertices (36%). Norrtälje has 431 parts, Värmdö 371, Haninge 184. Decision: `-filter-islands min-area=` plus `keep-shapes` removes skerries while guaranteeing every kommun keeps a ring; keep Gotland/Öland/Orust/Tjörn intact.
- **Projection.** SWEREF 99 TM = Transverse Mercator, central meridian 15°E, k=0.9996 (from SCB `.prj`). In D3: `d3.geoTransverseMercator().rotate([-15, 0])` then `.fitSize([w,h], topo)` — visually identical to SWEREF 99 TM. `d3.geoConicConformal()` defaults to parallels "[30°, 30°] resulting in flat top"; set `.parallels([57, 67]).rotate([-15,0])` for a conic alternative. Or pre-project with mapshaper and use `d3.geoIdentity().reflectY(true)` (smaller JSON, no runtime projection).
- **Aspect ratio.** "längd: 1 572 km från norr till söder", "bredd: 499 km" (sv.wikipedia); LAU bbox spans 55.34–69.06°N, 10.96–24.17°E (~1,517 km × ~690 km including the bbox's diagonal slack). A ~3:1 tall map wastes width on desktop. Common tricks (design practice, no single citable source found — **UNVERIFIED as "known" conventions**): (a) inset Stockholm/Göteborg/Malmö/Skåne where 290 tiny kommuner cluster; (b) rotate ~30° to lay Sweden along a wide viewport; (c) split Norrland/Svealand-Götaland into two panels; (d) hex/Dorling cartogram of 290 cells for choropleths, with the real map as a toggle (GISCO `POP_2024` or SCB population gives the Dorling radii).

## 8. Centroids, tätorter, label points

- **Tätorter:** SCB open geodata, 2,017 statistical localities (2023), polygons with "län, kommun, tätortskod, tätortsbeteckning, befolkning och landareal"; GeoPackage via `https://geodata.scb.se/geoserver/stat/wfs?...TYPENAMES=stat:Tatorter_2023&outputFormat=geopackage`; historic layers 1980–2020. Same CC0 regime as SCB open data.
- **Population grid:** SCB "Statistik på rutor", 1 km squares, total population and age/sex, ETRS89 and SWEREF99TM, GeoPackage/WFS, yearly 2015–2025 → population-weighted centroids can be computed (SCB does not publish them directly — **UNVERIFIED** that no such product exists).
- **GISCO:** NUTS LB point layer exists (707 KB, all Europe); LAU has no LB layer. okfse's file carries a `geo_point_2d` centroid per kommun.
- **Valdistrikt:** Valmyndigheten publishes 2026 electoral-district geometry as JSON in SWEREF99 TM (whole country ~27 MB; per-county 217 KB–4 MB), "fri att använda" with attribution.

## 9. Historical boundaries

- **Lantmäteriet Kommun, län och rike, årsvis**: annual versions per 1 January; areas missing for some years before 2024; start year **UNVERIFIED**.
- **Thenmap (api.thenmap.net, Journalism++)**: dataset `se-7` "Swedish municipalities, from 1974 (a few borders in southern Sweden still missing from 1973)"; `se-4` "Swedish counties, from 1968"; GeoJSON/TopoJSON/SVG, `recommendedProjections: ["sweref99tm"]`, props incl. `kommunkod`, `wikidata`, `sdate`, `edate`. Measured: 2020 TopoJSON 160 KB, 1974 GeoJSON 185 KB. Served over plain http; **data license not stated on the site — UNVERIFIED**.
- **junkka/histmaps**: Riksarkivet "Historiska GIS-kartor" 1600–1990 (parishes/counties verified, other unit types "unverified"), data CC0, sf objects in EPSG:3006. I could not find the Riksarkivet download page itself (their open-data list only shows a place-name dataset) — **UNVERIFIED** as a direct download.
- SCB historical kommun geometry, "Sveriges kommungränser" on dataportal.se (fetch failed twice): **UNVERIFIED**.

## 10. Context layers: sea, lakes, neighbours

- **GISCO Countries 2024** (`CNTR_RG_*_2024_4326.geojson`): 263 countries incl. NO, FI, DK, EE, LV, LT, PL, DE, RU (verified by parsing the 20M file); measured 20M 2.0 MB, 10M 3.8 MB, 03M 15.1 MB. Same EuroGeographics non-commercial notice as §3.
- **Natural Earth 10m** (public domain): Land 3.12 MB, Coastline 2.93 MB, Ocean 3.04 MB, Lakes 2.24 MB + "lakes_europe" supplement 181 KB, Minor Islands (≤2 km²) 308 KB. Cheapest fully unrestricted option; clip to a Sweden-plus-neighbours bbox with mapshaper.
- **Lantmäteriet Sverigekartor** (open): "gränser, sjöar, polcirkeln samt rut- och gradnät" at 1:5M/10M/20M — a CC0 Swedish alternative for lakes/Vänern-Vättern.

## Comparison table

| Source | Granularity | License | CRS | Format | Currency | Recommendation |
|---|---|---|---|---|---|---|
| Lantmäteriet Kommun, län och rike | 290 kommun, 21 län, rike; cadastral detail; incl. sea to territorial limit; annual versions | CC0 (account needed) | EPSG:3006 | GeoPackage (Nedladdning), OGC API Features/GeoJSON (Direkt) | 2026 | **Primary** (authoritative, needs clip + heavy simplification) |
| SCB Digitala gränser | 290/21/66 LA; generalised, no sea, few islands | CC0 | EPSG:3006 | Shapefile, TAB | 2026-02-25 | **Fallback / fastest path** (168 KB shp, ~10k vertices) |
| GISCO LAU/NUTS | 290 LAU (1:1M), NUTS3=län (5 scales); `POP_2024` | © EuroGeographics, **non-commercial** | 3035/4326/3857 | GeoJSON/TopoJSON/GPKG/SHP | 2024 | Good geometry, but licence and 150 MB Europe-wide file; fine for a hobby project |
| OSM (Geofabrik/osm-boundaries) | admin_level 4 & 7 | ODbL (share-alike on data) | 4326 | PBF/GeoJSON | continuous | Avoid — same SCB origin plus ODbL |
| geoBoundaries SWE | ADM2 290 (2017), ADM1 (2009) | CC0 / CC BY 3.0 | 4326 | GeoJSON | stale | Avoid |
| GADM | ADM2 | non-commercial, no redistribution | 4326 | various | — | Unusable |
| Natural Earth | countries, land, lakes only | public domain | 4326 | SHP | 5.x | Context layers |
| GioPalusa/SwedenGeoJSON | LM 2026 kommun/län/rike, unsimplified | CC0 | 4326 | GeoJSON 23.6 MB | 2026 | Handy pre-converted LM source |
| Thenmap | kommun 1974–, län 1968– | UNVERIFIED | sweref99tm/others | GeoJSON/TopoJSON | active | Time-travel feature, if licence confirmed |

## Recommended primary source + fallback

**Primary: Lantmäteriet "Kommun, län och rike" (CC0)** — pulled once at build time from Geotorget (free account) or via the already-converted CC0 copy in GioPalusa/SwedenGeoJSON (which is the 2026 annual layer). Reasons: it is the legal source of truth, CC0 with no attribution or non-commercial clause, carries `kommunkod`/`lanskod` for joining statistics, and offers annual versions for a time slider. Costs: polygons extend into the sea, so clip against a coastline (Topografi 1M land polygons, Natural Earth land, or simply the GISCO/SCB land-only outline), then reduce 23.6 MB → a few hundred KB with mapshaper (`weighted` Visvalingam + `keep-shapes` + `-filter-islands`) and quantised TopoJSON.

**Fallback: SCB Digitala gränser (CC0)** — 168 KB shapefile with 9,748 vertices, already land-only and generalised for thematic maps; a five-minute `mapshaper -proj wgs84 -o format=topojson` pipeline. SCB itself says "Gränserna är inte lämpliga för analyser", but for choropleths it is exactly what it was made for. Use it as the first deliverable and swap in the Lantmäteriet-derived file when the clipping pipeline is ready — both share `KnKod`/`kommunkod` identifiers.

**Do not** build on GISCO (non-commercial clause, 150 MB Europe-wide extraction), OSM (ODbL share-alike on the served TopoJSON, and its boundaries are SCB imports anyway), geoBoundaries (2017/2009 vintage) or GADM (no redistribution). For context use Natural Earth (public domain) or GISCO Countries if the project stays non-commercial. For a D3 renderer, `d3.geoTransverseMercator().rotate([-15,0]).fitSize(...)` reproduces SWEREF 99 TM; or pre-project to EPSG:3006 in mapshaper and use `geoIdentity().reflectY(true)`.

## Sources (fetched)

- https://www.lantmateriet.se/oppnadata
- https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/
- https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/kommun-lan-och-rike-nedladdning/
- https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/kommun-lan-och-rike-direkt/
- https://geotorget.lantmateriet.se/link/kommun-lan-rike-direkt
- https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/topografi-250-nedladdning-vektor/
- https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/sverigekartor/
- https://www.lantmateriet.se/sv/geodata/vara-produkter/geotorget/
- https://www.lantmateriet.se/sv/geotorget-produktstod/om-tillhandahallandet/
- https://www.lantmateriet.se/sv/geotorget-produktstod/fragor-och-svar/
- https://www.lantmateriet.se/sv/om-lantmateriet/nyheter-och-sociala-medier/nyhetsbrev/produktnyheter-geodata/nyhetsbrev-20251/
- https://www.lantmateriet.se/sv/nationella-geodataplattformen/datamangder/kommun-lan-och-rike/
- https://www2.lantmateriet.se/globalassets/temawebbar/ngp/informationsspecifikation_kommun_lan_rike_test_1_rev32.pdf
- https://geotorget.lantmateriet.se/dokumentation/GEODOK/56/latest/informationsinnehall/tema-administrativ-indelning.html
- https://geotorget.lantmateriet.se/dokumentation/GEODOK/56/latest/atkomst-och-leverans.html
- https://geotorget.lantmateriet.se/dokumentation
- https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/ (+ shape_svenska_260225.zip)
- https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/
- https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/statistiska-tatorter/
- https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/statistik-pa-rutor/
- https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units
- https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/local-administrative-units
- https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics
- https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units/countries
- https://gisco-services.ec.europa.eu/distribution/v2/lau/lau-2024-files.html
- https://gisco-services.ec.europa.eu/distribution/v2/nuts/nuts-2024-files.html
- https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2024_4326.geojson (downloaded, parsed)
- https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_20M_2024_4326.geojson (downloaded, parsed) + HEAD requests on NUTS/CNTR/LAU files
- https://github.com/eurostat/Nuts2json
- https://ropengov.github.io/giscoR/reference/gisco_get_lau.html ; https://ropengov.github.io/giscoR/reference/gisco_attributions.html
- https://wiki.openstreetmap.org/wiki/Tag:boundary=administrative ; https://wiki.openstreetmap.org/wiki/Sweden/Kommuner
- https://www.openstreetmap.org/api/0.6/relation/54409.json ; https://www.openstreetmap.org/api/0.6/relation/935506.json
- https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline
- https://osm-boundaries.com/ ; https://download.geofabrik.de/europe/sweden.html
- https://github.com/okfse/sweden-geojson (README + raw swedish_municipalities.geojson, parsed)
- https://github.com/GioPalusa/SwedenGeoJSON ; https://github.com/stefur/swemaps ; https://github.com/jnordgren/swedish_data_map_geojson ; https://github.com/perliedman/svenska-landskap ; https://github.com/junkka/histmaps ; https://github.com/peterk/kartogram_sverige_kommun ; GitHub REST API repo/contents endpoints for each
- https://www.geoboundaries.org/ ; https://www.geoboundaries.org/api/current/gbOpen/SWE/ADM2/ ; https://www.geoboundaries.org/api/current/gbOpen/SWE/ADM1/
- https://gadm.org/license.html
- https://www.naturalearthdata.com/about/terms-of-use/ ; https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ ; https://www.naturalearthdata.com/downloads/10m-physical-vectors/
- https://mapshaper.org/docs/guides/simplification.html ; https://mapshaper.org/docs/reference.html
- https://d3js.org/d3-geo/conic ; https://d3js.org/d3-geo/cylindrical
- https://sv.wikipedia.org/wiki/Sveriges_geografi ; https://en.wikipedia.org/wiki/Geography_of_Sweden ; https://en.wikipedia.org/wiki/Sweden
- https://www.thenmap.net/ ; http://api.thenmap.net/v2/se-7/info/2020-01-01 ; http://api.thenmap.net/v2/se-4/info/2020-01-01 ; https://github.com/rotsee/thenmap
- https://sok.riksarkivet.se/data-api/nedladdningsbara-datamangder/
- https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026
- Failed fetches (404/empty): lantmateriet.se …/administrativ-indelning/ ; e-pb-administrativ-indelning-nedladdning-vektor.pdf ; geotorget.lantmateriet.se/geodataprodukter/kommun-lan-rike-nedladdning-api (JS-only) ; scb.se …/sa-far-du-anvanda-scbs-oppna-data/ ; dataportal.se/datasets/805_1441 ; thenmap.net/docs ; GEODOK/51 access page
