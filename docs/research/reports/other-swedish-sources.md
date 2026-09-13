# Swedish open data sources beyond SCB PxWeb — fact-finding report

Date: 2026-09-10. Scope: municipality-level (kommun) or finer data for a zero-cost, static-hosted web app. Every license/limit claim below was read on a page fetched today unless marked **UNVERIFIED** or **(search snippet only)**. Live API calls were made where possible to confirm "no key needed".

Legend for "Build-time bulk OK?": can the data be downloaded once and preprocessed into static files, legally and practically.

---

## 1. Kolada (RKA) — api.kolada.se

- **Data:** Thousands of KPIs for all 290 kommuner + 21 regions (live `/v3/municipality` returned 312 entries, type K/L). Areas include "Befolkning", "Arbetsmarknad", "Förskoleverksamhet", "Kultur och fritid", "Infrastruktur, miljö- och hälsoskydd", "Vuxenutbildning", elderly care (U-series), etc. Unit-level (school/preschool, IDs starting "V") data via `/oudata`.
- **API:** **v2 is dead — `https://api.kolada.se/v2/` returned HTTP 410 Gone today.** v3 released 2025-04-04; migration is "/v2/ → /v3/". Swagger: `https://api.kolada.se/v3/docs`; OpenAPI: `https://api.kolada.se/v3/openapi.json`. Paths: `/kpi`, `/kpi/{kpi_id}`, `/kpi_groups`, `/municipality`, `/ou`, `/data/kpi/{kpi_id}/year/{year}`, `/data/municipality/{municipality_id}/year/{year}`, `/oudata/...`. Pagination: `values`, `next_url`, `previous_url`, `count` (count = items on the page, not total). `per_page` default 5000 (OpenAPI: `"Number of items per page","default":5000`).
- **Live checks:** `/v3/data/kpi/N01951/municipality/0180` → population 1970–2025 by gender K/M/T. `/v3/kpi?title=befolkning` → 48 KPIs. `/v3/kpi?per_page=5000&page=2` returned further KPIs, so **>5,000 KPIs exist**; exact total UNVERIFIED (response truncated).
- **License (kolada.se/om-oss/api, verbatim):** "Utnyttjande av data från Koladas API är avgiftsfritt och kräver inget avtal." — "Om du använder data från Kolada i en tjänst, ska källan anges ('Källa: Kolada')." — "Det är tillåtet att använda vår data för kommersiella ändamål." Also: processed/modified data may not be attributed to Kolada; no claiming official partnership with RKA; data may be revised and KPIs removed without notice. No CC license named.
- **Cost / key:** Free, no key, no agreement. **Rate limits:** none stated anywhere (docs, OpenAPI). 
- **Update / history:** published continuously "per source schedules"; population back to 1970; most KPIs much shorter (UNVERIFIED per KPI).
- **Build-time bulk OK?** Yes — no restriction stated; 5000-row pages make full dumps practical.
- **Zero-cost risk:** Low. Main risk is undocumented throttling if you hammer it; batch by year.

## 2. Valmyndigheten — election results

- **Data:** Results for riksdag/region/kommun elections down to **valdistrikt** (6,312 districts in 2026), plus mandates, turnout, candidates, polling stations, and **valdistrikt boundary files** (GIS, SWEREF99 TM, per län + national).
- **License ("Om vår öppna data", verbatim):** "All data är fri att använda, förutsatt att du anger Valmyndigheten som källa." and "Användande av vår data kräver inte några avtal och innebär inte några avgifter." No CC license named. Formats listed: csv (primary), txt, xlsx, xml, json. **No API** — file downloads only.
- **2026 (election 13 Sep 2026):** "Teknisk beskrivning av resultatfiler": results are **zip files containing JSON** at `https://resultat.val.se/resultatfiler/val2026/` — 626 zips (311 preliminary + 311 final: riksdag + 20 regions + 290 kommuner), each with `röstfördelning`, `mandatfördelning`, `summering`; levels valdistrikt / kommun / valkrets / län / riket. Preliminary count updated election night and the Wednesday after; final count Monday–end of week. `index.md5` lists files. Simulation runs 17 Aug–2 Sep 2026. (Directory listing at that URL returned 404 today — use the index file, not directory browsing.) The rådata page says other 2026 files (candidates, early votes) update hourly "20 minutes before each full hour", early-vote counts 06:00 and 14:00.
- **2022:** XLSX per valdistrikt (riksdag 16 MB, region 14 MB, kommun 19 MB) on val.se; CSV/JSON under `data.val.se/filer/val2022/...`.
- **2018:** archived at `historik.val.se/val/val2018/statistik/index.html`: `2018_R_per_valdistrikt.xlsx`, `2018_R_per_kommun.xlsx` (and L/K variants), XML raw data, shape ZIPs.
- **History:** raw data pages for 2002–2022, EU elections 2009–2024, Sametinget 2013–2025.
- **Build-time bulk OK?** Yes (explicitly free, attribution only). **Risk:** Low. Note election-night JSON is preliminary; re-run the build after the final count.

## 3. Lantmäteriet — Öppna data

- **License (lantmateriet.se/oppnadata):** "Creative Commons, CC0" — users may "använda, sprida, göra om, modifiera och bygga vidare på Lantmäteriets öppna data"; attribution encouraged, not required. Per-product exceptions: *Ortnamn Nedladdning, vektor* is **CC BY 4.0** (search snippet only, UNVERIFIED on page); *Markhöjdmodell Nedladdning, grid 50+* CC0 (search snippet).
- **Boundaries:** New product **"Kommun, län och rike Nedladdning"** (launched 2025-02-03, replaces "Administrativ indelning Nedladdning, vektor"): polygons for kommuner, län, riket, as current + yearly versions; delivered as **GeoPackage + JSON description**; free, CC0 (Geotorget page, search snippet; the lantmateriet.se product page confirms content and that access goes via Geotorget). Topografi 250 (GEODOK 56, fetched): "Creative Commons, CC0", includes theme *administrativ indelning*, monthly updates, avgiftsfri.
- **Download mechanism / registration:** **A free account is required.** Topografi 250 docs: deliveries require a registered account in "Mitt konto". Product news page: the download API "kräver behörighet som beställs i Geotorget", auth = Basic Auth or OAuth2. STAC-browser guides exist for Höjddata, Topografi 50/250, Kommun län rike, Ortnamn. `opendata.lantmateriet.se` refused connection twice — UNVERIFIED.
- **Cost / limits:** Free; no rate limits stated. **Build-time bulk OK?** Yes (CC0) once you have an account. **Risk:** Low–medium (account + Geotorget order flow is friction, not cost). Alternative without account: SCB "Digitala gränser" (other agent).

## 4. Skolverket

- **Data:** *Skolenhetsregistret* (all school units, organisation, status; updated daily). *Planned Educations API* (`https://api.skolverket.se/planned-educations/`, stable-v3, HAL+JSON, Swagger): school units with WGS84/SWEREF99 coordinates, education events, gymnasium admission points (min/avg), student counts per program, Skolinspektionen documents/school survey results; statistics per **school unit**. Pagination default 20, max 100.
- **License (verbatim):** "Villkoren i Skolverkets källicens (Creative Commons)" linking to the **CC0 1.0** deed (on both API pages). Search snippet: the CC0 covers Skolenhetsregistret, Syllabus, Planned educations, Susa-navet.
- **Key / limits:** No key mentioned; no rate limits stated. Skolenhetsregistret v2 active since 2024-12-13 at `https://api.skolverket.se/skolenhetsregistret/`; v1 phase-out planned 2025/2026 turn of year. (My guessed `/v2/kommun` path returned 404 — use the Swagger for exact paths.)
- **Municipality-level grades/SALSA:** available through Skolverket's web statistics database ("kommunala jämförelsetal") and SALSA pages, but **no API/license statement** found for that tool. Practical route: Kolada already carries many Skolverket-derived KPIs per kommun.
- **Build-time bulk OK?** Yes (CC0). **Risk:** Low.

## 5. Arbetsförmedlingen / JobTech Development

- **JobSearch API:** live call `https://jobsearch.api.jobtechdev.se/search?municipality=0180&limit=1` returned JSON (6,709 hits for Stockholm) **with no API key**. Filter by municipality code.
- **Historical ads dataset** (data.arbetsformedlingen.se/dataset/job-ads/): ads since 2006, "cirka 6,9 miljoner annonser", JSON in zip, **"Creative Commons CC0"**, bulk files ("Nedladdningsbara filer"). Historical-ads API and Taxonomy API need no key (search snippet). AF's open-data definition: "information som är kostnadsfri, maskinläsbar och tillgänglig för alla att använda och dela fritt, oavsett ändamål".
- **Unemployment per kommun:** Excel time series on arbetsformedlingen.se: "Arbetssökande län och kommun" 1996–Jul 2026 (62 MB, monthly) and "Inskrivna arbetslösa, tid utan arbete per län och kommun" Jan 2006–Jul 2026 (37 MB). **No license stated on that page (UNVERIFIED);** contact statistik@arbetsformedlingen.se. Kolada also has Arbetsmarknad KPIs.
- **Caveat:** `jobtechdev.se` and `forum.jobtechdev.se` failed DNS from this environment today (possibly transient).
- **Build-time bulk OK?** Yes for historical ads (CC0). **Risk:** Low.

## 6. Brå — crime statistics

- **License (bra.se "Data från Brå", verbatim):** "Den statistik som Brå löpande producerar och publicerar får vidareutnyttjas fritt. Användandet är inte heller förenat med några villkor." Not a CC license. "I dagsläget har myndigheten inget publikt API för öppna data."
- **Data:** "Anmälda brott i kommunerna (tabell 120)" — annual Excel, incl. per 100,000 inhabitants, **from 2002** ("Fr.o.m. år 2002"), final through 2025; preliminary monthly. SOL database (`https://statistik.bra.se/solwebb/action/index`): kommun and stadsdel level, monthly. (SOL gave a TLS error "unable to verify the first certificate" via WebFetch — fine in browsers, may need care in build scripts.)
- **Build-time bulk OK?** Yes (Excel). **Risk:** Low; manual/scripted Excel parsing.

## 7. Housing prices — Mäklarstatistik / Booli / Hemnet / Valueguard / Boverket

- **Svensk Mäklarstatistik (Allmänna villkor PDF, verbatim):** stats "får användas i enlighet med dessa allmänna villkor samt citeras under förutsättning att vederbörlig källhänvisning (’Källa: Svensk Mäklarstatistik AB’) görs"; §1.2 "Användaren äger inte rätt att vidareförmedla/vidareförsälja Produkten i kommersiellt syfte."; §1.5 Mäklarstatistik reserves "den exklusiva rätten att i media och i andra offentliga sammanhang redovisa och kommentera prisutvecklingen"; §3.1 all IP retained. → **Not open data**; republishing a municipality price dataset is not permitted beyond citation.
- **Valueguard HOX:** commercial product; bostadsstatistik page offers no free municipality data or reuse terms. **Not usable.**
- **Booli:** all API pages tried returned 404; search snippets say a key + SHA-1 signature is needed. Terms **UNVERIFIED**; treat as not usable.
- **Hemnet:** "BostadsAPI" (integration.hemnet.se) is a broker integration API (search snippet); no open data. **Not usable.**
- **Boverket Bostadsmarknadsenkäten (BME):** annual survey of all 290 kommuner (housing shortage/balance etc.). dataportal.se metadata: license **`http://creativecommons.org/licenses/by/4.0/`**, Excel, publisher Boverket, distributions `metadata.boverket.se/store/1/resource/32` and `/35`. Attribution "ange Boverket och Bostadsmarknadsenkäten som källa" (search snippet). **Usable** as a housing-market proxy. Actual price levels: use SCB (other agent).

## 8. Sveriges dataportal (dataportal.se)

- National catalog harvested nightly from publishers via **DCAT-AP-SE 2.0.0** (RDF). **Search API** (docs.dataportal.se/registry/api): `https://admin.dataportal.se/store/search?type=solr&query=rdfType:http\://www.w3.org/ns/dcat#Dataset+AND+public:true...&limit=100&offset=0` (limit max 100; Solr syntax; fields like `title.sv`); formats RDF/XML, Turtle, RDF/JSON; nightly dump `/all.rdf`; **SPARQL** at `https://admin.dataportal.se/sparql`. No auth, no limits stated. Live query `title.sv:kommun` → **2,110 datasets** (e.g., SKR "Kommun-Bas", municipal boundaries and land from individual kommuner).
- Useful to read **license URIs** programmatically (verified today: Skatteverket tax rates → CC0; Boverket BME → CC BY 4.0; SKR kommungruppsindelning → `licensecategories/nolicense`).

## 9. Nature geodata — Naturvårdsverket, Skogsstyrelsen, SGU, HaV

- **Naturvårdsverket:** "Data publiceras enligt licenstypen CC0 vilket betyder att data kan användas utan begränsningar" (quoted via OSM wiki page; NV's own policy page returned 404 today — treat wording as secondary-sourced). Portals: `oppnadata.naturvardsverket.se` (Skyddad natur, Nationalparker, Naturreservat, Natura 2000, Leder), `geodatakatalogen.naturvardsverket.se`, bulk dirs at `geodata.naturvardsverket.se/nedladdning/` (Skog, Marktacke, Vatmark, Grasmark, Riksintresse...). Protected areas also via WFS (Metria-hosted). Enables "share of kommun area protected".
- **Skogsstyrelsen (verbatim):** "Skogsstyrelsen tillämpar Creative Commons (CC 0) där inte annat anges." Products: Skogliga grunddata (TIFF), REST/WMS, APIs.
- **SGU (verbatim):** "CC0-licens innebär att data tillhandahålls utan kostnad och kan användas och återanvändas utan restriktioner." All data open since 2024-06-09.
- **HaV:** governed by lag (2022:818); terms in a PDF "Villkor och avgifter för öppna data" — **license UNVERIFIED**.
- **Build-time bulk OK?** Yes (CC0). **Risk:** Low; heavy GIS preprocessing.

## 10. SMHI open data

- **License (verbatim):** CC BY 4.0 — "Du har tillstånd att kopiera och distribuera våra öppna data samt skapa bearbetningar. Detta är tillåtet även för kommersiella ändamål." Attribution + mark modifications. Rules: "Du ska endast använda dokumenterade API:er..."; "Lasta inte ner SMHIs tjänster i onödan. Undvik t.ex. massnedladdning..."; use caching. No numeric rate limit; SMHI may block IPs for abuse.
- **API (live, no key):** `https://opendata-download-metobs.smhi.se/api/version/1.0.json` lists parameters: 1 hourly temp, 2 daily mean temp, 22 monthly mean temp, 5/23 daily/monthly precipitation, **10 "Solskenstid"** (only 20 stations, e.g. Stockholm Sol 98735 since 1983). Periods per station: `latest-hour`, `latest-day`, `latest-months`, `corrected-archive`; JSON/XML/ATOM.
- **Granularity:** stations, not kommuner → you must map stations to kommuner; sunshine coverage too sparse for a national "sunniest kommun" ranking. **Build-time bulk OK?** Yes (archive downloads are the intended pattern). **Risk:** Low.

## 11. Trafikanalys / Trafikverket

- **Trafikanalys API:** `https://api.trafa.se/api/data` and `/structure` (`?query=<product code>`), XML/JSON, **no key** (live `structure?query=t10011` worked: buses 2001–2025). Terms: open data "made available without fees or conditions" under lag (2022:818); attribution unless processed; cache strongly recommended. "Fordon i län och kommuner" published annually (Feb) as Excel/PDF and in the statistics portal (also in SCB's statistikdatabasen 2002–2025).
- **Trafikverket Open API / Lastkajen (NVDB):** **registration with e-mail + license acceptance required**; license link "Licens - senaste versionen" → **CC0**; "Vi kommer att övervaka hur mycket trafik som genereras... kommer vi att kontakta dig" (limits in docs, JS portal not readable here). Build-time use fine after registering. **Risk:** Low–medium (account).

## 12. Health — Folkhälsomyndigheten / Socialstyrelsen

- **Folkhälsodata (PxWeb):** API `http://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv/`; live config: **maxValues 10,000; maxCalls 1,000 per 10 s; maxCells 100,000; CORS on**. Filter riket/län/kommun (life expectancy, self-rated health, ANDTS, vaccinations). **License caveat (fohm "Om webbplatsen", verbatim):** FoHM diagrams/tables "får användas fritt av myndigheter och annan offentlig verksamhet ... förutsatt att källa anges" and "Användning för kommersiella syften är inte tillåtet". Whether this covers raw PxWeb data (much of which originates from SCB) is **UNVERIFIED** — check each table's metadata/source. **Risk:** medium (license ambiguity).
- **Socialstyrelsen:** statistikdatabaser page states license **"CC0"**, formats XLSX/CSV, updates annual/monthly; API `sdb.socialstyrelsen.se/sdbapi.aspx`; developer CSV dumps (ekonomiskt bistånd 1990–2025, dödsorsaker 1997–2025, läkemedel 2006–2025). Kommun granularity in those files **UNVERIFIED** here. Attribution format given.

## 13. Skatteverket / Försäkringskassan / Pensionsmyndigheten / CSN

- **Skatteverket "Skattesatser per kommun":** dataportal license **CC0** (`creativecommons.org/publicdomain/zero/1.0/`), JSON/CSV/text via `skatteverket.entryscape.net/store/9/resource/91|93|108`. Verified TSV (2025): År, Församlingskod, Kommun, Församling, Summa inkl./exkl. kyrkoavgift, Kommunalskatt, Landstingsskatt, Begravningsavgift, Kyrkoavgift (~1,800 parish rows); 2026 XLSX exists. SCB has the 2000–2026 series (CC0). **Excellent, tiny, static.**
- **Försäkringskassan:** all official statistics as open data (CSV + API) via dataportal.se; kommun breakdown **UNVERIFIED**; license wording not on page.
- **Pensionsmyndigheten:** open data page lists diary, models, statistics; attribution "ange Pensionsmyndigheten som källa"; **no kommun-level dataset seen**.
- **CSN:** nothing found (UNVERIFIED).

## 14. Riksantikvarieämbetet, Wikidata/Commons, OpenStreetMap

- **K-samsök API:** `https://kulturarvsdata.se/ksamsok/api?method=search&...`, **no key**, JSON/JSON-LD/RDF, bounding-box search; metadata **CC0**. But user terms say you may "inte cacha eller spara data från K-samsök under längre tid än en vecka" and must display "denna sida använder data från K-samsök" — **the one-week cache rule conflicts with build-time preprocessing** unless rebuilt weekly. Some object content is non-commercial. Fornsök/Bebyggelseregistret bulk download exists via RAÄ's open-data portal; formats/license not verified.
- **Wikidata (verbatim):** "All structured data in the main, property and lexeme namespaces is made available under the Creative Commons CC0 License". Good for kommun metadata (P94 coat-of-arms image).
- **Coats of arms (Commons):** licensed per file — e.g., `Stockholm_vapen.svg` is **CC BY-SA 2.5** (author Marmelad) with insignia notice: "The use of such symbols is restricted in many countries. These restrictions are independent of the copyright status." Swedish law 1970:498 §1: registered "svenskt kommunalt vapen" may not be used in trademarks/commercial designations without permission. Displaying arms informatively with attribution is the normal practice; check each file's license.
- **OpenStreetMap (verbatim):** ODbL — "You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors. If you alter or build upon our data, you may distribute the result only under the same license." Public tile servers are **not** free for third-party apps (Tile Usage Policy).

## 15. SKR — Kommungruppsindelning 2023

- 9 groups (A1 Storstäder, A2 Pendlingskommun nära storstad, B3 Större stad, B4/B5 (låg)pendling nära större stad, C6 Mindre stad/tätort, C7 Pendlingskommun nära mindre stad, C8 Landsbygdskommun, C9 Landsbygdskommun med besöksnäring). Excel "Listor och tabeller" 80 kB on skr.se; dataportal datasets 653_26839 (2023) and 653_26816 (historical 1988–2023), JSON/CSV/Excel via `catalog.skl.se/store/1/resource/118|132|198`. **License:** dataportal category "nolicense"; SKR page: data "fritt att använda enligt det omarbetade PSI-direktivet och den nya datalagen 2022". **Usable**, attribute SKR.

## 16. Tillväxtverket / Tillväxtanalys

- **Tillväxtverket "Indelning i stad- och landsbygdstyper":** 3-type and 6-type kommun typology + FA-region typology; **Excel 2026** files (kommuntyper 32.5 kB; FA 19 kB; calculation bases), plus 2021 and 2014 versions. No explicit license; page asks users to "tydligt hänvisar Tillväxtverkets typindelning". Pipos/Serviceanalys requires account and targets public-sector users — not for a static app. Tillväxtanalys statistikportal blocked by CAPTCHA today. Local accessibility index (TTI) documented by Trafikanalys (PM 2025:2); dataset download **UNVERIFIED**.

## 17. PTS — Bredbandskartläggning

- Per-kommun/län/riket tables ("tabellbilagor") in PTS statistikportal; data as of 1 Oct yearly, published late April/early May; Bredbandskartan for maps. **License UNVERIFIED**; `statistik.pts.se` sits behind Radware bot protection (blocked automated fetch), so scripted download may fail. Risk: medium.

## 18. Other notable

- **Trafiklab GTFS Sverige 2:** CC0, but **API key required**; Bronze quota **1 call/min, 50/month**; updated at most daily. Fine for one build-time download of `https://api.resrobot.se/gtfs/sweden.zip?key=...` (stop density per kommun), not for runtime.
- **Polisen events API:** `https://polisen.se/api/events` (params DateTime, locationname, type), no key, **only the 500 latest notices**, no license stated → not suitable for statistics.
- **Systembolaget:** open product API closed 2020-11-01; store API requires portal account (search snippets; portal DNS failed today). Not usable.
- **Svenska kyrkan:** no per-kommun/parish membership download found (only "sverigefinländare per stift och församling" xlsx); no license. Not usable.
- **Riksdagen open data:** not municipal — skipped.

---

## Top 8 sources for a municipality explorer (ranked)

1. **Kolada v3** — thousands of ready-made per-kommun KPIs, free, no key, 5000-row pages, population back to 1970; just cite "Källa: Kolada".
2. **Valmyndigheten** — complete results to valdistrikt for 2018/2022 (XLSX/XML) and 2026 (JSON zips), free with attribution; district boundaries included.
3. **Lantmäteriet "Kommun, län och rike"** — CC0 GeoPackage boundaries with yearly versions (needs a free Geotorget account).
4. **Skatteverket skattesatser per kommun** — CC0, tiny TSV/CSV/JSON, per parish, multiple years.
5. **Brå tabell 120** — reported crimes per kommun and per 100k, 2002–2025, "får vidareutnyttjas fritt" with no conditions.
6. **Skolverket APIs (Skolenhetsregistret + Planned Educations)** — CC0, no key, school coordinates and per-school stats for maps.
7. **Naturvårdsverket / Skogsstyrelsen / SGU geodata** — CC0 protected areas, forest, land cover for "nature" metrics per kommun.
8. **Boverket Bostadsmarknadsenkäten** — CC BY 4.0 Excel, the only open per-kommun housing-market signal found (SCB covers prices).

Honourable mentions: JobTech JobSearch/historical ads (CC0, no key), SKR kommungruppsindelning + Tillväxtverket kommuntyper (classification columns), SMHI metobs (CC BY 4.0, station-based), Trafikanalys API (no key), Wikidata (CC0 metadata + arms image pointers).

## Sources that are NOT usable (and why)

- **Svensk Mäklarstatistik** — proprietary terms: no commercial redistribution, IP retained, exclusive publication rights; citation only.
- **Valueguard HOX, Hemnet, Booli** — commercial/broker APIs; no open license found (Booli terms UNVERIFIED, pages 404).
- **Systembolaget** — open API closed 2020; store API behind account.
- **Svenska kyrkan** — no per-kommun open dataset.
- **Polisen API** — only 500 latest events, no history, no license.
- **K-samsök** — usable only if you accept the one-week caching limit (rebuild weekly); otherwise incompatible with static preprocessing.
- **Pipos (Tillväxtverket)** — account-gated, public-sector audience.
- **Folkhälsomyndigheten-produced tables/diagrams** — non-commercial clause; raw Folkhälsodata license per table unclear (UNVERIFIED) — use SCB/Kolada equivalents where possible.
- **PTS statistikportal** — license unverified and bot-protected; manual download only.
- **Trafiklab GTFS** — key + 50 downloads/month; OK at build time only.
- **Kolada v2** — HTTP 410 Gone; migrate to v3.

## Sources (URLs fetched)

- https://api.kolada.se/v2/ (410) · https://www.kolada.se/om-oss/api/ · https://www.kolada.se/news/nu-slapper-vi-version-3-av-koladas-api · https://api.kolada.se/v3/docs · https://api.kolada.se/v3/openapi.json · https://api.kolada.se/v3/municipality · https://api.kolada.se/v3/kpi?title=befolkning · https://api.kolada.se/v3/kpi?per_page=1 · https://api.kolada.se/v3/kpi?per_page=5000&page=2 · https://api.kolada.se/v3/data/kpi/N01951/municipality/0180
- https://www.val.se/valresultat-och-statistik/statistik-och-data · https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data · https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026 · https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022 · https://www.val.se/valresultat-och-statistik/statistik-och-data/teknisk-beskrivning-av-resultatfiler · https://historik.val.se/val/val2018/statistik/index.html · https://resultat.val.se/resultatfiler/val2026/ (404 listing) · https://data.val.se/
- https://www.lantmateriet.se/oppnadata · https://www.lantmateriet.se/sv/geodata/vara-produkter/oppna-data/ · https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/kommun-lan-och-rike-nedladdning/ · https://geotorget.lantmateriet.se/dokumentation/GEODOK/56/latest.html · https://www.lantmateriet.se/sv/geodata/vara-produkter/Produktnyheter/Geografisk-information/geotorget-nedladdning---nytt-api-for-nedladdning/ · https://www.lantmateriet.se/sv/geotorget-produktstod/guider/anvanda-vara-data-i-stac-browser/ · https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/ortnamn-nedladdning-vektor/ · https://geotorget.lantmateriet.se/dokumentation/GEODOK/OD/api-nedladdning-geotorget-v1-0.html · https://opendata.lantmateriet.se/ (refused)
- https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-skolenhetsregistret · https://www.skolverket.se/om-skolverket/oppna-data/api-for-skolor-utbildningar-och-statistik-planned-education · https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/uppgifter-om-skolenheter-studievagar-och-statistik · https://api.skolverket.se/planned-educations/v3/api-docs · https://www.skolverket.se/skolutveckling/statistik/sok-statistik-om-forskola-skola-och-vuxenutbildning
- https://jobsearch.api.jobtechdev.se/search?municipality=0180&limit=1 · https://data.arbetsformedlingen.se/dataset/job-ads/ · https://data.arbetsformedlingen.se/ · https://data.jobtechdev.se/ · https://arbetsformedlingen.se/statistik/sok-statistik/tidigare-statistik-tidsserier · https://arbetsformedlingen.se/statistik/
- https://bra.se/statistik.html · https://bra.se/om-bra/om-webbplatsen/data-fran-bra · https://bra.se/banners/statistik/databas-over-anmalda-brott · https://bra.se/statistik/statistik-om-rattsvasendet/anmalda-brott · https://statistik.bra.se/solwebb/action/index (TLS error)
- https://www.maklarstatistik.se/wp-content/uploads/Svensk-Maklarstatistik-Allmanna-Villkor.pdf · https://valueguard.se/bostadsstatistik/ · https://www.boverket.se/sv/om-boverket/oppna-data/ · https://www.boverket.se/sv/om-boverket/oppna-data/bostadsmarknadsenkaten/ · https://www.boverket.se/sv/samhallsplanering/bostadsmarknad/bostadsmarknaden/bostadsmarknadsenkaten/om-bostadsmarknadsenkaten/
- https://docs.dataportal.se/registry/api/ · https://docs.dataportal.se/dcat/docs/sparql/ · https://admin.dataportal.se/store/search?... (queries: title.sv:kommun, skattesatser, bostadsmarknadsenkäten, kommungruppsindelning)
- https://oppnadata.naturvardsverket.se/ · https://geodata.naturvardsverket.se/nedladdning/ · https://wiki.openstreetmap.org/wiki/Sweden/Open_data/Naturv%C3%A5rdsverket · https://www.skogsstyrelsen.se/sjalvservice/karttjanster/geodatatjanster/oppna-data/ · https://www.sgu.se/produkter-och-tjanster/geologiska-data/om-geologiska-data/licensvillkor/ · https://www.havochvatten.se/data-kartor-och-rapporter/data-och-statistik/om-oppna-data-och-statistik/om-oppna-data-pa-havs--och-vattenmyndigheten.html
- https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning · https://opendata-download-metobs.smhi.se/api/version/1.0.json · https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/10.json · https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/10/station/98735.json
- https://www.trafa.se/sidor/oppen-data-api/ · https://www.trafa.se/vagtrafik/fordon/ · https://api.trafa.se/api/structure?query=t10011 · https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/ · https://www.trafikverket.se/e-tjanster/hamta-data-fran-trafikverket/
- https://www.folkhalsomyndigheten.se/statistik-och-data/om-vara-data/statistikdatabaser/folkhalsodata-hitta-och-hamta-statistik/ · https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv/?config · https://www.folkhalsomyndigheten.se/om-folkhalsomyndigheten/om-webbplatsen/ · https://www.socialstyrelsen.se/statistik-och-data/oppna-data/ · https://www.socialstyrelsen.se/statistik-och-data/oppna-data/statistikdatabaser/ · https://www.socialstyrelsen.se/statistik-och-data/statistik/for-utvecklare/
- https://skatteverket.se/download/18.262c54c219391f2e96326e2/skattesatser-kommuner-2025.txt · https://www.forsakringskassan.se/om-forsakringskassan/oppna-data · https://www.pensionsmyndigheten.se/om-pensionsmyndigheten/allmanna-handlingar/oppna-data-vidareutnyttjande-av-information
- https://www.raa.se/hitta-information/k-samsok/att-anvanda-k-samsok/api/ · https://www.raa.se/hitta-information/k-samsok/att-anvanda-k-samsok/kom-igang-med-k-samsoks-api/ · https://www.raa.se/hitta-information/k-samsok/att-anvanda-k-samsok/anvandarvillkor/ · https://www.raa.se/hitta-information/oppna-data/ · https://www.raa.se/hitta-information/fornsok/ · https://www.wikidata.org/wiki/Wikidata:Licensing · https://commons.wikimedia.org/wiki/Category:Coats_of_arms_of_municipalities_of_Sweden · https://commons.wikimedia.org/wiki/File:Stockholm_vapen.svg · https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1970498-om-skydd-for-vapen-och-vissa-andra_sfs-1970-498/ · https://www.openstreetmap.org/copyright
- https://skr.se/kommunerochregioner/kommungruppsindelning.8281.html · https://skr.se/resurserochhjalpmedel/skrsoppnadata.8439.html
- https://tillvaxtverket.se/tillvaxtverket/statistikochanalys.1987.html · https://tillvaxtverket.se/tillvaxtverket/statistikochanalys/statistikomregionalutveckling/regionalaindelningar/indelningistadochlandsbygdstyper.1844.html · https://www.tillvaxtanalys.se/statistik/statistikportalen.125715.html (CAPTCHA)
- https://pts.se/internet-och-telefoni/bredband/pts-mobiltacknings--och-bredbandskartlaggning/ · https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning · https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning/dokument-rapporter (bot wall)
- https://www.trafiklab.se/api/gtfs-datasets/gtfs-sverige-2/ · https://polisen.se/om-polisen/om-webbplatsen/oppna-data/api-over-polisens-handelser/ · https://www.svenskakyrkan.se/statistik · https://api-portal.systembolaget.se/ (DNS fail)
