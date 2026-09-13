# Prior-art survey: interactive "explore Sweden through open data" experiences

Date: 2026-09-10. Method: WebFetch of product pages plus WebSearch. Tags: **[fetched]** = page opened and read; **[search-only]** = existence and description confirmed only via search-result snippets; **[UNVERIFIED]** = could not open, or evidence is weak. Nothing below is described from memory alone.

---

## 1. Swedish landscape

**SCB "Kommuner i siffror"** (kommunsiffror.scb.se) [fetched: app shell + two SCB explainer pages]. Web app (PWA-style, "save as icon on your phone", uses geolocation to pick your kommun). 13 fixed indicators: population since 1970, population change, sex ratio, average age, birthplace, urban/rural share, land use, income 20–64, employment, single-family house prices, household types, tax rates, riksdag turnout. Lets you compare municipalities with each other or with Sweden. Data from Statistikdatabasen. Weaknesses: the app renders nothing without JS; small indicator set; no map-driven exploration in SCB's own description; explainer page last updated 2021. Free.

**SCB "Sverige i siffror"** [fetched]. Quick-facts portal in four themes (people, education/work/money, economy, land/environment) with three tools: Lönesök, Prisomräknaren, Kommuner i siffror. Text-to-speech, easy-read; aimed at students and the public. The companion "Djupdykning i statistik om Sveriges kommuner" page is only a curated gateway into Statistikdatabasen tables.

**SCB Kartor** [fetched]. About a dozen ArcGIS-built map visualisations: population change 2023 by DeSO, 70+ by DeSO, children in economic hardship, election results by voting district (2018, 2022), municipal turnout, cycling distances, holiday-home ownership by kommun. Maps are "dynamically coupled" to charts and filters. Analyst tooling, ArcGIS look, one topic per map.

**SCB Statistikatlas** [fetched: SCB introduction PDF; live tool not found]. This is the most important piece of Swedish prior art for the builder's idea. The atlas opened on a choropleth of one-year population growth per kommun, a correlation scatter (growth vs share elderly), and a "historier" (stories) panel with commentary. A Play button animated time series; selected municipalities left "spår" (traces) across years; Ctrl-click multi-select; hover values; variable pickers for map colour and X/Y/point-size; tabs for histogram, bar, table, parallel axes, time graph; resizable panes; a data manager to load more indicators by topic. Built on Linköping University's NCVA Statistics eXplorer (GAV Flash/ActionScript, later HTML5, also used by OECD and Eurostat) [search-only]. The NCVA host did not resolve today and SCB's Kartor page no longer lists it, so it appears retired [UNVERIFIED]. Lesson: SCB already did "population growth revealed on the map with time animation" a decade ago, as a three-pane analyst tool, and it did not survive.

**Kolada / Jämföraren** (RKA) [fetched: home, help]. 6,000+ indicators, free, no login, API v3 with Swagger. Jämföraren: pre-set views per verksamhetsområde for a focus municipality vs similar municipalities, county, nation; bars, spider diagrams, tables; Excel export. Quartile colour coding (green/yellow/red) and a "Liknande kommuner" tool ranking by a difference index (default 7 most similar) [search-only]. No map anywhere in the docs. Expert-facing, dense; this is the data backbone everyone else (including Kommunatlas) sits on.

**Ekonomifakta "Regional jämförelse"** (Svenskt Näringsliv) [fetched]. Search a kommun or län, add more with a plus sign, get a table of nyckeltal. Table only, no map or charts. Next.js visible in asset paths.

**Regionfakta.com** (Pantzare Information, funded by regionförbund/länsstyrelser) [fetched]. Hierarchical region → topic → table navigation, thematic Sweden maps, quick-fact cards, map-based region selector. Covers a subset of counties. Dated but functional; free.

**Hemnet / Booli / Hitta / Eniro** [Hemnet: 403, search-only; Booli: blog fetched, stats page 404; Hitta/Eniro: no evidence found]. Hemnet shows area-level stats only in Stockholm/Göteborg/Malmö and kommun-level elsewhere, mostly as price-development charts inside listing pages and /statistik pages. Booli's detailed area statistics live in the paid Booli Pro tool; Värdekollen is the consumer face. Related pattern spotted: Norway's Finn.no "areaprofile" pages titled "Sammenlign adressen med der du bor idag" (compare this address with where you live today) [search-only].

**SVT Datajournalistik / Pejl** [fetched]. /pejl/ now presents SVT's data desk: "din kommun" lookups (unemployment, schools, crime), maps (fires, flood risk, train delays), games ("Bygg en väljare"), live trackers, a personal-inflation builder; active into 2025. Valkompass 2026 exists for all 290 kommuner and 21 regions. Weakness seen first-hand: the 2020 "Hur biltätt är det i din kommun" article's embedded map now says "Innehållet är inte längre tillgängligt"; editorial embeds rot. DN/SvD "flyttmönster"-style pieces: nothing surfaced [UNVERIFIED].

**Election result maps** [fetched: SVT 2022 overview + Ale page; val.se; valresultat.org]. SVT: search kommun/valkrets, per-kommun pages with ranked party bars, mandate chart with +/- vs 2018, turnout, dropdown of valdistrikt, neighbour links, dark mode; OpenStreetMap credited but the fetched HTML is list-first, not map-first. val.se: tables and PDFs, defers to SCB. **valresultat.org** (independent) is the real map product: 2006–2022, all three elections, drill to valdistrikt, colour by winning party or by one party's strength, district search, data "freely usable". **fortidsrostning.jakobohlsson.se** (independent, open source on GitHub): 2026 early-voting map by kommun and polling station, per 1,000 eligible, 2022 comparison, a mobilisation index, weather correlation via SMHI. **Kommunkollen.org** (Hasty.se): map coloured by largest party in each kommunfullmäktige (S in 99, M 18, SD 6), search by name or postcode, AI-summarised municipal decisions with editor verification, datasets CC BY 4.0.

**Independent municipality explorers**
- **Kommunatlas.se** (Aifred AB) [fetched: home, karta, jämför]. The closest competitor. 81 Kolada indicators (updated 2026-09-01), SCB boundaries. Map coloured by any nyckeltal with hover values; click to a municipality page with rank among 290 and star bookmarks; a "kommunutforskaren" animated bubble chart (Gapminder-style, X/Y/size/year, play at 0.5×/1×/2×, regional filter) for 2020–2025; pre-built analyses ("Hänger jobb och trygghet ihop?"); topplistor; two-municipality side-by-side vs rikssnitt, but only for pairs in the same county or among the largest municipalities; life-situation guides (e.g. relocating families). Google Analytics + Clarity; free. Weaknesses: utilitarian visual language, Kolada-only indicators, restricted compare pairs, no time travel beyond 2020, no narrative, game or flows.
- **Kommunkollen.nu** [fetched]. Directory: search, all municipalities, largest/smallest lists, "veckans kommun", random-municipality button; population and tätorter; ads (addrevenue). SEO-flavoured.
- **sverigeskommuner.net** (Årsunda Webbinvest AB) [fetched]. SEO portfolio site: boundary map, lists by län/landskap, coats of arms, tax, size rankings.
- **orti.se/en/municipality** [403; search-only]. "Interactive map with municipal boundaries; click for info, news, statistics"; has an English path.
- **Kommunkartan.se** (Kamin AI AB) [fetched]. Local news/decision aggregator on a map (bygglov, detaljplaner, Trafikverket, police); freemium 25 kr/month; API. Different job, same canvas.
- **medborgardata.se** (Jan-Eric Ramberg) [fetched]. Power BI reports: births/moves per kommun per month, drill riksnivå → län → kommun → ~3,300 areas; wages, elections by district, emissions, schools, energy prices. Rich but Power BI-shaped.
- **demografie-europa.eu/en/sweden** [via Nya Dagbladet article; site itself UNVERIFIED]. Time-slider map of foreign-background share by kommun 2002–2020, made by an AfD MEP and promoted by a nationalist outlet. Relevant as a warning: the "reveal demographic change over time on a map" pattern is already in use for agenda-driven framing; a neutral, well-designed version does not exist.
- **Datastory** [fetched]. Swedish non-profit (founder ex-Gapminder); tools include a School Map comparing all schools in Sweden, Poll of Polls, Hypothetical Riksdag; SKR works with them [search-only]. **Newsworthy** (J++) [search-only]: automated local news per kommun, 300+ feeds, B2B.
- **Geodata/GitHub**: stefur/swemaps (GeoParquet kommuner, län, valdistrikt, FA regions in WGS84, MIT) [fetched]; borstell/swemapdata (R) [search-only]; miroli's 2015 gist "Simple Circle Map of Sweden" (d3 + TopoJSON, circle radius = sqrt(land area)/5, Mercator, 360×600) [fetched]; vincentorback and giorgi-ghviniashvili gists with SCB JSON/TopoJSON incl. sweden-municipalities, jnordgren GeoJSON, simon-johansson/kommunkoder [search-only]. dataalbum.github.io/municipalities is Finnish, not Swedish.

**SKR "Kommunens Kvalitet i Korthet"** [search-only]. ~260 municipalities, ~40 nyckeltal in three areas; results published inside Kolada Jämföraren; municipalities post their own KKiK pages. **Regional RUS dashboards** [fetched: Region Gävleborg, Region Kalmar]. Gävleborg: Power BI, "best in a desktop browser", built "for those who work with regional development", data uploaded June 2026. Kalmar: "Regionatlas" interactive fact tool (platform not stated). Västernorrland "Analysportal", Örebro "interactive statistics tool" [search-only]. All professional-facing.

## 2. Nordic

**SSB Kommunefakta** [fetched: index + Oslo]. Best-in-class municipal profile: six sections, icon key-figure cards with one big number ("729 437 personer"), population pyramid, bars, a population line with projection to 2050, donuts; "Sammenlign folketallet med annen kommune" search; deep links to source tables. Clean, mobile grid. No map-driven exploration on the profile.

**Statistics Finland Paavo / Kuntien avainluvut** [both URLs 404; search-only]. Paavo: postal-code statistics since 1990, free, WMS/WFS at geo.stat.fi. Kuntien avainluvut: PxWeb tables, not a designed experience.

**Statistics Denmark Kommunekort** [fetched, partial]. Eight themes with indicator counts (17 municipal accounts, 8 elderly care, 12 disability...), "compare municipalities"; interaction not visible in the fetched HTML.

**CBS in uw buurt** (NL) [cbsinuwbuurt.nl now serves gambling content: UNVERIFIED live; described via Webmapper's project page (fetched) and cbs.nl search hits]. ~75 indicators at gemeente/wijk/buurt/centre and 100 m / 500 m grid; compare two or more areas anywhere in the country; map → charts → tables; multiple years. Webmapper hosted it 2015–2023. Lesson: a lapsed domain is product death (also Teleport, below).

## 3. International statistical portals

**ONS Census Maps + Custom area profile** [maps page is a JS shell; GitHub repo ONSdigital/dp-census-atlas and ONS Digital blog fetched]. SvelteKit + MapLibre + Tailwind + TypeScript, MIT. URL is the primary application state (viewport and selections), so every view is a shareable link. Data is three flat-file APIs on S3: CSV values by geography, JSON class breaks, GeoJSON metadata; no server. Custom profile: search, draw polygon/circle or upload boundary → best-fit aggregation of output areas via Nomis API → downloadable profile; Pym embeds.

**Census Reporter** [fetched]. Search place or address → profile in five categories, each figure with pre-computed context against parent geographies (plain-language "how this place fits"); choropleths, distributions; CSV/Excel/geo export; open source, donation-funded. **Data USA** (Deloitte + Datawheel) [fetched]: 47,000 auto-generated reports over 37,016 locations, compare reports. **Google Data Commons** [docs fetched]: knowledge graph, Timeline/Scatter/Map explorers, natural-language search, MCP server, open source.

**Gapminder / Vizabi** [tools page returned empty; Vizabi repo fetched]: BSD-3 framework for bubble/time-slider tools, 6,600+ commits. **OWID Grapher** [explorers index + repo fetched]: explorers are admin-configured dropdown-driven chart/map/table views; TypeScript/React/Mobx; note the code is no longer MIT (view-only).

## 4. "Where should I live" tools

**NYT Opinion quiz (Nov 2021)** [nytimes.com blocked; search-only]: ~17,000 US places, 30+ metrics, question-driven. **Washington Post climate risk/resilience (Nov 2024)** [403; search-only]: look up a city, 28 factors, combined risk of six hazards; also walkability and heat trackers. **CNN 2024** [451]: ten toggleable factors [search-only]. **Movemap** [fetched]: "select at least 3 statements that match your lifestyle" (nine statements: winters, heat, rain, density, housing cost, mountains, coast, airport) → filters 3,143 counties and shows the live count of matches → county map with 40+ filters; freemium. **Teleport Cities** [search-only]: free, well-funded, acquired 2017, silently died in 2024, domain now gambling. **Nomads.com** [fetched]: Nomad/Solomad/Family scores, 500+ filter criteria, card grid, $19.99 lite tier. **Numbeo** [fetched]: 9.9 M crowd-sourced prices, 12,865 cities, two-city comparison, API licensing. The Pudding "Where should you live": no such essay found [UNVERIFIED]; **A People Map of the US** [fetched]: city names replaced by most-viewed Wikipedia resident, circles sized by pageviews, hover, UK version; Wikipedia API 2015–2019.

## 5. Playful data experiences and games

**Radio Garden** [fetched]: spin a globe, green dots are stations, click to tune; Studio Puckey + Moniker; the reference for "the globe is the UI". **Population.io** (World Data Lab) [fetched]: enter birthdate + country → your rank in world population, life expectancy; live. **Worldle** [fetched]: guess the country from its silhouette, six guesses, feedback = km distance + direction arrow + proximity %; daily at local midnight; no repeat within 100 days; spoiler-free share grid; iOS/Android apps. **Globle** [fetched]: colour-by-proximity on a globe, daily. **Tradle** (OEC/Datawheel, March 2022) [403 on both hosts; search-only]: guess the country from its export treemap, six guesses, same distance/arrow/% feedback. **Flourish bar chart race** [fetched]: free tier, clickable legends, timed captions, running counter; the FT/Burn-Murdoch "most populous cities 1500–2018" Observable notebook that popularised it [429; search-only].

## 6. Cartograms and flows

**Datawrapper cartograms** [fetched]: Dorling cartograms for US, world, German states; use a cartogram when the story is "how many people are affected", a geographic map when it is "where"; because readers first see "just circles", add labels at zoom 1 and prominent names in tooltips. **odi.hexmap.js / HexJSON** [fetched]: 5 kB gzipped SVG hexmap library, hover, colour by value, CC BY 4.0, superseded by oi.hexmap.js; UK constituency hex layouts openly licensed. **Observable Dorling notebooks** (jgaffuri Eurostat NUTS population, Joe Davies animated, Harry Stevens) [429; search-only]: d3-force collision from centroids.

**Flowmap.blue** [fetched]: paste a Google Sheet of origin-destination rows → deck.gl/Mapbox/d3 flow map with clustering, animation, time filtering; CC BY-NC. **The Refugee Project** (Hyperakt + Ekene Ijeoma) [fetched]: circles per country, 50-year time slider, narrative events alongside UNHCR data. **The Global Flow of People** (Sander/Abel/Bauer, Science 2014) [global-migration.info now redirects to an unrelated site; described via seeingdata.org]: chord diagram of flows between 196 countries per five-year period 1990–2010. **peoplemovin** (Carlo Zapponi, 2011) [403; search-only]: slopegraph, origins left, destinations right, line width = migrants, World Bank data, 215 M people.

---

## Patterns that work (and who proved them)

1. **Map coloured by one indicator, hover shows value, click opens a profile** – Kommunatlas, ONS Census Maps, CBS in uw buurt, valresultat.org.
2. **URL as the whole application state** so every view is a shareable deep link – ONS dp-census-atlas.
3. **Zero-backend flat files** (CSV values + JSON breaks + GeoJSON) – ONS; cheap, fast, and immune to the server rot that killed Statistikatlas, CBS and Teleport.
4. **Play button over a time axis with traces for selected units** – SCB Statistikatlas (spår), Gapminder/Vizabi, Kommunatlas bubbles, Refugee Project.
5. **Every number shown in context**: quartile colours (Kolada), "vs rikssnitt" (Kommunatlas), pre-computed plain-language comparison to parent geography (Census Reporter).
6. **One big number per card with an icon** – SSB Kommunefakta; instantly readable on mobile.
7. **"Similar municipalities" by difference index instead of geographic neighbours** – Kolada.
8. **Preference → live count of matches → map** – Movemap ("select at least 3 statements", count updates), Nomads filters, NYT 30-metric quiz.
9. **Daily guess game with distance + direction + % feedback and a spoiler-free share grid** – Worldle, Tradle, Globle; Tradle proves you can guess a place from a data chart, not just a shape.
10. **Cartogram toggle with heavy labelling** – Datawrapper's Dorling guidance; miroli's Sweden circle map shows the geometry is trivial with d3.
11. **Pre-loaded "stories" beside the free explorer** – Statistikatlas historier, Kommunatlas analyses, OWID explorers.
12. **Serendipity buttons** ("random kommun", "veckans kommun") – Kommunkollen.nu; **personalisation hooks** (geolocate your kommun – SCB app; "compare with where you live today" – Finn.no; "your place in the population" – Population.io).
13. **Editorial framing of extremes** ("Solna 2297 bilar/km², Jokkmokk least") – SVT; the cheapest way to make a dataset feel like a fact.
14. **Auto-generated place text** – Data USA (47k reports), Newsworthy.

## Gaps in the Swedish landscape

- **No product is designed for delight.** Everything is analyst-grade (Kolada, Power BI, SCB Kartor), directory/SEO (kommunkollen.nu, sverigeskommuner.net), or utilitarian (Kommunatlas).
- **Time travel is dead.** The only SCB tool that animated municipal change on a map (Statistikatlas) appears retired; Kommunatlas animates 2020–2025 only, and only in a bubble chart. SCB publishes population back to 1970.
- **Nobody fixes Sweden's map problem.** Norrland dominates area while population sits in the south; no public Swedish product offers a Dorling/hex/cartogram view of the 290 kommuner (only a 2015 gist).
- **No preference-based "var ska jag bo?"** Kommunatlas has static life-situation guides, not weighted, live re-ranking on a map.
- **No data game** about Swedish municipalities exists at all.
- **No neutral, well-designed demographic-change-over-time map.** The one found (demografie-europa.eu) is agenda-driven.
- **No flow map of flyttningar between kommuner**, despite SCB publishing in/out migration per kommun (medborgardata shows the counts, in Power BI).
- **Comparison is constrained**: Kommunatlas allows only same-county or big-city pairs; Kolada compares but without a map; nothing highlights a "winner" per indicator.
- **No auto-surfaced facts** for citizens (Newsworthy does it for newsrooms, paid).
- **Nothing bilingual**; only orti.se has an /en path.
- **Durability**: SVT embeds gone, NCVA gone, CBS and Teleport domains hijacked; a static, open-source, snapshot-based site is itself a differentiator.

## Differentiation opportunities for this project

1. **Geographic ↔ Dorling/hex toggle** as a first-class control, with heavy labelling per Datawrapper's advice. Unique in Sweden.
2. **Time travel 1970 → 2025** with play, scrub and traces (revive the Statistikatlas idea in a modern SvelteKit/MapLibre or d3 stack), starting on "population growth revealed on the map".
3. **"Var ska jag bo?" with weighted sliders** that re-rank all 290 on the map live and show the match count (Movemap pattern), using Kolada plus SCB indicators; make it any-pair comparable, unlike Kommunatlas.
4. **Daily "Gissa kommunen"**: show a silhouette plus 3–4 indicator bars (Tradle mechanic), give km-distance + arrow + % feedback, spoiler-free share grid, no repeats within N days.
5. **Auto-surfaced facts** computed from ranks, outliers and biggest changes ("X har Sveriges lägsta medelålder", "Y växte 38 % sedan 2015"), phrased like SVT's extremes and Census Reporter's context sentences.
6. **Flyttflöden**: an animated flow map of moves between municipalities (Flowmap.blue/peoplemovin patterns) that nobody has built for Sweden.
7. **Compare any two** with per-indicator winner pills and rikssnitt reference; state in the URL so a comparison is a link (ONS pattern).
8. **Personal hooks**: geolocate to "din kommun", "jämför med där du växte upp", random-kommun button.
9. **Zero-backend static data snapshots** with visible sources and an open GitHub repo (like jakobohlsson's), so the portfolio piece cannot rot the way Statistikatlas did.
10. **Swedish + English** in one build.

Caveat: Kommunatlas already owns "map + compare + bubble chart on Kolada data". Differentiate on time depth, cartograms, game, facts, flows and visual craft, not on the map-and-compare core alone.

---

## Sources

Fetched and read:
- https://www.scb.se/hitta-statistik/sverige-i-siffror/kommuner-i-siffror/ (rendered SCB homepage)
- https://www.scb.se/hitta-statistik/sverige-i-siffror/
- https://kommunsiffror.scb.se/ (JS shell only)
- https://www.scb.se/hitta-statistik/redaktionellt/testa-scbs-kommunapp/
- https://www.scb.se/hitta-statistik/sverige-i-siffror/om-kommuner-i-siffror/
- https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/kartor/
- https://www.scb.se/hitta-statistik/sverige-i-siffror/djupdykning-i-statistik-om-sveriges-kommuner/
- https://www.scb.se/contentassets/60e2d3bff5194910b1a1ed96eeb7f8fd/introduktion-statistikatlasen.pdf
- https://www.kolada.se/ ; https://www.kolada.se/help/kolada/
- https://www.ekonomifakta.se/fakta/regional-statistik/din-kommun-i-siffror/
- https://www.regionfakta.com/
- https://www.kommunatlas.se/ ; https://www.kommunatlas.se/karta/ ; https://www.kommunatlas.se/jamfor/
- https://kommunkollen.nu/ ; https://kommunkollen.org/ ; https://kommunkartan.se/
- https://sverigeskommuner.net/karta ; https://medborgardata.se/
- https://nyadagbladet.se/inrikes/interaktiv-karta-belyser-befolkningsutbytet-i-sverige/
- https://fortidsrostning.jakobohlsson.se/ ; https://www.valresultat.org/
- https://valresultat.svt.se/2022/ ; https://valresultat.svt.se/2022/kommunval.html ; https://valresultat.svt.se/2022/kommunval-1440-ale.html
- https://www.val.se/english/election-results/elections-to-the-riksdag-and-regional-and-municipal-councils/election-results-2022
- https://www.svt.se/pejl/ ; https://www.svt.se/nyheter/hur-biltatt-ar-det-i-din-kommun
- https://www.booli.se/blogg/bostadsstatistik-pa-omradesniva/
- https://datastory.org/data-stories
- https://www.regiongavleborg.se/regional-utveckling/om-regional-utveckling/regional-utvecklingsstrategi/uppfoljning-av-regional-utvecklingsstrategi/
- https://regionkalmar.se/om-oss/statistik/
- https://gist.github.com/miroli/4280679f81d0006e3142 ; https://github.com/stefur/swemaps
- https://dataalbum.github.io/municipalities/ (Finnish)
- https://www.ssb.no/kommunefakta ; https://www.ssb.no/kommunefakta/oslo
- https://www.dst.dk/da/Statistik/kommunekort
- https://www.webmapper.nl/projecten/cbs-in-uw-buurt/
- https://www.ons.gov.uk/census/maps/ (shell) ; https://www.ons.gov.uk/visualisations/customprofiles/
- https://github.com/ONSdigital/dp-census-atlas ; https://digitalblog.ons.gov.uk/2023/01/17/custom-profiles/
- https://censusreporter.org/ ; https://datausa.io/ ; https://docs.datacommons.org/
- https://github.com/vizabi/vizabi ; https://ourworldindata.org/explorers ; https://github.com/owid/owid-grapher
- https://flowmap.blue/ ; https://www.therefugeeproject.org/ ; https://seeingdata.org/examples-visualisation/global-flow/
- https://radio.garden/ ; https://population.io/ ; https://nomads.com/ ; https://www.numbeo.com/cost-of-living/
- https://pudding.cool/2019/05/people-map/ ; https://www.movemap.io/quiz
- https://worldle.teuteuf.fr/ ; https://globle-game.com/
- https://flourish.studio/visualisations/bar-chart-race/
- https://odileeds.github.io/odi.hexmap.js/ ; https://www.datawrapper.de/blog/cartograms

Attempted, not readable (search-only or UNVERIFIED):
- https://www.hemnet.se/bostadsmarknaden (403) ; https://www.booli.se/statistik (404)
- https://orti.se/en/municipality (403) ; https://ncva.itn.liu.se/explorer?l=sv (DNS failure)
- https://www.kolada.se/verktyg/jamforaren/ (shell) ; https://www.kolada.se/om-kolada/ (404)
- https://kommunkartan.ai.se/ (title only)
- https://stat.fi/tup/paavo/index_en.html (404) ; https://stat.fi/tup/alue/kuntienavainluvut.html (404)
- https://cbsinuwbuurt.nl/ (domain now serves unrelated gambling content)
- https://github.com/ONSvisual/census-maps (404) ; https://datacommons.org/ (shell) ; https://www.gapminder.org/tools/ (empty)
- https://games.oec.world/en/tradle/ and https://oec.world/en/games/tradle-game (403)
- http://peoplemov.in/ (403) ; https://www.global-migration.info/ (redirects to unrelated site)
- https://www.nytimes.com/interactive/2021/11/23/opinion/sunday/best-places-live-usa-quiz.html (blocked)
- https://www.washingtonpost.com/climate-environment/interactive/2024/climate-risk-resilience-factors-us-cities/ (403)
- https://www.cnn.com/interactive/2024/us/where-to-live-best-place-dg/ (451)
- https://open-innovations.org/blog/2024-07-31-uk-cartogram-round-up (403)
- https://observablehq.com/@johnburnmurdoch/bar-chart-race-the-most-populous-cities-in-the-world and https://observablehq.com/@jgaffuri/dorling-cartogram-population (429)
