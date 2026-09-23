# 0025 — The editorial pass

**Date:** 2026-09-23
**Plan:** none — a review of the finished site, screen by screen, in both languages, both themes
and at 1,440, 900, 375 and 320 px, rather than an increment with a plan of its own.
**Status:** accepted. Closes issue #48. Refines ADR-0011 (the profile keeps its full-width row; D4 below is what it
does inside it) and corrects the unit of three indicators published since plans 16, 19 and 21.

## Context

Every earlier record here was written by the change that needed it. This one was written by
looking at the whole: the site as a visitor meets it, with nothing about the code in mind. Most
of what that found was small, and several of the small things were wrong numbers on screen
rather than matters of taste. They are recorded together because they share one cause: each was
correct in the component that produced it and wrong beside the component next to it.

## Decisions

### D1 — Three differences are in percentage points, and the contract says so

`post-secondary-education-gap`, `share-65-plus-vs-country` and `turnout-gap-general-municipal`
each subtract one share from another, and each said so in its own description — "i
procentenheter", "in percentage points" — while its unit said `'percent'`. The profile therefore
printed the 65+ gap as "−5,64 %", which reads as a relative change and is not one.

`Indicator.unit` gains `'percentage-points'` at two decimals, the precision of the shares it is
built from. The enum's order means nothing (a unit is stored as its string, not an index), and the
unit only decides decimals and the facts' noise bound, both identical to `'percent'`, so **no
published figure moved**: the four changed pantry files differ from `main` in the unit field and
nowhere else, which was checked by normalising that field and diffing. A test in
`kitchen/src/indicators/registry.test.ts` now requires the description and the unit to make the
same claim, in both directions, for every published indicator.

### D2 — One table of unit words, shared by the site and the kitchen

The facts quoted bare figures — "6 529,2 mot 0,2" for population density, "29,69 mot 32,64" for
a tax rate — while the profile beside them said "inv/km²" and "%". The unit words lived in the
site alone, so the kitchen could not have used them. They move to `shared/units.ts`, which both
programs import and which imports nothing but the contract's types.

### D3 — Swedish sets a space before the percent sign

The profile said "32,42%" beside a fact saying "11 %". Språkrådet and SCB's own publications
space the sign; English does not. `withUnit` in `shared/units.ts` makes the choice once, with a
non-breaking space so the sign never starts a line.

### D4 — The profile reads as a feature page on a wide screen

ADR-0011 gave the profile the full width because at column width a measure's name and its figure
fought for one line. At 1,440 px that overshot: a name sat a thousand pixels from its own figure,
across a gap the eye crosses forty-four times. Above 64rem the story and the places like it now
form a standfirst column of 21rem on the left, and the measures the body beside it — still wider
than the column 0011 moved them out of, so the fight it ended does not return.

### D5 — The phone gets its own layouts rather than a squeezed desktop

- **Compare** stacks each measure: name, then both figures side by side under their municipality's
  name in its series colour and line style, then the shared trend. The four-column table scrolled
  the second municipality — the reason the panel exists — off the screen. The table keeps
  explicit ARIA roles, because WebKit drops a table's semantics once its display changes.
- **A measure row** puts the figure and its trend side by side under the name: about 100 px a row
  instead of 150, on a profile of forty-four rows.
- **The bar scrolls away** below 60rem. Sticky, its three rows held a sixth of an 812 px screen
  permanently. Its two columns are now equal, so the measure picker is no longer cut to
  "Folkmäng" at 320 px; the theme chip keeps only its icon below 25rem.
- **The arrow-key sentence** is hidden on a device with no fine pointer and no hover. On a phone
  it was two of the caption's five lines, describing keys the visitor does not have.

### D6 — An absence is set as an absence

"måttet publiceras inte för det här året" was set exactly like a figure — monospaced, medium,
full size — so in a column of numbers it was the loudest number there. Absences are now the
display face's italic, smaller and muted, in the profile, the table and the comparison.

### D7 — The theme button names its action and claims no state

It carried `aria-pressed` beside a label that flips, so in the dark theme a screen reader heard
"Switch to the light theme, toggle button, pressed". The label is the action; the state is gone.
The component had no test at all and has three now.

### D8 — The table arrives where the visitor already is

It opens scrolled to the selected municipality, sets its sort direction visibly (a triangle drawn
in borders, since the fonts are subset to the site's own characters), writes a rank as "82 av 290"
under a column already headed "Plats", and marks the selected row and header hover with a fixed
`--on-plate-accent` — the theme's dark-mode accent is about 2.2:1 on the white plate.

### D9 — The method text and the source notes are in both languages (issue #48)

`derivation` and `sources[].note` were the only prose in the contract that was not `Bilingual`,
the one breach of "both languages or neither". Both are `Bilingual` now, and all 42 derivations
and 54 notes have Swedish, written against the declarations rather than the published text, so
every table code, content label, dimension value and status name stays exactly what the code
uses. A note with nothing to translate is written once with `neutral()`
(`kitchen/src/indicators/prose.ts`).

- **`schemaVersion` goes to 2.** A required field changed shape, which is the case ADR-0021
  bumped for and ADR-0022 did not: a bundle built for version 1 cannot read an object where it
  expects a string, and a version-2 bundle cannot read the old string. The index carries the
  version for the whole split pantry, so it is the one number that changes.
- **The content is checked, not only the shape.** `registry.test.ts` refuses a published
  derivation whose Swedish is the English, a note identical in both languages that contains a
  word, and a straight apostrophe in any English prose. The last one is the house-style item this
  record first left alone: the pantry's English mixed 71 typographic apostrophes with 32 straight
  ones, and translating every derivation was the moment to make them one.
- **No figure moved.** Every pantry file was compared with `main` with the prose fields and
  `schemaVersion` removed: fifty files, none different. Names were compared separately, since that
  removal would have hidden them: none changed.
- **A Swedish thousand no longer breaks across lines.** Reading the new text on the page showed
  "gånger 1" at the end of one line and "000" at the start of the next. It was not new: every
  hand-written Swedish name, description and the unit "per 1 000 invånare" used an ordinary space
  where `Intl` writes a non-breaking one. All of them are non-breaking now, except the one SCB
  label the code matches against, and `registry.test.ts` refuses the ordinary space in any
  published Swedish prose.
- The characters the Swedish introduces (”, ×, −) were already in the fonts' subset, which adds
  the design's own typography deliberately, so no font was rebuilt.

## Also fixed

- **`yarn dev` could not serve a municipality page.** `vite.config.ts` read `data/indicators.json`,
  which Plan 13 had split into an index and one file per indicator, so `/sv/malmo-1280/` threw
  ENOENT in development while production served it. `tools/dev-server.test.ts` now covers it.
- **The layout's empty rows drew their gaps.** The 'place' and 'against' rows are empty until a
  municipality is chosen, and a grid gap sits between empty tracks as faithfully as full ones, so
  the facts started 170 px under the map. The layout has no row gap; items bring their margins.
- **Copy.** The tagline no longer hard-codes "1968–2026", which would have gone stale at the next
  refresh and broke across lines after the dash. The country fact states the two-year comparison
  it made ("högre 2025 än 1985") rather than "har stigit sedan", which both claimed a trend and
  needed a definite noun no pantry name can supply. "platserna som liknar den" is "kommunerna som
  liknar den mest". The compare summary puts the name inside its sentence. "depends on what you
  are for" is "what you are after". "Närmast över 10 mått" is "Mest lika sett till 10 mått". The
  notices no longer call the site a database, nor a "cooperation" with SCB. "till idag" is
  "till i dag", as everywhere else.
- The similar-places heading is an `h3` and was styled by an `h2` rule, so it alone rendered bold
  sans; the compare heading drew two rules, one under its text and one under the header.

## What the second pass found

A second full pass, over states the first did not open — the fold-out, the search, sparse and
suppressed years, a diverging legend, English throughout, and 320 px everywhere:

- **The absence key was drawn as colour classes.** Both legend lists answered to `.legend li`, so
  an absence took a class cell's flex share and full-width swatch: one pattern stretched across
  the column and its words wrapped a syllable at a time. The class ramp is `.legend-classes` now.
- **At 320 px the legend broke its own numbers** — "10 71" over "5" — because seven labels had 40
  px each and `overflow-wrap: anywhere`. Below 30rem the ramp is a two-column key, filled top to
  bottom so it still reads lowest to highest.
- **"noll ligger här" pulled its class label off the line** the other six sit on. It is its own
  line now, with a caret at the swatch.
- **The fold-out's subheadings had no style.** They are `h3`s and the rule was written for a `dt`
  the markup no longer has, so "Publiceras för" was the largest type in the column after the year.
- **The method text is English on the Swedish page**, and said nothing about it: the kitchen wrote
  `derivation` and source notes once, in English. The pass first shipped a stopgap — `lang="en"`
  (WCAG 3.1.2) and a line saying so — and filed
  [issue #48](https://github.com/aniisabihi/atlas290/issues/48); D9 then closed the issue in the
  same pull request and the stopgap is gone.
- **Search put what was typed last.** Folding made "sö" match "so", which is right, but also
  ordered Sollefteå, Sollentuna and Solna above every name that begins "Sö". Folding still decides
  what is offered; within a tier, a literal prefix now comes first.
- **The result count sat under the label**, half behind the list and across the bar's rule. It is
  spoken always and shown only when nothing matched, in the list's own box.
- **The plate grew by a line on switching to the bubbles**, whose caption runs to three lines at
  every desktop width; the caption now reserves three.
- **English ran long:** the tagline took four lines to Swedish's three, and "Search for a
  municipality" in capitals was wider than its field. Both are shorter; the placeholders are
  "Skriv ett namn" / "Type a name", which fit 320 px.
- **At 320 px a figure took four lines** because the trend column kept 10.5rem; it now gives way
  first. Close no longer wraps onto a line of its own under the compare search.
- The site's own English uses the typographic apostrophe throughout.

## Left as it is, deliberately

- **The spaced em dash.** Swedish convention is a spaced en dash (–); the site uses a spaced em
  dash (—) consistently in more than 150 sentences, 120 of them in the pantry's indicator prose,
  most of that inside the published-number modules. Changing it is a house-style decision with a
  large diff and no reader who is misled today, so it is not made here.
- **Five facts in a three-column grid** leave one cell empty. Making one fact span two would say it
  mattered more, which ADR-0003 refuses.

## Consequences

`public/pantry/` changes in forty-five files: `facts.json` (the wording and units of four
sentences), the index (`schemaVersion` 2 and the unit field of three indicators), and every
indicator file (its derivation and notes in both languages, English apostrophes made typographic,
and the unit field of three). No value, status, break or layout moved. Two publishes from the same
frozen responses are byte-identical.
