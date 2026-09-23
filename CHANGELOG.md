# Changelog

Notable changes to Atlas 290, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Entries from 1.1.0 onward are generated**, by release-please, from the Conventional Commit
subjects that land on `main` — so the commit subject you write _is_ the changelog line someone
reads. `feat`, `fix`, `perf`, `refactor` and `docs` appear here; `chore`, `test`, `style` and `ci`
stay in git. 1.0.0 below was written by hand, once, because everything in it predates the
convention.

What a version number means here:

| Part      | Changes when                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MAJOR** | A published URL stops working. The URL grammar (`src/state/url.ts`, `shared/slug.ts`) is the only promise this project makes outward — `?m=`, `/sv/malmo-1280/`, every pasted link. A redesign is not a breaking change; a renamed path is. |
| **MINOR** | The site or the kitchen does something it did not do before, and every existing link still resolves.                                                                                                                                        |
| **PATCH** | Something that was wrong is right.                                                                                                                                                                                                          |

The monthly SCB refresh does **not** cut a release. New data arrives as its own reviewable pull
request and writes its own line to [docs/refresh-log.md](docs/refresh-log.md); a version marks a
change to the software. See
[decision 0012](docs/decisions/0012-releases-and-a-changelog.md).

## [1.6.0](https://github.com/aniisabihi/atlas290/compare/v1.5.0...v1.6.0) (2026-09-23)


### Added

* **site:** the editorial pass ([#49](https://github.com/aniisabihi/atlas290/issues/49)) ([c3bb7af](https://github.com/aniisabihi/atlas290/commit/c3bb7af85975b1f5f70a278c25b26e94e6800610))

## [1.5.0](https://github.com/aniisabihi/atlas290/compare/v1.4.0...v1.5.0) (2026-09-21)


### Added

* **site:** bubbles sized by the measure, a table that arrives, and an editorial polish ([#46](https://github.com/aniisabihi/atlas290/issues/46)) ([9fb2ce7](https://github.com/aniisabihi/atlas290/commit/9fb2ce7057020989d6c5b3bb0648f72ae705db98))

## [1.4.0](https://github.com/aniisabihi/atlas290/compare/v1.3.1...v1.4.0) (2026-09-21)


### Added

* **kitchen:** absence that says which, and a place against the country ([#44](https://github.com/aniisabihi/atlas290/issues/44)) ([b5565ca](https://github.com/aniisabihi/atlas290/commit/b5565ca191893ba82c650275d47c31a9cf9c7e41)), closes [#40](https://github.com/aniisabihi/atlas290/issues/40) [#42](https://github.com/aniisabihi/atlas290/issues/42)

## [1.3.1](https://github.com/aniisabihi/atlas290/compare/v1.3.0...v1.3.1) (2026-09-21)


### Fixed

* **kitchen:** scale.reference goes, and a share stops pretending to diverge ([#41](https://github.com/aniisabihi/atlas290/issues/41)) ([85ce5e7](https://github.com/aniisabihi/atlas290/commit/85ce5e72d9278ac31dc0815019c2291647bd9b91))

## [1.3.0](https://github.com/aniisabihi/atlas290/compare/v1.2.0...v1.3.0) (2026-09-21)


### Added

* **kitchen:** sparsity in the site, and seven more indicators ([#39](https://github.com/aniisabihi/atlas290/issues/39)) ([0ac183f](https://github.com/aniisabihi/atlas290/commit/0ac183f60a177503044852f79fc1eb354ff79d06))
* **kitchen:** the sparse-series design, and eight more indicators ([#34](https://github.com/aniisabihi/atlas290/issues/34)) ([a766afd](https://github.com/aniisabihi/atlas290/commit/a766afd233bf51a8f3b6a07986b77b5f4e5fbfb2))


### Fixed

* **profile:** a link that names a municipality takes no focus ([#33](https://github.com/aniisabihi/atlas290/issues/33)) ([7189185](https://github.com/aniisabihi/atlas290/commit/718918577d2ac5ef41411ab21e17b3698e43f3a5)), closes [#32](https://github.com/aniisabihi/atlas290/issues/32)


### Performance

* **site:** address the review of the view-rebuild fix ([222a830](https://github.com/aniisabihi/atlas290/commit/222a830c8b1c80f06f16d9c35e57e91c6f2def8f))
* **site:** the view is built once, not thirty-five times ([b0a19de](https://github.com/aniisabihi/atlas290/commit/b0a19de978426444b3ffdbc17d0e1eca1f56b731)), closes [#35](https://github.com/aniisabihi/atlas290/issues/35)

## [1.2.0](https://github.com/aniisabihi/atlas290/compare/v1.1.0...v1.2.0) (2026-09-18)


### Added

* **kitchen:** an indicator becomes a definition ([#27](https://github.com/aniisabihi/atlas290/issues/27)) ([cc35729](https://github.com/aniisabihi/atlas290/commit/cc35729161b200e4d00b46ee57d789132ca3b69c))
* **kitchen:** seventeen more indicators, from ten to twenty-seven ([#30](https://github.com/aniisabihi/atlas290/issues/30)) ([3288d21](https://github.com/aniisabihi/atlas290/commit/3288d215d5a68c47f967ba7a8f25bc7001b7d5c0))
* **pantry:** an index and one file per indicator ([#25](https://github.com/aniisabihi/atlas290/issues/25)) ([dc3bbd5](https://github.com/aniisabihi/atlas290/commit/dc3bbd5ebafc4d4778984b6aa1dcb92d46b65968))


### Changed

* **kitchen:** the old indicator implementations go ([#29](https://github.com/aniisabihi/atlas290/issues/29)) ([cc93619](https://github.com/aniisabihi/atlas290/commit/cc93619f694cbeadbe1676619adc14a1c54a24eb))


### Documentation

* **plans:** design the fourth slice — more of the source ([#23](https://github.com/aniisabihi/atlas290/issues/23)) ([31eb4b7](https://github.com/aniisabihi/atlas290/commit/31eb4b7fcc3e660484344257486a152cd655a42f))

## [1.1.0](https://github.com/aniisabihi/atlas290/compare/v1.0.0...v1.1.0) (2026-09-17)


### Added

* **release:** version the repository and generate its changelog ([#20](https://github.com/aniisabihi/atlas290/issues/20)) ([27c0f41](https://github.com/aniisabihi/atlas290/commit/27c0f41577ff4d871a70561a1b65f402d2c1682f))


### Fixed

* **release:** keep main green when a release merges, and start the runbook ([#22](https://github.com/aniisabihi/atlas290/issues/22)) ([d5c38b6](https://github.com/aniisabihi/atlas290/commit/d5c38b69ad96832797f9e90ea4a1ca2a5fb095d6))

## [1.0.0] — 2026-09-17

The first release. An interactive atlas of Sweden's 290 municipalities built entirely from
Statistics Sweden open data, as a static site with no server, no runtime API and no tracking —
the product of eleven build plans, from an empty repository to a deployed site, between
2026-09-13 and 2026-09-17.

### Added

#### The kitchen — an offline pipeline that freezes its sources

- `yarn kitchen fetch` is the only code in the repository allowed to reach SCB. It freezes every
  response under `kitchen/raw/`, where the responses are committed and reviewable.
- `yarn kitchen publish` reads only those frozen files, refuses the network, and writes
  `public/pantry/`. Publishing twice from the same sources produces byte-identical output, and CI
  fails on any diff — determinism is a requirement, not an aspiration.
- Twelve SCB tables, each content code resolved from the table's own metadata by its stable
  Swedish label rather than hardcoded, because the same code can carry different values in
  different tables and different eras of the same table.
- The map and the numbers are joined by municipality code, and nothing is published — not even
  the topology — unless the two sets of codes match exactly. A silent mismatch would draw a
  municipality with another's data.
- Code-history fixes for renumbered municipalities, the CKM table cutover in 2025, inflation
  adjustment against CPI, the following-January boundary rule, and a check stage that runs against
  every indicator before anything lands on disk. The reasoning is in
  [decision 0001](docs/decisions/0001-plan-1-build-decisions.md).
- `manifest.json` records, per indicator, exactly which frozen response each number came from —
  the provenance trail from a shape on the map back to a committed SCB file.

#### Ten measures, 1968 to 2026

| Measure                           | Coverage  |
| --------------------------------- | --------- |
| Population                        | 1968–2025 |
| Population change                 | 1968–2025 |
| Net migration per 1,000 residents | 1968–2025 |
| Share aged 65 and over            | 1968–2025 |
| Mean age                          | 1998–2025 |
| Population density                | 1991–2025 |
| Median income                     | 1999–2024 |
| House prices                      | 1981–2025 |
| Post-secondary education          | 1985–2025 |
| Municipal tax rate                | 2000–2026 |

Where a measure is absent for a municipality and year, the site says which kind of absence it is
rather than drawing a gap.

#### The site

- A choropleth map of all 290 municipalities and a bubble cartogram, with an animated morph
  between them — 32-point SVG paths holding 60fps at 6× CPU throttling, and no second renderer
  ([decision 0004](docs/decisions/0004-the-morph.md)).
- Time travel across every year a measure exists, with playback.
- Search, an explicit comparison between two municipalities, and a profile panel showing all ten
  measures with prose that tells a municipality's own story rather than ranking it.
- "Places like this" — five similar municipalities presented as a set, never as a ranking, from a
  distance metric settled by measurement rather than argument
  ([decision 0002](docs/decisions/0002-similarity-metric.md)).
- A facts strip that finds its own facts: five families of claim with no score comparing them,
  because "how surprising" has no honest exchange rate across kinds of claim
  ([decision 0003](docs/decisions/0003-the-facts-engine.md)).
- A table twin of every view, so nothing is only available as a picture.
- **The URL is the state.** Every view is a link and every link is a view; playback, morph
  progress and pointer hover are the three documented exceptions.
- **No verdicts.** There is no "higher is better" flag anywhere in the codebase.

#### 580 pages that exist before anyone asks for them

- A pre-rendered page per municipality per language, `/sv/malmo-1280/` and `/en/malmo-1280/`, plus
  a sitemap — because every page this site serves is a shell, and a crawler that does not run
  JavaScript would otherwise find no links at all
  ([decision 0008](docs/decisions/0008-headers-and-discoverability.md)).
- A rasterised preview card per municipality, so a pasted link shows the place
  ([decision 0005](docs/decisions/0005-a-page-per-municipality.md)).
- `?m=` keeps working for ever.

#### Swedish and English, throughout

Both languages or neither: `src/i18n/strings.ts` types English against Swedish, so a string added
to one language fails the typecheck. Indicator prose comes from the pantry, written by the
kitchen, in both.

#### A design language

Eleven decisions settled from four mockups drawn on the real data
([decision 0009](docs/decisions/0009-the-design-language.md)). The map ground is fixed white, so
the page ground is never white in either theme and the map reads as a printed sheet. Light is the
standard, with a designed dark theme and a control that beats the operating system in both
directions. Three self-hosted faces under a 120 kB budget.

#### Checks, not intentions

- Unit and integration tests across the kitchen (Node) and the site (jsdom).
- Playwright end-to-end tests in Chromium, Firefox and WebKit, including an axe accessibility scan
  in all three. What is and is not covered is stated in
  [docs/accessibility.md](docs/accessibility.md).
- A Lighthouse performance budget measured against the build that is actually deployed.
- A Content Security Policy served by the preview server, so the browser suite exercises the real
  policy, and proven able to fail.
- Deploys to Cloudflare Pages from GitHub Actions rather than from Cloudflare's git integration,
  because Cloudflare would publish whatever lands on `main` and a red build and a live site could
  otherwise coexist.
- A monthly refresh job that opens a data pull request, fails if SCB's observation count has
  fallen, and writes its heartbeat line whether or not it succeeded — so the job whose failures are
  the warning cannot be silently disabled.

### Known limitations

Carried forward, not fixed: [docs/DESIGN.md](docs/DESIGN.md) section 8. The morph has no unit-test
coverage and cannot have any, because jsdom implements no path measurement
([decision 0004](docs/decisions/0004-the-morph.md)). There is no automated post-deploy smoke check
and no written rollback procedure ([docs/deployment.md](docs/deployment.md)).

---

Before 1.0.0 there were no versions, only plans. The build history — what each increment set out
to do and what it ended with — is in [docs/plans/](docs/plans/README.md), and the reasoning behind
the decisions is in [docs/decisions/](docs/decisions/README.md).

[1.0.0]: https://github.com/aniisabihi/atlas290/releases/tag/v1.0.0
