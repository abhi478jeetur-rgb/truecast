# Roadmap — from "passes the gate" to "worth a star"

Gate #3: **PASS, 7.1**, 0 P0, 0 P1. The remaining work is not correctness — it is
polish, distribution, and the things that make a repo *linkable*.

**Sizing:** XS ≤ 1 h · S 2–4 h · M ≈ 1 day · L 2–3 days
**Priority:** P0 blocks a respectable publish · P1 required for "polished" ·
P2 should · P3 nice

---

## M0 — Publishable (all P0)

| ID | Task | Size | Pri | Notes |
|---|---|---|---|---|
| R-01 | `git init`, first commit, sensible history | XS | P0 | repo does not exist yet |
| R-02 | MIT `LICENSE` | XS | P0 | |
| R-03 | Real README: pitch, GIF, 4 screenshots, install, dev, architecture, limitations | M | P0 | current README is the Vite template |
| R-04 | `QA.md` — gate record: 3 runs, 7.1, what failed, what was refused | S | P0 | the most linkable artefact in the repo |
| R-05 | Attribution: Open-Meteo (CC-BY 4.0, non-commercial free tier) in README **and** in-app; keep Inter OFL + Lucide ISC licences | S | P0 | legal requirement, not a nicety |
| R-06 | `.gitignore` audit; never commit `release/`, `dist/`, `node_modules/` | XS | P0 | 100 MB `.deb` must stay in Releases |
| R-07 | Capture the GIF + screenshots (dark/light, sheet, favourites, °F) | S | P0 | biggest stars-per-hour item |
| R-08 | Product name + icon | S | P0 | "Weather" collides with GNOME Weather; icon done |

---

## M1 — Close the gate's own list (P1)

| ID | Task | Size | Pri | Notes |
|---|---|---|---|---|
| R-10 | **F-03** theme the search sheet | M | P1 | **DONE** — 9.6–17.2 dark, 7.1–17.0 light |
| R-11 | **F-06** "Keep typing" below 2 characters | XS | P1 | **DONE** — 0 geocoder calls at 1 char |
| R-12 | **F-07** kill the default Electron menu | XS | P1 | **DONE** — real hidden menu, Alt does nothing |
| R-13 | **F-09** favourite reorder + "Clear all" | M | P1 | **DONE** — arrows + drag, confirm, focus kept |
| R-14 | **F-04** `outline-color: Highlight` under forced colors | XS | P1 | **REJECTED** — the source already uses `Highlight`; the gate measured its computed value |
| R-15 | **F-08** precipitation visualisation | M | P2 | **DONE** — per-hour bars under each temperature |

---

**M1 verification:** `p11-sheet.json` (both themes), `p12-m1.json` (6/6: bars,
reorder, persistence, clear-all), `p13-m1.json` (5/5: one character, menu, bars),
plus the regression suite (features 28/28, city 10/10, search 8/8, a11y 9/9,
sheet 5/5, focus 5/5, truth 131/131, console 0).

## M2 — Premium feel (P1/P2)

| ID | Task | Size | Pri | Notes |
|---|---|---|---|---|
| R-20 | Settings sheet (units, motion, about) with `Ctrl+,` | M | P1 | makes it feel like an app, not a demo |
| R-21 | Manual refresh + last-updated in the title bar | S | P1 | |
| R-22 | Keyboard shortcuts: refresh, search, Esc, Enter, arrows in results | S | P1 | |
| R-23 | Search results as a real combobox (`aria-activedescendant`, arrow keys) | S | P2 | completes the a11y story |
| R-24 | City-switch transition (crossfade), honoured by reduced motion | S | P2 | biggest "premium" perception win per hour |
| R-25 | Per-row star in search results | S | P2 | fixes the empty-state copy properly |
| R-26 | Skeletons that match the real layout (hero/hourly/days), no spinner | S | P2 | |
| R-27 | Tray icon with current temperature | M | P3 | nice on Linux, not required |

---

## M3 — Ship and be found (P1)

| ID | Task | Size | Pri | Notes |
|---|---|---|---|---|
| R-30 | AUR package (S) or Flathub submission (L) | S / L | P1 | one-line install moves stars more than features |
| R-31 | GitHub Actions: typecheck + build + lint on PR | S | P1 | |
| R-32 | Unit tests for `format.ts` / `weatherApi.ts` (dates, units, rounding, window) | M | P1 | 0 tests today |
| R-33 | E2E smoke under xvfb (launch, one city, one toggle) | M | P2 | move the `/tmp` harnesses into `e2e/` first |
| R-34 | Release workflow that attaches the `.deb` | S | P1 | |
| R-35 | Wayland + HiDPI check on a real session | S | P2 | untested |

---

## M4 — The differentiator (P2)

| ID | Task | Size | Pri | Notes |
|---|---|---|---|---|
| R-40 | CI job that fails when the UI disagrees with the API | M | P2 | genuinely novel; you already have the harness |
| R-41 | Write-up: "I had an AI design gate my app three times…" + link the repo | S | P2 | the thing that actually travels |
| R-42 | About panel: version, data source, licence, commit | XS | P2 | |
| R-43 | Localisation scaffold (en + one other) | L | P3 | only if you want contributors |

---

## Definition of "polished"

- No open finding above P2, and every P2 either fixed or **stated** in the README.
- Every state designed: cold load, stale, offline, failed switch, empty search,
  no results, 500 px, 200 % text, forced colors, reduced motion.
- No layout shift on interaction; no focus ever lost; no contrast below AA.
- Keyboard-complete: every action reachable without a pointer.
- Window identity correct: title, icon, Restore, no stray menu.
- Install is one command.

## Not worth doing

Cross-platform builds, a native rewrite, an account/sync layer, weather alerts.
None of them earn a star; all of them cost a week.

## Start here (≈1.5 days)

**R-01 → R-02 → R-03 → R-07 → R-04 → R-10.**
Publishable, honest, and the one open P2 is gone.
