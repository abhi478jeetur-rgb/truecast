// End-to-end smoke test against the packaged app.
//
//   node e2e/smoke.mjs [path-to-binary]
//
// Launches the binary with a throwaway profile, drives it over CDP, and checks
// the title, request count, API agreement, shortcuts and the units switch.
// Exits non-zero on failure. Designed for `xvfb-run -a` on a headless machine.
import { launchApp, waitFor, sleep } from "./harness.mjs";

const SF = { lat: 37.7749, lon: -122.4194 };
const failures = [];
const check = (name, pass, detail) => {
  if (!pass) failures.push(`${name} — ${JSON.stringify(detail)}`);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  — " + JSON.stringify(detail)}`);
};

const api = async (unit, wind) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SF.lat}&longitude=${SF.lon}` +
    `&current=temperature_2m&timezone=auto&forecast_days=1&temperature_unit=${unit}&wind_speed_unit=${wind}`;
  return (await fetch(url)).json();
};

// CI stability: this test needs the live API. Say so instead of hanging.
const reachable = await fetch(
  "https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m",
  { signal: AbortSignal.timeout(10_000) },
).then((response) => response.ok).catch(() => false);
if (!reachable) {
  console.log("SKIP  api.open-meteo.com is not reachable from this machine; the live checks need it.");
  process.exit(0);
}

const app = await launchApp({ port: 9230 });
try {
  const { cdp } = app;
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, `!!document.querySelector('button[aria-label^="Change city"]') || /Weather is unavailable/.test(document.body.innerText)`, "first paint", 60_000);
  if (await cdp.eval(`/Weather is unavailable/.test(document.body.innerText)`)) {
    throw new Error(`the app showed its error state instead of weather: ${await cdp.eval("document.body.innerText.replace(/\\n+/g, ' | ')")}`);
  }
  await sleep(1500);

  check("window title is Truecast", (await cdp.eval("document.title")) === "Truecast");
  const forecast = () => cdp.requests.filter((url) => /api\.open-meteo\.com\/v1\/forecast/.test(url)).length;
  check("one forecast request per launch", forecast() === 1, forecast());

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
  const before = forecast();
  await cdp.key("r", "KeyR", 82, 2);
  await sleep(2500);
  check("Ctrl+R refreshes without reloading", (await cdp.eval("window.__smoke")) === 1);
  check("Ctrl+R issues exactly one request", forecast() - before === 1, forecast() - before);

  const fahrenheit = await api("fahrenheit", "mph");
  await cdp.eval(`document.querySelector('button[aria-label^="Fahrenheit"]').click()`);
  await waitFor(cdp, `[...document.querySelectorAll('span')].some(s => s.children.length === 0 && s.textContent.trim() === ${JSON.stringify(`${Math.round(fahrenheit.current.temperature_2m)}°`)})`, "hero in °F");
  check("°F re-requests and matches the API", true, `${Math.round(fahrenheit.current.temperature_2m)}°`);
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  app.stop();
}

console.log(`\n${failures.length ? `${failures.length} failing` : "all checks passed"}`);
process.exit(failures.length ? 1 : 0);
