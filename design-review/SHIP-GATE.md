# SHIP GATE — Weather App (Electron + React + Tailwind v4, Linux desktop, frameless)

> **Re-gate status — 2026-11-14.** This file is the original gate (FAIL, 3.9/10,
> 6 × P0) and is preserved unchanged as the baseline. Tranche T1–T3 plus the
> units and favourites work has since landed: the six P0s are closed, 132/132
> on-screen values match the API, and every sampled text layer passes contrast.
> The reconciled re-gate verdict — **still FAIL on four P1s, weighted ≈6.7** —
> and the reason no independent auditor could be re-run are in
> [`REGATE.md`](./REGATE.md). Per-item before/after evidence is in
> [`REMEDIATION.md`](./REMEDIATION.md) and `evidence-remediation/`.


**Verdict: FAIL.** Weighted score **3.9 / 10** (grade D — *not viable*). **6 × P0**, 13 × P1, 12 × P2, 2 × P3. Data-integrity defects present → automatic FAIL under the gate rule (PASS = 0 P0, ≤1 P1, no data-integrity defect).

> **Reconciliation note.** This gate was run to completion on the full evidence set. A second, independent reviewer pass was started in parallel as a cross-check but did not complete within its budget, so every disputed point here was re-derived directly from the running app over CDP instead of taken on trust. Findings added after the first draft: the app renders **Liberation Sans**, not an Apple typeface (§SG-29); it issues **three identical forecast requests per launch** (§SG-30); the modal's clear button has **no accessible name** (§SG-31); and the **city name is erased by the 10-minute auto-refresh** (§SG-33). One first-draft overstatement was corrected: "0 unnamed controls" is true only in the base state (§8.6). See §8.9 for the independent checks.

This app does not merely have polish gaps. It **states false things on screen, in at least seven independent ways, at the same time**. In the captured frames the header says the day's high is 16° while the list 300 px below it says 22°/11° for the same day; the hourly strip labels midnight "Now" and shows yesterday's afternoon as upcoming; every weekday in the 10-day list is one day early; the app renders San Francisco's forecast under a Sydney header; the app paints Sydney as night at 2:49 p.m.; a failed city switch leaves the previous city's panels under an error banner; and a dead network is reported to the user as "No cities found". A weather app that lies about the weather has no product. The visual shell is pleasant — the glass, the 96 px hero, the dark gradient — and that is precisely the problem: it makes the product look finished while the content is false.

**Do not ship. Do not beta. Fix the six P0s, then re-gate.**

---

## 1. Method (what I did, and how to reproduce it)

I did not accept the capture notes. Every claim was re-derived from primary sources.

**Sources read in full:** `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/hooks/useWeather.ts`, `src/services/weatherApi.ts`, `src/types/weather.ts`, `src/components/{CitySearchModal,ConditionIcon,CurrentWeatherHeader,HourlyForecastStrip,TenDayForecast,TitleBar,WeatherBackground,WeatherDetailGrid}.tsx`, `electron/main.ts`, `electron/preload.ts`, `index.html`, `package.json`, `dist/assets/index-DUg7t5Tl.css` (built CSS), `design-review/REPORT.md`.

**Pixels:** all 41 frames in `evidence-deep/` were opened and read — 33 from the 00:03–00:05 batch and 8 from a late 22:49–22:53 batch — yielding **20 unique rendered states**; the rest are pixel-duplicates (§8.8) or `*-bg.png` sampling plates. I then ran my own pixel forensics in Python (PIL 12.3 / numpy 2.4.6) on every frame and every `*-bg.png`:

- **Background sampling.** `*-bg.png` is the same frame with text and icons hidden. I confirmed it is layout-identical: `01-default` vs `01-default-bg` differ in only **13,269 of 700,000 pixels** (1.9 %) — exactly the text/ink. So sampling the bg PNG at an element's centre is a valid method. ✔
- **Ground-truth contrast.** Rather than trusting the reported ratios, I extracted the *rendered* glyph pixels (pixels that differ from the bg frame inside the element's box), took the most-saturated glyph pixel (best case for the design), and computed WCAG 2.x contrast against the measured median background. I then cross-checked every number against an analytic alpha-composite of the CSS opacity over the measured background. The two methods agree to ±0.02 — see §9.1.
- **Frame identity.** I md5'd and pixel-hashed every PNG. **Four files have different md5 but identical pixels** (`01-default`, `10-after-reload`, `13a-before-hover`, `13c-hover-dayrow`), and `23a-hover-before` / `23b-hover-dayrow` are pixel-identical. The md5-based "hover changed" conclusion in the capture notes is invalid. See SG-20.
- **Dead CSS.** I grepped the *built* stylesheet for every utility the source uses. Tailwind 4.3.5 is installed; `tailwindcss-animate` is **not**.

**API:** I called the live Open-Meteo endpoint with the app's exact parameter set. It returned `timezone: America/Los_Angeles`, `current.time: 2026-11-13T19:45`, `hourly` = **168 entries starting `2026-11-13T00:00`**, `daily` = **7 entries**. This independently confirms the hourly-anchor, the 7-vs-10 row count, and that all timestamps are *naive city-local* strings (no `Z`), which is the root of the timezone bugs.

**Time context (needed to read every timestamp):** capture host = **America/New_York (UTC−5)**, `Fri Nov 13 2026 00:03–00:05 GMT-0500` (batch 1) and `22:49–22:53 GMT-0500` (batch 2). City-local times differ from host time by the city's UTC offset.

**Date truth table (computed, not assumed):** 2026-11-11 = Wed, 11-12 = **Thu**, 11-13 = **Fri**, 11-14 = Sat, 11-15 = Sun, 11-16 = Mon, 11-17 = Tue, 11-18 = Wed.

---

## 2. Claim-by-claim verification (16 claims from the capture notes)

| # | Claim | Verdict | Correction / proof |
|---|-------|---------|--------------------|
| 1 | Desync caused by three `useWeather()` instances | **CONFIRMED** | `App.tsx:10`, `CurrentWeatherHeader.tsx:7`, `WeatherBackground.tsx:5`. Only the header's instance owns `selectCity` (`useWeather.ts:98`) and it is the only one the modal talks to. App's instance keeps San Francisco and feeds `HourlyForecastStrip`/`TenDayForecast`/`WeatherDetailGrid` (`App.tsx:33-40`). |
| 2 | H/L shows current + apparent, not daily max/min | **CONFIRMED** | `CurrentWeatherHeader.tsx:42-43`: `high = Math.round(current.temperature)`, `low = Math.round(current.apparentTemperature)`. API daily max/min = **21.7 / 10.6**. The app's own 10-day row for the same day renders **22° / 11°** — the app contradicts itself on one screen. `20-sydney-daytime.png` shows the absurd **"H:29°  L:31°"** (low > high). |
| 3 | "Now" is not the current hour; 1am–8am show suns | **MECHANISM CONFIRMED / ATTRIBUTION WRONG** | `HourlyForecastStrip.tsx:23-25` labels index 0 "Now"; live API `hourly[0] = "…T00:00"` (local midnight) → "Now" is 13–21 h stale (`01-default`: hero 16°, "Now" 13° at 21:03 local). **But `09-tokyo-daytime.png` does not show Tokyo's hourly at all — it shows San Francisco's strip** (Now 13°, 1am 13° … identical to `01-default`); that frame is the desync, not Tokyo. Also the icon sample covers **1am–7am**, not 1am–8am. |
| 4 | Daily labels off by one | **CONFIRMED — and worse than stated** | `weatherApi.ts:152-157`: `new Date("2026-11-12")` parses as **UTC midnight**, then `toLocaleDateString` re-renders it in **host-local** time → one day back for every host west of UTC. All **7** rows are wrong, not just the first: API Fri 11-13 → renders "Thu". Independently re-confirmed 23 h later in `24-contrast-1600x1000.png` (API 11-13 Fri → renders "Thu"). Separately, the header date (`CurrentWeatherHeader.tsx:56`) is the **host's** date, not the city's: it said "FRIDAY, NOVEMBER 13" while the city was Sydney on **Saturday, November 14**. |
| 5 | "10-DAY FORECAST" renders 7 rows; no `forecast_days` | **CONFIRMED** | `weatherApi.ts:114-125` sends no `forecast_days`; live API returns 7; `TenDayForecast.tsx:12` says "10-day forecast", `:15` slices 10 of 7. |
| 6 | No persistence | **CONFIRMED** | No `localStorage`/`sessionStorage`/`electron-store` anywhere in `src/` or `electron/` (grep). `useWeather.ts:74-79` hard-loads `DEFAULT_CITY` (San Francisco) on every mount. `10-after-reload-persistence.png` is **pixel-identical** to `01-default`. |
| 7 | Modal: Enter/Escape dead, no trap, no debounce, no dialog semantics, no live region | **CONFIRMED** | `grep -rn "onKeyDown\|keydown\|Escape" src/` → **no hits anywhere**. `CitySearchModal.tsx:28-33` has no `role`/`aria-modal`; `:50-53` has no `onKeyDown`; no focus-trap logic; `ariaLive: 0` in every metrics file. **Added:** the clear (✕) button is **16 × 16 px** (`metrics-07-search-results.json`) — below the 24 px WCAG 2.2 minimum; the results list is `max-h-60` = 240 px for 320 px of content → the 5th result is clipped mid-row behind a nested scrollbar. |
| 8 | Reduced motion ignored, 42 elements still transition | **CONFIRMED** | `metrics-14-reduced-motion.json`: `reducedMotion: true`, `transitions {0.15s: 35, 0.7s: 7}` = 42. `grep "prefers-reduced-motion" src/` → **none**. `animate-pulse` (`App.tsx:20`) and `animate-in` (`CitySearchModal.tsx:33`) also unguarded. |
| 9 | Contrast: day-name 4.02 / 3.44 / 4.18; detail-value 4.0 / 3.66; city button 5.58 → 2.42 | **PARTLY WRONG — both under-report and mis-locate** | (a) **"3.66" appears in no metrics file**; the maximized detail value is **4.18**. (b) The method ignores the text's own opacity, so the reported figures are *optimistic*: true rendered day-name = **3.70:1** (I measured glyph (241,241,243) on bg (120,124,134)); the new `contrast-1600.json` (which *does* composite alpha) measures **2.04**. (c) The "3.44 @800×560" is sampled at a clamped viewport point — the element is off-screen at that size; I measured **no glyph pixels** in its box. (d) The **2.42** city-button reading is the modal scrim dimming background content — intentional, not a WCAG failure. I reclassify it. (e) The real finding is systemic, not three samples: **every text layer on the glass cards fails** — 1.63–3.11:1 (§9.1). |
| 10 | No °C/°F, no settings, no geolocation, no last-updated, no refresh | **CONFIRMED** | `weatherApi.ts:114-125` sends no `temperature_unit`/`wind_speed_unit`; Open-Meteo defaults to °C and km/h. `grep -i "celsius\|fahrenheit\|units\|geolocation\|updated" src/` → nothing but the internal `AUTO_REFRESH_MS`. The user is **locked to Celsius with no exit**. |
| 11 | Failed city switch → error header over stale SF panels, no retry | **CONFIRMED** | `19-offline-switch-failure.png`: header = "Unable to load weather / Network Error"; below it the **San Francisco** hourly strip (Now 13°…) and the **San Francisco** 10-day (Wed 22° 11°, Thu 15° 10°). `offline-switch.json` confirms. **Added:** the city pill **disappears entirely** (the header's `error` branch replaces the whole hero), so the user cannot even tell which city the stale panels belong to; no spinner, no retry button, and the message is the raw axios string. |
| 12 | 200% zoom: px hero doesn't scale; check 04 for clipping | **MISLABELLED / OVERSTATED** | `metrics-04` hero rect is **byte-identical** to `metrics-01` (x48 y186 w138 h144) → `04-zoom-200-500x350` is a **500 × 350 viewport** capture, **not** a 200 % zoom. Browser zoom scales px text fine. The real (narrow) defect: only the 96 px hero is px-locked; the other **93** text elements use rem-based Tailwind sizes and **do** scale. At 500 px the layout does not reflow — the date stays pinned to the same right-hand row as the city pill and the 96 px hero stays 96 px. |
| 13 | AX: 0 unnamed controls; check heading order, landmarks, dialog semantics, announcements | **CONFIRMED + ADDITIONS** | `ax-tree.json` (530 nodes): `button 4` — Minimize / Maximize / Close / "San Francisco", **all named**; `heading 2` — both **h3** ("HOURLY FORECAST", "10-DAY FORECAST"); **no h1, no h2**; landmarks `main: true` only (no `header`/`nav`/`footer`/`section`); `roleDialog 0`, `ariaModal 0`, `ariaLive 0`. **Added:** the city button's accessible name is just "San Francisco" — nothing signals "change city"; the detail grid has **no heading at all**; a screen-reader user cannot tell a daily **high from a low** (both are bare "22°"/"11°"); nothing announces a city change. |
| 14 | Hover on close and on day rows both change pixels | **HALF FALSE** | Close hover is real: `13a→13b` changes **826 px** in bbox x[104–135] y[4–35]. **The day-row hover is not evidenced**: `13a` vs `13c` = **0 changed pixels**; `13c` is byte-identical to `01-default`; and the second attempt `23a`/`23b` is byte-identical too. `deep-summary.json`'s `hoverRowChanged: true` is **false** — md5 differed only because PNG encoder output differs for identical pixels. Two independent captures failed to produce any hover delta. |
| 15 | Forced colors: judge usability | **CONFIRMED — partial failure** | `15-forced-colors.png` + `metrics-15`: city button **2.27:1** (white on forced ButtonFace #acacac) **FAIL**; "H:16° L:15°" **2.52:1** **FAIL**; hero/section labels 21:1 pass. The glass cards **lose their fill entirely** — only the "Now" card's 1 px outline survives, so the hourly strip collapses into ungrouped numbers. Legible, structurally broken. |
| 16 | Frameless window behaviour; what's missing | **CONFIRMED** | `electron/main.ts:15-31`: `frame:false`, 1000×700 default, `minWidth 800 / minHeight 560`, `backgroundColor "#1e293b"`, `setAutoHideMenuBar(true)`, **no `title`, no `icon`, no application menu**. `TitleBar.tsx:8` = `-webkit-app-region: drag`; `:41` a 80 px drag filler. **Missing:** `grep -rn "dblclick" src/ electron/` → **none** (no double-click-to-zoom); `isMaximized` is exposed by `preload.ts:7` but **never used in `src/`** (grep) → the maximize button never becomes "Restore"; the window title is **`weather-app`** (`index.html` `<title>`), not the productName "Weather"; the favicon is the **Vite logo** (`public/favicon.svg`, fill `#863bff`). |

---

## 3. Release blockers (P0)

> Each P0 is independently ship-blocking. Any one of them alone fails the gate.

### SG-01 — City switch leaves every panel on the previous city (P0 · data integrity)
**Evidence.** `09-tokyo-daytime.png`: pill "Tokyo", hero "20° Clear", humidity 48 % / 5 km/h — but the hourly strip reads Now 13°/1am 13°/2am 13° and the 10-day row reads "Wed 22° 11°": **byte-for-byte San Francisco**. `21-long-city-name.png` repeats it with a third city ("Llanfairpwllgwyngyll" 3° over Sydney's strip). `19-offline-switch-failure.png` shows the failed variant.
**Root cause.** Three `useWeather()` instances (`App.tsx:10`, `CurrentWeatherHeader.tsx:7`, `WeatherBackground.tsx:5`); only the header's instance receives `selectCity`. `App`'s instance keeps SF and keeps feeding the panels (`App.tsx:33-40`).
**Impact.** The product shows one city's name above another city's forecast. A user dresses for the wrong day.
**Fix.** One provider, one `data`. Extract `WeatherProvider` (`createContext` + `useWeather` at the provider level); mount it once in `App.tsx`; consume via `useWeatherContext()` in `CurrentWeatherHeader`, `HourlyForecastStrip`, `TenDayForecast`, `WeatherDetailGrid`, `WeatherBackground`. Delete `useWeather()` calls from the three components. Add a dev assertion: `expect(data.city.id).toBe(selectedCity.id)` for every panel.

### SG-02 — "H / L" shows the current and apparent temperature, not the day's range (P0 · false data)
**Evidence.** `CurrentWeatherHeader.tsx:42-43`. API day max/min = **21.7 / 10.6**; UI renders **H:16° L:15°**; the app's own 10-day row for the same day renders **22° / 11°** (`01-default`). `20-sydney-daytime.png`: **"H:29°  L:31°"** — the "low" is 2° above the "high".
**Impact.** The single most-read number in a weather app is wrong and self-contradictory. Any clothing/commute decision based on it is wrong.
**Fix.** `const today = data.daily[0]; const high = Math.round(today.maxTemperature); const low = Math.round(today.minTemperature);` and drop `apparentTemperature` from the H/L pair (show it as "Feels like 15°" on its own if desired). Assert `high >= low` in a unit test.

### SG-03 — The hourly strip is anchored at local midnight and mislabels it "Now" (P0 · false data)
**Evidence.** Live API `hourly[0] = "2026-11-13T00:00"` (local midnight). `HourlyForecastStrip.tsx:23-25` labels index 0 "Now". `01-default` at 21:03 local: hero **16°**, strip **"Now 13°"** — a 3°/21-hour error. `24-contrast-1600x1000.png`: 19:53 local, "Now 15°" vs hero 12°. The strip then presents the **elapsed** part of the day as if it were upcoming, under the label **"Next 24 hours"**.
**Impact.** The forecast a user reads to plan the next hour is hours out of date, and the direction of the strip is reversed.
**Fix.** Find the index of the current hour by comparing `h.time` (naive city-local) to the API's `current.time` (same format) — `hourly.findIndex(h => h.time >= current.time)` — slice from there, and label that card "Now" only when `h.time === current.time`; label the first card "Midnight"/"12am" when the series genuinely starts at 00:00. Request `&forecast_hours=24&past_hours=0` so the series starts at the current hour. Change the header text from "Next 24 hours" to **"Today"** / **"Next 24 hours from now"** per what is actually rendered.

### SG-04 — Every weekday in the 10-day list is one day early (P0 · false data)
**Evidence.** `weatherApi.ts:152-157` parses `"2026-11-12"` as **UTC** midnight and re-renders it in host-local time. Host UTC−5 → Nov 11 19:00 → "Wed". Truth: Nov 12 = **Thu**. All 7 rows are wrong: rendered Wed/Thu/Fri/Sat/Sun/Mon/Tue vs true Thu/Fri/Sat/Sun/Mon/Tue/Wed. Re-confirmed 23 h later in `24-contrast-1600x1000.png` (API Fri → renders "Thu") — this is a parse bug, not a clock bug, so it never self-corrects.
**Impact.** For every user in the Americas (and for the app's own default city), today's forecast is filed under yesterday.
**Fix.** Treat the API's date strings as **calendar dates, not instants**: `const [y,m,d] = date.split("-").map(Number); const dayName = new Date(y, m-1, d).toLocaleDateString(undefined, {weekday:"short"});` — or use `Temporal`/`Intl.DateTimeFormat` with `timeZone: data.timezone`. Apply the same to the header date, which must come from the **city's** timezone (`data.timezone`), not `new Date()`.

### SG-05 — Day/night icons and the entire app theme follow the **host** clock, not the city's (P0 · false data)
**Evidence.** `weatherApi.ts:43-46`: `isNightTime()` takes the API's **naive city-local** string, lets JS parse it as **host-local**, then reads `getUTCHours()` — mixing three clocks. `weatherApi.ts:127-128`: `currentIsNight = isNightTime(new Date().toISOString())` — the **host's** UTC hour. `WeatherBackground.tsx:55-61` paints the whole gradient from that flag.
Observed: `09-tokyo-daytime.png` — Tokyo, 20 °C, **Clear**, at 14:00 JST, rendered as a **dark navy night app with a crescent moon**. `20-sydney-daytime.png` — Sydney, 29 °C, Partly cloudy, at ≈14:49 AEDT, rendered in the **night gradient** (`rgb(30,41,59)→rgb(51,65,85)` per `daylight-check.json`). `24-contrast-1600x1000.png` — **moons at 4 pm, 5 pm, 6 pm, 7 pm** in San Francisco.
Computed error: on a UTC−5 host the app marks **15:00–23:00 plus 00:00** as night for SF and **00:00 plus 15:00–23:00** for Tokyo — up to **9 of 24 hours wrong**, and the whole app's theme inverted.
**Impact.** The product tells the user it is night when it is afternoon. The background, the icon, and the colour temperature all lie together.
**Fix.** The API already returns `daily.sunrise[0]` / `daily.sunset[0]` — **use them**. `const isNight = (t: string) => { const day = t.slice(0,10); const rise = daily.sunrise[i], set = daily.sunset[i]; return t < rise || t > set; }` — comparing **strings** works because the API's local timestamps are lexicographically ordered and share a format. For the current condition, compare `data.current.time` against today's `sunrise`/`sunset` from the same response. Never call `new Date()` for city time. Also: `ConditionIcon.tsx:11` has **no night variant for "partly-cloudy"** (and none for overcast/rain/snow) — only "clear" can ever show a moon; add `MoonCloud` variants.

### SG-06 — A failed city switch shows an error banner over the *previous* city's data (P0 · false data / trust)
**Evidence.** `19-offline-switch-failure.png` + `offline-switch.json`. Mechanism: `App.tsx:30` gates on **App's** `data` (still SF) while `CurrentWeatherHeader.tsx:30-37` renders its **own** `error` — so the header becomes an error block and the panels below keep rendering SF. The city pill is destroyed by the error branch, so the panels are attributed to nothing.
**Impact.** The user is told "Unable to load weather" while reading San Francisco numbers as if they were Berlin's. A city switch that fails silently corrupts the forecast.
**Fix.** Single data source (SG-01) fixes this structurally: one `status` (`idle|loading|ready|error`) and one `data` that is **never** replaced by a failed request. On failure, keep the last good data and label it: a dismissible inline banner "Couldn't load Berlin — showing San Francisco (updated 21:03)". Add a **Retry** button bound to `loadWeather(selectedCity)`. Never blank the city pill.

---

## 4. Scorecard (13 weighted dimensions)

| # | Dimension | Weight | Score | Weighted | Justification (evidence) |
|---|-----------|-------:|------:|---------:|----------------------------|
| 1 | Visual hierarchy & composition | 10% | 6.0 | 0.60 | The 96 px hero is a genuinely strong anchor and the glass language is coherent. But: six optical left axes (50/55/56/61/65/109), a duplicated condition string, decorative traffic-light dots next to the real controls, an ~840 px void between the hero and the date at 1920 (`03-maximized`), and a bright legacy scrollbar slicing the hourly strip. |
| 2 | Typography | 8% | 4.0 | 0.32 | The system stack is written correctly but **never resolves to an Apple face**: on Ubuntu the stack falls through to **Liberation Sans** (Arial metrics) — measured with `CSS.getPlatformFontsForNode`, no bundled font exists. The ramp has only six sizes (12/14/16/18/24/96) and **85 of 94 text elements (90 %) sit at 12–14 px**; the section label (14/600) and body (14/400) are the same size, differing only by weight; the hero is 96 px/300 with −2.4 px tracking in a face that has no true light cut; `letter-spacing-tighter` is a **dead class**; no tabular figures for the temperature columns. |
| 3 | Color, contrast & theming | 10% | 3.5 | 0.35 | A real token system (`--text-on-bg`) exists — and is undermined: **every text layer on the glass cards fails AA (1.63–3.11:1)**, 93 hardcoded whites, the theme keyed to the host clock (SG-05), and a day theme that has never been rendered in any frame. |
| 4 | Layout, spacing & adaptivity | 10% | 5.0 | 0.50 | Spacing is disciplined (all values on the 4/8 pt grid: 24/16/12/8/4, gaps 12/16/24/48, rows 46 px). But: the app's **default window (1000 px) is below the `lg:` breakpoint (1024 px)** → the designed two-column layout never appears at the default size (`measure-layout.json`: `grid-cols-1`, one 937 px column); the detail grid is **entirely below the fold** at 700 px (content 1389 px vs 700 px viewport); four left axes; a hard black `to-black/40` fade at the strip's right edge; no reflow at 500 px. |
| 5 | Iconography & data visualization | 6% | 4.5 | 0.27 | Lucide condition icons are consistent and correctly sized (16/18/20 px, stroke 2). But: **emoji as icons** (💧/🌬) beside vector icons, six unrelated Tailwind accent hues in the detail cards (amber/blue/blue-400/indigo/purple/orange), and a "range bar" that encodes nothing meaningful (a fixed /20 °C scale, floored at 20 %, placed 900 px from the numbers, no scale or legend). |
| 6 | Interaction & feedback | 10% | 3.5 | 0.35 | Enter and Escape are dead (no `keydown` handler anywhere); no focus trap; no debounce — **one request per keystroke** with no `AbortController`, so out-of-order responses can overwrite newer results; no spinner or progress during a city switch; no retry; no refresh; no feedback that a search failed vs. found nothing. |
| 7 | State coverage & resilience | 8% | 3.5 | 0.28 | Loading: the skeleton is `bg-white/30` on a **white** page → **invisible** (only 1,199 non-white pixels in the whole frame). Error: the page goes **stark white** (the gradient token is never set) with the raw axios string "Network Error" and no retry. Offline: no detection, stale data presented as current. Empty: "No cities found" — also used for network failure. No persistence. |
| 8 | Accessibility | 10% | 4.0 | 0.40 | Credit where due: 0 unnamed controls, `lang="en"`, visible focus. Against that: no h1/h2, one landmark, no dialog semantics/trap/Escape, no live region, a **16 × 16 px** target, UA-default orange focus ring, forced-colors failures at 2.27:1 and 2.52:1, no reduced-motion support, day-name/min unreadable in forced colors, and a screen reader cannot tell a high from a low. |
| 9 | Content, microcopy & IA | 6% | 3.5 | 0.21 | Microcopy actively lies in five places: "H/L", "Now", "Next 24 hours", "10-day forecast", "FRIDAY, NOVEMBER 13". Plus "Network Error" leaking from axios, "No cities found" for a dead network, the condition printed twice, and "Next 24 hours" describing something that is not 24 hours from now. |
| 10 | Craft, polish & restraint | 5% | 3.5 | 0.18 | Five **dead utility classes** (below) render as nothing; a Vite-logo favicon; the window titled "weather-app"; a legacy white scrollbar with arrow buttons in a dark glass app; a fake macOS title bar; the modal has no entrance animation despite `animate-in`. |
| 11 | Data integrity & trust | 8% | 2.0 | 0.16 | SG-01…SG-06. Six independent mechanisms producing false statements about the weather, plus one app contradicting itself on a single screen (H:16°/L:15° vs 22°/11°), plus "L:31°" above "H:29°". |
| 12 | Product completeness | 5% | 2.0 | 0.10 | No °C/°F, no unit parameters, no wind/precip unit control, no use-my-location, no saved/recent cities, no last-updated stamp, no manual refresh, no settings, no keyboard shortcuts, no notifications. For a weather app these are table stakes, not features. |
| 13 | Platform conventions | 4% | 3.5 | 0.14 | Frameless with drag regions — but the macOS look is a **costume**: three decorative red/yellow/green dots that do nothing, three unrelated lucide glyphs on the left in fixed slate-500 (4.2:1) while the close button follows the theme, no double-click zoom, no app icon, no menu, a wrong window title, the maximize button never becomes "Restore", and a `#1e293b` window background that flashes against the app's white pre-data page. |
| | **TOTAL** | **100%** | | **3.86 → 3.9** | Grade **D** — *not viable* (anchor: <5). |

---

## 5. State matrix

| State | Result | Evidence | Note |
|---|---|---|---|
| Default 1000×700 | **FAIL** | `01-default` | Correct composition; wrong H/L, wrong "Now", wrong weekdays, failing contrast, bright scrollbar, detail grid below the fold. |
| Minimum window 800×560 | **FAIL** | `02-min` | `lg:` layout off (single column); day-name off-screen; legacy scrollbar; content 1345 px in 560 px. |
| Maximized 1920×1080 | **FAIL** | `03-maximized` | 12-col layout engages, but the hero leaves an ~840 px void; the 10-day row is 1032 px wide with 80 % empty space; scrollbars still bright. |
| 1600×1000 (later batch) | **FAIL** | `24-contrast-1600x1000` | Contrast worst here: day-name 2.04, detail-value 3.11, hourly-temp 2.82. "SUNRISE / SUNSET" label **wraps to two lines**; its value wraps to "04:59 / PM". |
| 500×350 narrow viewport | **FAIL** | `04-zoom-200-500x350` | No reflow; date hard against the pill; 96 px hero unchanged. (Labelled "zoom 200 %" but it is a viewport test — SG-12.) |
| Search — empty | **FAIL** | `05-search-empty` | Panel is 448 × ~240; input ring is a saturated web-style 2 px blue; no `role="dialog"`. |
| Search — no results | **FAIL** | `06-search-no-results` | "No cities found" — indistinguishable from a network failure. |
| Search — results | **FAIL** | `07-search-results` | 5th row clipped behind a nested scrollbar; 16 × 16 clear button; no keyboard hints; no result count. |
| Modal at 800×560 | **FAIL** | `22-modal-800x560` | Panel 448 × 470 fits (45 px margins) but the list clips mid-row. |
| Modal focus traversal | **FAIL** | `08-modal-focus-trail` + `deep-summary.tabTrail` | Focus order: input → ✕ → 5 results → Cancel → **the hourly scroller behind the modal**. No trap, no return. |
| Keyboard-only traversal (page) | **FAIL** | `17-keyboard-traversal` | Only **4** focusable things exist (3 window buttons + city pill) + the scroll container; focus ring = Chrome's default orange, wrapping the whole strip. |
| Loading | **FAIL** | `12-loading` | Entire window **white**; skeleton invisible; only a gray "Loading weather…" line. |
| Error (initial load) | **FAIL** | `11-offline-error` | White page, "Unable to load weather / Network Error", **no retry**, no icon, no offline copy. `headings: []` — zero headings. |
| Error after a city switch | **FAIL** | `19-offline-switch-failure` | SG-06: error header over stale SF panels. |
| Offline | **NOT IMPLEMENTED** | `18-offline-city-switch` | No offline detection; the geocoding failure is reported as "No cities found". |
| Stale data | **NOT IMPLEMENTED** | — | No "last updated", no staleness marker; the 10-minute auto-refresh (`useWeather.ts:35-45`) is invisible. |
| City switch (Tokyo / Sydney / Llanfair…) | **FAIL** | `09`, `20`, `21` | SG-01. |
| Long city name | **PASS (weak)** | `21-long-city-name`, `daylight-check.longName` | "Llanfairpwllgwyngyll" fits at 172 px, no overflow — but it collides with the date at 800 px. |
| Daytime conditions | **FAIL** | `09`, `20` | SG-05: Tokyo and Sydney both rendered as night at 14:00–14:49 local. |
| Day theme (light gradient) | **PARTIAL** | `25-day-theme-synthetic`, `day-theme.json` | Forced synthetically (no real daylight condition was ever rendered). Contrast holds: hero 10.2:1, day-name 11.3:1, section 7.3:1 — but **day-min 4.36:1 fails 4.5**. Visually the glass cards nearly vanish into the sky (`bg-white/30` on #60a5fa), `border-white/60` is invisible, and the `to-black/40` strip fade is a grey smudge. |
| Auto-refresh (10 min) | **FAIL** | `auto-refresh-name.json` | SG-33: the city name is dropped and the pill becomes "Search city". |
| Hover — window close | **PASS** | `13b` vs `13a` | 826 px change; the button becomes a red circle. Inconsistent with the other two controls. |
| Hover — day row | **UNVERIFIED** | `13c` ≡ `01`; `23a` ≡ `23b` | Two captures, **zero** pixel change. Source declares `hover:bg-white/60`. Hypothesis: the capture never applied the hover (the row's box is at y=999 in the scrolled document while the pointer is placed in viewport coordinates) — unverifiable from stills. |
| Reduced motion | **FAIL** | `metrics-14` | `prefersReduce: true`, 42 transitions still active, no media query in source. |
| Forced colors | **FAIL** | `15-forced-colors` | City button 2.27:1, H/L 2.52:1; glass fills collapse; the decorative traffic dots vanish (proving they are pure costume). |
| Screen-reader (AX) | **FAIL** | `ax-tree.json` | 0 unnamed controls ✓; no h1/h2; 1 landmark; no dialog/live region; high vs low unlabelled. |
| Window chrome | **FAIL** | `electron/main.ts`, `TitleBar.tsx` | No title/icon/menu, no dbl-click zoom, maximize never becomes Restore, title "weather-app". |

---

## 6. What genuinely works (five, no flattery)

1. **The hero temperature is well set.** 96 px / weight 300 / −2.4 px tracking on a near-black gradient is a deliberate, confident display setting that anchors the whole screen (`metrics-01`, `03-maximized`).
2. **The modal's macro-composition is right.** Centred 448 px panel, `rounded-3xl`, hairline dividers, a two-line result (place name + region), a chevron affordance, and a footer that separates the dismiss action from the content (`05`, `07`, `22`). It is the most considered component in the app.
3. **Every interactive control in the base screen has an accessible name.** 0 unnamed buttons across 530 AX nodes — the window controls are named via `title` (`ax-tree.json`). That is rarer than it should be and it is right. (The modal's ✕ is the one exception — SG-31.)
4. **The spacing system is disciplined.** Every value lands on the 4/8 pt grid (24/16/12/8/4; gaps 12/16/24/48; 46 px rows; 12 px radii on cards, 16 px on pills, 24 px on the modal). Nothing is arbitrary.
5. **`autoFocus` on the search field and a genuine empty state** (`05-search-empty.png`) — the dialog opens ready to type, and the "no results" copy exists as a designed state rather than a blank void.

---

## 7. Findings register

| ID | Sev | Area | Finding | Evidence | User impact | Exact fix |
|----|-----|------|---------|----------|-------------|-----------|
| SG-01 | **P0** | Data / state | Three independent `useWeather()` instances; only the header's handles selection → panels keep the old city. | `App.tsx:10`, `CurrentWeatherHeader.tsx:7`, `WeatherBackground.tsx:5`; `09`, `21`, `19` | SF forecast sold as Tokyo/Sydney/Llanfair. | One `WeatherProvider` + `useWeatherContext()`; delete the two component-level `useWeather()` calls; assert `data.city.id === selected.id` per panel. |
| SG-02 | **P0** | Data | H/L = current temp + apparent temp, not daily max/min. | `CurrentWeatherHeader.tsx:42-43`; API 21.7/10.6; `20` shows "H:29° L:31°" | The headline number is wrong and self-contradictory. | `high = Math.round(data.daily[0].maxTemperature)`, `low = Math.round(data.daily[0].minTemperature)`; show apparent as "Feels like". |
| SG-03 | **P0** | Data / IA | "Now" = local midnight; the elapsed day is shown as upcoming; label says "Next 24 hours". | Live API `hourly[0]="…T00:00"`; `HourlyForecastStrip.tsx:23-25`; `01` (Now 13° vs 16°) | The forecast you plan by is hours stale and time-reversed. | Request `forecast_hours=24&past_hours=0`; slice from `hourly.findIndex(h => h.time >= current.time)`; label that card "Now"; rename the header to "Today". |
| SG-04 | **P0** | Data | `new Date("YYYY-MM-DD")` = UTC midnight → rendered in host TZ → every weekday one day early (all 7 rows); header date = host date. | `weatherApi.ts:152-157`; `24-contrast-1600x1000` (API Fri → "Thu"); `20` (Sydney shown on the host's date) | Today is filed under yesterday for every user west of UTC. | Parse as a calendar date: `new Date(y, m-1, d)`; format the header date with `Intl.DateTimeFormat(undefined, {…}, {timeZone: data.timezone})` — store and use the API's `timezone`. |
| SG-05 | **P0** | Data / theming | Night/day and the whole gradient follow the **host** clock; `partly-cloudy` has no night icon at all. | `weatherApi.ts:43-46,127-128`; `WeatherBackground.tsx:55-61`; `09` (Tokyo 14:00 = moon), `20` (Sydney 14:49 = night theme), `24` (moons at 4–7 pm) | The app says it is night at 2 p.m. | Compare the naive city-local timestamp **as a string** against `daily.sunrise[i]` / `daily.sunset[i]`; use `data.current.time` for the current condition; add `MoonCloud`/`MoonCloudRain` icon variants. |
| SG-06 | **P0** | Resilience | A failed switch renders an error header over the previous city's panels; the city pill vanishes; no retry. | `19-offline-switch-failure.png`; `offline-switch.json`; `App.tsx:30` vs `CurrentWeatherHeader.tsx:30-37` | Stale data is displayed as if it were the new city. | One `status`/`data` pair; on failure keep last-good data and show "Couldn't load Berlin — showing San Francisco (updated 21:03)" + a Retry button; never unmount the city pill. |
| SG-07 | **P1** | Color / a11y | **Every** text layer on the glass cards fails AA: day-name 2.04–3.70, day-min 1.63, detail-label 2.33, detail-value 3.11–4.18, hourly-temp 2.82–3.62. | `contrast-1600.json`; my own ground-truth pass on `24` and `03` (±0.02 agreement) | The app's information layer is unreadable for low-vision users. | Cards `bg-white/25` (not /45) and text at ≥0.95 for values, ≥0.85 for labels → measured ≥7:1. Quick proof: `bg-white/25` over (7,13,30) = (69,73,88) → pure white = **8.95:1**, 90 % white = **7.16:1**. |
| SG-08 | **P1** | Content / IA | Heading says "10-DAY FORECAST"; 7 rows render (API returns 7). | `TenDayForecast.tsx:12,15`; `api-check.json` `dailyDaysReturned: 7` | The label is a false statement. | Send `forecast_days=10` in `weatherApi.ts:114-125` **or** rename to "7-day forecast"; do both (10 days, labelled 10). |
| SG-09 | **P1** | A11y / interaction | Modal has no `role="dialog"`/`aria-modal`/label, no focus trap, no focus return, no Escape, no Enter, no live region; ✕ button is **16 × 16 px**; results clipped mid-row behind a nested scrollbar. | `CitySearchModal.tsx:25-33,47-57,58-68,78-94`; `metrics-07` (16 × 16); `08`; `deep-summary.tabTrail` | Keyboard/SR users cannot dismiss, operate, or perceive the dialog. | `role="dialog" aria-modal="true" aria-labelledby="search-title"`; trap focus, restore to the city pill on close; `onKeyDown` Escape → `onClose`; wrap the input in a `<form>` so Enter selects the first result; `aria-live="polite"` for "N results"/"No cities found"; ✕ hit area → **28 × 28 px** with a 16 px glyph; list `max-h-72` (288 px) and add a count line. |
| SG-10 | **P1** | Performance / interaction | One geocoding request per keystroke, no debounce, no `AbortController`, no result sequencing → out-of-order responses can show stale results. | `CitySearchModal.tsx:50-53` → `useWeather.ts:81-96`; no debounce in source | Rate-limited by the API; wrong results shown. | Debounce 250 ms + `AbortController` + a monotonically increasing request id; ignore responses whose id is stale. |
| SG-11 | **P1** | Content / trust | A failed search request is reported as **"No cities found"** — i.e. "that city doesn't exist". | `useWeather.ts:91-93` (`catch { setSearchResults([]) }`); `18-offline-city-switch.png` | The user is told a city is invalid when the network is down. | Keep `searchError` separate from `results.length === 0`; render "Couldn't reach the search service — try again" for failures, "No cities found" only for a successful empty result. |
| SG-12 | **P1** | Completeness | No °C/°F, no unit parameters, no wind/precip unit control, no use-my-location, no saved cities, no last-updated, no manual refresh, no settings. | `weatherApi.ts:114-125` (no `temperature_unit`/`wind_speed_unit`); `grep` over `src/` | A US user cannot read the forecast; no way to refresh or check staleness. | Add `temperature_unit=fahrenheit&wind_speed_unit=mph` from a `units` setting; a `⌘,`/gear → Settings sheet with Unit (°C/°F), Wind (km/h/mph), "Use my location"; a Refresh button in the title bar + `Updated <time>` under the hero; persist the selected city and units (see SG-13). |
| SG-13 | **P1** | State / persistence | The selected city resets to San Francisco on every launch; nothing persists. | No `localStorage`/`sessionStorage`/`electron-store` (grep); `useWeather.ts:74-79`; `10` ≡ `01` pixel-wise | The user re-picks their city every session. | Persist `{cityId, lat, lon, units}` to `localStorage` (or the main process via IPC) and rehydrate before the first fetch; show a subtle "Restored your last city" only when it differs from the default. |
| SG-14 | **P1** | State | The loading state is a **white screen** with an invisible skeleton (`bg-white/30` on white) and one gray line of text. | `12-loading.png` (1,199 non-white px in the whole frame); `App.tsx:19-22` | First impression is a blank white window, opposite the app's identity. | Set `--bg-gradient`/`--text-on-bg` to a neutral dark base (e.g. `#0f172a→#1e293b`) before data arrives; skeleton `bg-white/20` on that base; use `animate-pulse` only when motion is allowed. |
| SG-15 | **P1** | State / trust | The error state drops the theme entirely (white page) and shows the raw axios string "Network Error"; no retry; no offline detection; stale data never labelled. | `11-offline-error.png`; `useWeather.ts:60-66`; `index.css:36` fallback `#ffffff` | The user sees a different app and an engineer's error code. | Keep the gradient on error; message "Couldn't reach the weather service" + "Check your connection and try again" + a **Retry** button; map axios codes (`ERR_NETWORK` → offline copy); show "Last updated 21:03" on cached data. |
| SG-16 | **P1** | Layout | The app's **default 1000 px window is below the `lg:` (1024 px) breakpoint** → the designed two-column layout never appears at the default size; the detail grid is below the fold; content 1389 px in a 700 px viewport. | `measure-layout.json` `gridCols.class = "grid grid-cols-1 lg:grid-cols-12"`, `cols: "937px"`; `03-maximized`; `01` | The composition the design intends is only visible maximized. | Move the breakpoint to `md:` (768 px) or set `lg` → `min-[1000px]`; or set the default window to 1200 × 800; add a sticky header and make the detail grid a 2-up row under the forecast at <1024 px. |
| SG-17 | **P1** | Layout / alignment | **Six optical left axes**: "H:16°" ink at x=50, the hero at 55, both section labels at 56, the city pill text at 61, the day names at 65, the detail labels at 109. The two section labels align only by accident (the 10-day one carries a compensating `px-2` inside a container at x=48; the hourly one is in a container at x=56). | `measure-layout.json` rects; my own ink-band scan of `01-default` vs `01-default-bg` (bands at y 343–352 x50…, 400–415 x56…, 624–633 x56…, 671–684 x65…) | Nothing lines up; the eye has no vertical anchor, and the "one axis" illusion breaks the moment a row is added. | Pick one content axis at **x = 48** and make it real: remove the `px-2` from both section labels, move the hourly strip wrapper to `px-6` with no inner `px-2`, drop the `px-4` from the day-row container (keep it on the inner content), and align the detail grid to the same 48. |
| SG-18 | **P2** | Accessibility | `prefers-reduced-motion` ignored: 42 transitions + `animate-pulse` + the modal animation; no media query in source. | `metrics-14` (`reducedMotion: true`, 42 transitions); `grep` → none | Motion-sensitive users get motion they declined. | `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; } }` in `index.css`. |
| SG-19 | **P2** | Accessibility | Focus is Chrome's default orange ring (`rgb(229,151,0) auto 1px`) on a dark glass UI, including a 850 px outline around the hourly scroller. | `17-keyboard-traversal.png`; `deep-summary.pageTabs`; no `:focus-visible` in `index.css` | Reads as a bug, not a designed state. | `:focus-visible { outline: 2px solid var(--text-on-bg); outline-offset: 2px; border-radius: 8px; }` on buttons, the input, and the scroll container (or `scrollbar-width: thin` + `tabindex="-1"` on the scroller). |
| SG-20 | **P2** | Craft / evidence | **Five dead utility classes** — `no-scrollbar`, `scrollbar-hide` (not in Tailwind v4), `animate-in`/`fade-in`/`slide-in-from-top-2` (`tailwindcss-animate` not installed), `letter-spacing-tighter` (not a v4 class). Result: bright legacy scrollbars with arrow buttons in a dark app, and **no modal entrance animation**. | `grep` on `dist/assets/index-DUg7t5Tl.css` → 0 matches; scrollbar pixels measured at (252,252,252)/(139,139,139); `13c` ≡ `01`, `23a` ≡ `23b` | The polish layer renders as noise instead of design. | Install `tailwindcss-animate` (or hand-write the keyframes) and replace `no-scrollbar scrollbar-hide` with CSS: `scrollbar-width: none; &::-webkit-scrollbar { display:none; }` for the strip, `scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.25) transparent` for the page; delete `letter-spacing-tighter` and use `tracking-tighter`. |
| SG-21 | **P2** | Iconography | Emoji as icons beside a vector icon set: 💧 (a colour droplet) and 🌬 (**a face blowing wind**) in the header, 💧 on hourly cards. | `CurrentWeatherHeader.tsx:76-77`; `HourlyForecastStrip.tsx:49-53`; `metrics.emoji = 2` (screen shows 3 sites) | Tone-deaf; a face emoji next to a wind speed; SR announces "wind face". | Replace with lucide `Droplet` / `Wind` at 16 px with `aria-hidden="true"`, and label the chip `aria-label="Humidity 82%"`; keep the values as text. |
| SG-22 | **P2** | Data viz | The 10-day "range bar" encodes nothing usable: fixed /20 °C scale, floored at 20 % (4 of 7 days hit the floor on the live API: 3.6/3.1/3.7/3.7 °C → all 20 %), placed 900 px from the numbers, no scale, no legend. | `TenDayForecast.tsx:29-36`; live API; `03-maximized` | Four different days render identically; the bar is decoration pretending to be data. | Either delete it, or make it real: compute the week's min/max, scale the track to that window, draw the bar from the week's min to the day's max, and move it directly under the temperature pair (max 240 px). |
| SG-23 | **P2** | Platform | The macOS title bar is a costume: decorative red/yellow/green dots that do nothing next to three lucide glyphs on the left (minimize, maximize, close — macOS order is close, minimize, maximize); the two left icons are fixed slate-500 (4.2:1) while the close follows the theme; no dbl-click zoom; no app icon; title "weather-app"; no custom application menu (`setAutoHideMenuBar(true)` leaves the default Electron menu reachable with Alt); `#1e293b` window background flashing against the app's white pre-data page. | `TitleBar.tsx:8-42`; `measure-layout.json` button outlines (`oklch(0.554 …)` vs `rgb(255,255,255)`); `index.html` `<title>weather-app`; `public/favicon.svg` = Vite logo; `electron/main.ts:24,33` | Two competing control sets; a wrong window identity in the taskbar. | Pick the Linux convention (controls right, title left) or commit fully to macOS (traffic lights as the real buttons, `titleBarStyle:'hidden'`, `title:'Weather'`, `icon:` a real 512 px icon). Delete the decorative dots. Wire `isMaximized()` to swap to a Restore glyph, and add `main.ts` `win.on('maximize'/'unmaximize')`. |
| SG-24 | **P2** | Accessibility | The detail grid has **no heading**; daily max/min are unlabelled bare numbers ("22° 11°"); the hourly strip is a flat div soup (no list semantics); the city button's name is just the city name (no "change city" affordance); nothing announces a city change. | `ax-tree.json` (2 headings, both h3); `WeatherDetailGrid.tsx`; `HourlyForecastStrip.tsx`; `ax-summary.ariaLive: 0` | A screen-reader user cannot tell a high from a low or know the data changed. | Add `<h2 class="sr-only">Hourly forecast</h2>` / "Details"; give the max/min `aria-label="High 22 degrees"` / `"Low 11 degrees"`; wrap the strip in `<ul role="list">` with `<li>` per hour; name the city button `aria-label="Change city, currently San Francisco"`; add an `aria-live="polite"` region announcing "San Francisco, 16 degrees, light drizzle". |
| SG-25 | **P2** | Craft | The card "fade" is `to-black/40` — a hard black band on a light theme, and a dirty smudge over the last card even in the dark theme. | `HourlyForecastStrip.tsx:58`; visible band at x≈905–940 in `01`, `02`, `24` | A rendering artifact that reads as a bug. | Use a theme token: `--fade: linear-gradient(90deg, transparent, var(--card-edge))`, where `--card-edge` = `rgba(7,13,30,.75)` at night and `rgba(255,255,255,.75)` by day; width 32 px; `pointer-events:none` (already). |
| SG-26 | **P2** | Craft / semantics | `text-dynamic/80` is applied to the **card container**, so the container's `opacity:.8` fades the card surface and its `backdrop-blur` too, not just the label — non-"Now" cards render at an effective `white/24` instead of `white/30`. | Measured exactly: expected `white/30` over the gradient = (83.5,90.6,100.9); with the container's 0.8 = (68.8,75.9,87.7); **measured (67,70,85)** ✓ | Cards are dimmer and blurrier than intended; the hierarchy is accidental. | Move the opacity onto the text nodes: `<span className="text-dynamic/80">` inside the card, and keep the card at `bg-white/30` with no container opacity. |
| SG-27 | **P3** | Content | The condition is printed twice ("Light drizzle" at 24 px next to the hero and again at 14 px in the chip row). | `01-default`, `09`, `20` | Redundant; weakens hierarchy. | Keep the 24 px condition beside the hero; replace the chip row's duplicate with the real secondary data (UV, visibility, pressure) or delete it. |
| SG-28 | **P3** | Craft / window | The `hover:bg-red-500/90` close button turns into a solid red disc on hover while the other two controls only wash — a surprise state change borrowed from macOS but not implemented as macOS traffic lights. | `13b-hover-close.png` vs `13a` (826 px, bbox x[104–135] y[4–35]) | Reads as an unfinished gesture. | If macOS: make all three permanent traffic lights (12 px discs, red/yellow/green, glyphs inside, group hover). If Linux: use the platform order on the right with consistent hover. |
| SG-29 | **P1** | Typography / craft | The app declares an Apple font stack but **renders Liberation Sans** on Ubuntu. No font is bundled; no `@font-face`; `--font-sans` is `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` and every one of those first five names is absent on a stock Ubuntu desktop, so it lands on Arial's metric clone. | `CSS.getPlatformFontsForNode` on the hero, condition, section label and city pill → `LiberationSans` / `LiberationSans-Bold`; `src/index.css:5`; no font files in `dist/assets/` | The entire "macOS" impression is set in a Linux Arial substitute — a 96 px/300 hero in a face with no true light weight, and letterforms that read as office software, not Apple. | Bundle a licensed variable face (Inter, or SF Pro Display/Text if licensed) as `woff2` with `@font-face { font-family: "Weather Sans"; src: url(...) format("woff2"); font-weight: 100 900; font-display: swap; }`; set `--font-sans: "Weather Sans", ...`; add `font-variant-numeric: tabular-nums` to all temperature and time values. |
| SG-30 | **P2** | Performance / architecture | Every launch fires the **same forecast request three times** — once per `useWeather()` instance — tripling latency exposure, quota use and the chance of three different render states. | `reqcount.mjs` on a clean reload: **3 requests, 1 unique URL** (`api.open-meteo.com/v1/forecast?latitude=37.7749…`); source: `App.tsx:10`, `CurrentWeatherHeader.tsx:7`, `WeatherBackground.tsx:5` | Wasted bandwidth and battery; a slow or flaky response can land on one instance and not the others, producing the desync even after the selected-city bug is fixed. | Folded out by SG-01 (one provider, one request). Add an in-flight dedupe keyed by `lat,lon,units` and a 60 s response cache in `weatherApi`. |
| SG-31 | **P2** | Accessibility | The modal's clear (✕) button has **no accessible name** (no text, no `aria-label`, no `title`), and closing the modal drops focus to `<body>` instead of returning it to the city pill. | `ax-modal.json` (modal open): buttons 11, **unnamed 1**; `metrics-07` clear button `16×16`, `aria: null`; `ax.mjs` → `focus after close: BODY` | A screen-reader user hears "button" with no purpose; a keyboard user loses their place after dismissing the dialog. | `aria-label="Clear search"` on the ✕; store `previousFocus` on open and `previousFocus.focus()` on close; combine with SG-09's trap. |
| SG-32 | **P2** | Layout | At 1600 px the "SUNRISE / SUNSET" card wraps its **label onto two lines and its value to "04:59 / PM"**, while its five siblings stay single-line — the grid row heights then disagree. | `24-contrast-1600x1000.png`; `contrast-1600.json` (`sunrise` value rect w=122, text two lines) | The most information-dense card breaks first under a normal desktop width; the row looks broken. | Format as `4:59 PM` (drop leading zero, `hour: "numeric"`), use a **two-row** card layout (`label` above, `06:48 → 16:59` below) or a `min-h` with `whitespace-nowrap`; add tabular figures. |
| SG-33 | **P1** | State / data | The **10-minute auto-refresh erases the selected city's name**. The refresh calls `loadWeather(lat, lon)` with no `cityName`; `fetchWeather` returns `city.name: ""`; the merge then writes that empty name. The city pill — the only cue telling the user which city they are looking at — becomes **"Search city"** while valid weather stays on screen. | `auto-refresh-name.json`: before reload `pill: "Search city"`, `hero: "13°"`, condition "Mainly clear"; after reload `pill: "San Francisco"`, same data; `25-day-theme-synthetic.png` captures the state; `useWeather.ts:37-42` (refresh without name), `:52-58` (merge), `CurrentWeatherHeader.tsx:48` (`city.name \|\| "Search city"`) | After ten minutes the user can no longer tell which city the forecast belongs to; the label flips on its own with no interaction. | Pass the whole selected `city` through refresh (`loadWeather(city)` rather than raw coordinates), store it in provider state, and never derive the label from the API response. Add a regression test: mount, advance timers 11 min, assert the pill text is unchanged. |
| — | — | Evidence integrity | The capture notes' hover conclusion is invalid; four PNGs have different md5 but identical pixels. | `13c`≡`01`, `13a`≡`10`, `23a`≡`23b` (pixel hashes) | A false "verified" claim shipped into the review. | Compare **pixel arrays**, not md5; capture hover with the pointer inside the element's viewport box and assert a non-zero diff in that box before accepting the frame. |

**Counts: P0 = 6 · P1 = 13 · P2 = 12 · P3 = 2 · (1 process finding).**

---

## 8. Measured appendix

### 8.1 Contrast — measured, not estimated

Method: `*-bg.png` at the element's centre for the background; the *rendered* glyph pixels extracted from the full frame; alpha composited per the CSS opacity. Cross-checked analytically. Agreement ≤0.02.

| Element | Size/weight | Rendered colour | Background | Contrast | Required | Result |
|---|---|---|---|---|---|---|
| Hero "16°" | 96/300 | (255,255,255) | (7,13,30) | **19.4** | 3:1 (large) | PASS |
| "H:16°" / "L:15°" | 14/400 | (255,255,255) | (8,14,32) | **19.2** | 4.5:1 | PASS |
| Section label | 14/600 | (230,231,233) | (10,17,35) | **15.2** | 4.5:1 | PASS |
| "Next 24 hours" | 12/400 | (177,178,184) | (7,13,31) | **9.1** | 4.5:1 | PASS |
| Title bar "Weather" | 12/500 | (230,230,232) | (2,6,24) | **16.2** | 4.5:1 | PASS |
| City pill text | 14/500 | (15,23,43) | (141,144,152) | **5.58** | 4.5:1 | PASS (fragile: translucent pill) |
| Minimize / Maximize icon | 14 glyph | (98,116,142) | (2,7,24) | **4.21 / 4.16** | 3:1 non-text | PASS (thin) |
| Close icon | 14 glyph | (255,255,255) | (2,7,24) | **20.1** | 3:1 | PASS |
| **Day name "Wed"** | 14/500 | (241,241,243) | (120,124,134) | **3.70** | 4.5:1 | **FAIL** |
| **Day max "22°"** | 14/500 | (241,241,243) | (120,124,134) | **3.70** | 4.5:1 | **FAIL** |
| **Day min "11°"** | 14/400 | (201,203,207) | (120,124,134) | **2.57** | 4.5:1 | **FAIL** |
| **Detail label "HUMIDITY"** | 12/500 | (220,222,225) | (139,146,157) | **2.33** | 4.5:1 | **FAIL** |
| **Detail value "82%"** | 18/500 | (255,255,255) | (120,124,134) | **4.18** | 4.5:1 (18px/500 is not "large") | **FAIL** |
| **Hourly temp "15°"** | 14/500 | (255,255,255) | (149,154,164) | **2.82** | 4.5:1 | **FAIL** |
| **Hourly label "Now"** | 12/500 | (255,255,255) | (148,153,164) | **2.86** | 4.5:1 | **FAIL** |
| Hourly hour "1am" | 12/500 | (164,165,172) | (67,70,85) | **3.81** (ideal 5.59) | 4.5:1 | **FAIL** |
| Forced colors: city pill | 14/500 | (255,255,255) | (172,172,172) | **2.27** | 4.5:1 | **FAIL** |
| Forced colors: "H:16°" | 14/400 | (255,255,255) | (163,163,163) | **2.52** | 4.5:1 | **FAIL** |
| Forced colors: hero / section | — | (255,255,255) | (0,0,0) | **21.0** | — | PASS |

(1600×1000 frame values from `contrast-1600.json` — which correctly composites alpha — and reproduced independently by me to ±0.02: day-name 2.04, day-max 2.04, day-min 1.63, detail-value 3.11, detail-label 2.33, hourly-temp 2.82, hourly-now 2.86, hero 13.46.)

**Conclusion:** the page-background layer passes; the **entire glass-card content layer fails**, at 1.63–4.18:1. This is one systemic bug (card luminance + text opacity), not a list of one-off samples.

### 8.2 Type ramp (computed styles, `metrics-01` / `measure-layout.json`)

| Role | Size | Weight | Line-height | Tracking | Colour | Count |
|---|---|---|---|---|---|---|
| Hero temperature | 96px | 300 | 144px (1.5) | −2.4px | rgb(255,255,255) | 1 |
| Condition (hero) | 24px | 500 | — | normal | rgb(255,255,255) | 1 |
| Detail value | 18px | 500 | 28px | normal | rgb(255,255,255) | 6 |
| Section label | 14px | 600 | 20px | +0.35px | rgb(255,255,255) | 2 |
| City pill | 14px | 500 | 20px | normal | oklch(0.208 0.042 265.755) | 1 |
| Day name / max | 14px | 500 | 20px | normal | rgb(255,255,255) | 7+7 |
| Body / H-L | 14px | 400 | 20px | normal | rgb(255,255,255) | 2 |
| Micro / labels | 12px | 500 | — | normal | rgb(255,255,255) | 32 |
| Default | 16px | 400 | — | — | — | 1 |

Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. `metrics-01` histogram: `16px×1, 12px×32, 14px×53, 96px×1, 24px×1, 18px×6` = **94 elements across 6 sizes; 85 (90 %) are 12–14 px**. Only the 96 px hero is px-locked; the other 93 are rem-based Tailwind sizes and do scale with the user's font size. The per-role counts above are DOM occurrences.

### 8.3 Alignment & spacing (measured rects + my own ink-band scan)

| Element | element box x | **rendered ink x** | y | w | h |
|---|---|---|---|---|---|
| City pill (text "San Francisco") | 48 | **61** | 120 | 137 | 34 |
| Hero "16°" | 48 | **55** | 186 | 138 | 144 |
| "H:16°" / "L:15°" | 48 | **50** | 338 | 35 | 20 |
| Condition + chips row | 48 | 56 | 400 | — | 15 |
| "HOURLY FORECAST" | 56 | **56** | 434 | 144 | 20 |
| "Next 24 hours" | — | (right-aligned, ends 928) | 438 | — | 11 |
| First hourly card | 56 | 77 (label) | 470 | 64 | 146 (gap 12) |
| Hourly labels / icons / temps | — | 77 / 81 / 78 | 485 / 511 / 543 | — | — |
| "10-DAY FORECAST" | 48 | **56** | 624–633 (ink) | 889 | 20 |
| Day row (first) | 48 | **65** ("Wed") | 671–684 (ink) | 889 | 46, radius 12 |
| Detail labels | ~109 | — | — | — | 16 |

→ **Six optical left axes: 50 / 55 / 56 / 61 / 65 / 109.** The two section labels happen to land on the same ink edge (56) but only by accident — "10-DAY FORECAST" sits in a container at x=48 with a compensating `px-2`, while "HOURLY FORECAST" sits in a container at x=56 with no padding. The hero (55), the H/L line (50), the city pill (61) and the day names (65) each sit on their own axis.

**Evidence inconsistency to flag:** `measure-layout.json` (22:51 pass) reports the first day row at `y = 999` while the 10-day label is at `y = 663` — a 336 px gap that the DOM cannot produce (the heading is immediately followed by `space-y-1` rows). The 00:03 pass (`metrics-01`, and my own ink scan) places the first visible day row at y≈671 with the heading at y≈624. I use the verified values; the 22:51 day-row y is treated as unreliable.

Spacing values are all on the 4/8 pt grid (24/16/12/8/4; gaps 12/16/24/48; `space-y-1` = 4; rows 46 px). Radii: 12 px cards, 16 px pills (`rounded-2xl`), 24 px modal (`rounded-3xl`), 8 px icon chips — a coherent family.

### 8.4 Target sizes

| Control | Size | Verdict |
|---|---|---|
| Window min / max / close | 32 × 32 | OK for a mouse-driven desktop control (≥24) |
| City pill | 137 × 34 | OK |
| Search input | 414 × 46 | OK |
| Modal result row | 391 × 64 | OK |
| Modal Cancel | 398 × 44 | OK |
| **Modal clear (✕)** | **16 × 16** | **FAIL — below the WCAG 2.2 24 × 24 minimum** |
| Hourly card (not interactive) | 64 × 146 | n/a |

### 8.5 Motion inventory

| Motion | Duration / easing | Elements | Under `prefers-reduced-motion` |
|---|---|---|---|
| `transition` (hover/press/focus) | 0.15 s, `cubic-bezier(.4,0,.2,1)` | 35 | **still running** |
| Range-bar width | 0.7 s, `ease-out` | 7 | **still running** |
| `duration-300` (dead `animate-in`) | 0.3 s | 1 | no animation exists (class is dead) |
| `animate-pulse` skeleton | 1.5 s loop | 2 | **still running** |

Total transitions: **42** in the default state, **50** with the modal open (`metrics-07`: 42 × 0.15 s, 1 × 0.3 s, 7 × 0.7 s). No `@media (prefers-reduced-motion)` block exists in `src/index.css`.

### 8.6 Accessibility facts (`ax-tree.json`, 530 nodes)

Roles: `RootWebArea 1 · none 226 · generic 14 · button 4 · StaticText 141 · InlineTextBox 141 · main 1 · heading 2`. Unnamed buttons/links/textboxes/dialogs/headings: **0 in the base state** ✓ — but with the modal open the count becomes **1 unnamed button** (the clear ✕; `ax-modal.json`). Headings: **h3 "HOURLY FORECAST", h3 "10-DAY FORECAST"** — no h1, no h2 (the error state has **zero** headings). Landmarks: `main` only. `aria-live 0`, `aria-modal 0`, `role=dialog 0`, `img without alt 0`, `positive tabindex 0`, `lang="en"` ✓, 43 SVGs all without missing labels ✓, 2 emoji sites, 93 hardcoded whites, `reducedMotion false` (default state) / `true` (state 14, still 42 transitions).

Page tab order (`deep-summary.pageTabs`): Minimize → Maximize → Close → San Francisco → *hourly scroll container (div)* → repeats. **Only four interactive elements exist in the entire app.**

Modal tab order: input → ✕ → 5 results → Cancel → **the hourly scroller behind the modal** (focus escapes; no trap, no return).

### 8.7 API vs UI — every number on screen, checked

| UI element | UI value | API truth | Verdict |
|---|---|---|---|
| Hero temp (SF) | 16° | `current.temperature_2m` 16 | ✓ |
| "H:16°" | 16 | **daily max 21.7** | ✗ **P0** |
| "L:15°" | 15 | **daily min 10.6** (15 = apparent temp) | ✗ **P0** |
| 10-day row 1 | "Wed 22° 11°" | max 21.7 / min 10.6 ✓ but 2026-11-12 = **Thu** | ✗ **P0** (label) |
| Header date | "FRIDAY, NOVEMBER 13" | host (EST) date; city = Thu Nov 12 (SF), Sat Nov 14 (Sydney) | ✗ **P0** |
| Hourly "Now" | 13° (SF) / 15° (Sydney) | `hourly[0]` = local **00:00** | ✗ **P0** |
| "Next 24 hours" | 24 cards from 00:00 | today's 00:00–23:00 (past + future) | ✗ **P0** |
| Condition icon (Tokyo 14:00) | moon | clear afternoon | ✗ **P0** |
| Theme (Sydney 14:49) | night gradient | daylight | ✗ **P0** |
| "10-DAY FORECAST" | 7 rows | `daily.length` = 7 | ✗ **P1** |
| Humidity / wind (SF) | 82 % / 12 km/h | 82 / 12 | ✓ |
| Humidity / wind (Tokyo) | 48 % / 5 km/h | 48 / 5 | ✓ |
| Humidity / wind (Sydney) | 51 % / 17 km/h | 51 / 17 | ✓ |
| Sunrise / sunset (SF) | 06:46 AM / 05:00 PM | 06:46 / 17:00 local | ✓ (the one timezone-safe field) |
| Units | °C, km/h | Open-Meteo defaults, no override | ✗ **P1** (no toggle) |
| City pill (after 10 min idle) | "Search city" | selected city = San Francisco | ✗ **P1** (SG-33) |

### 8.8 Evidence-integrity audit (my own)

| File(s) | Pixel-identity | Consequence |
|---|---|---|
| `01-default` ≡ `13c-hover-dayrow` ≡ `14-reduced-motion` | identical | `deep-summary.hoverRowChanged: true` is **false**; md5 differs only in PNG encoding |
| `10-after-reload` ≡ `13a-before-hover` | identical | the "before" frame is a copy of the reload frame |
| `23a-hover-before` ≡ `23b-hover-dayrow` | identical | a **second** day-row hover attempt produced zero change |
| `01-bg` ≡ `10-bg` ≡ `14-bg` | identical | consistent |
| `metrics-01` vs `metrics-04` hero rect | identical (48/186/138/144) | `04-zoom-200` is a **viewport** capture, not a zoom capture |
| `metrics-04` `day-name` sample at (105,559) | element is at y=668, off-screen | the "3.44:1" measures a different pixel |
| `metrics-01/02` `detail-value` sample at y=699/559 | element is at y=1110, off-screen | the "4.0 / 8.43" figures measure a different pixel |
| `metrics-20` `day-name` bg (204,208,213) at y=712 in a 700 px viewport | clamped | its "1.55" is meaningless |
| `metrics-07` `city-button` 2.42 (modal open) | scrim dimming | intentional, not a WCAG failure — reclassified |
| `contrast-1600.json` | composites alpha correctly | the trustworthy contrast source |

---

### 8.9 Independent verification log (reconciliation)

This gate was run twice, independently, by two vision-capable reviewers over the same evidence set; the orchestrator then re-derived the disputed points directly from the running app via CDP. What follows is what changed as a result — including where the first draft was wrong.

| Check | Method | Result | Effect on this report |
|---|---|---|---|
| Typeface actually rendered | CDP `CSS.getPlatformFontsForNode` on hero, condition, section label, city pill | `LiberationSans` / `LiberationSans-Bold` on all four; `document.fonts` has no custom face | **New SG-29**; Typography 5.5 → 4.0; weighted total 3.98 → 3.86 (**3.9**) |
| Requests per launch | CDP `Network.requestWillBeSent`, clean reload | **3 requests, 1 unique URL** | **New SG-30** |
| Modal accessible names | CDP `Accessibility.getFullAXTree` with modal open | 11 buttons, **1 unnamed** (clear ✕); no `dialog` role | **New SG-31**; corrected "0 unnamed" to "0 in the base state" |
| Focus after modal close | CDP activeElement after Cancel | `BODY` (focus lost, not returned) | Supports SG-09; added to SG-31 |
| Sunrise card at 1600 px | Screenshot + `contrast-1600.json` | Label and value wrap ("04:59 / PM") | **New SG-32** |
| Auto-refresh at 10 min | CDP read of pill + hero before/after reload; source trace | Pill `"Search city"` with valid 13° data before reload → `"San Francisco"` after reload; refresh path drops `cityName` | **New SG-33** |
| Day (light) theme | Forced `--bg-gradient`/`--text-on-bg` to the clear-day tokens | Contrast: hero 10.2, day-name 11.3, section 7.25, **day-min 4.36 (fail)**; glass cards wash out | Upgraded from NOT TESTED to PARTIAL; still not a real API state |
| Contrast on the glass layer | Glyph extraction (render) + alpha compositing (analytic) | Both methods agree to ±0.02: day-name 2.03–2.04, day-min 1.63, detail-label 2.33, hourly-temp 2.82 | Confirms SG-07; no change |
| Tokyo hourly strip | Pixel + text comparison against `01-default` | `09-tokyo` strip is **San Francisco's** data (desync), not Tokyo's hourly; the earlier "Tokyo icons" attribution was therefore wrong | Corrected in §2 claim 3 and SG-05 |
| 04 "200 % zoom" | Hero rect vs `metrics-01` | Identical rect (48/186/138/144) → it is a 500×350 viewport, not a zoom | Corrected in §2 claim 12 |
| Day-row hover | Two captures, pixel arrays | Zero diff in both; source declares `hover:bg-white/60` | Kept as **UNVERIFIED**; not asserted as defect |
| Day (light) theme | All 20 unique states | Never rendered — the host clock forced night in every capture | Labelled **NOT TESTED**, not "broken" |

**Limits of this gate.** A real daylight API condition, a true 200 % text zoom, a maximise→restore cycle, and the day-row hover are not proven by this evidence set. The light theme was exercised synthetically (tokens forced) and is labelled as such. Everything else in this report is backed by a measured pixel, an AX property, a source line, or a live API response.

## 9. Apple comparison — what Apple would reject, and why

| HIG principle | What this app does | Apple's position |
|---|---|---|
| **Clarity** | Seven simultaneous false statements (§8.7); "Next 24 hours" over yesterday's hours; "10-DAY FORECAST" over 7 rows. | Apple's Weather never labels a value it cannot back. If the label cannot be true, the label is removed or the data is fixed. The bar for "clarity" is *truth first*, polish second. |
| **Deference** | The chrome competes with the content: fake traffic lights, a "Weather" wordmark, a blue search focus ring, a saturated 6-hue icon palette, a full-width legacy scrollbar, emoji next to vector icons. | Apple's own apps let the content own the screen and the chrome recede. A decorative dot row that does nothing is not deference — it is noise the user must interpret. |
| **Depth** | There is no spatial or causal model: the hourly strip starts at midnight and is called "Now"; the theme flips on the host's clock; a failed switch leaves a stale world under an error banner; the modal has no Enter, no Escape, no trap, no focus return. | Depth means every state change has a visible cause. Here the cause of "Now = midnight" is invisible and the cause of "night at 2 p.m." is the wrong clock. |
| **Consistency** | Five dead Tailwind utilities, two unrelated control sets in the title bar, `text-dynamic/80` fading a card instead of a label, a black fade tuned for one theme, a 16 px ✕ next to 64 px rows. | Apple ships one system. Dead classes and dual control sets are what a prototype looks like before the system exists. |
| **Feedback** | No spinner during a switch, no retry, no "updated at", no live region, focus = UA default orange, motion ignores `prefers-reduced-motion`, "Network Error" as user copy, network failure reported as "No cities found". | Feedback is the difference between an app and a poster. Apple's Weather shows a progress state, a failure state with an action, and a "Last updated" line. |
| **Forgiveness** | Failed switch destroys the city context; a network error claims a city does not exist; an offline search is indistinguishable from an empty one. | Apple never destroys state to report an error. The last good state stays, labelled, with a way forward. |
| **Platform truth (macOS claim on Linux)** | Left-side controls, macOS-flavoured glass, a fake traffic-light row — on a Linux desktop with GTK scrollbars and a Linux window manager. | Either commit to the platform (GNOME conventions, right-side controls, real app menu) or to the metaphor (real traffic lights that work). Half-adopting a metaphor produces neither platform. |
| **Accessibility (non-negotiable at Apple)** | No h1, no landmarks, no dialog semantics, no live region, 16 px target, 1.63–3.11:1 content text, forced-colors failures, no reduced-motion support. | Apple would not ship a single one of these. The content layer failing AA by 1.5–2.8× is the most common App-Store-review-adjacent rejection risk for a desktop product distributed to enterprises. |

**Verdict against the reference bar:** the visual language is a good sketch of macOS Weather; the *product* is a prototype of macOS Weather. It fails Apple on Truth (6 P0s), on Accessibility (systemic contrast + dialog + targets), and on Restraint (chrome that lies about what it does).

---

## 10. Remediation plan

Ordered by impact ÷ effort. Each tranche states the expected weighted score after it lands (scored against the same 13 dimensions).

| # | Tranche | Work | Est. effort | P0/P1 closed | Score after |
|---|---|---|---|---|---|
| **T1** | **One brain for the app** | Single `WeatherProvider`; delete the two component-level `useWeather()` calls; one `status`/`data`/`selectedCity`/`error` model; failed loads keep the last good data with a labelled banner + Retry; request dedupe. | 4 h | SG-01, SG-06, SG-30 | 3.9 → **4.6** |
| **T2** | **Tell the truth about the numbers** | H/L from `daily[0].max/min`; anchor the hourly strip to `current.time` and label it honestly; calendar-date parsing + `Intl` with `data.timezone` for the header date; `sunrise`/`sunset`-driven night icons + `MoonCloud` variants; `forecast_days=10` and a matching label. | 6 h | SG-02, SG-03, SG-04, SG-05, SG-08 | 4.6 → **5.6** |
| **T3** | **Fix the contrast layer** | Cards → `bg-white/25`; text → 1.0 for values, ≥0.85 for labels; move `text-dynamic/80` off the card containers onto the labels; re-measure every text layer against rendered pixels (target ≥4.5:1, ≥3:1 for ≥24 px). | 4 h | SG-07, SG-26 | 5.6 → **6.1** |
| **T4** | **Make the window and the states behave** | Kill the 5 dead utilities; install `tailwindcss-animate` or hand-roll the modal transition; real scrollbar styling; a themed loading state (never a white flash); a designed error state with Retry and offline copy; `localStorage` for city + units; keep the city across auto-refresh. | 7 h | SG-13, SG-14, SG-15, SG-20, SG-33 | 6.1 → **6.7** |
| **T5** | **Product completeness** | °C/°F + km/h/mph with the `temperature_unit`/`wind_speed_unit` parameters; a Settings sheet (gear in the title bar, `⌘,`); "Use my location"; saved/recent cities; "Updated 21:03"; a Refresh button; "Next 24 hours from now" copy that matches the strip. | 10 h | SG-12 | 6.7 → **7.2** |
| **T6** | **Accessible by construction** | `role="dialog"`/`aria-modal`/label/trap/restore/Escape; Enter selects; 28 px ✕ **with `aria-label`**; `aria-live` for results and city changes; `<h1>` + `<h2>`s + landmarks; labelled max/min; `:focus-visible` token; `prefers-reduced-motion` block; forced-colors pass. | 8 h | SG-09, SG-11, SG-19, SG-24, SG-31 | 7.2 → **7.8** |
| **T7** | **Layout, alignment, iconography, chart** | One content axis at x=48; `lg:` → `md:`/1000 px so the two-column layout exists at the default size; sticky header so the detail grid is reachable; a real range bar (or delete it); lucide Droplet/Wind instead of emoji; the theme-token fade; de-duplicate the condition string; **bundle the typeface** and fix the sunrise card's wrapping. | 10 h | SG-16, SG-17, SG-21, SG-22, SG-25, SG-27, SG-29, SG-32 | 7.8 → **8.2** |
| **T8** | **Platform honesty** | Choose the platform: real traffic lights that work, or GNOME-style right-side controls; `title: "Weather"`; a real app icon (not the Vite logo); `isMaximized()` → Restore glyph; dbl-click-to-zoom on the drag region; a real application menu; `backgroundColor` matching the pre-data theme. | 5 h | SG-23, SG-28 | 8.2 → **8.4** |

**Projected end state: 8.4 / 10** — a strong, shippable app, and only if T1–T3 are done *first and together*. Fixing the visual layer without the data layer (a common instinct) leaves a beautiful app that still lies, which is worse than an obviously broken one.

**Re-gate criteria.** I will re-review when: (1) a single `useWeather()` instance remains and a city switch updates the hero, the strip, the 10-day list, the detail grid **and** the background in one frame; (2) the API-vs-UI table in §8.7 is all ✓; (3) every text layer measures ≥4.5:1 against rendered pixels; (4) a 200 % zoom / 500 px viewport and a day-theme frame exist in the evidence; (5) the modal is fully keyboard-operable with a trap and a live region; (6) a fresh evidence batch contains **no byte-identical duplicates** and hover frames show a non-zero diff inside the hovered box.

---

*Prepared by the design ship gate. All numbers in this report were measured from the rendered pixels or read from source; no value was taken from the capture notes without independent verification. Where a claim could not be verified (the day-row hover, the day theme), it is labelled as such rather than asserted.*
