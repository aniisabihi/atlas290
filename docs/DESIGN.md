# Sweden Data Explorer — design

Date: 2026-09-10, revised 2026-09-13 after design review. Status: Plan 1 (foundations and the
first indicator) is implemented and the pantry is committed; the product itself — the map,
time travel, cartogram morph and facts engine described below — is not yet built.
Research behind every factual claim: [docs/research/](research/README.md).

## 1. What we are building

An interactive atlas of Sweden's 290 municipalities that you explore rather than query.

A visitor lands on a map coloured by population change, with a year slider parked at 1968 and one hint: drag it. Dragging makes the country change colour, and the colours mean the same thing in every year, so a municipality that darkens has genuinely changed. A play button runs the years as a short story. A button morphs the real map into a bubble cartogram, where each municipality is sized by population, so the visual lie of a normal Swedish map is fixed in one gesture. A search box finds any municipality by name in either language. Clicking one opens a profile. A clear "Compare with…" button puts a second one beside it. A strip of facts offers things the visitor never thought to ask for, each a link straight into the view that proves it.

**Not** a dashboard, not a wall of charts, not a rebuild of SCB's website, not a chatbot.

## 2. Decisions taken, and why

| Decision                                                                                                                   | Why                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vision: map + time travel + cartogram morph + deterministic facts engine**                                               | Time depth to 1968, a shape-changing map and auto-surfaced facts are all absent from the Swedish landscape. The nearest competitor, Kommunatlas, has none of them.                                                                                   |
| **First slice: the focused map** with search, play, a hand-written facts strip, and the static cartogram as the phone view | Finishable in about six weeks of evenings and weekends, and every later feature plugs into the same core. The play button and facts strip make time lead from day one instead of shipping the competitor's core with fewer indicators.               |
| **SCB is the only data source**                                                                                            | One licence, one API, one client, one municipality-code system. Every number traces to one place. Costs us crime, schools, nature and weather data.                                                                                                  |
| **Bilingual, Swedish and English, from day one**                                                                           | SCB provides indicator names in both languages, and retrofitting a second language touches every screen.                                                                                                                                             |
| **All data fetched and transformed at build time; the site is static**                                                     | Guarantees zero cost by construction and makes the site immune to SCB being slow, changed or rate-limited.                                                                                                                                           |
| **First view: population change, slider at 1968**                                                                          | The first drag is the moment the site earns its keep. The empty panel shows three hand-picked deep links instead of nothing.                                                                                                                         |
| **Colour scales are fixed across all years, computed in the kitchen**                                                      | The slider must tell the truth about change. Per-year recolouring would show relative position shuffling, not real change.                                                                                                                           |
| **Money is inflation-adjusted to current kronor by default**                                                               | Income runs from 1999 and house prices from 1981. Nominal kronor across four decades mostly show inflation. SCB's consumer price index is another CC0 table. Nominal stays visible in the profile and table.                                         |
| **Phones are first-class, and see the cartogram by default**                                                               | The kitchen already computes the bubble layout. Bubbles give equal tap targets, waste no width on a country three times taller than wide, and fix the visual lie. Only the animated morph is deferred.                                               |
| **Search box plus an explicit compare button**                                                                             | Sundbyberg, Solna and Burlöv are pixels on a national map. Search is also the keyboard and screen-reader entry point. "Compare with…" gives touch and keyboard the same path and makes the URL unambiguous.                                          |
| **Links carry a correct title and description now; pre-rendered pages later**                                              | A pasted link should say what it shows. Static pages per municipality are a later increment. The URL grammar is final in the first slice so nothing shared ever breaks.                                                                              |
| **Origin and background indicators are out of scope**                                                                      | SCB publishes population by country of birth per municipality, and an agenda-driven site already puts exactly that on a time slider. Net migration means total, not split by origin. Revisit only with explicit framing rules and a decision record. |
| **The site loads nothing but its own files**                                                                               | No analytics, no tracking, self-hosted fonts, enforced by a content security policy and stated on the site. Cloudflare's own request counts tell us if anyone came.                                                                                  |
| **MIT code, CC0 data files, no coats of arms**                                                                             | Code anyone can learn from, data matching SCB's terms, a notices page for libraries and fonts. Municipal arms carry per-file licences and Swedish insignia law.                                                                                      |
| **Public repository from the first commit**                                                                                | GitHub Actions is free only for public repositories, and this is a portfolio. There are no secrets to protect.                                                                                                                                       |
| **SVG with D3, no map tiles**                                                                                              | 290 shapes is small. SVG gives keyboard focus, screen-reader semantics and shape morphing almost free, at roughly 27 KB of library code instead of 283 KB for MapLibre.                                                                              |
| **Vite, React, TypeScript**                                                                                                | Matches the rest of your work and there is no server to justify anything heavier.                                                                                                                                                                    |
| **Hosted on Cloudflare Pages**                                                                                             | Free, its own clean address, better compression for data files. Vercel's free plan is restricted to non-commercial personal use, which a hiring portfolio sits awkwardly against.                                                                    |
| **No AI anywhere in the product**                                                                                          | Every free hosted model tier is trial-sized or purchase-gated, and in-browser models cost visitors gigabyte downloads. The facts engine is plain statistics, which is also more defensible engineering.                                              |

## 3. Architecture

Three pieces with a hard wall between them.

**The kitchen.** A TypeScript program run offline, on your machine and monthly in CI. It talks to SCB and writes finished files. It never runs in a browser.

**The pantry.** The finished files, committed to the repo: map geometry and bubble layout, one compact file holding all indicators for all municipalities and years, the colour breaks per indicator, the facts file, and a manifest recording where every number came from and when.

**The dining room.** The static website. It reads pantry files and nothing else. No server, no runtime API call, no keys, no third-party requests.

The two sides share only a set of TypeScript types describing a pantry file. Change the kitchen's output shape and the website stops compiling. That is the safety net, and it is the only coupling between them.

### The kitchen, stage by stage

Each stage is separately runnable and separately testable.

1. **Fetch.** Query SCB's PxWeb API v2 for the tables we need, including the consumer price index, chunked to stay under its limits of 150,000 cells per query and 30 calls per 10 seconds. Both languages.
2. **Freeze.** Write raw responses into the repo untouched. After this, the build needs no network, is repeatable, and survives SCB changing anything.
3. **Fix.** Repair Sweden's administrative history. Knivsta did not exist before 2003, Nykvarn before 1999, or Bollebygd and Lekeberg before 1995. Every municipality code in Skåne changed in 1997 and in Västra Götaland in 1998. Heby changed county in 2007. Parents get a flagged break the year a child split off, so Uppsala does not appear to collapse in 2003. From reference year 2025, SCB adds small random noise to population figures and publishes them in separate tables, so old and new series must be stitched and the perturbation marked on every affected value.
4. **Check.** Refuse to publish on anything suspicious: wrong municipality count, missing years, implausible jumps that are not flagged breaks, values outside a declared range, a municipality unreachable by keyboard.
5. **Compute.** Derive what SCB does not publish: inflation-adjusted money, rates per 1,000 residents, rates per 1,000 residents, rankings, fixed colour breaks per indicator, the facts, the cartogram bubble layout, and the adjacency graph with hand-curated edges for islands so arrow keys never dead-end at Gotland.
6. **Publish.** Write pantry files and the provenance manifest. Raw SCB values are labelled as SCB's. Derived values are labelled as our calculation from named SCB inputs with the method stated, because SCB's terms forbid crediting them for numbers we computed.

**Determinism is a requirement, not an aspiration.** Sorted keys, fixed number formatting, no timestamps inside data files. Running the pipeline twice produces byte-identical output, so a data refresh shows up as a readable diff in a pull request.

### Geometry

Municipality and county boundaries come from SCB's own CC0 shapefile: 290 municipalities, roughly 9,700 points, 168 KB, already generalised for thematic maps and already free of sea area. The pipeline reprojects it to WGS84, runs mapshaper's `-clean` with an explicit `gap-width=1.5km` to remove digitisation slivers, and quantises the result into TopoJSON at `1e5`. There is no simplification step and no filtering of small islands: SCB's file already arrives generalised for thematic maps, at 9,748 vertices for the whole country (see [boundary-geodata.md](research/reports/boundary-geodata.md)), so there is nothing left worth stripping — adding a simplify or filter-islands pass here would only remove real shape at no size benefit. Sweden's shape is reproduced with a transverse Mercator projection centred on 15 degrees east, which matches the national grid.

Lantmäteriet's authoritative boundaries are the documented upgrade path if we ever need exact geometry or historical boundaries. They are also CC0, but need a free account, arrive at cadastral precision, and include sea out to the territorial limit, so they must be clipped.

### The website

**The URL is the application's memory.** Indicator, year, selected municipality, comparison partner, map or cartogram, colour mode, table view, and language all live in the address bar. Everything rendered is a function of that. Consequences: every view is shareable, the back button behaves, reloads keep your place, and the state logic is testable as pure text in and view description out. Municipalities are identified by their stable four-digit code with a readable name added for humans.

**One state, many views.** Map, profile panel, comparison, facts strip and the plain data table all read the same state. New views plug into the same socket.

**The map is 290 SVG paths.** Small enough that the browser treats it as ordinary content, which is where the accessibility comes from. The cartogram layout is precomputed in the kitchen; on desktop the browser slides shapes between two known sets of positions, on phones the bubbles are simply the default view with the panel as a bottom sheet.

**Three ways to pick a municipality.** Tap or click it, search it by name in either language, or walk to it with arrow keys. All three land in the same state.

**Time has a play button.** It advances the year on a fixed timer, pauses on interaction, and respects the reduced-motion setting. The year axis always runs 1968 to today; years an indicator does not cover are visibly dimmed rather than hidden.

**One pantry file for the first slice.** Ten indicators across 290 municipalities and about 58 years is small enough to ship as one compact file, which makes the profile and comparison instant and lets the profile show ten small time charts with a cursor that follows the slider. Per-indicator files are the growth path when indicators multiply.

## 4. Data model

Three concepts, deliberately few.

- **Municipality**: code, names in both languages, county, land area, geometry, bubble position, keyboard neighbours.
- **Indicator**: identifier, names and descriptions in both languages, exact definition (which SCB table, content code, age band, treatment of unknowns), unit, price basis for money, scale hint (sequential or diverging and around what reference), fixed colour breaks, coverage years, a bilingual caveat, a minimum-count rule for indicators built from events such as house sales, and a sensitivity class.
- **Observation**: a municipality, a year, a value, and a status: present, not yet published, municipality did not exist, perturbed by SCB noise, too few cases. Absence renders as absence, never zero.

There is no "higher is better" flag. Comparison says "higher on 7 of 10", never "wins". If a preference-ranking feature is ever built, the visitor supplies the direction.

### Starting indicators

Ten to open with, each verified against live SCB metadata as available per municipality.
One changed during the build: the list originally said _median_ age, derived by interpolating
single-year ages. SCB publishes median age only down to county level, never per municipality,
and deriving one ourselves would have cost roughly 130 MB of frozen source data for a figure
we could only locate within a band. SCB does publish **mean** age per municipality directly,
so that is what ships: exact, no interpolation, no precision caveat, at the price of starting
in 1998 rather than 1968. Share aged 65 and over is unaffected — it needs only a threshold at
65, not a full distribution. Measured and decided in the Task 2 spike; see `docs/kitchen.md`.

| Indicator                                                   | From                                           | Coverage     |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------ |
| Population                                                  | Population by age and sex                      | 1968 onwards |
| Population change, per cent                                 | Derived                                        | 1968 onwards |
| Mean age                                                    | Mean age by region                             | 1998 onwards |
| Share aged 65 and over                                      | Derived from age distribution                  | 1968 onwards |
| Net migration per 1,000 residents                           | Migration by region                            | 1968 onwards |
| Median earned income, inflation-adjusted                    | Total earned income plus consumer price index  | 1999 onwards |
| Share with post-secondary education                         | Education level                                | 1985 onwards |
| Mean price of sold single-family houses, inflation-adjusted | Property sale prices plus consumer price index | 1981 onwards |
| Municipal tax rate                                          | Municipal tax rates                            | 2000 onwards |
| Population density                                          | Population, area and density                   | 1991 onwards |

Each gets a one-page specification before any code: exact table, codes, derivation, and both descriptions. The list is deliberately open beyond these.

**Correction, Task 6 (2026-09-14):** this section previously said net migration ran "1997 onwards". That was wrong — checked against live SCB metadata while building the indicator, it is stitched from three tables (TAB1211 1968–1996, TAB1212 1997–2024, TAB6640 2025) and genuinely covers 1968 onwards, matching the verified-facts table in `docs/plans/2026-09-14-02-the-ten-indicators.md`. One real caveat survives: about 49 municipalities renumbered by the 1998 county mergers (Skåne, Västra Götaland) have no 1968–1996 data, because the oldest table was never republished under current codes. See `kitchen/src/indicators/migration.ts` and `docs/kitchen.md` for detail.

## 5. Accessibility

Designed in, not retrofitted. Target: WCAG 2.2 AA, plus a manual screen-reader pass and a Chartability review before each increment ships.

- Search is the universal entry point and works identically for mouse, touch, keyboard and screen reader.
- Arrow keys move focus between geographically neighbouring municipalities, using the adjacency graph built in the kitchen, with curated edges so islands are never dead ends.
- A live region announces name, value, status and rank as focus or year changes, anchored to the selected municipality.
- Every view has a plain sortable table twin, reachable as a URL view, plus a one-sentence kitchen-generated summary of the current map state.
- Colour classes stay distinguishable for colour blindness, every class is also carried in the table and the announcement, and adjacent classes keep at least 3:1 contrast.
- Reduced motion applies to every transition, not only the morph: the play button steps instead of sliding, the morph becomes a cross-fade.
- Profile and compare are non-modal panels with a declared focus target on open, close, back, and deep link.

## 6. Testing

| Layer                   | Covers                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Unit                    | Kitchen maths, code-history fixes, inflation adjustment, statistics, facts templates, URL parsing |
| Snapshot                | Pipeline output, so a data change is always a visible diff                                        |
| Component               | Individual views                                                                                  |
| Browser                 | Clicking, searching, dragging the year, play, morphing, keyboard navigation                       |
| Automated accessibility | Runs in CI and fails the build on violations                                                      |

The code lives on GitHub, CI runs on GitHub Actions, which is free for public repositories, and Cloudflare Pages deploys automatically from the same repository. A scheduled monthly job re-runs the kitchen and opens a pull request when SCB publishes new figures. It must commit something to stay alive, because GitHub disables scheduled jobs after 60 days without repository activity.

## 7. Scope

**First slice, about six weeks of evenings and weekends.** Map of 290 municipalities, the ten indicators above, year slider with play, fixed colour scales, profile panel, search, explicit compare, a hand-written strip of five deep-linked facts, static cartogram as the phone view, URL state with correct titles, both languages, WCAG 2.2 AA, deployed on Cloudflare Pages.

**Then, each as its own increment with a recorded decision.** The automatic facts engine. The animated cartogram morph. Similar-municipality search. Rule-generated profile prose. Pre-rendered municipality pages with preview images.

**Explicitly deferred.** Neighbourhood-level zoom into SCB's 6,160 small areas. A preference-based "where should I live". A daily guessing game. Animated migration flows. Any of these may never be built.

## 8. Known limitations, stated honestly

- Income figures lag about thirteen months; population for a year appears the following February.
- Population data from 2025 onwards carries deliberate small random noise, so totals need not equal the sum of their parts. Every affected value is marked and the site says so where it matters.
- Municipalities created after 1983 have no data before they existed, and their parents carry a flagged break in the split year.
- Commuting data stops in 2021 and election results stop in 2022.
- Rent data is survey-based and likely has gaps for small municipalities.
- House prices in small municipalities rest on few sales in some years and are flagged rather than smoothed.
- SCB provides no crime, school quality, nature or weather data, so those questions are out of scope by construction.

### Sources considered and deliberately not used

All four were researched and are genuinely free. We still said no, to keep one licence, one client and one failure mode.

| Data    | Would come from                                            | Why not                                                                                                                                                        |
| ------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schools | Skolverket open APIs, CC0                                  | Published per school, not per municipality, so we would be inventing the aggregation and implying a league table                                               |
| Crime   | Brå, "Anmälda brott i kommunerna", free with no conditions | Spreadsheets rather than an API, so the fetch step is clumsier for little gain                                                                                 |
| Weather | SMHI open data, CC BY 4.0                                  | Measured at stations, not municipalities. Sunshine is recorded at roughly twenty stations nationally, so a sunniest-municipality map would be mostly guesswork |
| Nature  | Naturvårdsverket, Skogsstyrelsen, SGU, CC0                 | Arrives as map polygons, so any metric means real GIS work intersecting shapes with our boundaries                                                             |

Adding any of them is cheap architecturally, because a source is just another fetch-and-fix module producing the same municipality, year and value. The cost is not code. It is one more licence to honour, one more set of terms to track, and one more upstream change that can break a build. Naturvårdsverket's CC0 status is also unconfirmed at source and would need checking first.

SCB's own land use and area statistics give a partial nature picture without leaving the single source.

## 9. Still open

Deliberately undecided until we prototype or reach them:

- Whether the animated morph needs a Canvas layer beneath the SVG to hold 60 frames per second on a mid-range phone. Canvas, if added, sits under the SVG focus and ARIA layer, never replacing it.
- Bubble cartogram versus hexagon grid for the morph target.
- Indicators beyond the first ten.
- Visual design language.
- Project name, with one hard constraint: it must not suggest affiliation with SCB.
