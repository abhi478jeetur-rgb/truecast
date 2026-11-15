# Remediation — tranche T1–T3

**Scope.** One data source, truthful numbers and time, and a contrast layer that
survives a pixel measurement. No layout redesign, no new features. Measured
against the same methods as `SHIP-GATE.md`.

**Build under test:** the packaged artifact, `release/linux-unpacked/weather-app`
(built by `electron-builder` from the same `dist/`; `.deb` alongside it),
Electron 45, 1000×700 default window, live Open-Meteo data, host
`America/New_York` (UTC−5). CDP on `:9225`; every frame and JSON below was
captured from that binary, not from a dev server.
**Evidence:** `evidence-remediation/` — screenshots, text-transparent background
plates, and the raw JSON: `r01.json`, `cities.json`, `states2.json`,
`light-theme.json`, `truth-check.json`, `regate-facts.json`, `hover-diff.json`,
`modal-contrast.json`, `console.json`, `evidence-integrity.json`,
`dom-check.json`, `dom-check-after-refresh.json`, and `features.json` for the
units/favourites work. The reconciled verdict is in `REGATE.md`.

---

## Scorecard movement

| Dimension | Gate | Now | What changed |
|---|---|---|---|
| Data integrity | 1.0 | **8.5** | One provider; API-sourced H/L; city-local time; sunrise/sunset day/night |
| Typography | 4.0 | **7.0** | Inter variable bundled; tabular figures; fewer competing sizes |
| Contrast | 2.0 | **8.0** | Worst sampled layer 6.19:1 (dark) / 5.56:1 (light); all pass |
| Visual / craft | 5.0 | 6.5 | Glass restrained; real traffic lights; styled scrollbars |
| Layout | 4.0 | 5.5 | Two-column grid now engages at the default width; fold still an issue (T7) |
| Motion | 5.0 | 6.0 | `prefers-reduced-motion` honoured |
| Accessibility | 5.0 | 6.5 | Dialog semantics, Escape, focus restore, labelled clear, focus-visible |
| States / resilience | 3.0 | 7.0 | Last-good data + named failure + Retry; themed cold error |
| **Weighted total** | **3.9** | **≈6.2** | Matches the T1–T3 projection (→ 6.1) |

---

## The six P0s

| ID | Before | After | Proof |
|---|---|---|---|
| SG-01 | Three `useWeather()` instances; Tokyo header over San Francisco panels | One `WeatherProvider`; the label is derived from the selection, never the response. In every capture the pill and the panels name the same city. | `r02`, `r03`, `states2.json` (`failure.before.pill == failure.pill`) |
| SG-02 | "H/L" = current + apparent (`H:29° L:31°` in Sydney — high below low) | `daily[0].temperature_2m_max/min`. San Francisco **16/11** vs API 15.9/11.2; Sydney **22/18** vs 21.8/17.6; London **10/0** vs 9.7/−0.4; Miami **22/13** vs 21.9/13 | `truth-check.json`, `cities.json`, `light-theme.json` |
| SG-03 | "Now" = local midnight, 21 h stale | Hourly array starts at the city's current hour (`forecast_hours`), matched on the hour prefix; the current entry takes the current reading, so hero and "Now" always agree | `r01.json`: hero `14°`, 24 cards, first `Now \| 14° \| 6%` |
| SG-04 | Every weekday one day early | Calendar dates parsed from parts, never through the host timezone. Sydney header **SUNDAY, NOVEMBER 15** while the host is still Saturday; rows `Today, Sun, Mon…` | `cities.json` |
| SG-05 | Theme and icons followed the host clock (Sydney at 3 p.m. painted night) | `isNight` = string comparison against that date's `sunrise`/`sunset` from the same response. London 20:30 local (sunset 16:12) → `lucide-moon` and `lucide-cloud-moon`; Miami 15:30 clear → `lucide-sun` on the light gradient; Sydney's header reads **SUNDAY, NOVEMBER 15** while the host is still on Saturday | `cities.json` icon classes, `r03`, `r10`, `light-theme.json` |
| SG-06 | Failed switch left an error banner over the previous city's panels, no retry | Failed switch keeps the last good data, dims nothing, names the city that failed, offers Retry/Dismiss. Retry recovers the requested city. | `r11` banner text; `states2.json` `recovered: Tokyo 12°` |

## The measurement-driven findings

### SG-07 — contrast

Text-transparent plates, glyph pixels sampled at the centre of each run, element
alpha composited. **Before: 1.63–3.11:1. After:**

| Layer | Dark theme | Light theme | Required |
|---|---|---|---|
| Hero 96 px | 9.56 | 10.92 | 3.0 |
| Condition 24 px | 7.99 | 7.79 | 3.0 |
| City pill 14 px | 6.19 | 15.40 | 4.5 |
| H / L 14 px | 8.31 / 8.31 | 7.55 | 4.5 |
| Section headings | 11.00 / 13.29 | 9.60 / 8.13 | 4.5 |
| Day name / min / max | 9.49 / 7.73 / 9.40 | 11.78 / 8.29 / 11.78 | 4.5 |
| Detail label / value | 9.15 / 9.64 | 11.91 | 4.5 |
| Hourly label / temp / Now | 7.59 / 6.50 / 6.28 | 15.01 | 4.5 |
| Header date / updated | 8.60 / — | 11.86 / 5.56 | 4.5 |
| Title-bar title | 6.40 | — | 4.5 |

**Worst layer across both themes: 5.56:1** (the 12 px "Updated …" line on the
light gradient); the worst on the dark theme is 6.19:1. Every sampled layer
passes its own threshold — 4.5:1 for body sizes, 3:1 for the 96 px hero and the
24 px condition. No text sits on an opacity ladder below 0.74; values are at
full opacity.

### SG-29 — typeface

`CSS.getPlatformFontsForNode` now returns **`Inter`** (`isCustomFont: true`) on
the hero, headings and pill, where it previously returned `LiberationSans`.
Inter ships as one 48 KB latin variable file (`src/assets/fonts/`,
`inter-latin-wght-normal.woff2`, SIL OFL — licence beside it), emitted into
`dist/assets/` by Vite.

### SG-30 — request fan-out

Clean reload with `Network.requestWillBeSent`: **3 requests, 1 unique URL → 1
request, 1 URL** (`r01.json.requests`). The service also shares an in-flight
promise and caches a response for 60 s per `lat,lon,units`.

### SG-31 — modal accessibility

With the modal open: `role="dialog"`, `aria-modal="true"`, **0 unnamed buttons**
(was 1), the clear control is 36 × 36 with `aria-label="Clear search"`, Escape
closes it, and focus returns to the **city button** rather than `<body>`.
Enter in the field selects the first result. A 12-step Tab traversal stays
inside the dialog for all 12 steps (**9 distinct stops, 0 escapes**);
`regate-facts.json.modalTraversal`.

The sheet now opts into the light token set (`data-theme="light"`), so its
focus ring is the blue `#0b57d0` token rather than the dark theme's white —
keyboard focus on *Cancel* and on a result row is visible. Every sampled label
inside the sheet passes: title 16.18, input 16.63, placeholder **7.08**, result
name 13.18, result subtitle **6.84**, Cancel 7.39 (`modal-contrast.json`).

### SG-32 — sunrise card at 1600 px

Card 186 × 119; label 17 px on one line; value `6:49 AM` on one line with
`Sunset 4:58 PM` beneath; three equal columns of 185.5 px. No wrap, no
"04:59 / PM" (`wide-1600.json`, `r09-1600x1000.png`).

### SG-33 — auto-refresh city name

Refresh now receives the whole `City`, and the label is never taken from the
forecast response.

Runtime proof (`dom-check-after-refresh.json`), from the live app with **no
reload**: mounted 12:03:41, sampled 12:06:15, then again after the 10-minute
interval fired.

| Sample | Pill | “Updated” line | Network |
|---|---|---|---|
| 12:06:15 (baseline) | San Francisco | Updated 2 min ago | — |
| 12:14:19 (after tick) | **San Francisco** | **Updated just now** | **1** forecast request |

`pillUnchanged: true`, `updatedReset: true`. The refresh request count is taken
from CDP `Network.requestWillBeSent`, so this is a real fetch, not a re-render.
This proof was captured on the package immediately preceding the final rebuild;
the only source delta since is the search sheet's text colours, and the refresh
path (`WeatherProvider.load`) is unchanged.

## Other gate items closed while in these files

- **SG-13** cold failure is a themed state ("Weather is unavailable", connection
  copy, **Try again**), not a white page; loading is a themed skeleton.
- **SG-16** the grid moved from `lg:` (1024) to `md:`, so the two-column layout
  exists at the default 1000 px window.
- **SG-27** emoji `💧`/`🌬` replaced with lucide `Droplet`/`Wind`.
- **SG-22** five dead utilities removed (`no-scrollbar`, `scrollbar-hide`,
  `letter-spacing-tighter`, `animate-in`, `slide-in-from-top-2`).
- **SG-19** `:focus-visible` ring on every control; `prefers-reduced-motion`
  block; scrollbars themed.
- **Title bar** now contains the real window controls as traffic lights with
  24 px hit targets and accessible names; the decorative duplicate cluster is
  gone.
- **Hourly strip** has no visible scrollbar and a cut-off card as the scroll
  cue; each card's precipitation is labelled with an icon and reserved height.
- **10-day list** renders 10 rows (API now asked for `forecast_days=10`) and the
  range bar is positioned against the week's own min/max instead of an arbitrary
  `/20`.
- **Units** are requested from the API (`temperature_unit`, `wind_speed_unit`)
  and the labels are the API's own (`°C`, `km/h`); the toggle itself is T5.

## Defects found while re-measuring (fixed here)

- **The search sheet ignored the theme it was drawn on.** The sheet is light in
  every theme, but it inherited the active token set, so in the dark theme its
  `:focus-visible` ring was `#fff` on a white panel — keyboard focus on *Cancel*
  and on a result row was invisible (WCAG 2.4.7). The panel now declares
  `data-theme="light"` and gets the blue ring; measured in `modal-contrast.json`.
- **Placeholder text was `slate-400` on `slate-50` (~2.6:1).** Darkened in two
  steps: `slate-500` still measured **4.44:1**, below AA, so the placeholder and
  the result subtitle (4.30:1) moved to `slate-600`. Final figures in
  `modal-contrast.json`.

## Re-gate criteria (§10 of the gate)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | One `useWeather()`; a switch updates hero, strip, list, grid and background in one frame | **PASS** | `WeatherProvider`; pill and panels agree in `r02`, `r03`, `r10`; `cities.json` |
| 2 | The API-vs-UI table is all ✓ | **PASS — 132/132 values** | `truth-check.json` (hero, H/L, feels-like, humidity, wind, UV, visibility, pressure, sunrise/sunset, 24 hourly cards, 10 day rows, header date) |
| 3 | Every text layer ≥4.5:1 against rendered pixels | **PASS** | `r01.json` (dark, worst 6.19), `light-theme.json` (light, worst 5.56), `modal-contrast.json` (6.84–16.63) |
| 4 | A 200 % zoom / 500 px viewport and a day-theme frame exist | **PARTIAL** | `g04-viewport-500x350.png` (no horizontal overflow, single column), `r10-light-theme.png` (real clear-day API state). At 200 % text size `g05-text-200.png` the rem text doubles (14 → 28 px) but the 96 px display numeral does not scale; no content is lost and there is no horizontal overflow. |
| 5 | Modal fully keyboard-operable, with a trap and a live region | **PASS** | 12/12 Tab steps stay inside the dialog (9 distinct stops, 0 escapes); Escape closes and returns focus to the city pill; `aria-live` announces search state; `regate-facts.json` |
| 6 | No byte-identical duplicates; hover frames differ inside the hovered box | **PASS** | 25 frames, 25 unique pixel hashes, 0 duplicate groups; hover changes **19,686 of 20,664 px** inside the row (95.3 %) and 0 px outside it; `evidence-integrity.json`, `hover-diff.json` |

Criterion 4 is the one honest "partial": the app passes WCAG 1.4.4's
no-loss-of-content requirement and reflows at 500 px, but its display numeral is
pixel-locked by design. Electron's own zoom accelerators could not be exercised
over CDP (synthetic keys do not reach the application menu), so no browser-zoom
claim is made.

## Partially closed, or still open

- **SG-09** — dialog semantics, trap, Escape, Enter, focus restore and the
  labelled 36 px clear button are in place. The result list still clips the
  fifth row mid-height and there is no "N results" line; `max-h` is unchanged.
- **SG-24** — both sections are now `<h2>` with labels, but the ready state has
  no `<h1>`, and high/low are still bare numbers for a screen reader.
- **SG-13** — favourites and the unit preference persist across launches, but the
  last selected city still resets to San Francisco (T4).
- **SG-17** — content axes are still 48 / 56 / 65 px, not one axis (T7).
- **SG-23** — the window is still titled `weather-app` and the favicon is still
  the Vite mark; no double-click-to-zoom, no Restore state (T8).

## Units and favourites

Added after the T1–T3 pass, measured on the packaged build (`features.json`,
28/28 assertions).

**Units.** A segmented °C/°F control in the title bar. °C pairs with km/h and
kilometres; °F pairs with mph and miles. Switching **re-requests the forecast in
the new units** (`temperature_unit`, `wind_speed_unit`) rather than converting on
the client, so the rendered number and the API response agree exactly, rounding
included. One request per switch, and the selected city is **not** reset — the
initial-load effect is guarded by a ref so recreating `load` on a unit change
cannot bounce the user back to San Francisco.

**Favourites.** A star beside the city pill (36 px hit target, `aria-pressed`,
labelled "Add/Remove {city} to/from favorites"). With the search field empty the
sheet shows a Favourites section: one click selects, a per-row ✕ removes. Places
are de-duplicated **by coordinates**, so the built-in default San Francisco and
the same city found through search count as one favourite. Capped at 12, stored
in `localStorage` under `weather.favorites.v1` / `weather.units.v1` with
validation on read and silent in-memory fallback if storage is blocked.

**Two defects the measurement caught:**
- Open-Meteo labels miles per hour **`mp/h`**; the value is theirs but the symbol
  on screen is now `mph`.
- The unit switch originally reused the glass chip **plus** a white active
  segment. Two translucent white fills stacked, and the active segment measured
  **3.5:1**. It now has its own track tokens (`--unit-track`, `--unit-active`);
  measured **6.97:1 active, 6.99:1 inactive**, star 5.23:1, favourite name
  13.63:1, favourite subtitle 7.08:1.

Persistence is asserted across a real reload: °F stays selected, readings are in
°F/mph/miles, and the favourite is still listed and removable.

## Still open (T4–T8, untouched)

- 10-day list still begins below the fold at 1000 × 700 (T7 sticky header /
  density).
- Search results are buttons, not a combobox: no arrow-key highlight (T6).
- No last-updated timestamp in the title bar; no geolocation (T4).
- Large-window composition still leaves a wide empty band beside the hero (T7).
- Hourly data can be up to the refresh interval old; "Now" is the last fetched
  hour bucket (bounded by the 10-minute refresh).
- The search sheet is deliberately always light; it does not follow the app's
  dark theme. Defensible, but a full macOS build would theme the sheet.
- Forced-colors mode was not re-tested after the token rewrite.
