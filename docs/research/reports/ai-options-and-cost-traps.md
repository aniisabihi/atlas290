# Free/local AI options and cost-trap audit for a zero-cost static Sweden-municipality app

Research date: 2026-09-10. All quotes are from pages fetched that day unless noted. "UNVERIFIED" marks claims I could only find in third-party blogs or could not confirm at all.

## 1. Recommendation up front

**AI mostly does not belong in the runtime of this project.** Every hosted "free" LLM tier is either a trial-sized credit, unpublished/changeable, or gated behind a purchase; in-browser LLMs cost users a 0.7–3.4 GB download and crash on iOS. The two genuinely useful, low-risk options are:

1. **Build-time, template-first narrative generation** where numbers, rankings and comparisons are produced by deterministic code and an LLM (local Ollama, or none at all) only picks phrasing from a constrained set. Commit the output as static JSON; the LLM step is optional and re-runnable, so the "deterministic data pipeline" claim survives as long as the *facts* are computed, not generated.
2. **Optional, lazy-loaded semantic search over indicator names** with Transformers.js and a ~118 MB quantized multilingual embedding model, behind a button, with the default being plain lexical search (Fuse.js/FlexSearch/Pagefind). Better still: precompute indicator embeddings at build time so the browser only needs a tiny model or none at all.

Everything else labelled "AI" in the brief is better done with classical statistics (section 5), which is more defensible in a portfolio because every number is reproducible.

## 2. In-browser inference

**WebLLM** (`@mlc-ai/web-llm` 0.2.85, published 2026-09-08, Apache-2.0 — npm registry). Requires WebGPU. Prebuilt model list from `src/config.ts` with `vram_required_MB`:

| Model | VRAM MB | low_resource |
|---|---|---|
| gemma3-1b-it-q4f16_1 | 711 | yes |
| Llama-3.2-1B-Instruct-q4f16_1 | 879 | yes |
| Qwen2.5-0.5B-Instruct-q4f16_1 | 945 | yes |
| Qwen3-0.6B-q4f16_1 | 1,403 | yes |
| Qwen2.5-1.5B / Qwen3-1.7B / SmolLM2-1.7B q4f16 | 1,630 / 2,037 / 1,774 | yes |
| Llama-3.2-3B-Instruct-q4f16_1 | 2,264 | yes |
| Qwen2.5-3B / Qwen3-4B q4f16 | 2,505 / 3,432 | yes |
| Phi-3.5-mini / Phi-4-mini q4f16 | 3,672 / 3,438 | no |

Download size is roughly the VRAM figure (weights are the bulk). WebLLM's own README says first load "can take a significant amount of time for the very first run without caching."

**WebGPU support (gpuweb Implementation Status wiki, updated 2026-08-13):** Chrome 113+ (Win/macOS/ChromeOS), Chrome 121+ Android, Chrome 144+/147+ Linux (Intel/NVIDIA Wayland); Firefox 141 Windows, 145+ macOS Apple Silicon, 147+ other macOS, Linux and Android still "expected 2026"; Safari 26 on macOS, iOS, iPadOS. caniuse.com reports ~87% global usage. MDN still labels it "Limited availability." **iOS reality check:** WebLLM issue #753 (opened 2025-12-10, "Closed as not planned"): on iOS 26 Safari, SmolLM2-135M worked but Qwen2.5-3B "closes the tab" with "A problem occurred with this webpage." Treat phones as unsupported for anything above ~0.5B.

**Can a 1–3B model do the two proposed tasks?**
- *Natural-language preference → weighted query*: feasible as constrained JSON output (this is a slot-filling task), but the same result is achievable with a synonym dictionary plus a tiny embedding model, at 1/10 the download. A 1B model will also invent indicator names that do not exist; you must validate against the real list anyway.
- *2-sentence narrative from numbers*: risky at runtime. Data-to-text research finds neural generation "prone to hallucination compared to traditional template-based systems" (ToTTo, arXiv 2004.14373); arXiv 2407.14088 finds "larger (in terms of size) LLMs may sacrifice faithfulness"; arXiv 2502.12372 finds factual inconsistency in data-to-text "follows an exponential scaling with LLM size." Small models are somewhat *more* faithful but far less fluent, and any runtime generation cannot be reviewed before a visitor sees it. Do it at build time or not at all.

**Transformers.js** (`@huggingface/transformers` 4.2.0, published 2026-04-22, Apache-2.0 — npm; note it is now v4, not v3). WebGPU is opt-in via `device: 'webgpu'`; docs warn "The WebGPU API is still experimental in many browsers" and fall back to WASM. Multilingual embedding models with Swedish coverage, ONNX files on the Hub:

- `Xenova/multilingual-e5-small`: model.onnx 470 MB, fp16 235 MB, **quantized/int8 118 MB**, q4f16 205 MB.
- `Xenova/paraphrase-multilingual-MiniLM-L12-v2`: same size ladder (470 / 235 / **118** / 205 MB).
- `KBLab/sentence-bert-swedish-cased` (768-dim, Swedish–English distilled from all-mpnet-base-v2); an ONNX port exists at `LightEmbed/sentence-bert-swedish-cased-onnx`. Transformers.js compatibility of that port: UNVERIFIED.

118 MB is acceptable only as a lazy, user-initiated download. For ~6,000 Kolada indicator names the better design is: embed at build time in Node with the same library, ship a float16 matrix (6,000 × 384 × 2 B ≈ 4.6 MB), and embed only the *query* in the browser — or skip the model entirely and use FlexSearch with Swedish normalization.

## 3. Build-time generation with a local model

**GitHub Actions hosted runners (docs, fetched 2026-09-10):** public repos get "4" vCPU, "16 GB" RAM, "14 GB" SSD; private repos "2" vCPU, "8 GB". Actions are "free for ... public repositories that use standard GitHub-hosted runners"; private repos on Free get 2,000 min/month. (The brief's "7 GB" figure is the old private-runner spec.) A practitioner write-up (brokeit.dev) reports llama3.2:3b (2 GB) "works reliably" on the standard runner, uncached model pull "8–12 minutes", cache restore "~35 seconds to restore 2GB", and an 8B model OOM-kills the 7 GB runner. With 16 GB on public repos a 7–8B q4 model should fit; UNVERIFIED that it does within a reasonable wall time.

**Honest evaluation:**
- *Quality*: 3B-class models produce fluent Swedish/English sentences but the brokeit author moved "structural reasoning checks ... to manual review". Expect wrong comparatives ("higher than average" when it is lower) unless the comparison is computed by code and given to the model as a boolean.
- *Hallucination with numbers*: the largest risk. Mitigation: the model never sees raw numbers it must reproduce. Code selects the facts and formats every number; the model chooses among templated clauses or rewrites a fully-specified sentence. Validate output with a regex that every digit sequence in the text appears in the input.
- *Determinism*: Thinking Machines (2025-09-10) showed 1,000 temperature-0 completions of Qwen3-235B yielded "80 unique outputs"; cause is lack of "batch invariance", so any hosted endpoint is nondeterministic. Local CPU llama.cpp/Ollama with a fixed seed and single request is repeatable on the same binary and hardware, but reproducibility across versions/machines is UNVERIFIED and should not be claimed. Therefore: do not put an LLM inside the pipeline you call deterministic. Keep it as a separate, optional "prose polish" step whose output is committed and diffable, and let the fact selection be rule-based (section 5) so `npm run build` is bit-reproducible without a model.
- *Fully rule-based alternative*: rank-based "fact discovery" (top/bottom decile, largest 5-year change, biggest deviation from the county median) plus a few dozen hand-written Swedish/English sentence templates covers 290 municipalities well and is what most newsroom data desks actually ship. This is the recommended default.

## 4. Free hosted inference tiers and their traps

| Provider | What is free (quoted) | Durable or trial? | Verdict for "no paid dependency" |
|---|---|---|---|
| Hugging Face Inference Providers | Free users: "$0.10, subject to change" monthly credits; "Extra usage ... credits purchase required" | Recurring but trivially small | Fails: ~1–2M small-model tokens/month at best, explicitly changeable |
| Cloudflare Workers AI | "10,000 Neurons per day at no charge"; over limit "further operations will fail with an error"; Llama 3.1 8B = 75,147 neurons per M output tokens (≈133k output tokens/day); bge-small embeddings 1,841 neurons/M tokens | Durable free tier, but needs a Worker (Free: "100,000 per day", "10 milliseconds of CPU time") or the REST API | Only acceptable for *build-time* use from CI; 290 × 200 tokens fits in one day's quota. Still a third-party dependency; keep Ollama as fallback |
| Groq | Free Plan table (official page) lists e.g. openai/gpt-oss-20b and qwen/qwen3.6-27b at 30 RPM / 1K RPD / 8K TPM / 200K TPD. Llama-3.x rows were **not** in the fetched free table although llama-3.3-70b-versatile and llama-3.1-8b-instant are listed as production models | Durable-looking but limits/models change; third-party "1K RPD/100K TPD for Llama 3.3 70B" UNVERIFIED | Usable for build-time only; do not ship a key to the browser |
| Google Gemini API | Pricing page shows a Free Tier for Gemini 3.x Flash / Flash-Lite and 2.5 Pro/Flash, annotated "Content used to improve our products"; Terms: "Human reviewers may read, annotate, and process your API input and output"; rate-limits page no longer publishes free numbers ("can be viewed in Google AI Studio"; "not guaranteed") | Durable but opaque; third-party reports of Dec-2025 cuts and Pro removal conflict with the pricing page — UNVERIFIED | Data-use terms alone make it a poor fit for a privacy-minded portfolio; limits unknowable in advance |
| Mistral | "Free mode lets you create API keys and use included monthly usage within the limits shown on the Limits page" — numbers only in the Admin Panel; third-party "1B tokens/month, training opt-in" UNVERIFIED | Durable but unpublished | Same as Gemini: cannot document the limit you depend on |
| OpenRouter `:free` models | "20" RPM and "50" requests/day without credits; "1,000"/day only after "$10+ in credits purchased (all time)" | Gated | Fails: the useful tier requires a purchase |

Net: no hosted tier lets you write a truthful sentence like "this feature will keep working for free." A local Ollama run on the developer's machine (or the public-repo Actions runner) is the only option that satisfies the constraint, and only at build time.

## 5. Deterministic "AI-ish" techniques that fit the pipeline (recommended core)

All are reproducible, explainable, and fast for 290 rows × a few hundred indicators.

- **Interesting-fact discovery**: z-scores (|z| > 2), Tukey fences (Q1 − 1.5·IQR, Q3 + 1.5·IQR), robust z with median/MAD; rank in decile; largest absolute/relative change over N years. Libraries: `simple-statistics` 7.12.0 (ISC; has `zScore`, `quantile`, `interquartileRange`, `medianAbsoluteDeviation`, `sampleCorrelation`, `linearRegression`, `tTest`, `permutationTest`), `d3-array` 3.2.4 (ISC; `quantile`, `quantileSorted`, `deviation`, `variance`, `median`, `rank`, `mode`, `cumsum`).
- **User-weighted ranking**: min–max or rank-based normalisation per indicator, direction flag (higher-is-better), weighted sum; show the contribution breakdown. Pure arithmetic; `arquero` 8.0.3 (BSD-3) gives dplyr-style group/rollup/join if you want a dataframe.
- **"Municipalities most like Västerås"**: standardise, then k-nearest neighbours by Euclidean or cosine distance — 290² distances is trivial in the browser; no library needed.
- **Archetypes**: `ml-kmeans` 7.0.1 (MIT, published 2026-06) or `simple-statistics.kMeansCluster`; `ckmeans`/`jenks` for optimal 1-D class breaks on choropleths (ckmeans is "an improvement on heuristic-based clustering approaches like Jenks").
- **2-D "galaxy" view**: `ml-pca` 4.1.1 (MIT; last publish 2022-11 — stable but dormant), `umap-js` 1.4.0 (MIT; last publish 2024-06; `UMAP` class with `fit`, `fitAsync`, `nComponents`). Fix the random seed and precompute at build time so the layout is stable across visits.
- **Change-point detection**: no widely adopted JS library exists; npm search on 2026-09-10 returned only 0.x packages (`karaul` 0.1.0, `statcore` 0.1.0, `changepoint-edivisive` 0.1.2). Binary segmentation or CUSUM is ~40 lines; implement it yourself and unit-test it.
- **Benford first-digit test**: chi-square on leading digits, a good "data quality" easter egg on count-type indicators; trivial to code.

## 6. Speech and sonification (brief)

Web Speech API `SpeechSynthesis` is "Baseline: Widely available ... since September 2018" (MDN); voices are whatever the OS provides (`getVoices()`), so Swedish voice availability varies by device — UNVERIFIED per platform. Tone.js 15.1.22 (MIT) for sonifying time series; both are free, offline, and add no dependency risk. Good accessibility story for a portfolio.

## 7. Cost-trap checklist

| Trap | Why it bites | Free-safe alternative | Source |
|---|---|---|---|
| Mapbox tiles | 50,000 map loads/month free, then "$5.00" per 1,000; account + token | MapLibre GL JS 6.9.0 (BSD-3) + OpenFreeMap ("no limits on the number of map views or requests ... no API keys") or self-hosted PMTiles (`pmtiles` 4.5.0) on R2/Pages via HTTP range requests | mapbox.com/pricing; openfreemap.org; docs.protomaps.com |
| MapTiler Cloud "free" | "5k/month" map sessions, "MapTiler logo on the map", "testing, personal or non-commercial use" | Same as above | maptiler.com/cloud/pricing |
| OSM raster tiles as basemap | Policy: "no SLA or guarantee", "We may block access, without notice" | OpenFreeMap / PMTiles / simple municipality GeoJSON with no basemap | operations.osmfoundation.org/policies/tiles |
| Nominatim geocoding | "absolute maximum of 1 request per second", no autocomplete, identify with User-Agent | Precompute coordinates at build time; ship a static lookup | operations.osmfoundation.org/policies/nominatim |
| Google Fonts CDN | LG München 20 Jan 2022 (3 O 17493/20): EUR 100 damages for IP transfer; "the same functionality is possible without using Google" | Self-host via Fontsource npm packages (check each font's licence, mostly OFL) | activemind.legal/guides/ruling-google-fonts |
| Plausible Cloud | Cheapest plan $9/month; "30-day free trial" only | Cloudflare Web Analytics (JS snippet, "Available on all plans", 10 non-proxied sites), GoatCounter ("free for reasonable public usage"), Umami self-host (MIT; needs Node 18.18+ and PostgreSQL 12.14+) or Umami Cloud Hobby ("completely free"; 100k events/3 sites UNVERIFIED), Plausible CE self-host | plausible.io; developers.cloudflare.com/web-analytics; goatcounter.com; github.com/umami-software/umami |
| Sentry | Developer plan: "5k errors", "50 replays", "One user", "30-day lookback" | `window.onerror` → console, or none; static sites rarely need it | sentry.io/pricing |
| Algolia | Build plan "50K records", "10K search requests/month" | Pagefind 1.5.2 (MIT; Swedish stemming ✅; "10,000 page site with a total network payload under 300kB"), FlexSearch 0.8.x (Apache-2.0), Fuse.js 7.5.0 (Apache-2.0) | algolia.com/pricing; pagefind.app/docs/multilingual |
| Image/asset CDN | Cloudflare Images etc. are paid | jsDelivr for npm/GitHub files: "no bandwidth limits", but GitHub files "larger than 20 MB" and packages ">150 MB" are refused | github.com/jsdelivr/jsdelivr README |
| Forms | Formspree Free "50 submissions per month" (third-party reported; pricing page did not render — UNVERIFIED) | No form; `mailto:` or link to GitHub Issues | splitforms.com (secondary) |
| Comments | Disqus ads/tracking; paid tiers | giscus: "No tracking, no ads, always free", requires public repo + Discussions | giscus.app |
| Uptime monitor | Paid tiers creep | UptimeRobot Free "50 monitors", "5 min. monitoring interval"; or skip — Pages/GitHub Pages already have status pages | uptimerobot.com/pricing |
| CI minutes | Private repos: 2,000 min/month, 2 vCPU/8 GB | Keep the repo public: unlimited minutes, 4 vCPU/16 GB | docs.github.com Actions billing + runners |
| Large data in git | Git warns >50 MiB, "GitHub blocks files larger than 100 MiB"; repo "ideally less than 1 GB" | Split per indicator/year into small JSON/Parquet; commit only derived files | docs.github.com about-large-files |
| Git LFS | Free plan: "10 GiB" storage and "10 GiB" bandwidth (the old 1 GB figure is outdated); bandwidth billed per GiB after | Avoid LFS for web-served assets (every visitor download counts) | docs.github.com LFS billing |
| Hosting size caps | GitHub Pages "no larger than 1 GB", "soft bandwidth limit of 100 GB per month", 10 builds/hour; Cloudflare Pages "20,000 files", "25 MiB" per asset, "500" builds/month | Both are fine for this app; Workers static assets: "Requests to static assets are free and unlimited" | docs.github.com Pages limits; developers.cloudflare.com/pages/platform/limits |
| Object storage fallback | R2 free: "10 GB-month / month", "1 million" Class A, "10 million" Class B, egress "Free"; Standard storage only | Use R2 for PMTiles/large Parquet if ever needed | developers.cloudflare.com/r2/pricing |
| Domain name | .se retail 2026 roughly 99–361 kr/year depending on registrar; Internetstiftelsen wholesale reported as 92 kr/year (secondary source) | `*.github.io` or `*.pages.dev` — SEK 0 | denna.se; loopia.se; webb.se |
| "Free" data APIs that later gate | SCB PxWebApi 2: "maximum number of calls of 30 per 10 seconds" per IP, no key today; Kolada: "avgiftsfritt och kräver inget avtal", attribution "Källa: Kolada" required | Fetch at build time only, cache raw responses in the repo, never call from the browser; then a policy change breaks a build, not the site | scb.se pxwebapi; kolada.se/om-oss/api |
| LLM API keys in a static site | Any key shipped to the browser is public; free tiers fail hard ("further operations will fail with an error") | No runtime LLM calls; build-time only, or in-browser models behind explicit user opt-in | section 4 |

## 8. Bottom line

Ship the deterministic core (section 5) as the headline engineering. If you want an AI garnish, add (a) a build-time, template-constrained prose step run with local Ollama where every number is injected by code and validated by regex, and (b) an opt-in semantic search using precomputed embeddings. State plainly in the README that the site has zero runtime API dependencies and that the LLM step is optional and non-deterministic by nature — that honesty is itself a portfolio point.

## Sources (all fetched 2026-09-10)

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/web-analytics/ , /get-started/ , /limits/
- https://huggingface.co/docs/inference-providers/en/pricing
- https://huggingface.co/docs/transformers.js/en/index
- https://huggingface.co/docs/transformers.js/guides/webgpu
- https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx
- https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tree/main/onnx
- https://huggingface.co/KBLab/sentence-bert-swedish-cased ; https://huggingface.co/LightEmbed/sentence-bert-swedish-cased-onnx (search results)
- https://webllm.mlc.ai/ ; https://github.com/mlc-ai/web-llm ; https://github.com/mlc-ai/web-llm/releases ; https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts ; https://github.com/mlc-ai/web-llm/issues/753
- https://caniuse.com/webgpu ; https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API ; https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://brokeit.dev/posts/running-ollama-in-github-actions-ci-what-actually-works/
- https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/
- https://arxiv.org/abs/2407.14088 ; https://arxiv.org/abs/2502.12372 ; https://arxiv.org/pdf/2004.14373 (search result)
- https://ai.google.dev/gemini-api/docs/rate-limits ; https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/terms
- https://console.groq.com/docs/rate-limits ; https://console.groq.com/docs/models
- https://docs.mistral.ai/admin/user-management-finops/tier
- https://openrouter.ai/docs/api-reference/limits
- https://www.goatcounter.com/ ; https://plausible.io/#pricing ; https://github.com/plausible/community-edition ; https://github.com/umami-software/umami ; https://docs.umami.is/docs/cloud/faq
- https://sentry.io/pricing/ ; https://www.algolia.com/pricing ; https://uptimerobot.com/pricing/ ; https://giscus.app/
- https://pagefind.app/ ; https://pagefind.app/docs/multilingual/ ; https://github.com/CloudCannon/pagefind ; https://github.com/krisk/Fuse ; https://github.com/nextapps-de/flexsearch
- https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/README.md ; https://fontsource.org/
- https://www.activemind.legal/guides/ruling-google-fonts/
- https://operations.osmfoundation.org/policies/nominatim/ ; https://operations.osmfoundation.org/policies/tiles/ ; https://openfreemap.org/ ; https://docs.protomaps.com/ ; https://github.com/maplibre/maplibre-gl-js ; https://www.mapbox.com/pricing ; https://www.maptiler.com/cloud/pricing/
- https://github.com/PAIR-code/umap-js ; https://github.com/simple-statistics/simple-statistics ; https://simple-statistics.github.io/docs/ ; https://github.com/mljs/pca ; https://github.com/uwdata/arquero ; https://github.com/d3/d3-array ; https://d3js.org/d3-array/summarize ; https://github.com/Tonejs/Tone.js ; https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- npm registry (`npm view`, 2026-09-10) for versions/dates/licences of @mlc-ai/web-llm, @huggingface/transformers, umap-js, ml-pca, ml-kmeans, arquero, simple-statistics, d3-array, fuse.js, flexsearch, pagefind, tone, maplibre-gl, pmtiles
- https://www.scb.se/en/services/open-data-api/pxwebapi/ ; https://www.kolada.se/om-oss/api/
- https://denna.se/nyheter/domankostnad-se-2026 ; https://www.loopia.se/domannamn/ ; https://www.webb.se/domannamn/prisjustering-fran-internetstiftelsen-gallande-se-och-nu-domaner/ (secondary, for .se pricing)
- Secondary/unverified: tokenmix.ai and klymentiev.com (Groq Llama free limits), splitforms.com (Formspree), freetier.co (Umami Hobby numbers)
