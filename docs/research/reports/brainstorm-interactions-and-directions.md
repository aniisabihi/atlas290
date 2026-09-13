# Brainstorm: interaction models and product directions

Draft written before research results arrived; to be reconciled with research findings.
Everything here is an idea to evaluate, not a decision.

## A. Interaction models beyond "choropleth + line chart"

### A1. The map as a morphing object, not a fixed picture
- **Real map ⇄ Dorling cartogram ⇄ hex grid**: one continuous shape-morph (flubber / d3-interpolate) so the user sees the same municipalities become circles sized by population. Solves Sweden's "empty north, dense south" problem visually and teaches the user why a choropleth lies.
- **Spike map** for absolutes (population, births) vs **fill** for rates. Toggle is animated, not a hard cut.
- **Sweden-as-strip**: because Sweden is ~3:1 tall, a "vertical scrubber" that turns the country into a latitude strip chart (municipality dots by latitude, y = indicator) — the map literally unfolds into a chart.

### A2. Time as a physical control
- **Drag-to-time-travel**: horizontal drag on the map itself scrubs the year (no separate slider needed on touch). Municipalities re-colour, the year counter ticks.
- **"Since you were born"**: user enters a birth year; every indicator is shown as change since then. Cheap, personal, memorable.
- **Ghost trails**: on the scatter/"galaxy" view, dragging time leaves faint trails so the user sees trajectories (Gapminder trails).

### A3. Comparison as a first-class gesture
- **Pin two, see a "versus" card**: click municipality A, shift/long-press B. Small multiples of the same charts side by side, with the delta highlighted.
- **"Municipalities most like X"**: kNN on standardised indicators; hovering the result highlights them on the map. Discovery through similarity rather than through menus.
- **Swap the axis**: any chart can be dragged onto the map to become its colour encoding (drag-and-drop encoding). Ambitious but very demonstrable.

### A4. Discovery over querying
- **Auto-surfaced facts ("Did you know")**: rule-based outlier detection (z-score, IQR, biggest rank movers, longest streaks) computed at build time; each fact is a deep link into the exact view that shows it. Deterministic, testable, no LLM.
- **Rank movers**: a bump chart of who climbed/fell most in the last N years, tap one to fly to it.
- **Extremes strip**: for the current indicator, the top-5 and bottom-5 as a little ribbon under the map; hovering flashes them.
- **Serendipity button ("Slumpa")**: random municipality + its three most unusual traits.

### A5. Preference elicitation that is not a form
- **"Where should I live?" as sliders on a balance beam**: each preference is a weight; the map re-ranks live (debounced), top-10 pop up as pins. Show *why* each municipality scores (contribution bars) — explainability beats a black box.
- **Pairwise choices ("this or that")**: show two municipalities' profiles, user picks, 6–8 rounds infer weights (like a Tinder-style preference elicitation). More playful; harder to make honest — needs a visible "here's what we inferred" panel and an escape to sliders.
- **Constraint painting**: draw a rough region on the map to restrict the search (e.g., "anywhere within 2 hours of Stockholm" using commuting data if available).

### A6. Games and challenges (portfolio-differentiating but must not eclipse the explorer)
- **"Guess the municipality"** (Worldle/Tradle-style): show its shape + 3 stats, guess; each guess reveals direction/distance. Daily seed for repeat visits. Very shareable.
- **"Higher or lower"** with two municipalities and one indicator.
- These are cheap once the data model exists and they create the "genuinely want to explore" feeling.

### A7. Narrative / scrollytelling
- **Data stories**: 3–5 curated scroll-driven stories ("How Sweden aged", "The great urbanisation", "Where the newcomers went"), each step driving the same map/chart components. Demonstrates the component architecture (one state machine, many views).
- **Per-municipality "profile" page** that reads like a short article generated from rules ("Västerås grew by 12% since 2010, faster than 80% of municipalities, mainly through immigration"). Static, deterministic, SEO-able, deep-linkable.

### A8. Non-visual and accessibility-native interactions
- **Keyboard map navigation**: arrow keys move focus between geographic neighbours (adjacency graph precomputed from topology). Screen-reader announces municipality + value + rank.
- **Sonification**: play an indicator across the country north→south as a tone sequence (Tone.js / WebAudio). Rare, memorable, accessible.
- **Table twin**: every view has a live, sortable table twin (also the a11y fallback for Canvas).
- **Reduced-motion path**: morphs become cross-fades.

### A9. Small-area zoom (if DeSO/RegSO data is usable)
- Click a municipality → it expands into its DeSO/RegSO neighbourhoods (semantic zoom). Turns 290 units into ~6,000 and makes cities interesting (Stockholm as one blob is boring; Stockholm as 300 neighbourhoods is a story).

### A10. Flow / migration
- **Domestic migration flows** between municipalities as animated particles or great-arc bundles ("where do people who leave Kiruna go?"). Needs an origin–destination table (SCB has migration by region pairs at some level; verify). WebGL may be justified here.

## B. Candidate product directions (focused → ambitious)

### B1. "Kommunkartan" — one map, many lenses (focused)
- Single-page vector map of 290 municipalities; ~15–25 curated indicators; time scrubber; click for a profile drawer; compare two; shareable URLs.
- Strength: cohesive, finishable, showcases geo + state + a11y + pipeline.
- Risk: can drift toward "dashboard" unless the time/morph interactions are front and centre.

### B2. B1 + Discovery layer (recommended core?)
- Adds the deterministic "facts engine", rank movers, similarity search, per-municipality narrative profiles, cartogram morph.
- Strength: this is what makes it *exploration* rather than *lookup*. Also the most demonstrable data-engineering work (build-time pipeline with tests, provenance, reproducibility).

### B3. B2 + "Where should I live?" (ambitious, product-thinking showcase)
- Weighted ranking with explainability; possibly pairwise elicitation.
- Strength: memorable, personal, shows product thinking; strong demo moment.
- Risk: data honesty (housing price data availability; "nature" proxies), and it's a big UX surface.

### B4. B2 + Games/daily challenge (ambitious, virality)
- Guess-the-municipality daily; higher/lower.
- Strength: repeat visits, shareability, tests the data model in a fun way.
- Risk: can distract from the engineering narrative if it becomes the headline.

### B5. B2 + Small-area (DeSO/RegSO) semantic zoom (most technically ambitious)
- 290 → ~6,000 polygons; Canvas/WebGL justified; data volume forces real engineering (columnar formats, lazy loading, workers).
- Strength: technically the most impressive; unique in the Swedish landscape (verify).
- Risk: data availability at DeSO level, file sizes, and a11y complexity.

### B6. Stories-first (editorial) direction
- The product is 5–8 scroll-driven data stories with the explorer as the "go deeper" layer.
- Strength: highest visual/emotional impact per hour invested; naturally avoids the dashboard trap.
- Risk: content-heavy; the "explorer" may feel secondary; stories date quickly.

## C. What tends to make the strongest portfolio piece (hypothesis)
- A *coherent* core (B2) where every feature reuses one data model, one state machine, one set of view components — so the repo reads as architecture, not as a feature pile.
- One or two *signature interactions* nobody else in the Swedish landscape has (morphing cartogram + time scrub; deterministic facts engine with deep links; keyboard/sonified map).
- A visible, tested, documented *build-time data pipeline* (provenance, reproducibility, dataset metadata, schema validation) — this is the "data engineering" proof and also what guarantees the zero-cost/no-runtime-API property.
- Deliberate *scope discipline*: ship B1 as vertical slice; B2 features arrive as increments, each with an ADR.

## D. Decide-now vs. keep-open (draft)
Decide now:
- Zero-runtime-API principle (all data preprocessed at build time; app is static).
- Municipality (kommun) as the primary unit for v1; county as grouping.
- Vector-rendered Sweden (no raster tiles) — exact renderer TBD after spike.
- Primary data source(s) and license posture; boundary source.
- Language strategy (Swedish UI? English? both?) — affects everything from indicator names to SEO.
- Hosting target and repo/project name.
- Framework + build tooling family.

Keep open until prototyped:
- SVG vs Canvas (spike: 290 polygons + morph + hover on mid-range phone).
- Whether DeSO/RegSO is in scope at all.
- "Where should I live?" scoring model details and elicitation UX.
- Whether any AI is worth it (default: none).
- Exact indicator list beyond the first ~10.
- Story content.
