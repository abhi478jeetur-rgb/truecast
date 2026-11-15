// End-to-end smoke test against the packaged app.
//
//   node e2e/smoke.mjs [path-to-binary]
//
// Launches the binary with a throwaway profile, drives it over CDP, and checks
// that the numbers on screen match the API, that the units switch re-requests,
// and that Ctrl+F / Ctrl+R / Escape work. Exits non-zero on the first failure.
// Designed for `xvfb-run -a` on a headless machine.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BIN = process.argv[2] ?? path.resolve(import.meta.dirname, "../release/linux-unpacked/truecast");
const PORT = 9230;
const SF = { lat: 37.7749, lon: -122.4194 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (name, pass, detail) => {
  if (!pass) failures.push(`${name} — ${JSON.stringify(detail)}`);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  — " + JSON.stringify(detail)}`);
};

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error("the app never exposed a CDP target");
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.requests = [];
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Network.requestWillBeSent" && /api\.open-meteo\.com\/v1\/forecast/.test(message.params.request.url)) {
        this.requests.push(message.params.request.url);
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async key(key, code, virtualKeyCode, modifiers = 0) {
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: virtualKeyCode, modifiers });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKeyCode, modifiers });
  }
  close() {
    this.ws.close();
  }
}

async function waitFor(cdp, expression, label, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await cdp.eval(expression)) return true;
    } catch {
      // page not ready
    }
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

const api = async (unit, wind) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SF.lat}&longitude=${SF.lon}` +
    `&current=temperature_2m&timezone=auto&forecast_days=1&temperature_unit=${unit}&wind_speed_unit=${wind}`;
  return (await fetch(url)).json();
};

const profile = mkdtempSync(path.join(tmpdir(), "truecast-e2e-"));
const child = spawn(BIN, [
  "--no-sandbox",
  "--ozone-platform=x11",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
], { stdio: ["ignore", "pipe", "pipe"] });
child.stderr.on("data", () => {});

let cdp;
try {
  cdp = new Cdp(await waitForTarget());
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, `!!document.querySelector('button[aria-label^="Change city"]') && /°/.test(document.body.innerText)`, "first paint");
  await sleep(1500);

  check("window title is Truecast", (await cdp.eval("document.title")) === "Truecast");
  check("one forecast request per launch", cdp.requests.length === 1, cdp.requests.length);

  const celsius = await api("celsius", "kmh");
  const hero = await cdp.eval(`[...document.querySelectorAll('span')].find(s => s.children.length === 0 && /^-?\\d+°$/.test(s.textContent.trim()))?.textContent.trim()`);
  check("hero matches the API", hero === `${Math.round(celsius.current.temperature_2m)}°`, { hero, api: celsius.current.temperature_2m });

  await cdp.key("f", "KeyF", 70, 2);
  await waitFor(cdp, `!!document.querySelector('[role="dialog"]')`, "sheet open");
  check("Ctrl+F opens the city sheet", true);
  await cdp.key("Escape", "Escape", 27);
  await sleep(400);
  check("Escape closes it", !(await cdp.eval(`!!document.querySelector('[role="dialog"]')`)));

  await cdp.eval("window.__smoke = 1");
  const before = cdp.requests.length;
  await cdp.key("r", "KeyR", 82, 2);
  await sleep(2500);
  check("Ctrl+R refreshes without reloading", (await cdp.eval("window.__smoke")) === 1);
  check("Ctrl+R issues exactly one request", cdp.requests.length - before === 1, cdp.requests.length - before);

  const fahrenheit = await api("fahrenheit", "mph");
  await cdp.eval(`document.querySelector('button[aria-label^="Fahrenheit"]').click()`);
  await waitFor(cdp, `[...document.querySelectorAll('span')].some(s => s.children.length === 0 && s.textContent.trim() === ${JSON.stringify(`${Math.round(fahrenheit.current.temperature_2m)}°`)})`, "hero in °F");
  check("°F re-requests and matches the API", true, `${Math.round(fahrenheit.current.temperature_2m)}°`);
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  cdp?.close();
  child.kill("SIGTERM");
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}

console.log(`\n${failures.length ? `${failures.length} failing` : "all checks passed"}`);
process.exit(failures.length ? 1 : 0);
