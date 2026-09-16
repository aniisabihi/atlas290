# Atlas 290

[![CI](https://github.com/aniisabihi/atlas290/actions/workflows/ci.yml/badge.svg)](https://github.com/aniisabihi/atlas290/actions/workflows/ci.yml)

An interactive atlas of Sweden's 290 municipalities — the number is the name — built entirely from
Statistics Sweden (SCB) open data. Not affiliated with SCB. Static site, no server, no runtime API, no tracking.

Ten measures from 1968 to 2026: a choropleth you can drive with a mouse, a keyboard or a search
box, a year you can drag or play, a bubble cartogram that fixes the visual lie a geographic map
tells about where people live — with the 290 shapes travelling between the two rather than cutting — a profile with ten small histories per municipality, an explicit
comparison that declines to declare a winner, and a plain sortable table twin of every view.
Everything is in the URL, so every view is a link — and every municipality has its own page at
`/en/malmo-1280/`, with its own title, description and preview card.

The five facts on the front page are found by the kitchen rather than written by hand — one from
each of five families, from the whole country down to a single municipality against its twins.
Each profile opens with a few sentences telling that municipality's own story, and names the
five places most like it — measured across all ten indicators over the last ten complete years,
with the method stated on the page and the reasoning in
[decision 0002](docs/decisions/0002-similarity-metric.md).

## Running it

```bash
yarn install
yarn dev
```

Then open `/sv/` or `/en/` — the bare root redirects to whichever the browser prefers. The site
reads only the committed files under `public/pantry/`, so it runs with no network access at all.

```bash
yarn test        # unit and component tests
yarn typecheck   # site and kitchen, as separate projects
yarn lint        # oxlint and Prettier
yarn build       # production build into dist/
yarn kitchen publish   # rebuild the pantry from frozen SCB responses, offline
yarn e2e               # browser tests in Chromium, Firefox and WebKit
yarn cards             # redraw the 290 preview cards (rarely; see below)
yarn budget            # Lighthouse against the built site, with a budget
```

`yarn build` also writes the 580 municipality pages. `yarn cards` redraws the preview images in
`public/share/` and is deliberately **not** part of the build: text renders differently on macOS
and Linux, so running it in CI would produce a diff on every run. The cards carry no figures, so a
data refresh never invalidates them — run it when the design changes or a municipality is added.

**Link previews need an absolute origin.** `og:image` only resolves for a crawler when it is
absolute. The deploy sets `SITE_ORIGIN=https://atlas290.pages.dev` for you; build locally without
it and the tags stay root-relative, which is correct for the site and invisible to a crawler. The
build says which it did on every run.

Accessibility, including what has _not_ been checked: [docs/accessibility.md](docs/accessibility.md).

## Deploying it

The site is built and deployed by GitHub Actions, and **only when every check has passed** —
typecheck, lint, the unit tests, the browser tests in three engines, the accessibility scan and
the performance budget. Cloudflare's own git integration would deploy whatever lands on `main`
regardless, which means a red build and a live site could coexist.

Two secrets connect the two, and they have to be created by the repository owner. Nothing in this
repository can or should do it for you — do not paste an API token into an issue, a pull request
or a chat with an assistant.

1. **Create a Cloudflare account** (the free plan is enough — 500 builds a month, 20,000 files per
   site and 25 MiB per file, against a site that is a handful of files with a 1.05 MB largest) and
   a **Pages project** named `atlas290`. Choose "Direct Upload" rather than connecting the git
   repository, because Actions does the building.

   The name is not cosmetic: Cloudflare serves the project at `<project>.pages.dev`, so this is
   what makes the site `https://atlas290.pages.dev` — which is the origin the deploy builds the
   link previews against. A project under a different name deploys fine and shows no preview
   cards. The workflow declares it once as `PAGES_PROJECT` so the two cannot drift.

2. **Create an API token** at _My Profile → API Tokens → Create Token → Custom token_ with the
   minimum this needs:
   - Permission: **Account → Cloudflare Pages → Edit**
   - Account Resources: **Include → your account**

   Nothing else. In particular it needs no Zone permissions and no read access to anything.

3. **Copy your Account ID** from the Cloudflare dashboard sidebar.
4. **Add both as repository secrets** at _Settings → Secrets and variables → Actions → New
   repository secret_:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

Until those exist the deploy job **skips with a note** rather than failing, so the repository does
not wear a permanently red badge for a step nobody has asked it to take yet.

## Documentation

- **Start here:** [docs/SUMMARY.md](docs/SUMMARY.md) — the documentation index
- Working on the code: [CLAUDE.md](CLAUDE.md), [docs/setup.md](docs/setup.md),
  [docs/development-workflow.md](docs/development-workflow.md), [docs/codebase.md](docs/codebase.md)
- How it fits together: [docs/architecture.md](docs/architecture.md), [docs/conventions.md](docs/conventions.md)
- Deploying: [docs/deployment.md](docs/deployment.md)
- Design and decisions: [docs/DESIGN.md](docs/DESIGN.md)
- Research record: [docs/research/](docs/research/README.md)
- Build plans: [docs/plans/](docs/plans/README.md)
- Running the data pipeline: [docs/kitchen.md](docs/kitchen.md)

Code is MIT. Generated data files under `public/pantry/` are CC0, derived from SCB data (CC0). Derived figures are this project's own calculations, not SCB's.
