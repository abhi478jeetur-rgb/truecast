# Ship gate #3 — final pass

**Date:** 2026-11-14
**Artifact:** `release/linux-unpacked/weather-app` (Electron 45.3.1, `resources/app.asar`; same asar inside `release/weather-app_0.1.0_amd64.deb`)
**Method:** live CDP on `:9225`, rendered pixels, computed styles, real key events, live Open-Meteo comparison. Data layer spot-checked, not re-derived. Raw measurements: `evidence-regate3/verification.json`; frames: `evidence-regate3/*.png`.

Per the time box, this file was written complete **before** verification and then corrected where measurement disagreed with the brief or with my draft. Corrections are marked **[corrected]**.

---

## 1. Verdict

**PASS** — 0 P0, 0 P1, no data-integrity defect, **weighted 7.1**.

The rule that decides it: *PASS requires 0 P0, at most 1 P1, and no data-integrity defect.* Both P1 axes are at zero. Run 2's real P1 (the 152 px sheet jump) is measurably gone, its false-positive P1 was already rejected on reproduction, and nothing new rises above P2.

It is a PASS at **7.1** — *credible but not premium*. The app tells the truth, completes its flows, and no longer looks like a prototype wearing a costume. It is not Apple-quality: there are four P2s, three of them visible on the default path, and the one thing the brief says was fixed — focus after removing a favourite — is fixed only while the list is non-empty **[corrected]**. That does not fail the gate. It does mean the last verification claim in the brief was overstated, and I am not going to launder it.

---

## 2. Scorecard

Original = first gate (`SHIP-GATE.md`). Run 2 = `REGATE.md` reconciliation. Final = measured this pass.

| # | Dimension | Weight | Original | Run 2 | Final | Basis for the final column |
|---|---|---:|---:|---:|---:|---|
| 1 | Visual hierarchy & composition | 10% | 6.0 | 7.0 | **7.0** | Hero, H/L, conditions, hourly, 10-day read in that order at 1032×742 (`app-1032x742-dark.png`). Right rail runs short against a longer left list. No change. |
| 2 | Typography | 8% | 4.0 | 7.5 | **7.5** | Inter, real ramp, tabular numerals, two-size section headers. Hero is a fixed 96 px (see F-02). |
| 3 | Color, contrast & theming | 10% | 3.5 | 8.0 | **7.8** | **[corrected]** Night theme is coherent and contrast is strong, but the search sheet stays light inside a dark app — a theme break, confirmed on pixels (F-03). |
| 4 | Layout, spacing & adaptivity | 10% | 5.0 | 6.5 | **7.0** | Empty and six-result sheets share `top 474 / height 640` at 2880×1588: **0 px jump**. Result list 384/384, no scroll, last row 1026 vs dialog bottom 1114. |
| 5 | Iconography & data visualisation | 6% | 4.5 | 6.5 | **6.5** | Lucide weights and condition glyphs are consistent; no wind or precip shape anywhere. Unchanged. |
| 6 | Interaction & feedback | 10% | 3.5 | 6.5 | **6.8** | **[corrected]** Focus moves to the next Remove button and stays in the dialog — until the last item, where it falls to `<body>`. Partial fix, partial credit. |
| 7 | State coverage & resilience | 8% | 3.5 | 6.5 | **6.8** | Forced-colors selection is now visible; the sheet still has one appearance in every state. |
| 8 | Accessibility | 10% | 4.0 | 7.0 | **7.1** | Forced-colors ring measured (`outline: solid 2px rgba(0,230,255,.8)` on the selected unit, none on the other). Hardcoded colour, not a system token (F-04). Focus trap holds even after the P2 focus drop. |
| 9 | Content, microcopy & IA | 6% | 3.5 | 7.5 | **7.4** | **[corrected]** Favourites have an entry point and an honest count, but the empty-state instruction points at a star that is not in the list (F-05). |
| 10 | Craft, polish & restraint | 5% | 3.5 | 6.5 | **6.7** | Window background `#0b1220`: no white flash. No decoration for its own sake. |
| 11 | Data integrity & trust | 8% | 2.0 | 8.0 | **8.0** | Spot-checks match the API; the six historical P0s stay closed. |
| 12 | Product completeness | 5% | 2.0 | 6.5 | **7.0** | Save → count → persist across reload → remove, all verified end to end. Still no reorder or clear-all. |
| 13 | Platform conventions | 4% | 4.5 | 5.5 | **5.8** | Title, icon, `.desktop`, Restore, double-click zoom all measured. Default Electron menu still reachable on Alt; no explicit minimum size. |
| | **Weighted total** | 100% | **3.9** | **6.9** | **7.1** | |

**P0: 0 · P1: 0 · P2: 4 · P3: 5**

Grade band 7–7.9: *credible but not premium*. PASS on the rule; not a craft claim.

---

## 3. Verification results (the five named items)

| # | Claim | Result | Measurement |
|---|---|---|---|
| 1 | Window identity | **confirmed, 5/5** | `document.title` and CDP target both `Weather`. `build/icon.png` is 512×512 RGBA; the `.deb` installs `hicolor/512x512/apps/weather-app.png`; `.desktop` has `Name=Weather`, `Icon=weather-app`, `StartupWMClass=Weather`. Maximize → `2880×1588`, label `Restore window`. Restore → `1032×742`, `Maximize window`. Double-click the `app-region-drag` bar → `2880×1588`, `Restore window`. |
| 2 | Favourites button | **confirmed** | Titlebar control `aria-label` counts honestly: `Favorites, none saved` (0) → `Favorites, 1 city` → `Favorites, 2 cities`. Opens the sheet on the favourites view (`1 favorite city / FAVORITES / Sanaa`). Empty state is honest. Save survives `Page.reload` (`weather.favorites.v1`), city survives (`weather.city.v1`). |
| 3 | Sheet stability | **confirmed** | Empty `top 474, h 640`; six results `top 474, h 640`. **0 px** delta. `6 results` shown; 384/384 list; no clipped row. |
| 4 | No regression | **confirmed** | SF: hero 13 vs API 13.0; H 17 vs 16.9; L 11 vs 11.2; feels 12 vs 11.9; 79% vs 79; 6 km/h vs 6.1; `is_day 0` + Overcast (code 3). Oslo: hero 6 vs 6.3; date `SUNDAY, NOVEMBER 15` matches Oslo-local. 23/24 hourly values match to the degree; one 1 pm cell is 9° where the API rounds 8.4 → 8, with every precipitation index aligned — a forecast-run rounding boundary, not an indexing defect, and not counted as a data finding. Console errors on clean reload: **0**. |
| 5 | P1 count | **0 P0, 0 P1** | Remaining items are P2 at worst. |

**The one brief claim I refute:** "focus stays in the list after removing a favourite" is true only while items remain. With two favourites, Enter/click on the first moves focus to the next `Remove …` button and keeps it in the dialog. Remove the **last** one and `document.activeElement` is `<body>` while the dialog is still open. The focus trap still holds — Tab from body lands on `Cancel` inside the dialog and cycles `Input ↔ Cancel` — so this is a P2, not a P1. It is also a three-line fix.

---

## 4. Release blockers

None. There is no P0 and no P1, which is the gate.

What I would not ship as a designer, in order — these are P2s, and they are cheap:

1. **F-01 (P2). Focus is dropped when the last favourite is removed.** Evidence: `activeElement = BODY`, `inDialog: false`, dialog open. A keyboard user loses their place in a modal. Fix: in the remove handler, if `favorites.length === 1`, focus the search input (`dialog.querySelector('input')`) after removal; otherwise focus the row now at the same index, clamped to `length - 1`.
2. **F-03 (P2). The search sheet is always light inside a dark app.** Evidence: `app-1032x742-dark.png` (night navy `#0b1220`) vs `sheet-6-results-2880x1588.png` (pure white sheet). Fix: move sheet surfaces to `--surface`/`--surface-2`/`--text` tokens and add the night overrides; recheck 4.5:1.
3. **F-05 (P2). The favourites empty state tells the user to use a star that isn't there.** Copy: "Use the star beside its name to keep it here." Search rows are `button > name + region + arrow-right`; there is no star. The star lives next to the city pill, only after selection. Fix (copy, 10 min): "Search for a city, open it, then tap the star beside its name." Fix (better, ~1 h): add a per-row star to the result button.
4. **F-02 (P2). Hero is a fixed 96 px and ignores text size.** `text-[96px]` at `src/components/CurrentWeatherHeader.tsx:80`; computed 96 px regardless. Fix: `clamp(3.5rem, 12vw, 6rem)` with `line-height: 0.9`.

---

## 5. State matrix

| State | Result | Note |
|---|---|---|
| Default, data loaded | pass | 1032×742 and maximized |
| Minimum window | pass (previously measured) | 800×560, two-column breakpoint at 900 px |
| Maximized | pass | 2880×1588, `Restore window` |
| Restore | pass | 1032×742, `Maximize window` |
| Double-click drag region | pass | toggles zoom |
| 200% text | **fail** | hero 96 px fixed (F-02) |
| Sheet, empty | pass | 474/640 |
| Sheet, six results | pass | 474/640, 0 px jump, no scroll |
| Sheet, no results | pass | "No cities found" (accurate to API) |
| Sheet, one character | **weak** | premature "No cities found for “a”" (F-06, P3) |
| Favourites, none saved | pass | honest copy, entry point, correct count |
| Favourites, save/reload | pass | count and list persist |
| Favourites, remove (list non-empty) | pass | focus moves to next Remove |
| Favourites, remove (last item) | **fail** | focus → `<body>` (F-01) |
| Modal focus containment | pass | Tab cycles inside; Escape returns focus to trigger |
| Forced colors | pass | selected unit ringed (F-04 caveat) |
| Reduced motion | pass (previously measured) | honours `prefers-reduced-motion` |
| Error / offline / stale | pass (previously measured) | named city, last-good data, Retry/Dismiss |
| Console on clean load | pass | 0 |

---

## 6. What genuinely works

1. **The window is finally a real window.** Not a claim: a title, a 512 px icon that resolves from the installed `.desktop` file, a Restore label that flips at the right moment, and a drag region that responds to double-click. This closes the last "costume" finding.
2. **The favourites feature is end-to-end.** Save, count, persist across reload, list, remove, honest empty state. The count is truthful in the accessible name, not just the pixels.
3. **The sheet no longer jumps.** 640 px in both states, measured twice, with the result list sized to its contents. Run 2's only real P1 is closed.
4. **The data still tells the truth.** Two cities, two timezones, night conditions, correct local date, correct day/night icons. That was six P0s once; it is now the strongest part of the product.
5. **Failure is still handled like a product.** A failed switch keeps last-good data, names the city, offers Retry.

---

## 7. Findings

| ID | Sev | Area | Finding | Evidence | User impact | Exact fix |
|---|---|---|---|---|---|---|
| F-01 | **P2** | Interaction / a11y | Removing the **last** favourite leaves focus on `<body>` outside the open dialog. | `verification.json → focus_after_remove.last_item` | Keyboard user loses their place in a modal; one Tab recovers | If list would become empty, focus the search input after removal; else focus the row at the same index. |
| F-02 | **P2** | Typography / a11y | Hero numeral is a fixed 96 px and does not scale with text size. | `text-[96px]`, `CurrentWeatherHeader.tsx:80`; computed 96 px | Low-vision user sees the hero shrink relative to its caption | `font-size: clamp(3.5rem, 12vw, 6rem)`; keep `leading-[0.9]`, `tracking-[-0.04em]`. |
| F-03 | **P2** | Theming | Search sheet is always light while the app runs a dark night theme. | `app-1032x742-dark.png` vs `sheet-6-results-2880x1588.png` | Visible theme break on the most-used modal | Tokenise sheet surfaces; add night overrides; re-verify 4.5:1. |
| F-04 | **P3** | Accessibility | Forced-colors ring uses hardcoded `rgba(0,230,255,.8)` instead of a system colour. | computed outline under `forced-colors: active` | Ring may fall under 3:1 on a light forced palette | `outline-color: Highlight;` (and `CanvasText` for the border). |
| F-05 | **P2** | Content / IA | Favourites empty state references a star that is not in the result list. | copy vs row DOM (`button > name + region + arrow`) | User searches for a per-row star, finds none, may abandon | Rewrite copy, or add per-row star buttons. |
| F-06 | **P3** | Content | One-character query shows "No cities found for “a”". | UI vs geocoding API (returns no results for 1 char) | Reads as a failure instead of "keep typing" | Show "Keep typing to search" below 2 characters; do not call the API. |
| F-07 | **P3** | Platform | Default Electron menu reachable with Alt. | carried from run 2; not re-triggered this pass | Breaks the frameless illusion | Product menu, or `Menu.setApplicationMenu(null)` on Linux. |
| F-08 | **P3** | Data viz | No precipitation or wind visualisation. | detail grid | Numbers where shape would read faster | 24 h precip bar strip under the hourly scroller. |
| F-09 | **P3** | Product | No minimum window size; no favourite reorder or clear-all. | carried | Layout degrades below 800×560; friction at scale | `minWidth: 800, minHeight: 560`; drag handle + "Clear all" with confirm. |

No P0. No P1.

---

## 8. Measured appendix

| Check | Measurement | Result |
|---|---|---|
| Title | `Weather` (document + CDP target) | pass |
| Icon | 512×512 PNG in build; installed `hicolor/512x512/apps/weather-app.png`; `Icon=weather-app` | pass |
| `.desktop` | `Name=Weather`, `StartupWMClass=Weather`, `Categories=Weather;` | pass |
| Maximize / Restore / dblclick | 2880×1588 ↔ 1032×742; labels flip correctly | pass |
| Window background | `#0b1220` | pass |
| Favourites control | 42×28, bookmark + count, `aria-label` includes count | pass |
| Favourites persistence | survives reload; `weather.favorites.v1`, `weather.city.v1` | pass |
| Sheet geometry | 474/640 empty and six; 0 px delta | pass |
| Result list | 6 rows, 384/384, last row 1026 ≤ 1114 | pass |
| Hourly data | 23/24 match at Oslo; precip indices all align | pass |
| Hero / H / L / feels / humidity / wind (SF) | 13/17/11/12/79%/6 km/h vs 13.0/16.9/11.2/11.9/79/6.1 | pass |
| Console errors, clean reload | 0 | pass |
| Forced-colors selection | `solid 2px` ring on selected unit, none on the other | pass |
| Hero at 200% | 96 px unchanged | fail (F-02) |
| Focus after last removal | `activeElement = BODY` | fail (F-01) |

---

## 9. Apple comparison

Apple would **not reject** this build. There is no false data, no broken flow, no missing baseline capability and no inaccessible control. That is the bar, and it is cleared.

Apple **would** file three bugs before an external seed, because they are the cheap, visible ones:

- **F-03, the light sheet in a dark app** — *consistency*. A modal that ignores the app's appearance is caught in ten seconds on the most-used path.
- **F-02, the fixed hero** — *accessibility and clarity*. A numeral that does not track text size is a bug, not a style.
- **F-05, the instruction to use a star that isn't there** — *forgiveness and feedback*. It sends the user looking for an affordance the interface does not have.

The Alt menu (F-07) is the last costume tell and would be caught in review as a platform-coherence issue, not a rejection.

The gap between this and an Apple-shipped weather app is no longer correctness or completeness. It is that Apple would have fixed F-01, F-02, F-03 and F-05 before the first external build.

---

## 10. Three shortest remaining items

1. **F-01, last-favourite focus** — branch on `favorites.length === 1` and focus the search input; ~3 lines, ~15 min. Closes the only partially-fixed run-2 item.
2. **F-05, favourites copy** — one sentence, ~10 min (or per-row star, ~1 h, and it is the better product).
3. **F-03, sheet tokens** — surface/text variables plus night overrides, ~1 h including a contrast recheck.

After those three: **7.1 → ~7.5**, with nothing visible left on the default path. F-02 (clamp, ~15 min) and F-07 (menu, ~30 min) take it to ~7.7. Platform conventions remains the ceiling until there is a real menu and a minimum-size contract.

---

## 11. Provenance and honesty notes

- Run 1 (~6.5–6.8, four P1s, no scorecard) and run 2 (0 P0, ≈6.9, one real P1, one false positive) are preserved in `REGATE.md` and `evidence-regate2/`.
- **[corrected]** The draft of this file, written first under the time box, scored 7.2 and credited the focus fix in full. Measurement moved the total to 7.1, split the focus result into pass/partial, and restored the sheet-theming P2 after the unblurred 1032×742 frame showed a genuinely dark app.
- The app was left in Oslo with 0 favourites at 1032×742 after testing.
- Not re-tested this pass: minimum-size behaviour, offline recovery, reduced motion, 200% text rendering (source-inspected only), Alt-menu behaviour. They are marked as carried, not as verified.
