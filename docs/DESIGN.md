# Sweden Data Explorer — design

Date: 2026-09-10, revised 2026-09-13 after design review, revised 2026-09-14 after Plans 2 and 3, revised 2026-09-15 after Plans 6 to 9.
Status: **the first slice is complete** — all five plans are implemented. The kitchen fetches, freezes, checks and publishes all
ten indicators for 290 municipalities, with map geometry, keyboard adjacency and the bubble
layout; the published pantry is 1.04 MB, 275 kB gzipped, and rebuilds byte-identically from
frozen source. The site now reads it: Swedish and English at their own paths, the whole view in
the URL, the choropleth with a legend that admits what is missing, a year slider with play,
diacritic-folding search, arrow-key navigation over the map, and a debounced live region. Clicking a municipality opens a
profile with ten small histories and, for money, what the figure was at the time; an explicit
compare puts a second beside it with no verdict; a sortable table is the twin of every view; the
bubble cartogram is a view anyone can switch to and the default on a phone; and five
five facts each link into the view that proves them — and since Plan 7 nobody writes those five: the kitchen finds them, one from each of five families, and publishes them with the figures each asserts.

**Plan 6, the first of the second slice, is also done.** The profile now names the five
municipalities most like the one on screen, from a distance metric computed in the kitchen over
all ten indicators and a ten-year window, and opens with two or three sentences telling that
municipality's own story — how much it has grown or shrunk since its first published year, when
it turned, and the one measure it sits furthest out on. Every sentence re-derives its own claim
from the pantry in the tests.

Continuous integration runs 1,071 unit tests, 184 browser tests
across Chromium, Firefox and WebKit, an axe scan of nine page states and a measured performance
budget on every pull request; a monthly job refreshes from SCB and opens a pull request; and the
deploy runs only when all of that is green. What has not been done is written down in
[accessibility.md](accessibility.md) — chiefly that no screen-reader pass has been run. The
cartogram morph shipped in Plan 8 — the 290 shapes travel between the map and the bubbles
rather than cutting — and Plan 9 gave every municipality its own page, so a pasted link names
the place. The second slice is complete, and every increment section 7 lists has shipped.
Research behind every factual claim: [docs/research/](research/README.md).

## 1. What we are building

An interactive atlas of Sweden's 290 municipalities that you explore rather than query.

A visitor lands on a map coloured by population change, with a year slider parked at 1968 and one hint: drag it. Dragging makes the country change colour, and the colours mean the same thing in every year, so a municipality that darkens has genuinely changed. A play button runs the years as a short story. A button morphs the real map into a bubble cartogram, where each municipality is sized by population, so the visual lie of a normal Swedish map is fixed in one gesture. A search box finds any municipality by name in either language. Clicking one opens a profile. A clear "Compare with…" button puts a second one beside it. A strip of facts offers things the visitor never thought to ask for, each a link straight into the view that proves it.

**Not** a dashboard, not a wall of charts, not a rebuild of SCB's website, not a chatbot.

## 2. Decisions taken, and why

| Decision                                                                                                                   | Why                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vision: map + time travel + cartogram morph + deterministic facts engine**                                               | Time depth to 1968, a shape-changing map and auto-surfaced facts are all absent from the Swedish landscape. The nearest competitor, Kommunatlas, has none of them.                                                                                                  |
| **First slice: the focused map** with search, play, a hand-written facts strip, and the static cartogram as the phone view | Finishable in about six weeks of evenings and weekends, and every later feature plugs into the same core. The play button and facts strip make time lead from day one instead of shipping the competitor's core with fewer indicators.                              |
| **SCB is the only data source**                                                                                            | One licence, one API, one client, one municipality-code system. Every number traces to one place. Costs us crime, schools and weather data, and the map-shaped nature data (land cover, protected areas) — but not emissions, which SCB publishes per municipality. |
| **Bilingual, Swedish and English, from day one**                                                                           | SCB provides indicator names in both languages, and retrofitting a second language touches every screen.                                                                                                                                                            |
| **All data fetched and transformed at build time; the site is static**                                                     | Guarantees zero cost by construction and makes the site immune to SCB being slow, changed or rate-limited.                                                                                                                                                          |
| **First view: population change, slider at 1968**                                                                          | The first drag is the moment the site earns its keep. The empty panel shows three hand-picked deep links instead of nothing.                                                                                                                                        |
| **Colour scales are fixed across all years, computed in the kitchen**                                                      | The slider must tell the truth about change. Per-year recolouring would show relative position shuffling, not real change.                                                                                                                                          |
| **Money is inflation-adjusted to current kronor by default**                                                               | Income runs from 1999 and house prices from 1981. Nominal kronor across four decades mostly show inflation. SCB's consumer price index is another CC0 table. Nominal stays visible in the profile and table.                                                        |
| **Phones are first-class, and see the cartogram by default**                                                               | The kitchen already computes the bubble layout. Bubbles give equal tap targets, waste no width on a country three times taller than wide, and fix the visual lie. Only the animated morph is deferred.                                                              |
| **Search box plus an explicit compare button**                                                                             | Sundbyberg, Solna and Burlöv are pixels on a national map. Search is also the keyboard and screen-reader entry point. "Compare with…" gives touch and keyboard the same path and makes the URL unambiguous.                                                         |
| **Links carry a correct title and description now; pre-rendered pages later** _(shipped in Plan 9)_                        | A pasted link should say what it shows. Static pages per municipality are a later increment. The URL grammar is final in the first slice so nothing shared ever breaks.                                                                                             |
| **Origin and background indicators are out of scope**                                                                      | SCB publishes population by country of birth per municipality, and an agenda-driven site already puts exactly that on a time slider. Net migration means total, not split by origin. Revisit only with explicit framing rules and a decision record.                |
| **The site loads nothing but its own files**                                                                               | No analytics, no tracking, self-hosted fonts, enforced by a content security policy and stated on the site. Cloudflare's own request counts tell us if anyone came.                                                                                                 |
| **MIT code, CC0 data files, no coats of arms**                                                                             | Code anyone can learn from, data matching SCB's terms, a notices page for libraries and fonts. Municipal arms carry per-file licences and Swedish insignia law.                                                                                                     |
| **Public repository from the first commit**                                                                                | GitHub Actions is free only for public repositories, and this is a portfolio. There are no secrets to protect.                                                                                                                                                      |
| **SVG with D3, no map tiles**                                                                                              | 290 shapes is small. SVG gives keyboard focus, screen-reader semantics and shape morphing almost free, at roughly 27 KB of library code instead of 283 KB for MapLibre.                                                                                             |
| **Vite, React, TypeScript**                                                                                                | Matches the rest of your work and there is no server to justify anything heavier.                                                                                                                                                                                   |
| **Hosted on Cloudflare Pages**                                                                                             | Free, its own clean address, better compression for data files. Vercel's free plan is restricted to non-commercial personal use, which a hiring portfolio sits awkwardly against.                                                                                   |
| **No AI anywhere in the product**                                                                                          | Every free hosted model tier is trial-sized or purchase-gated, and in-browser models cost visitors gigabyte downloads. The facts engine is plain statistics, which is also more defensible engineering.                                                             |

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

**Three things are deliberately kept out of it**, and only three: whether the year is playing, how
far through the morph the shapes are, and which municipality the pointer is on. Each is where an
input happens to be at an instant rather than a view anybody chose, and writing any of them down
would put a history entry behind a mouse movement and make a shared link carry something nobody
picked. The third was added by [decision 0010](decisions/0010-the-place-beside-the-map.md).

**One state, many views.** Map, profile panel, comparison, facts strip and the plain data table all read the same state. New views plug into the same socket.

**The map is 290 SVG paths.** Small enough that the browser treats it as ordinary content, which is where the accessibility comes from. The cartogram layout is precomputed in the kitchen; on desktop the browser slides shapes between two known sets of positions, on phones the bubbles are simply the default view with the panel as a bottom sheet.

**Three ways to pick a municipality.** Tap or click it, search it by name in either language, or walk to it with arrow keys. All three land in the same state.

**Time has a play button.** It advances the year on a fixed timer, pauses on interaction, and respects the reduced-motion setting. The year axis always runs 1968 to today; years an indicator does not cover are visibly dimmed rather than hidden.

**One pantry file for the first slice.** Ten indicators across 290 municipalities and about 58 years is small enough to ship as one compact file, which makes the profile and comparison instant and lets the profile show ten small time charts with a cursor that follows the slider. Per-indicator files are the growth path when indicators multiply.

## 4. Data model

Three concepts, deliberately few.

- **Municipality**: code, names in both languages, county, land area, geometry, bubble position, keyboard neighbours.
- **Indicator**: identifier, names and descriptions in both languages, exact definition (which SCB table, content code, age band, treatment of unknowns), unit, price basis for money, scale hint (sequential or diverging), fixed colour breaks, coverage years, a bilingual caveat, a minimum-count rule for indicators built from events such as house sales, and a sensitivity class.

  **Correction, Plan 20 (2026-09-21):** this bullet previously said the scale hint carried "sequential or diverging **and around what reference**". The reference half never worked. `scale.reference` was declared as `'zero'` by seven indicators and read by nothing — the zero a diverging legend marks is derived from the KIND, not from the field — and its other value, `'national-median'`, had no producer and no consumer and could not get one: the breaks are fixed across all years (the decision three rows above), and a national median is not, so colouring against it would move a municipality's colour while its value stood still. The field is removed. See [docs/decisions/0022-the-reference-scale-is-not-built.md](decisions/0022-the-reference-scale-is-not-built.md).

- **Observation**: a municipality, a year, a value, and a status: present, not yet published, municipality did not exist, perturbed by SCB noise, too few cases, a redrawn boundary rather than real change, and — from Plan 21 — nothing of this kind here to count. Absence renders as absence, never zero, and the seven statuses exist so that the map can say WHICH absence: a figure that is coming and a thing that does not exist are different claims, and telling a municipality with no holiday-home area that its figure is "not published yet" would be a promise this project cannot keep. See [docs/decisions/0023-what-absence-means-and-the-country.md](decisions/0023-what-absence-means-and-the-country.md).

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

**Correction, Task 6 (2026-09-14):** this section previously said net migration ran "1997 onwards". That was wrong — checked against live SCB metadata while building the indicator, it is stitched from three tables (TAB1211 1968–1996, TAB1212 1997–2024, TAB6640 2025) and genuinely covers 1968 onwards, matching the verified-facts table in `docs/plans/2026-09-14-02-the-ten-indicators.md`. One real caveat survives: 50 of today's municipalities have no 1968–1996 data, because the oldest table was never republished under current codes — 47 renumbered by the 1998 county mergers (Skåne, Västra Götaland), plus Mullsjö, Habo and Heby, which changed county separately. See `kitchen/src/indicators/migration.ts` and `docs/kitchen.md` for detail.

## 5. Accessibility

Designed in, not retrofitted. Target: WCAG 2.2 AA, plus a manual screen-reader pass and a Chartability review before each increment ships.

- Search is the universal entry point and works identically for mouse, touch, keyboard and screen reader.
- Arrow keys move focus between geographically neighbouring municipalities, using the adjacency graph built in the kitchen, with curated edges so islands are never dead ends.
- A live region announces name, value, status and rank as focus or year changes, anchored to the selected municipality.
- Every view has a plain sortable table twin, reachable as a URL view, plus a one-sentence kitchen-generated summary of the current map state.
- Colour classes stay distinguishable for colour blindness, every class is also carried in the table and the announcement, and:
  - class colours come from a ColorBrewer scheme, and sequential ramps have **monotonic lightness**, so their order survives greyscale, a monochrome print, and any degree of colour vision deficiency;
  - the focus and selection indicator is two-tone, and **at least one of its two tones meets 3:1 against every class fill and every no-data fill** (WCAG 2.2 SC 1.4.11);
  - the four statuses that carry no value — did not exist, not yet published, too few cases, redrawn boundary — are told apart by **pattern, not colour**, and never by a grey that could pass for a class;
  - value, class and status are always available as text, so no reading of the map depends on colour at all.

- Reduced motion applies to every transition, not only the morph: the play button steps instead of sliding, the morph becomes a cross-fade.
- Profile and compare are non-modal panels with a declared focus target on open, close and back. A **deep link moves no focus at all** — see the correction below.

**Correction, issue #32 (2026-09-21):** the panels bullet previously named "deep link" as a fourth case with a declared focus target, and the profile implemented it by focusing its own heading on arrival. Both halves were wrong. The heading sits below the map in the document, so a keyboard visitor arriving on `/en/malmo-1280/` was dropped past the skip link, the measure picker, the search, the view switch, the year and the map, with no way forward to any of them; and because this application renders only once the pantry has been fetched, the drop landed at an unpredictable moment after the page was already readable, pulling anyone who had started tabbing out of wherever they were. It also made three tests in the browser suite fail in Linux WebKit alone, which is how it was found. A deep link now leaves focus where the browser put it. Open, close and back keep their declared targets. See [docs/decisions/0018-the-focus-a-link-never-asked-for.md](decisions/0018-the-focus-a-link-never-asked-for.md).

**Correction, Plan 3 Task 6 (2026-09-14):** this bullet previously required "adjacent classes keep at least 3:1 contrast". That is not achievable and the arithmetic is not close. WCAG contrast ratios telescope along a monotonic lightness sequence — the ratio between the first and last class is the product of the ratios between each adjacent pair — and the maximum possible ratio between any two colours is 21:1. Requiring 3:1 between each adjacent pair of `n` classes therefore requires `3^(n-1) <= 21`, capping a scale at **three classes**. Every indicator here has six breaks, so seven. Measured on the real palettes: adjacent pairs of a 7-class Blues ramp span 1.23–1.79:1, and the whole ramp end to end is only 8.27:1. The clause was replaced with the four requirements above, each of which is met and each of which is asserted in `src/map/colour.test.ts`.

A second fact worth stating rather than discovering later: a diverging ramp's two **ends** are nearly identical in lightness — 1.16:1 for RdBu, 1.08:1 for BrBG, 2.13:1 for the PuOr this project uses. Strong in-migration and strong out-migration therefore look alike in greyscale and to someone with no colour vision at all. That is inherent to diverging palettes, not a bad choice of one, and it is why the legend, the announcement and the table twin are load-bearing rather than decorative for the two diverging indicators.

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

**Then, each as its own increment with a recorded decision.** Similar-municipality search and rule-generated profile prose — both **done**, in [Plan 6](plans/2026-09-15-06-similar-municipalities-and-a-profile-that-reads.md), with [decision 0002](decisions/0002-similarity-metric.md). The automatic facts engine — **done**, in [Plan 7](plans/2026-09-15-07-statistics-and-facts-that-find-themselves.md), with [decision 0003](decisions/0003-the-facts-engine.md). The animated cartogram morph — **done**, in [Plan 8](plans/2026-09-15-08-the-morph.md), with [decision 0004](decisions/0004-the-morph.md). Pre-rendered municipality pages with preview images — **done**, in [Plan 9](plans/2026-09-15-09-a-page-per-municipality.md), with [decision 0005](decisions/0005-a-page-per-municipality.md). Every increment named here has now shipped.

**Explicitly deferred.** Neighbourhood-level zoom into SCB's 6,160 small areas. A preference-based "where should I live". A daily guessing game. Animated migration flows. Any of these may never be built.

## 8. Known limitations, stated honestly

- Income figures lag about thirteen months; population for a year appears the following February.
- Population data from 2025 onwards carries deliberate small random noise, so totals need not equal the sum of their parts. Every affected value is marked and the site says so where it matters.
- Municipalities created after 1983 have no data before they existed, and their parents carry a flagged break in the split year.
- Commuting data stops in 2021 and election results stop in 2022.
- Rent data is survey-based and likely has gaps for small municipalities.
- House prices in small municipalities rest on few sales in some years and are flagged rather than smoothed.
- SCB provides no crime, school quality or weather data, so those questions are out of scope by construction.

  _Corrected 2026-09-18 (Plan 16)._ This sentence also said "nature", and that was simply wrong.
  `TAB4357` publishes greenhouse gas emissions per municipality from 2008, which the fourth slice
  ships as `greenhouse-gas-per-resident` without leaving the single source. The limitation held
  for the map-shaped nature data in the table below — land cover, protected areas — and was
  overstated into a claim about environmental data as a whole.

- **"Places like this" weights age and growth twice.** The distance metric behind it uses all ten indicators with one vote each, and two of those pairs measure nearly the same thing: mean age and share aged 65+ correlate at 0.991, net migration and population change at 0.902. So a municipality's age and its growth each carry about two tenths of the weight rather than one. The alternatives — dropping indicators, reweighting, whitening the covariance — were all built and measured, and all change the answer very little (the same nearest municipality for 233 of 290) while replacing a rule anyone can check with one nobody can. Recorded rather than corrected; see [decision 0002](decisions/0002-similarity-metric.md).
- **"Places like this" does not move with the year slider.** It is measured once over the last ten complete years, because a single year's neighbours survive a data refresh only 89 times in 290, and because the tax rate series starts in 2000 — so a per-year version would simply have no answer for 42 of the site's 58 years. The panel states the years it was measured over.

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

Deliberately undecided until we prototype or reach them. Two questions that stood here — whether the morph needs a Canvas layer, and bubbles versus a hexagon grid — were closed by [Plan 8](plans/2026-09-15-08-the-morph.md) and [decision 0004](decisions/0004-the-morph.md): no Canvas, and bubbles. The project name is settled too: **Atlas 290**, chosen by the architect on 2026-09-15 and recorded in [decision 0006](decisions/0006-the-name.md). So is the visual design language, settled on 2026-09-16 from four mockups drawn on the real pantry — editorial, light as standard with both themes and a control, the map as the hero on a plate — in [Plan 10](plans/2026-09-16-10-the-design-language.md) and [decision 0009](decisions/0009-the-design-language.md).

- Indicators beyond the first ten.
