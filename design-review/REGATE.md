# Re-gate — reconciled verdict (provisional)

**Date:** 2026-11-14, after tranche T1–T3 plus the units and favourites work.

## Independent runs

The gate eventually ran twice on `opencode-go/deepseek-v4.1-flash`
(`design-review/evidence-regate2/` holds its second run's evidence):

- **Run 1** (after T1–T3 + units/favourites): **0 P0**, working total ~6.5–6.8,
  four P1s (SG-09, SG-13, SG-16, SG-17), plus three smaller findings. It ran out
  of its 60-step budget before writing the scorecard.
- **Run 2** (after those four were closed): **0 P0**, 13-row scorecard,
  **≈6.9**, and two claimed P1s — *favourites never persist* and *the search
  sheet jumps 152 px*. The first was **rejected after reproduction** (the stored
  ids are strings and the cycle persists; see `BACKLOG.md`); the second was real
  and is fixed, along with two P2s (focus after removing a favourite, and the
  selected unit in forced-colors mode). Its own evidence is preserved, including
  the data it used to reach the wrong conclusion.

## Earlier attempts (free tier)

The first attempts could not run:

1. `apple-quality-auditor` on `minimax-m3.1-flash-free` → *Free usage limit reached*, before any work.
2. Same agent on `longcat-2.5-free` → read the gate, listed the evidence and attached to CDP, then *Free usage limit reached* mid-run. No verdict was produced.
3. `nemotron-3.5-super-vl-free` and `glm-5.3-flash-free` → same cap on a trivial probe.
4. The agent as a subagent → inherited its free model and hit the same cap; on a paid model the request returned **Insufficient Balance**.

So the numbers below are **the orchestrator's own reconciliation**, scored against the
same rubric and from measurements taken on the running app. They are not an
independent sign-off. Re-run the gate when a model with budget is available;
`SHIP-GATE.md` §10 has the criteria and this directory has the evidence.

## Artifact under test

`release/linux-unpacked/weather-app` (Electron 45; identical `app.asar` inside
`release/weather-app_0.1.0_amd64.deb`), loaded from `resources/app.asar`, live
Open-Meteo data, host `America/New_York`, CDP on `:9225`.

## Verdict under the gate's own rule

**FAIL at the time of the run (four P1s); those four are now closed, so the
provisional state is PASS pending an independent re-run.**
PASS requires 0 P0, ≤1 P1, and no data-integrity defect. Current state:

- **P0: 0.** No data-integrity defect found; 132/132 on-screen values match the API.
- **P1: 4 at the time of this gate run** — and **all four were closed after it**
  (see below, each with a measurement). Under the rule that now reads
  **0 P0 / 0 P1 / no data-integrity defect → PASS**, pending the independent
  re-run that produces the formal scorecard. That claim is deliberately
  provisional: I am the author of the fixes, so my own count is not a gate.

The app is now honest. Composition and completeness are close, not perfect.

## The six P0s — closed, with proof

| ID | Proof |
|---|---|
| SG-01 split state | One `WeatherProvider`; pill and panels agree in every capture (`cities.json`, `r02`, `r03`, `r10`) |
| SG-02 false H/L | SF 16/11 vs API 15.9/11.2 · Sydney 22/18 vs 21.8/17.6 · London 10/0 vs 9.7/−0.4 · Miami 22/13 vs 21.9/13 |
| SG-03 stale "Now" | 24 cards anchored at the city's current hour; hero `14°` = first card `Now 14°` |
| SG-04 wrong weekday | Sydney header **SUNDAY, NOVEMBER 15** while the host is on Saturday; rows Today/Sun/Mon |
| SG-05 host-clock theme | London 20:30 (sunset 16:12) → `lucide-moon`/`cloud-moon`; Miami 15:30 clear → `lucide-sun` on the light gradient |
| SG-06 failure corrupts context | Failed switch keeps the last good data, names the failed city, offers Retry/Dismiss; retry recovers (`states2.json`, `r11`) |

## The four P1s — closed after this gate run

| ID | Closable? | Proof |
|---|---|---|
| SG-09 | **CLOSED** | Result list sized to the six rows the search requests: **384/384 px, no scroll**, last row bottom **583 ≤ 583**, "6 results" shown, dialog 31–669 inside 700; at 800×560 it fits 12–548 and snaps by row. `p2-search.json` (8/8) |
| SG-13 | **CLOSED** | `weather.city.v1` stores the last *successful* city: reload restores Miami with Miami's own reading, exactly 1 request; invalid JSON falls back to the default. `p1-city.json` (10/10) |
| SG-16 | **CLOSED** | At 1000×700 the first detail row is visible (572–696); the real defect was 800 px, where cards were 118 px and labels wrapped. Layout now goes two-column at **900 px**; at 800×560 cards are **341 px**, no wrap. `p3-fold.json` |
| SG-17 | **CLOSED** | Block edges **48**, text insets **16 ± 1** (both headers, day name, detail value). The accidental 56 px axis is gone. `p4-axes.json` |

Also added: a **bookmark button with the saved count** in the title bar, so
favourites have a visible entry point instead of being hidden behind an empty
search field (5/5, `p8-favorites-button.json`).

Also closed from the gate's own additions: the hourly scroller now takes the
**token focus ring** (`rgb(255,255,255)`, not UA orange); dead hover styling is
removed from non-interactive rows and cards; the ready state has one **`h1`**
and all high/low values are labelled (9/9, `p5-a11y.json`).

Smaller open items: no `<h1>` in the ready state; high/low unlabelled for screen
readers; the display numeral is pixel-locked at 200 % text size; the window is
still titled `weather-app` with the Vite favicon and no bundled icon; no
double-click-to-zoom, no Restore state, no application menu; forced-colors not
re-tested; the search sheet is always light.

## Scorecard (orchestrator's reconciliation)

| # | Dimension | Weight | Gate | Now |
|---|---|---:|---:|---:|
| 1 | Visual hierarchy & composition | 10% | 6.0 | 7.0 |
| 2 | Typography | 8% | 4.0 | 7.5 |
| 3 | Color, contrast & theming | 10% | 3.5 | 8.0 |
| 4 | Layout, spacing & adaptivity | 10% | 5.0 | 6.5 |
| 5 | Iconography & data visualization | 6% | 4.5 | 6.5 |
| 6 | Interaction & feedback | 10% | 3.5 | 6.5 |
| 7 | State coverage & resilience | 8% | 3.5 | 6.5 |
| 8 | Accessibility | 10% | 4.0 | 7.0 |
| 9 | Content, microcopy & IA | 6% | 3.5 | 7.5 |
| 10 | Craft, polish & restraint | 5% | 3.5 | 6.5 |
| 11 | Data integrity & trust | 8% | 2.0 | 8.0 |
| 12 | Product completeness | 5% | 2.0 | 6.5 |
| 13 | Platform conventions | 4% | 3.5 | 4.5 |
| | **Weighted total** | | **3.9** | **≈6.9** |

The run-2 column is the gate's own; it was measured *before* the sheet-height,
focus-after-removal and forced-colors fixes, so Layout and Interaction should be
slightly higher now. Platform conventions (4.5) is the biggest remaining drag and
is item 5 in `BACKLOG.md`.

These are judgements against the same anchors, backed by the measurements below,
not an independent score.

## Window identity (closed after the second run)

- Title **Weather**; a **512 px icon** drawn as SVG, bundled and installed to
  `hicolor/512x512/apps/weather-app.png`, so `Icon=weather-app` resolves.
- **Restore** state wired through `window-toggle-maximize` / `window-maximized`;
  **double-click** on the drag region zooms; window background `#0b1220`.
- `p9-window.json`: title `Weather`; maximize → `maxed:true` + "Restore window";
  restore → `false`; double-click → `true`.

Not done: a custom application menu (the Electron default is still reachable with
Alt). It is listed as a P3 and was deliberately left to keep the time box.

## Post-gate P2s

Gate #3 passed at **7.1** (0 P0, 0 P1). Three of its four P2s were then fixed and
measured (`p10-final.json`, 5/5): focus after removing the last favourite now
lands on the search field; the empty-state copy no longer points at a star that
is absent from the result list; the hero is `6rem` and scales to 192 px at 200 %
text. The fourth — the search sheet staying light inside the dark theme — is left
open deliberately, because doing it well needs a token pass and fresh contrast
measurement.

## Measurements behind it

- **132/132 on-screen values** match the API (`truth-check.json`).
- **28/28 feature assertions** pass for units and favourites (`features.json`).
- Contrast, rendered pixels: my **sampled** layers worst **6.19:1** dark / 5.56:1
  light; the gate's exhaustive sweep (80 runs dark, 82 light) found a worst of
  **4.53:1** and **4.97:1** — both pass, and the exhaustive number is the honest
  one to quote. Search sheet 6.84–16.63:1, unit switch 6.97–6.99:1.
- Typeface: `CSS.getPlatformFontsForNode` returns **Inter**, `isCustomFont: true`.
- Requests per launch: **1**, down from 3. Unit change: **exactly 1**.
- Auto-refresh: pill unchanged, "Updated" reset, 1 real request
  (`dom-check-after-refresh.json`).
- Keyboard: 12/12 Tab steps stay inside the dialog, 9 distinct stops, 0 escapes;
  Escape returns focus to the city button.
- Evidence integrity: **25 frames, 25 unique pixel hashes, 0 duplicates**; hover
  changes **19,686 of 20,664 px** inside the row and 0 outside it
  (`evidence-integrity.json`, `hover-diff.json`).
- Console errors and uncaught exceptions on a clean load: **0** (`console.json`).

## What unblocks PASS

Close the four P1s and re-run the gate: clip-free result list with a count,
persist the last city, make the detail grid reachable without scrolling past the
fold, and put the content on one axis. Then T8 for window identity. The data
layer no longer needs work.
