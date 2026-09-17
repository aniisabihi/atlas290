# Atlas 290

An interactive atlas of Sweden's 290 municipalities, built entirely from Statistics Sweden (SCB)
open data. One repository holds two programs: **the kitchen**, an offline Node pipeline that
fetches and freezes SCB responses and publishes a deterministic static data "pantry"; and **the
site**, a React 19 + Vite 8 front end that reads only those committed files. Ten measures from
1968 to 2026, in Swedish and English, as a choropleth, a bubble cartogram, per-municipality
profiles and a plain table twin of every view. The output is static: no server, no runtime API,
no tracking.

## Agent Context Guide

- Use this file as the documentation index; open detail docs from the tables below only when needed.
- Start with **[CLAUDE.md](../CLAUDE.md)** for setup, commands, conventions, and pre-PR checks.
- Route by task (load one primary topic, not every file):
  - **Run / debug locally** → [setup.md](setup.md)
  - **Code change** → [codebase.md](codebase.md); add [conventions.md](conventions.md) and
    [architecture.md](architecture.md) when the change is cross-cutting or touches the data contract
  - **Data / pipeline change** → [kitchen.md](kitchen.md) + [conventions.md](conventions.md)
  - **Ship / release** → [development-workflow.md](development-workflow.md) + [deployment.md](deployment.md)
    - [CHANGELOG.md](../CHANGELOG.md)
  - **Why is it like this?** → [DESIGN.md](DESIGN.md) and [decisions/](decisions/README.md)
- Prefer path references in docs over duplicating source; read code for implementation detail.
- Generated and committed — never hand-edit: `public/pantry/`, `kitchen/raw/`, `public/share/`,
  `dist/`, and haus-managed blocks in `CLAUDE.md`.
- If docs conflict with code or user intent, ask before making broad changes.

## Architecture

| File                               | Description                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | Runtime model, the kitchen→pantry→site flow, integration boundaries, data contracts       |
| [DESIGN.md](DESIGN.md)             | What is being built and why, the data model, scope, known limitations, what is still open |

## Codebase

| File                       | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| [codebase.md](codebase.md) | Complete module inventory, entry points, where to change what, test layout |

## Conventions

| File                             | Description                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| [conventions.md](conventions.md) | Adding an indicator, the data contract, determinism, URL grammar, editorial and agent rules |

## Setup

| File                 | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| [setup.md](setup.md) | Prerequisites, install, environment variables, how to verify, troubleshooting |

## Development workflow

| File                                               | Description                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| [development-workflow.md](development-workflow.md) | Common changes, quality checks, regenerating artifacts              |
| [kitchen.md](kitchen.md)                           | The data pipeline: every SCB table, content code and coverage range |

## Deployment

| File                           | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| [deployment.md](deployment.md) | Cloudflare Pages, what gates a deploy, the monthly refresh job |

## Other

| File                                 | Description                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| [accessibility.md](accessibility.md) | What is checked automatically, what the manual pass found, and what is not claimed |
| [decisions/](decisions/README.md)    | Dated decision records, 0001 onwards                                               |
| [plans/](plans/README.md)            | The build plans, each ending in software that runs                                 |
| [research/](research/README.md)      | Discovery record: sources, prior art, rendering and hosting options                |
| [../CHANGELOG.md](../CHANGELOG.md)   | What changed in each release, and what a version number means here                 |
| [refresh-log.md](refresh-log.md)     | One line per monthly refresh run, written by the workflow                          |
| [runbook.md](runbook.md)             | Non-obvious failures and the exact fix, newest first                               |
