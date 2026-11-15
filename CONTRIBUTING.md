# Contributing

Small, honest changes are welcome. This project cares more about correctness
than about feature count, so the bar is evidence, not enthusiasm.

## Before you start

- Open or claim an issue first, and say what you plan to change.
- One concern per pull request. A refactor and a feature in the same PR will be
  asked to split.
- No new dependencies without discussing it in the issue.

## Setup

```bash
npm ci
npm run electron:dev     # Vite + Electron
```

Node 22 or newer. Linux with X11 is the supported target.

## Checks that must pass

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

For anything that touches the UI or the data layer, also run the end-to-end
checks against a packaged build:

```bash
npm run dist
node e2e/smoke.mjs       # needs a display; xvfb-run on a headless box
node e2e/truth.mjs       # fails when the UI and the API disagree
```

CI runs all of the above, including the e2e pair under `xvfb`.

## UI rules

- **Use the tokens.** Surfaces, text, hairlines and hover states come from
  `src/index.css` (`--glass-*`, `--text-*`, `--sheet-*`, `--chip-*`). Hard-coded
  `slate-*` colours in new UI will be sent back.
- **Contrast is measured, not estimated.** Text below **4.5:1** at 11–14 px, or
  **3:1** above 24 px, fails. The repo measured the rendered pixel (text removed,
  glyph centre sampled), not the declared colour — `docs/STORY.md` explains why
  that distinction cost a whole rewrite.
- **Both themes.** A component that only looks right in dark mode is unfinished.
- **Keyboard.** Everything reachable and dismissible: focus trap in dialogs,
  Escape closes, focus returns to the trigger, no focus ever dropped to `<body>`.
- **Motion.** Anything animated must be silent under
  `prefers-reduced-motion: reduce`.
- **No lying.** If a number can't be shown truthfully, show less. Data comes from
  the API response; never compute a displayed value client-side that the API
  already returns in different units.

## Code map

| Path | What lives there |
|---|---|
| `src/state/WeatherProvider.tsx` | the single source of truth: city, data, units, favourites |
| `src/services/weatherApi.ts` | Open-Meteo requests, units, cache, de-duplication |
| `src/lib/format.ts` | calendar-safe dates and display formatting |
| `src/lib/theme.ts` | per-condition gradients and the dark/light decision |
| `src/lib/storage.ts` | persisted city, units, favourites (validated reads) |
| `src/components/CitySearchModal.tsx` | the sheet pattern to copy for dialogs |
| `e2e/` | launch + CDP harness, smoke test, truth check |

## Commits and PRs

- Imperative subject, one concern: `Fix the stray focus ring on the scroller`.
- In the PR description: what changed, why, screenshots for UI work, and what you
  deliberately did **not** do.
- If you can't reproduce a bug report, say so in the PR rather than fixing a
  guess — the project has one gate finding that was confidently wrong.

By contributing you agree your work is licensed under the MIT licence.
