# Conventions

How this codebase is extended, and the rules that are not obvious from the layout. Rationale for
most of them lives in [DESIGN.md](DESIGN.md) and [decisions/](decisions/README.md); this file says
what to do.

## The two-program rule

`kitchen/` is Node. `src/` is a browser. `shared/` is imported by both and may therefore import
neither a DOM API nor a Node API. `kitchen/src/no-dom.test.ts` asserts the kitchen half, and
`vitest.config.ts` runs the two suites in different environments so a leak fails a test rather
than surviving to production.

## Adding an indicator

1. Write a module in `kitchen/src/indicators/`. It exports an `IndicatorDefinition`
   (`kitchen/src/indicators/registry.ts`): the indicator's static metadata plus a
   `build(ctx)` that returns its series.
2. Declare the indicator's **own year range** locally, even when it happens to match population's.
   Every existing module does this deliberately — see the doc comments in `density.ts`, `tax.ts`
   and `migration.ts`.
3. Resolve each content code from the table's **own metadata by its stable Swedish label**, with
   `resolveContentCode()`. Never hardcode a content code: the same code can carry a different
   value in a different table, or in a different era of the same table
   ([decision 0001](decisions/0001-plan-1-build-decisions.md), trap 2).
4. Register it in `REGISTRY` (`ensureRegistered()` in `registry.ts`). `buildAll()` then drives it
   through the shared path — freeze-backed fetch, mapping onto the known municipalities, the
   definition's own status rule, and fixed quantile breaks — and validates that the series has
   exactly one row per municipality and that the id is not already taken.
5. An indicator may fetch nothing: `population-change` (`derived.ts`) is computed from population's
   built series and carries an empty `sources` array.
6. Add the table to the table in [kitchen.md](kitchen.md), and republish.

## Configuration versus code

There is no runtime configuration. No `.env`, no config service, no feature flags — nothing in
`src/` reads an environment variable. What would elsewhere be configuration is either:

- **published data**: indicator names, descriptions, caveats, derivations, sources, colour breaks
  and the facts all come from the pantry, in both languages, written by the kitchen; or
- **code**: the chrome's own strings in `src/i18n/strings.ts`, design tokens in
  `src/styles/tokens.css`, adjacency curations in the kitchen's geometry stage.

Build-time variables and CI secrets are listed in [setup.md](setup.md#environment).

## Changing published data

The pantry's shape is a contract in `shared/pantry.ts`, expressed as zod schemas and validated at
runtime by `src/data/pantry.ts`. Two rules:

- **The absence-status enum is append-only.** Its index is the status byte persisted in every
  published cell; inserting or reordering silently relabels the whole dataset.
- **Rounding is by unit.** `kitchen/src/round.ts` holds `UNIT_DECIMALS`, and `src/i18n/format.ts`
  formats against the same table, so a number is never shown to more precision than it carries.

Any change here means republishing in the same commit. `yarn kitchen publish` must be byte-identical
on a rebuild; CI fails otherwise.

## Ordering and determinism

Anything whose order ends up in a committed file is ordered with `kitchen/src/cmp.ts` — plain
structural comparison, never `String.prototype.localeCompare`, whose result depends on the host's
locale data. The bubble layout is seeded (`geometry/bubbles.ts`) for the same reason.

## URL and routing

- `src/state/url.ts` is the whole grammar: query keys, their order, and the parse/serialise pair.
  It imports no pantry data — it takes a small `PantryMeta` summary, so its tests need no fixture.
- `src/state/useAppState.ts` is the only code that writes history. Playback uses `replace` so 59
  years do not bury the back button.
- A municipality page is `/{lang}/{slug}-{code}/`. `shared/slug.ts` reads **only the four digits**;
  the words are decoration, so a renamed municipality keeps every shared link and a hand-edited
  slug cannot resolve to a different place. `?m=` keeps working for ever.
- Language is navigation, not state: `/sv/` and `/en/` are separate documents with their own `lang`
  and title, so the switch is a real link.

## Accessibility conventions

- Native elements first: a `<select>` for the measure, a range input for the year, real anchors for
  the facts and the language switch.
- One debounced polite live region for the whole page (`LiveRegion`).
- The profile panel is **not** a dialog — no `role="dialog"`, no focus trap, the map stays reachable.
- Every view has a plain sortable table twin, reached through the URL rather than offered as a
  lesser fallback.
- Contrast is asserted against the real stylesheet in `src/styles/tokens.test.ts`, which is why
  `css: true` is set for the site test project.

What is covered and what is explicitly not: [accessibility.md](accessibility.md).

## Editorial conventions

- **No verdicts.** No "higher is better" flag exists; `src/data/compare.ts` declines to add one and
  `SimilarPlaces` is a set with no ordinals or distances.
- **Both languages or neither.** `Strings` is `typeof sv`, so English must carry the same keys with
  the same shapes or `yarn typecheck` fails.
- **Say what is not known.** Caveats, absence patterns and coverage gaps are shown on the page, not
  buried in the repo.
- **Typography, in both languages.** A dash in running text is a spaced en dash (–), with a
  non-breaking space before it so no line starts with one; an unspaced en dash is a range
  (1968–2024). Swedish thousands and the Swedish percent sign take a non-breaking space
  (`1 000`, `32,42 %`); English hugs the sign (`32.42%`). English apostrophes are typographic (’).
  Tests enforce all of it: `src/i18n/strings.test.ts`, `kitchen/src/indicators/registry.test.ts`,
  `kitchen/src/facts/phrasing.test.ts`, `src/profile/story.test.ts`. See ADR-0025.

## Generated artifacts

Never hand-edited; see [codebase.md](codebase.md#generated--do-not-hand-edit) for the regeneration
commands. `public/share/` is deliberately outside the build because text rendering differs between
macOS and Linux.

## Decision records

A change to a decision in [DESIGN.md](DESIGN.md) gets a dated file in
[decisions/](decisions/README.md) stating context, decision and consequences. The haus gate
(`.github/workflows/haus-gate.yml`) checks that a decision-worthy diff carries one.

## Agent guardrails

- Do not edit `public/pantry/`, `kitchen/raw/`, `public/share/`, `dist/`, or `node_modules/`.
- Do not edit haus-managed blocks (`<!-- HAUS:BEGIN … -->` … `<!-- HAUS:END … -->`) or
  haus-owned files under `.claude/` and `.haus-workflow/` — regenerate with `haus apply`.
- Only `yarn kitchen fetch` may reach the network. Nothing else in this repository should.
- Never paste a Cloudflare token or any other secret into a file, an issue or a chat.
