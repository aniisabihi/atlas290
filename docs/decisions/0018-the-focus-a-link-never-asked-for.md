# ADR-0018: The focus a link never asked for

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `src/components/ProfilePanel.tsx`, `src/components/App.tsx`,
  `e2e/keyboard.spec.ts`, `docs/DESIGN.md` section 5
- **Related:** [issue #32](https://github.com/aniisabihi/atlas290/issues/32),
  [issue #26](https://github.com/aniisabihi/atlas290/issues/26),
  [0017](0017-the-flake-was-a-security-header.md), [0011](0011-the-profile-takes-the-page.md)

## Context

ADR-0017 closed the Firefox half of the intermittent browser suite and said plainly that the
WebKit half was a second cause with no evidence yet: "if WebKit keeps failing after this, it is a
second cause and the evidence for it starts now, from a suite whose Firefox noise is gone." It
kept failing. Issue #32 carried the first clean evidence — CI run 35581235784 on `main`, three
failures, all WebKit, zero Firefox — and it had by then twice stopped a merged change from
deploying, including the twenty-seven indicators, which sat un-published while the site went on
serving ten.

The issue's hypothesis was that Playwright's `.focus()` is unreliable in the Linux WebKit build,
on the strength of a correlation: every WebKit failure ever recorded sits immediately after one of
the eight `.focus()` call sites in the suite. Its two proposed fixes followed from that —
more retries for WebKit, or reaching the element with Tab instead — and it asked that neither be
implemented without triage. Both would have been wrong, because the hypothesis was wrong.

## Decision

**D1 — The cause is in the site, not in the suite: a profile panel takes focus on arrival.**
`ProfilePanel` moved focus to its own `<h2>` in an effect whenever it appeared. That is right when
a visitor opens a profile. It is not right when the page simply arrives already showing one,
which is what `/en/?y=2024&m=1280` and all 580 municipality pages do.

The failing tests are all deep links. They focus a shape, the panel's effect focuses the heading a
moment later, and the arrow key that follows goes to `<body>`, where nothing handles it. The
assertion that times out is whatever came next — a focus ring that never appears, a shape that is
never focused, an `aria-label` read off `<body>` and found to be `null`.

**D2 — It reproduces on any engine, once the moment is moved.** Delaying the heading's focus by
300 ms turns the three CI failures red locally, in WebKit, on the first run, with the same
messages — including the one directly-inspected data point issue #26 recorded, down to the
element it names and the word it received:

```
expect(locator).toBeFocused() failed
...
11 × locator resolved to <a href="/en/uppsala-0380/?y=2024">Uppsala</a>
  - unexpected value "inactive"
```

(The CI report said 12 rather than 11; that is how many times the assertion re-read the element
inside its five seconds, and it is the one number in the message that is a stopwatch rather than a
fact about the page.)

So `.focus()` is not unreliable, and Linux WebKit is not special except in being slow enough,
often enough, for the two to land in the wrong order. Six observations across three CI runs all
sat inside four files for one reason: those are the four files that deep-link to a municipality
and then touch focus. The eighth `.focus()` call site, the year slider at
`e2e/keyboard.spec.ts:235`, opens a page with no municipality in it and has never failed once.

**D3 — Neither suggested fix is taken.** Raising WebKit's retry count would have hidden a real
site defect behind a green job, which is exactly the risk the issue named. Replacing `.focus()`
with Tab would have made the suite stop reporting a bug it was right about: the tests were not
flaky, they were failing intermittently because the behaviour they exercise is intermittent.

**D4 — A profile the link arrived with takes no focus.** `ProfilePanel` asks
`openedByVisitor()` before it moves focus, and `App` answers `false` for the page's first commit
and `true` for every commit after it. Everything the panel did before still happens: clicking a
shape, choosing from search, picking a row in the table, and opening a different municipality
while one is already open all still land a screen reader on the name of what just opened.

**D5 — This was an accessibility defect in its own right, and the worse half of it was not the
flake.** The heading sits below the map in the document — ADR-0011 put it there deliberately — so
a keyboard visitor arriving on `/en/malmo-1280/` was dropped past the skip link, the measure
picker, the search, the view switch, the year and the map itself, with no way forward to any of
them. And because this application renders only once the pantry has been fetched, the drop landed
at an unpredictable moment _after_ the page was readable: anyone who had started tabbing was
pulled out of wherever they were. A change of context that nobody requested, at a time nobody
could predict.

**D6 — This supersedes the "deep link" clause of DESIGN section 5.** That section asked for
"a declared focus target on open, close, back, and deep link". Open, close and back keep theirs.
A deep link's declared focus target is now the top of the document, which is where the browser
already put it: the page title says where the link went, the skip link is still the first stop,
and the panel is still in the tab order where the layout puts it.

**D7 — The guard is a test that asserts the absence, not a longer timeout.**
`e2e/keyboard.spec.ts` now opens a deep link, waits for the network to go quiet — an open profile
fetches all twenty-seven indicator files, and every arrival is another commit with another round
of effects — and asserts that `document.activeElement` is still `<body>`. Re-introducing the bug
fails it on all three engines, deterministically, which is the property the three original tests
never had.

## Alternatives considered

- **Retry WebKit harder.** The issue's option 1. It would have worked, in the sense that the job
  would have gone green. The defect would have stayed, and the next real single-engine regression
  would have been indistinguishable from it.
- **Reach the elements with Tab.** The issue's option 2. Not mechanical, as the issue said: three
  of the eight sites focus deliberately because clicking would change the state under test. It
  would also have left the site defect in place and removed the only thing reporting it.
- **Keep the deep-link focus but move it earlier.** There is no earlier. The panel cannot be
  rendered before the pantry index and the opening indicator have been fetched, so there is no
  moment during the page's load at which this focus could land predictably. Fixing the timing was
  never available; only deciding not to move focus was.
- **Focus the heading on a deep link but keep the visitor's place if they had already moved.**
  A guess about intent, checked against nothing, and still a change of context at an unpredictable
  moment for everyone who had not moved yet.

## Consequences

- A deep link leaves focus at the top of the document. A screen-reader visitor arriving on a
  municipality page hears the page title, which names the municipality, and reaches the profile by
  moving through the page like any other content.
- **Escape no longer closes a profile the moment a deep link arrives.** It closes one when focus is
  inside the panel, or on the map, which is what non-modal has always meant here — the panel's own
  handler is on its `<section>`, and nothing was ever listening at the document. Before this
  change the arrival focus put a visitor inside the panel, so Escape happened to work from the
  first keystroke. `src/components/App.test.tsx` now says where it stands rather than inheriting
  it.
- The eight `.focus()` call sites in the browser suite stay as they are. They were never the
  problem, and rewriting them would have removed the suite's ability to notice this class of
  defect again.
- The WebKit strand ADR-0017 left open is closed, and issue #26's remaining evidence is explained
  rather than retired: the two observations it could not account for, a focus that never lands and
  a focus ring that never appears, are both this.
- What is **not** claimed: that the browser suite is now free of intermittent failure. This is one
  cause, found and reproduced. ADR-0017's Firefox cause and this one were both real and unrelated,
  which is reason to expect a third rather than to assume there is none.
