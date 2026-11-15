# QA — what was checked, and what the gate said

This is not a unit-test suite. It is the record of an independent **design ship
gate** run against the packaged app, three times, plus the measurements behind
it. It exists because the first version of this app looked finished while
stating false things on screen, and because "it builds" is not a quality claim.

## Method

- **Running artifact**, not source: `release/linux-unpacked/truecast`, loaded
  from `resources/app.asar`, attached over CDP.
- **Contrast** sampled from rendered pixels: the frame is re-captured with text
  removed to get the background, then the glyph-centre pixel is composited with
  the text's own alpha and any ancestor opacity.
- **Numbers** compared against the same Open-Meteo response the app is allowed
  to use — every visible value, including all 10 daily rows and 24 hourly cards.
- **Accessibility** from `Accessibility.getFullAXTree`, real
  `Input.dispatchKeyEvent`, and `getBoundingClientRect`.
- **Evidence** (screens, `-bg` plates, JSON) is committed under
  `design-review/evidence-*/`.

## The three runs

| Run | Verdict | Score | What it found |
|---|---|---|---|
| 1 | FAIL | ~6.5–6.8 (no scorecard) | 0 P0; four P1s (search sheet clipping, city not persisted, 800 px layout, six content axes); budget ran out before the report |
| 2 | FAIL | 6.9 | 0 P0; two claimed P1s — one **false positive**, rejected after reproduction (favourites persist); the other real (the sheet jumped 152 px) |
| 3 | **PASS** | **7.1** | 0 P0, 0 P1, 4 P2, 5 P3 |

Gate rule: **PASS = 0 P0, ≤ 1 P1, and no data-integrity defect.**

Run 3's own report is [`design-review/SHIP-GATE-2.md`](design-review/SHIP-GATE-2.md).
The original gate is [`design-review/SHIP-GATE.md`](design-review/SHIP-GATE.md);
the reconciliation, including the rejected finding, is
[`design-review/REGATE.md`](design-review/REGATE.md).

## Invariants that hold

- **131–132 on-screen values** match the API (`design-review/evidence-remediation/truth-check.json`).
- **Contrast**: sampled worst 6.19:1 dark / 5.56:1 light; the gate's exhaustive
  sweep found 4.53:1 and 4.92:1 — all pass AA.
- **One forecast request per launch**; exactly one per unit switch.
- **Auto-refresh** at 10 minutes keeps the city and resets "Updated", proven
  across a real interval (`dom-check-after-refresh.json`).
- **Units** are re-requested from the API, not converted locally; every value
  matches the °F response.
- **Keyboard**: the search sheet traps focus (12/12 Tab steps), Escape returns
  focus to the trigger, Enter picks the first result.
- **Evidence integrity**: 25 frames, 25 unique pixel hashes, 0 duplicates; the
  hover proof changes 94.5 % of the target's box.
- **0 console errors** on a clean load.

## Fixed after the pass

| ID | Finding |
|---|---|
| F-01 | Removing the **last** favourite dropped focus to `<body>` — now the search field |
| F-02 | Hero numeral was pinned at 96 px — now `6rem`, 192 px at 200 % text |
| F-05 | Empty-state copy pointed at a star that isn't in the result list |

## Open, deliberately

| ID | Sev | Finding |
|---|---|---|
| F-03 | P2 | The search sheet is always light inside the night theme. Fixing it properly needs a token pass and fresh contrast measurement. |
| F-04 | P3 | The forced-colors selection ring uses a hard-coded colour instead of `Highlight`. |
| F-06 | P3 | A one-character query says "No cities found" instead of "Keep typing". |
| F-07 | P3 | The default Electron menu is reachable with Alt. |
| F-08 | P3 | No precipitation or wind visualisation. |
| F-09 | P3 | No favourite reorder or "Clear all". |

These are stated here rather than hidden; the README repeats the user-facing
ones.

## Reproduce

```bash
npm run dist
./release/linux-unpacked/truecast --no-sandbox --ozone-platform=x11 \
  --remote-debugging-port=9225
# then attach over CDP and re-run the checks in design-review/evidence-*/
```

The demo GIF and screenshots are regenerated with
[`tools/capture.mjs`](tools/capture.mjs):

```bash
node tools/capture.mjs "$(curl -s http://127.0.0.1:9225/json | node -e \
  'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(x=>x.type==="page").webSocketDebuggerUrl))')"
```

## Caveat

The gate is an AI reviewer working from a rubric. It is useful precisely because
it is adversarial and measures instead of asserting — but it is not an oracle.
Run 2 produced a confident P1 with a wrong root cause; that finding was checked
against the running app and rejected rather than "fixed". Treat the reports the
same way.
