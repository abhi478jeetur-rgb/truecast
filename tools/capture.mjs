// Capture the README assets from the running app: a short demo GIF and four
// stills. Uses CDP screencast so CSS transitions are recorded as they paint.
//
//   node tools/capture.mjs <ws-url>
//
// Writes docs/demo-frames/*.jpg (transient), docs/screenshots/*.png, and
// docs/demo.gif via ImageMagick.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const WS = process.argv[2];
const ROOT = path.resolve(import.meta.dirname, "..");
const DOCS = path.join(ROOT, "docs");
const SHOTS = path.join(DOCS, "screenshots");
const FRAMES = path.join(DOCS, "demo-frames");
fs.mkdirSync(SHOTS, { recursive: true });
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const ws = new WebSocket(WS);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try { if (await ev(expr)) return true; } catch {}
    await sleep(200);
  }
  throw new Error("timeout");
}
const blur = async () => {
  await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
  await sleep(150);
};
const shot = async (name) => {
  await blur();
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
  console.log("  still", name);
};

let frameIndex = 0;
let recording = false;
const frameTimes = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Page.screencastFrame") {
    if (recording) {
      const file = path.join(FRAMES, `f${String(frameIndex).padStart(4, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(m.params.data, "base64"));
      frameTimes.push(m.params.metadata?.timestamp ?? Date.now() / 1000);
      frameIndex += 1;
    }
    send("Page.screencastFrameAck", { sessionId: m.params.sessionId }).catch(() => {});
  }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});

const FAVOURITES = JSON.stringify([
  { id: "292223", name: "Dubai", country: "United Arab Emirates", admin1: "Dubai", latitude: 25.0772, longitude: 55.3093 },
  { id: "5856195", name: "Honolulu", country: "United States", admin1: "Hawaii", latitude: 21.3069, longitude: -157.8583 },
  { id: "1850147", name: "Tokyo", country: "Japan", admin1: "Tokyo", latitude: 35.6895, longitude: 139.69171 },
]);

const setCity = async (query, region) => {
  await ev(`document.querySelector('button[aria-label^="Change city"]').click()`);
  await waitFor(`!!document.querySelector('input[aria-label="Enter city name"]')`);
  await ev(`(() => { const i = document.querySelector('input[aria-label="Enter city name"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(query)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor(`[...document.querySelectorAll('[role="dialog"] button')].some(b => new RegExp(${JSON.stringify(region)}).test(b.textContent))`);
  await ev(`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => new RegExp(${JSON.stringify(region)}).test(x.textContent)); b.click(); })()`);
  await waitFor(`document.querySelector('button[aria-label^="Change city"]')?.innerText.includes(${JSON.stringify(query.split(",")[0])})`);
  await sleep(1600);
};

ws.addEventListener("open", async () => {
  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });

    // Deterministic starting point: San Francisco, Celsius, three favourites.
    await ev(`localStorage.setItem('weather.favorites.v1', ${JSON.stringify(FAVOURITES)})`);
    await ev(`localStorage.setItem('weather.units.v1', '{"temperature":"celsius","windSpeed":"kmh"}')`);
    await ev(`localStorage.removeItem('weather.city.v1')`);
    await send("Page.reload", { ignoreCache: true });
    await waitFor(`!!document.querySelector('button[aria-label^="Change city"]') && /°/.test(document.body.innerText)`);
    await sleep(2200);

    // ── stills ────────────────────────────────────────────────────────────
    console.log("stills");
    await shot("dark.png");
    await ev(`document.querySelector('button[aria-label^="Favorites"]').click()`);
    await waitFor(`!!document.querySelector('[role="dialog"]')`);
    await sleep(600);
    await shot("sheet.png");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(500);

    await ev(`document.querySelector('button[aria-label^="Fahrenheit"]').click()`);
    await sleep(2200);
    await shot("fahrenheit.png");
    await ev(`document.querySelector('button[aria-label^="Celsius"]').click()`);
    await sleep(1800);

    await setCity("Dubai", "United Arab Emirates");
    await shot("light.png");

    // ── demo ──────────────────────────────────────────────────────────────
    console.log("demo");
    // back to the dark default for the opening frame
    await setCity("San Francisco", "California");
    await sleep(800);

    recording = true;
    await send("Page.startScreencast", {
      format: "jpeg",
      quality: 82,
      maxWidth: 1000,
      maxHeight: 700,
      everyNthFrame: 1,
    });

    const beat = async (ms) => sleep(ms);
    await beat(700);
    await ev(`document.querySelector('button[aria-label^="Fahrenheit"]')?.click()`);
    await beat(1700);
    await ev(`document.querySelector('button[aria-label^="Favorites"]')?.click()`);
    await beat(1400);
    await ev(`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => /^Dubai/.test(x.textContent)); b?.click(); })()`);
    await beat(1900);
    await ev(`document.querySelector('button[aria-label^="Celsius"]')?.click()`);
    await beat(1200);
    await blur();
    await beat(700);

    recording = false;
    await send("Page.stopScreencast");
    await sleep(300);

    // ── assemble ──────────────────────────────────────────────────────────
    const frames = fs.readdirSync(FRAMES).filter((f) => f.endsWith(".jpg")).sort();
    console.log(`frames: ${frames.length}`);
    if (frames.length > 0) {
      // ~12 fps, capped so the loop is not longer than the recording
      execFileSync("convert", [
        "-delay", "8",
        "-loop", "0",
        ...frames.map((f) => path.join(FRAMES, f)),
        "-resize", "880x",
        "-layers", "Optimize",
        path.join(DOCS, "demo.gif"),
      ]);
      const size = fs.statSync(path.join(DOCS, "demo.gif")).size;
      console.log(`demo.gif ${(size / 1048576).toFixed(1)} MB`);
    }

    await ev(`localStorage.setItem('weather.favorites.v1', '[]')`);
    await ev(`localStorage.removeItem('weather.city.v1')`);
    ws.close();
    process.exit(0);
  } catch (err) {
    console.error("ERR", err.stack || err.message);
    recording = false;
    ws.close();
    process.exit(1);
  }
});
