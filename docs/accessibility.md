# Accessibility

Target: WCAG 2.2 AA, plus the Chartability questions that apply to a data visualisation.

This records what was checked, what was found, and — as importantly — **what was not checked and
why**. A document that says everything passed is not credible and should not be believed.

Last reviewed: 2026-09-14, at the end of Plan 5.

## What runs automatically, on every commit

| Check                                                             | Where                                                            | Covers                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| axe-core 4.13, WCAG 2.0/2.1/2.2 A and AA plus best-practice rules | `e2e/accessibility.spec.ts`, eight page states in a real browser | names, roles, structure, contrast, landmarks                           |
| Keyboard behaviour in Chromium, Firefox and WebKit                | `e2e/keyboard.spec.ts`                                           | tab order, arrow navigation, the focus ring, the slider, the skip link |
| Reflow at 320 px and text at 200%                                 | `e2e/reflow.spec.ts`                                             | SC 1.4.10, SC 1.4.4                                                    |
| Contrast of every design token, in both themes                    | `src/styles/tokens.test.ts`                                      | SC 1.4.3, SC 1.4.11                                                    |
| Lighthouse accessibility score, budget 100                        | `tools/lighthouse-budget.mjs`                                    | a second opinion with a different rule set                             |

## What the automation found, and what was done

Every item below was a real defect in shipped code, found while building this plan.

| Found                                                                                                                                                                                                       | By                                                | Fixed                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| **No `main` landmark.** Plan 3's rewrite of the page shell dropped `<main>` and nothing noticed                                                                                                             | Lighthouse                                        | `<main id="content">` now wraps the primary content                            |
| **The skip link was broken in the table view.** It pointed at `#map`, which that view does not render — so the one control that exists to rescue a keyboard visitor did nothing in a whole view             | axe, once the rule set was widened past WCAG tags | points at a wrapper present in every view, and names whichever view is showing |
| **Label in Name failure (SC 2.5.3).** The language link read "English" while its accessible name was "Switch language to Swedish", so a voice-control user could say what they saw and nothing would happen | Lighthouse                                        | the accessible name now begins with the visible text                           |
| **The profile, comparison and facts sat outside any landmark**                                                                                                                                              | axe, best-practice rules                          | `<main>` widened to contain them                                               |
| **The comparison table forced the page to scroll sideways at 320 px**                                                                                                                                       | the reflow spec                                   | the table scrolls inside its own box, which 1.4.10 allows; the page does not   |
| **A console error on every page load** from a missing favicon                                                                                                                                               | Lighthouse                                        | a favicon that exists                                                          |

## What axe does not catch

Worth stating, because the number "zero violations" invites more confidence than it deserves.

While proving the scan could fail, the search box's visible `<label>` was removed and its
placeholder deleted. **The scan stayed green.** A planted image without alt text failed six
states immediately, so the scan is wired correctly — it simply does not cover that case with this
rule set. axe covers perhaps a third of what matters; this is a concrete example of the rest, and
the reason the list below is not empty.

## The manual pass

### Checked

- **Keyboard, start to finish, in three engines.** Chromium and Firefox reach every control.
  The map is reached after ten stops; the skip link jumps straight to it.
- **Arrow-key navigation over the map and the cartogram.** Every one of the 290 municipalities is
  reachable by arrow keys, on both layouts, asserted by unit tests that walk the real graph. A key
  pointing at open sea says so in the live region rather than moving somewhere unasked.
- **Focus is visible on everything.** The map draws its own two-tone ring, because a browser
  outline on an SVG path is clipped by its neighbours and cannot meet contrast on both a
  near-white and a near-black fill. Everything else uses the same two tones.
- **Colour is never the only channel.** The legend names every class in words and units; the four
  statuses with no value are told apart by pattern rather than colour; the live region speaks the
  value, the status and the rank; and every view has a plain sortable table twin.
- **Reduced motion** removes every transition, through a single `--motion` token, so it cannot be
  half-applied by forgetting a rule.
- **Both themes** meet 4.5:1 for body and muted text, asserted against the real stylesheet.

### Known, and not fixed

- **The map is the last tab stop.** A keyboard visitor passes ten controls before reaching it.
  The skip link is the answer and it works, but the source order is not ideal. Deferred rather
  than rushed: reordering the DOM affects every view and belongs with a layout change, not a
  release.
- **On macOS, WebKit does not Tab to links or buttons** unless the system-wide Full Keyboard
  Access setting is on, which it is not by default. In that configuration the skip link, the
  language switch, Play and the view switch cannot be reached by Tab — only the search box, the
  About disclosure and the map. The same WebKit build on Linux reaches everything, so this is a
  platform setting rather than something the page can change. It is asserted by the keyboard
  suite in whichever configuration the host is in, so it will be noticed if it changes.
- **`hreflang` uses relative URLs**, which Lighthouse flags. Absolute URLs need a domain, and
  there is not one yet. To be fixed when the site has an address.

### Not done, and not claimed

- **No screen-reader pass has been run.** DESIGN commits to a manual VoiceOver pass on the map,
  the year slider, the search combobox and the profile. That has **not** happened: the work in
  this repository was done by an agent that cannot run VoiceOver, NVDA or JAWS, and no substitute
  was pretended. Everything above about screen readers is an inference from the accessibility tree
  and from following the ARIA patterns, which is not the same thing as listening to one.

  This is the largest remaining gap. The combobox, the roving tabindex on 290 shapes and the
  debounced live region are exactly the constructs where the tree looks right and the experience
  is wrong.

- **No Chartability review** has been carried out as a structured pass, though several of its
  questions are answered above.
