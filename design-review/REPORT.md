# Design Review — Weather App (Electron + React + Tailwind v4)

**Reviewed against:** best-in-class macOS weather app standard. Platform: Linux desktop, frameless custom titlebar.
**Evidence:** 8 screenshots in `design-review/evidence/`, `metrics.json` (CDP-captured from the running app at `capturedAt 2026-11-13T04:34:23.498Z`), source tree under `src/`, CDP endpoint `127.0.0.1:9224` (app running, not killed).
**Screenshots read (all 8):** `01-default-1000x700.png`, `02-min-window-800x600.png`, `03-search-empty.png`, `04-search-results.png`, `05-london-weather.png`, `06-hover-row.png`, `07-focus-1.png`, `08-focus-4.png`.

---

## 1. Verdict

**Weighted score: 6.3 / 10 — Grade: C (competent but visibly unfinished).**

The app has a coherent visual language (glass cards, backdrop blur, system type stack, clear temperature prominence), real care in the search modal, and a visible focus state. It does **not** ship. The city-switch desync is empirically real: selecting London updates the header (city "London", 3°, Clear) but the hourly strip, 10-day strip, and detail grid remain frozen on San Francisco data. A weather app that presents the wrong forecast under the wrong city name is actively misleading and destroys trust. Fix that plus the accessibility baseline (aria-labels on icon-only titlebar buttons, modal role/focus-trap/Escape, emoji-as-icons, aria-live for async updates) before any ship consideration.

**Ship-meeting sentence:** "This is a nice-looking shell with a broken core: switch the city and the forecast stays put — we cannot ship a weather app that lies about the weather."

---

## 2. Scorecard

| # | Dimension | Score | Weight | Weighted | Justification |
|---|-----------|-------|--------|----------|---------------|
| 1 | Visual hierarchy & composition | 7 | 15% | 1.05 | Clean glass layout, temp dominant; marred by redundant titlebar dots+buttons and hidden scroll affordances |
| 2 | Typography | 7 | 12% | 0.84 | System stack, sensible scale (96px temp / 14px labels); light 300 weight at 96px, tight -2.4px tracking, contrast never measured |
| 3 | Color, contrast & theming | 6 | 12% | 0.72 | Dynamic `--text-on-bg` token + glass; but 94 hardcoded white texts, `contrastVsNearestBg: null` everywhere, questionable city-button text contrast |
| 4 | Layout, spacing & responsive | 6 | 12% | 0.72 | 4/8pt rhythm (px-6, gap-3, py-3); zero responsive adaptation at 800×600, horizontal overflow with no scroll cue |
| 5 | Iconography & data viz | 7 | 8% | 0.56 | Lucide condition icons clean; 10-day temp range bar is a nice touch; emoji used as icons (a11y defect) |
| 6 | Interaction design & feedback | 7 | 12% | 0.84 | Source-defined hover, visible (default) focus ring, backdrop-blur modal, search clear button; no focus trap, no Escape, no scroll affordance |
| 7 | State coverage & resilience | 5 | 10% | 0.50 | Loading/error/empty-search states exist; **city-switch desync** makes data states unreliable; no offline state |
| 8 | Accessibility & platform conventions | 5 | 11% | 0.55 | Modal lacks `role`/`aria-modal`/focus-trap/Escape, emoji without labels, `ariaLive: 0`, default focus ring, contradictory titlebar conventions |
| 9 | Content, microcopy & IA | 7 | 5% | 0.35 | Clear labels ("Next 24 hours"), good date formatting; duplicated "Overcast", emoji microcopy |
| 10 | Craft, polish & restraint | 6 | 3% | 0.18 | Backdrop blur, gradients, 42 transitions; undermined by redundant titlebar controls and desync |
|   | **TOTAL** | **6.3** | **100%** | **6.31** | |

Anchor reading: 6.3 lands in "6–7 = C range — solid but with notable gaps." Nothing here reaches the 9–10 "ship at Apple/Linear" bar; the desync alone is a redesign-level defect.

---

## 3. What Already Works

No flattery. These are the genuinely executed specifics:

1. **Search modal craft** (`03-search-empty.png`, `04-search-results.png`): centered `max-w-md` modal, `bg-white/95 backdrop-blur rounded-3xl`, `focus:ring-2 focus:ring-blue-500` on the input, `autoFocus`, clear (X) button, "No cities found" empty state, results with chevrons and a real scrollable list. This is the most intentional component in the app.
2. **Focus is visible** (`07-focus-1.png`, `08-focus-4.png`): focused elements show a distinct orange outline (`rgb(229, 151, 0) auto 1px`) on the hourly strip and the titlebar close button. It is Chrome's default style rather than a designed state (see F-14), but focus is never invisible.
3. **Hover classes exist in source** (`hover:bg-white/50`, `hover:bg-white/60`), but no hover state was actually captured: `06-hover-row.png` is byte-identical to `05-london-weather.png` (both md5 `8a75b669…`). Treat hover polish as unverified.
4. **Loading and error states** exist in `App.tsx` and `CurrentWeatherHeader.tsx` (pulse skeletons, "Unable to load weather").
5. **Temperature hierarchy** works: 96px `font-light` temp is the clear visual anchor; condition, H/L, and secondary details recede correctly (`text-dynamic/90`, `/80`, `/70`).
6. **`lang="en"`**, `-webkit-font-smoothing: antialiased`, and `-moz-osx-font-smoothing: grayscale` are set — text rendering intent is correct.
7. **`-webkit-app-region` drag/no-drag** is wired on titlebar and interactive elements, so the frameless window is draggable and buttons don't drag the window.

---

## 4. Findings (P0 → P3)

| ID | Sev | Area | Finding | Evidence | User impact | Exact fix |
|----|-----|------|---------|----------|-------------|-----------|
| F-01 | P0 | Data / city switch | **City-switch desync.** Header updates to the new city, but hourly strip, 10-day strip, and detail grid stay on the previous city's data. | `metrics.json`: `defaultState` = SF 16° Overcast, hourly Now 13°…11pm 15°, 10-day Wed 22°/11°, details UV 0 / Wind 17 km/h / Humidity 76% / Visibility 18 km / Pressure 1006.9 hPa / Sunrise 06:46 AM / Sunset 05:00 PM. `londonState` = header London 3° Clear H:3° L:0° 73% 9 km/h (correct) BUT hourly Now 13°…11pm 15°, 10-day Wed 22°/11°, details UV 0 / Wind 17 / Humidity 76 / Visibility 18 / Pressure 1006.9 / Sunrise 06:46 / Sunset 05:00 — **byte-identical to SF**. `focus1` text shows focused "Now 13°" (SF), not London's 3°. | User switches to London and sees San Francisco's forecast under "London, 3°, Clear." Wrong clothing/activity decisions; total loss of trust. Highest-severity defect. **Independently reproduced live:** London → Paris updated the header to 5° Clear while hourly/daily stayed on SF and the detail grid still showed SF's 76% humidity / 1006.9 hPa (see §8). | Make `loadWeather` atomically replace one `data` object and force all panels (`HourlyForecastStrip`, `TenDayForecast`, `WeatherDetailGrid`, `CurrentWeatherHeader`, `WeatherBackground`) to re-render from that single source. Add an `aria-live="polite"` region announcing "<City>, <temp>, <condition>" on change. Verify post-switch that `data.hourly`/`data.daily`/`data.details` match the header city. |
| F-02 | P2 | Titlebar | Icon-only titlebar buttons (minimize/maximize/close) expose `title` but **no `aria-label`** (`ariaLabel: null` for all 3). `title` still supplies an accessible name, so this is not a WCAG failure — it is a naming-robustness issue. | `metrics.json` buttons array: all three titlebar buttons have `ariaLabel: null`, only `title`. `src/components/TitleBar.tsx:11-31` uses `title="Minimize/Maximize/Close"` with lucide `X`/`Minimize`/`Maximize2`, no `aria-label`. | `title` is announced less consistently than `aria-label` across AT/browsers and is not exposed to touch users; low practical impact for desktop window controls. | Add `aria-label="Minimize"`, `aria-label="Maximize"`, `aria-label="Close"` (keep `title` for tooltips). |
| F-03 | P1 | Modal | Search modal has **no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, no Escape-key close, and no focus trap.** Backdrop click and Cancel close it, but AT is not told it's a modal and focus can escape. | `src/components/CitySearchModal.tsx:28-33`: wrapper `fixed inset-0 z-[60]`, no role/aria-modal; input has `autoFocus` but no focus restoration/trap; no keydown listener for Escape. | Screen-reader users don't know a dialog opened; focus leaks behind the modal; keyboard users can't dismiss with Escape. | Add `role="dialog" aria-modal="true" aria-labelledby="search-title"` to the modal panel, heading gets `id="search-title"`, trap focus on open, restore focus on close, add `keydown` Escape → `onClose`. |
| F-04 | P1 | Iconography | **Emoji used as icons without accessible labels:** `💧` humidity, `🌬` wind (header), `💧` precip (hourly card). `emojiInText: 2` in metrics; screenshots show more. | `src/components/CurrentWeatherHeader.tsx:76-77`: `<span>💧 {current.humidity}%</span>`, `<span>🌬 {…} km/h</span>`. `src/components/HourlyForecastStrip.tsx:49-53`: `💧 {h.precipitationProbability}%`. | Screen readers announce emoji names ("droplet", "wind face") instead of meaningful labels; verbose and confusing. | Replace emoji with lucide `Droplet`/`Wind` icons + visually-hidden or `aria-label` text, or `aria-hidden="true"` on emoji with adjacent `<span class="sr-only">Humidity 76%</span>`. |
| F-05 | P1 | Async feedback | **`ariaLive: 0`** — no live region. City switch and search results are announced to nobody. | `metrics.json`: `ariaLive: 0`. No `aria-live` anywhere in source. | Screen-reader users get no announcement that data changed after selecting a city or that search results appeared. | Add an off-screen `aria-live="polite"` region; announce `<city>, <temperature>, <condition>` on city select and "N results for <query>" on search. |
| F-06 | P1 | Layout / scroll | **Scroll containers hide scrollbars with no affordance.** Main scroll: `scrollH 1345 / clientH 700` (content overflows). Hourly strip: `scrollW 1812 / clientW 873` (horizontal overflow). Classes `no-scrollbar scrollbar-hide`; no fade gradient or "scroll to see more" cue. On 800×600 (`02-min-window-800x600.png`) content is cramped and the 10-day list is cut off at the bottom with no indication it scrolls. | `metrics.json` scrollables array; `02-min-window-800x600.png` shows right-edge scrollbar and bottom-truncated 10-day ("Wed …" only). `HourlyForecastStrip.tsx:22` `overflow-x-auto pb-4 no-scrollbar scrollbar-hide`; `TenDayForecast.tsx` inside a fixed-height scrolling container. | Users don't know more content exists off-screen; task failure on small windows. | Show a subtle scroll indicator (right-edge gradient already exists in hourly — keep it; add to 10-day), or paginate; at minimum do not `scrollbar-hide` the main container on small widths. Add responsive layout: stack detail grid, reduce padding, shrink temp at < 900px. |
| F-07 | P1 | Color / contrast | **Contrast never measured against rendered background** (`contrastVsNearestBg: null` for every typography sample). 94 hardcoded white text instances. `text-dynamic/60` (opacity 0.6) at 14px on dark bg is borderline for small text. City button text `oklch(0.208 0.042 265.755)` (dark) on `bg-white/55` glass over dark bg may fail 4.5:1. | `metrics.json`: `hardcodedWhiteText: 94`, all `contrastVsNearestBg: null`; `cityButton` color `oklch(0.208...)`, bg `bg-white/55 backdrop-blur-md border border-white/60`. | Low-contrast text is unreadable for low-vision users; hardcoded white breaks if `--text-on-bg` token isn't applied. | Measure contrast on rendered pixels for every text layer; enforce ≥4.5:1 (normal) / ≥3:1 (large). Replace hardcoded white with `text-dynamic` opacities; verify city-button text/glass blend. |
| F-08 | P1 | Platform conventions | **Titlebar is contradictory:** colored traffic-light dots (red/yellow/green, macOS-correct order) drawn *plus* separate functional minimize/maximize/close buttons whose **order is minimize–maximize–close** (macOS is close–minimize–maximize, red leftmost). Redundant and out of order. | `01-default-1000x700.png` / `TitleBar.tsx:34-38` dots red-yellow-green left-to-right; `TitleBar.tsx:11-31` buttons minimize, maximize, close. `metrics.json` buttons confirm order minimize→maximize→close. | Violates macOS muscle memory; two competing control sets look like a bug. | Remove the decorative dots (or make them the actual buttons). Reorder functional buttons to close–minimize–maximize with correct colors (red close leftmost). |
| F-09 | P2 | Typography | Display temp at `font-weight 300` / `font-light`, 96px, `letter-spacing -2.4px`, `line-height 144px`. Light weight at very large sizes can render thin/fragile on non-Retina Linux screens; tight tracking reduces legibility of "16°"/"3°". | `metrics.json` typography.temp: `fontSize 96px`, `fontWeight 300`, `lineHeight 144px`, `letterSpacing -2.4px`. | Marginal legibility on standard DPI displays. | Bump display temp to `font-weight 400` (or `500`) and relax tracking to `-1px`; test on 1× DPI. |
| F-10 | P2 | Motion | **`prefers-reduced-motion` not respected.** 42 transitions, `animate-pulse` skeletons, `animate-in fade-in slide-in-from-top-2 duration-300` on the modal — all run regardless of reduced-motion setting. | `metrics.json`: `prefersReducedMotion: false`, `transitionsFound: 42`, `animationsFound: 0` (transitions counted, not reduced-media). `CitySearchModal.tsx:33` `animate-in ... duration-300`; `App.tsx:20-21` `animate-pulse`. | Vestibular users get motion they asked to avoid. | Wrap motion in `@media (prefers-reduced-motion: reduce)` → `transition: none`, `animation: none`; disable `animate-pulse`/`animate-in` under reduced motion. |
| F-11 | P2 | States | **No offline / no-network state**, and no "last updated" timestamp. Auto-refresh is 10 min (`AUTO_REFRESH_MS`) but invisible. | `App.tsx:24-29` error state only covers fetch error, not offline; no timestamp UI. | Users can't tell if data is stale or if they're offline. | Add offline detection + "Offline — showing cached data" banner; add "Updated <time>" microcopy. |
| F-12 | P2 | Headings / landmarks | No `<h1>`; section labels use `<h3>` (`HOURLY FORECAST`, `10-DAY FORECAST`). `header` landmark `false`, only `main` true. Weak document outline for AT. | `metrics.json`: `headings` two h3s at 14px; `landmarks.header: false`, `main: true`. | Screen-reader users lack page title and landmark navigation. | Add `<h1>` (city + temp) or a visually-hidden page heading; add `header`/`main` landmarks; consider `<h2>` for sections. |
| F-13 | P3 | Content | "Overcast" condition appears twice (condition text + icon label row) with identical copy. Microcopy is functional but undifferentiated. | `01-default-1000x700.png`: big "Overcast" next to temp and row "Overcast ☁ 76% 17 km/h". | Mild redundancy, not a blocker. | Differentiate: big condition = current; row = "Conditions" label or remove duplicate. |
| F-14 | P2 | Focus styling | Focus uses Chrome's unstyled default (`outline: rgb(229,151,0) auto 1px`) on a dark glass UI; no `:focus-visible` token exists. | `metrics.json` focus1/focus4; `07-focus-1.png`, `08-focus-4.png`; no focus rules in `src/index.css`. | The default orange ring clashes with the palette and varies by platform, reading as unfinished at a premium price point. | Add a token-based `:focus-visible` ring (2px `var(--text-on-bg)` / accent + 2px offset) for buttons, inputs, and interactive rows; leave mouse focus unstyled. |

P0 count: **1** (F-01). P1 count: **6** (F-03–F-08). P2: 6 (F-02, F-09–F-12, F-14). P3: 1 (F-13).

---

## 5. Top Five Highest-Leverage Changes

Ordered by expected impact on weighted score and ship-readiness.

| # | Fix | Expected score impact |
|---|-----|----------------------|
| 1 | **Fix city-switch desync** (atomic `data` replacement, all panels re-render, `aria-live` announcement) — removes the P0 and the core trust failure. | +0.45 (state 5→8, interaction 7→8, craft 6→7) |
| 2 | **Accessibility baseline** — `aria-label` on 3 titlebar buttons; modal `role="dialog"`/`aria-modal`/focus-trap/Escape; replace emoji with icon+label; add `aria-live="polite"`. | +0.45 (a11y 5→8, color 6→7) |
| 3 | **Scroll affordance + responsive 800×600 layout** — visible scroll cues / no `scrollbar-hide` on main; stack detail grid and reduce padding below ~900px. | +0.36 (layout 6→8, interaction 7→8) |
| 4 | **Contrast audit & tokenization** — measure every text layer against rendered background; enforce 4.5:1/3:1; eliminate 94 hardcoded whites; verify city-button glass contrast. | +0.36 (color 6→8, typography 7→8) |
| 5 | **Titlebar cleanup** — remove redundant dots or make them the buttons; reorder to close–minimize–maximize (red leftmost). | +0.18 (composition 7→8, craft 6→7) |

Cumulative potential: ~6.3 → ~8.1 (B+), contingent on F-01 and F-02–F-08 landing first.

---

## 6. Missing States & Edge Cases (not present in evidence)

These states should exist but have no screenshot / no UI:

- **Offline / network failure** — distinct banner, not the generic "Unable to load weather."
- **City-switch loading** — no spinner/state while the new city's weather fetches (header may flip before body, which *is* the desync).
- **Empty search results** — "No cities found" exists (`CitySearchModal.tsx:75-77`) but was not screenshot; verify it renders.
- **Long city names** (e.g., "Saint Petersburg, Russian Federation") — city pill is `rounded-full` with `px-3 py-1.5`; could overflow the titlebar area at small widths.
- **Extremely long forecast lists** — 10-day is fixed at 10 rows; hourly slices to 24. Fine, but no "more" affordance.
- **Minimum window size** — at 800×600 (`02-min-window-800x600.png`) content is cramped and truncated; define a true min size and reflow.
- **Maximized / full screen** — no evidence; glass gradient may not scale gracefully.
- **Keyboard-only navigation** — tab order not verified; focus trap missing in modal.
- **Reduced motion** — not respected (F-10).
- **High-contrast / forced-colors mode** — `bg-white/55` glass and `text-dynamic` tokens may vanish; not tested.

For each: design the empty/loading/error variant first, then the success state. Every state needs a visible affordance and, where async, an `aria-live` announcement.

---

## 7. Benchmark

Compared to best-in-class references:

| Product | What it does better | Precise gap in this app |
|---------|---------------------|-------------------------|
| **Apple Weather (macOS)** | Single source of truth; city switch updates every panel atomically; "Last updated"; clean titlebar with only 3 traffic-light buttons; dynamic type respects system settings. | Our desync (F-01); redundant titlebar controls (F-08); no updated timestamp (F-11). |
| **Linear** | Ruthless accessibility: every icon button has `aria-label`, focus-visible rings are intentional and consistent, modals trap focus and announce via live regions, reduced-motion respected. | No `aria-label` on titlebar buttons (F-02); no modal role/trap/Escape (F-03); no `aria-live` (F-05); reduced motion ignored (F-10). |
| **Carrot Weather / Dark Sky** | Clear hierarchy, microcopy that differentiates current vs. forecast, no redundant information. | Duplicated "Overcast" (F-13); emoji-as-icons (F-04). |

**Would this pass a Linear or Apple design review? No.** Linear would fail it on accessibility (unlabeled icon buttons, no focus trap, no live regions) and the desync. Apple would fail it on platform titlebar conventions, the misleading data presentation, and contrast rigor. It is a promising v0.1 shell, not shippable.

---

## 8. Appendix: Measurements

All values taken from `metrics.json` (CDP-captured, running app) and source; none invented.

**Viewport / scroll**
- Default: `1000×700`, dpr 1, scrollbarWidth 0. Main container `scrollH 1345 / clientH 700` (overflows by 645px). Hourly strip `scrollW 1812 / clientW 873` (overflows by 939px horizontally).
- Min window: `800×600` (`02-min-window-800x600.png`), right-edge scrollbar visible, 10-day cut off.

**Type scale**
| Sample | Size | Weight | Line-height | Letter-spacing | Color |
|--------|------|--------|-------------|----------------|-------|
| Temp (`16°`/`3°`) | 96px | 300 | 144px | -2.4px | rgb(255,255,255) |
| City button (`San Francisco`/`London`) | 14px | 500 | 20px | normal | `oklch(0.208 0.042 265.755)` |
| Section label (`HOURLY FORECAST`) | 14px | 600 | 20px | 0.35px | rgb(255,255,255) |
| Secondary (`H:16°`) | 14px | 400 | 20px | normal | rgb(255,255,255) |
| Day row (`Wed`) | 14px | 500 | 20px | normal | rgb(255,255,255) |
- Font family: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- `tinyText: 0` (no text below readable size). `contrastVsNearestBg: null` (contrast not measured — a gap).

**Buttons & hit targets**
- Titlebar minimize/maximize/close: 32×32px, top 4px. (Below Apple's 44pt recommended touch target, but these are mouse-driven desktop window controls; acceptable.)
- City button: `137×34` (SF) / `95×34` (London), top 120px, pill `rounded-full` (`borderRadius 3.35544e+07px`), `bg-white/55 backdrop-blur-md border border-white/60`, `px-3 py-1.5`, gap-2.
- All 3 titlebar buttons: `ariaLabel: null`, `title` set only.

**Theme tokens (`src/index.css`)**
- `--bg-gradient`: `linear-gradient(180deg, #0f172a 0%, #1e293b 100%)` (night/overcast). Clear-day would be `#bfdbfe → #60a5fa`; not observed because `WeatherBackground` maps clear-night to the same dark gradient as overcast-night (`#0f172a → #1e293b`), which visually masks the desync (background identical for SF overcast-night and London clear-night).
- `--text-on-bg`: `#ffffff` (night). Set by JS in `WeatherBackground.tsx:56-61`.
- 94 hardcoded white text instances.

**Accessibility facts**
- `ariaLive: 0`; `iconOnlyButtons: 3`, all without `aria-label`; `landmarks.header: false`, `main: true`; `lang: en`; `imagesWithoutAlt: 0`; `emojiInText: 2`; `transitionsFound: 42`, `animationsFound: 0`; `prefersReducedMotion: false`.
- Focus: `outline: rgb(229, 151, 0) auto 1px` on focused elements (focus1 = DIV hourly strip; focus4 = BUTTON close). Visible and distinct.

**Desync — before/after values (from metrics.json)**

| Field | Before (SF) | After select London | Status |
|-------|-------------|---------------------|--------|
| Header city | San Francisco | London | ✅ updates |
| Header temp | 16° | 3° | ✅ updates |
| Header condition | Overcast | Clear | ✅ updates |
| Header H/L | H:16° L:14° | H:3° L:0° | ✅ updates |
| Humidity | 76% | 73% | ✅ updates |
| Wind | 17 km/h | 9 km/h | ✅ updates |
| Hourly "Now" | 13° | 13° | ❌ STALE (SF) |
| Hourly 1am…11pm | 13°…15° | 13°…15° | ❌ STALE (SF) |
| 10-day Wed…Tue | 22°/11°…16°/12° | 22°/11°…16°/12° | ❌ STALE (SF) |
| Details UV/Wind/Hum/Vis/Pressure/Sunrise-Sunset | 0 / 17 / 76% / 18 km / 1006.9 / 06:46–05:00 | identical | ❌ STALE (SF) |

**Independent live verification (London → Paris, post-capture)**

Driven over CDP against the same running build, after the screenshot pass:

| Field | London (before) | Paris (after) | Verdict |
|-------|-----------------|---------------|---------|
| Header city / temp | London, 3° Clear | Paris, 5° Clear | ✅ updates |
| Header humidity / wind | 73% / 9 km/h | 88% / 7 km/h | ✅ updates |
| Hourly "Now" | 13° | 13° | ❌ unchanged (SF) |
| Hourly 1am–11pm | 13°…15° | 13°…15° | ❌ unchanged (SF) |
| 10-day Wed…Tue | 22°/11°…16°/12° | 22°/11°…16°/12° | ❌ unchanged (SF) |
| Detail grid | 76% / 11 km/h / 1006.9 hPa / 06:46–05:00 | identical | ❌ unchanged (SF) |

**Root cause (confirmed in source):** three independent `useWeather()` instances — `App.tsx:10`, `CurrentWeatherHeader.tsx:7`, `WeatherBackground.tsx:5`. Only the header's instance owns the search/select flow, so only its state updates. App's instance keeps fetching San Francisco and feeds `HourlyForecastStrip`, `TenDayForecast`, and `WeatherDetailGrid`; its 10-minute auto-refresh occasionally nudges those SF values (wind drifted 17 → 11 km/h during the session), which masks the staleness.

**Evidence file list**
`01-default-1000x700.png`, `02-min-window-800x600.png`, `03-search-empty.png`, `04-search-results.png`, `05-london-weather.png`, `06-hover-row.png`, `07-focus-1.png`, `08-focus-4.png`, `metrics.json`. All 8 screenshots were read successfully; none corrupt.

---

**End of review.** Weighted score: **6.3 / 10 — Grade C.** P0: **1**, P1: **6**, P2: **6**. Three highest-leverage fixes: (1) fix the city-switch desync, (2) modal accessibility (role/aria-modal, focus trap, Escape, live regions) plus emoji labels, (3) scroll affordance + responsive 800×600 layout.
