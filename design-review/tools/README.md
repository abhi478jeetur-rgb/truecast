# Re-running the verification

These are the exact CDP scripts used for the measurements in `../SHIP-GATE.md`.
They assume the packaged app is running with a debugging port:

```bash
cd release/linux-unpacked
setsid ./weather-app --ozone-platform=x11 --remote-debugging-port=9225 &
WS=$(curl -s http://127.0.0.1:9225/json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).find(x=>x.type==='page').webSocketDebuggerUrl))")
```

| Script | Produces |
|---|---|
| `deep-evidence.mjs` | 19 states, `metrics-*.json`, `ax-tree.json`, `api-check.json` |
| `daylight.mjs` | `20-sydney-daytime`, `21-long-city-name`, `22-modal-800x560`, `daylight-check.json` |
| `contrast.mjs` | `24-contrast-1600x1000` + `contrast-1600.json` (alpha-composited contrast) |
| `fonts.mjs` | `fonts.json` (platform font per node) |
| `reqcount.mjs` | `requests.json` (requests per reload) |
| `ax.mjs` | `ax-modal.json` (modal AX tree + focus after close) |
| `layout.mjs` | `measure-layout.json` (rects, grid, scroll height) |
| `daytheme.mjs` | `25-day-theme-synthetic*` + `day-theme.json` |
| `refresh-name.mjs` | `auto-refresh-name.json` |
| `hover.mjs` | `23a/23b` hover attempt (proved no diff) |
| `offline-switch2.mjs` | `19-offline-switch-failure.png` + `offline-switch.json` |

Note: `*-bg.png` frames are the same frame with text made transparent, used to sample the true rendered background.