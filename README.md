# Sweden Data Explorer

An interactive atlas of Sweden's 290 municipalities built entirely from Statistics Sweden (SCB) open data. Static site, no server, no runtime API, no tracking.

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
```

## Documentation

- Design and decisions: [docs/DESIGN.md](docs/DESIGN.md)
- Research record: [docs/research/](docs/research/README.md)
- Build plans: [docs/plans/](docs/plans/README.md)
- Running the data pipeline: [docs/kitchen.md](docs/kitchen.md)

Code is MIT. Generated data files under `public/pantry/` are CC0, derived from SCB data (CC0). Derived figures are this project's own calculations, not SCB's.
