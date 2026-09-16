# How this project works (workflow methodology bindings)

> The few project-specific values the workflow standard (WORKFLOW.md) binds to:
> where the source-of-truth docs live, the test commands the TDD/verification gate
> runs, the highest-stakes logic, and the pre-commit tool. This file is yours to
> edit and haus will not overwrite it.
>
> Everyday commands (dev, build, lint, typecheck, format) and project documentation
> live in `CLAUDE.md` + `docs/` — run **`/docs`** to generate/refresh them.

## Source-of-truth documents

- Spec: docs/DESIGN.md (sections 1 "What we are building", 7 "Scope" and 8 "Known
  limitations") — this project has no separate SPEC. Per-increment specs are the build
  plans in docs/plans/, written one at a time just before execution.
- Design: docs/DESIGN.md
- UX flows: docs/DESIGN.md section 5 (accessibility and interaction) plus
  docs/accessibility.md — there is no separate UX document. The interaction contract is
  in practice the URL grammar (src/state/url.ts): every view is a state, and every state
  is a link.
- Decisions: docs/decisions/ — a dated record for every change to a DESIGN decision.

## Test commands (TDD / verification gate)

- Test (unit + integration): `yarn run test`
- Test (E2E): `yarn run e2e`
- Determinism gate (run with any kitchen change): `yarn kitchen publish` must leave
  `public/pantry/` byte-identical. CI fails on any diff.

## Highest-stakes logic

TDD-only. These produce or interpret published figures, and a silent error here is a wrong
number on a map rather than a visible failure:

- **The published-number path** — `kitchen/src/indicators/**` (including code-history
  fixes, the CKM table cutover and inflation adjustment), `kitchen/src/check.ts`,
  `kitchen/src/breaks.ts`, `kitchen/src/round.ts`, `kitchen/src/stats.ts`.
- **The data contract** — `shared/pantry.ts`. The absence-status enum is append-only: its
  index is a status byte persisted in every published cell, so a reorder silently
  relabels the whole dataset.
- **The map-to-data join** — `kitchen/src/publish.ts` and `kitchen/src/geometry/`. A code
  mismatch means a municipality drawn with another's data.
- **Determinism** — `kitchen/src/cmp.ts` and anything whose ordering reaches a committed
  file.
- **The URL grammar** — `src/state/url.ts` and `shared/slug.ts`. Every published link is a
  promise; these are the only code allowed to define what one means.

## Pre-commit tool

- Tool: **none installed** — no lefthook, no husky, by design. The gate is CI
  (`.github/workflows/ci.yml` and `.github/workflows/haus-gate.yml`) plus the pre-PR
  checklist in `CLAUDE.md`. Run `yarn typecheck && yarn lint && yarn test && yarn build`
  before pushing.
