import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const WS_URL = process.argv[2];
const OUT = "/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
fs.mkdirSync(OUT, { recursive: true });

const ws = new WebSocket(WS_URL);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r.result?.value;
}
async function waitFor(expr, label, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await ev(expr)) return true; } catch {}
    await sleep(250);
  }
  throw new Error("timeout: " + label);
}
const shotDims = new Map();
async function setViewport(w, h) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(450);
}
async function clearViewport() {
  await send("Emulation.clearDeviceMetricsOverride");
  await sleep(350);
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  const size = await ev(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
  shotDims.set(name, size);
  console.log("shot", name, `${size.w}x${size.h}`, fs.statSync(file).size + "B");
  return file;
}
async function bodyText() {
  return ev(`document.body.innerText`);
}
async function openSearch() {
  return ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.className.includes('rounded-full') && x.textContent.trim());
    if (!b) return false; b.click(); return true;
  })()`);
}
async function typeSearch(q) {
  return ev(`(() => {
    const i = document.querySelector('input[placeholder="Enter city name"]');
    if (!i) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(q)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}
async function selectResult(re) {
  return ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => new RegExp(${JSON.stringify(re)},'i').test(x.textContent) && x.textContent.trim().length > 4);
    if (!b) return null; const t = b.textContent.trim(); b.click(); return t;
  })()`);
}
async function pressTab(n = 1) {
  for (let i = 0; i < n; i++) {
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: "Tab", code: "Tab" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: "Tab", code: "Tab" });
    await sleep(180);
  }
}
async function pressEnter() {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, key: "Enter", code: "Enter" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, key: "Enter", code: "Enter" });
  await sleep(300);
}
async function pressEscape() {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, key: "Escape", code: "Escape" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, key: "Escape", code: "Escape" });
  await sleep(300);
}
async function hoverSelector(expr) {
  const r = await ev(expr);
  if (!r) return null;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(r.x), y: Math.round(r.y) });
  await sleep(500);
  return r;
}
function md5(file) {
  return execFileSync("md5sum", [file]).toString().split(" ")[0];
}
function pixel(file, x, y) {
  const out = execFileSync("convert", [file, "-format", `%[pixel:p{${Math.round(x)},${Math.round(y)}}]`, "info:"]).toString().trim();
  let m = out.match(/srgb\((\d+),(\d+),(\d+)\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  m = out.match(/srgba\((\d+),(\d+),(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  m = out.match(/srgb\(([\d.]+)%,([\d.]+)%,([\d.]+)%\)/);
  if (m) return { r: Math.round(+m[1] * 2.55), g: Math.round(+m[2] * 2.55), b: Math.round(+m[3] * 2.55) };
  m = out.match(/gray\(([\d.]+)(%?)\)/);
  if (m) { const v = m[2] ? Math.round(+m[1] * 2.55) : Math.round(+m[1]); return { r: v, g: v, b: v }; }
  m = out.match(/#([0-9a-f]{6})/i);
  if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
  return null;
}
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a, b) => {
  const L1 = lum(a), L2 = lum(b);
  return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2));
};
function composite(fg, bg) {
  const a = fg.a;
  return { r: Math.round(fg.r * a + bg.r * (1 - a)), g: Math.round(fg.g * a + bg.g * (1 - a)), b: Math.round(fg.b * a + bg.b * (1 - a)) };
}
function parseColor(s) {
  const m = (s || "").match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  const ok = (s || "").match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (ok) {
    const L = +ok[1], C = +ok[2], h = (+ok[3] * Math.PI) / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, mm = m_ ** 3, ss = s_ ** 3;
    let r = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss;
    let g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss;
    let bb = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss;
    const gam = (v) => Math.max(0, Math.min(255, Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))));
    return { r: gam(r), g: gam(g), b: gam(bb), a: 1 };
  }
  return null;
}

const SAMPLES = `(() => {
  const all = [...document.querySelectorAll('*')];
  const byText = (re) => all.find(e => e.children.length === 0 && re.test((e.textContent||'').trim()) && (e.textContent||'').trim().length < 50);
  const cityBtn = document.querySelector('button.app-region-no-drag');
  const titleBtn = [...document.querySelectorAll('button')].find(b => b.getAttribute('title') === 'Close');
  const firstDay = all.find(e => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test((e.textContent||'').trim()) && e.children.length === 0);
  const detailLabel = all.find(e => (e.textContent||'').trim() === 'HUMIDITY' && e.children.length === 0);
  const detailValue = all.find(e => /^\\d+%$/.test((e.textContent||'').trim()) && e.children.length === 0);
  const pick = (el, name) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      name, text: (el.innerText || el.textContent || '').trim().slice(0, 50),
      color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing, fontFamily: cs.fontFamily,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      opacity: cs.opacity
    };
  };
  return [
    pick(document.querySelector('h1') || byText(/^\\d+°/), 'hero-temp'),
    pick(byText(/^(Clear|Overcast|Cloudy|Rain|Snow|Fog)$/), 'condition'),
    pick(cityBtn, 'city-button'),
    pick(byText(/^HOURLY FORECAST$/i), 'section-label'),
    pick(byText(/^H:\\d+°$/), 'high-low'),
    pick(firstDay, 'day-name'),
    pick(detailLabel, 'detail-label'),
    pick(detailValue, 'detail-value'),
    pick(titleBtn, 'titlebar-close')
  ].filter(Boolean);
})()`;

async function collect(file, extra = {}) {
  const samples = await ev(SAMPLES);
  const dims = shotDims.get(path.basename(file)) || (await ev(`({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})`));

  // Capture the same frame with all text hidden so we can sample the true rendered background.
  const bgPath = file.replace(/\.png$/, "-bg.png");
  await ev(`(() => { const s = document.createElement('style'); s.id='audit-bg';
    s.textContent = '*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;}';
    document.head.appendChild(s); return true; })()`);
  await sleep(150);
  const bgShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(bgPath, Buffer.from(bgShot.data, "base64"));
  await ev(`document.getElementById('audit-bg')?.remove()`);

  for (const s of samples) {
    const cx = Math.min(Math.max(s.rect.x + s.rect.w / 2, 0), dims.w - 1);
    const cy = Math.min(Math.max(s.rect.y + s.rect.h / 2, 0), dims.h - 1);
    s.sampledBg = null; s.contrast = null; s.sampleAt = { x: Math.round(cx), y: Math.round(cy) };
    const px = pixel(bgPath, cx, cy);
    if (!px) continue;
    s.sampledBg = px;
    const fg = parseColor(s.color);
    if (fg) {
      const eff = fg.a < 1 ? composite(fg, px) : fg;
      s.contrast = contrast(eff, px);
    }
  }
  const facts = await ev(`(() => {
    const all = [...document.querySelectorAll('*')];
    const css = (e) => getComputedStyle(e);
    const transitions = {};
    for (const e of all) { const d = css(e).transitionDuration; if (d && d !== '0s') transitions[d] = (transitions[d]||0)+1; }
    const fontSizes = {};
    for (const e of all) if (e.children.length === 0 && (e.textContent||'').trim()) { const s = css(e).fontSize; fontSizes[s]=(fontSizes[s]||0)+1; }
    const colors = {};
    for (const e of all) if (e.children.length === 0 && (e.textContent||'').trim()) { const c = css(e).color; colors[c]=(colors[c]||0)+1; }
    const interactive = [...document.querySelectorAll('button,a[href],input,[role="button"],[tabindex]')].map(e => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName.toLowerCase(), text: (e.innerText||'').trim().slice(0,30), aria: e.getAttribute('aria-label'), title: e.getAttribute('title'),
        w: Math.round(r.width), h: Math.round(r.height), tabindex: e.getAttribute('tabindex'), role: e.getAttribute('role') };
    });
    const scrollables = all.filter(e => e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2).map(e => ({
      tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0,80), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight,
      ox: css(e).overflowX, oy: css(e).overflowY
    }));
    const textNodes = [...document.querySelectorAll('h1,h2,h3,h4,p,span,div,button')].filter(e => e.children.length === 0 && (e.textContent||'').trim());
    const leftEdges = [...new Set(textNodes.map(e => Math.round(e.getBoundingClientRect().x)))].filter(x => x < 120).sort((a,b)=>a-b);
    return {
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, scrollbar: innerWidth - document.documentElement.clientWidth },
      title: document.title, lang: document.documentElement.lang,
      transitions, fontSizes, colors, interactive, scrollables, leftEdges,
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ tag: h.tagName, text: h.innerText.trim().slice(0,40), size: css(h).fontSize })),
      landmarks: { header: !!document.querySelector('header'), main: !!document.querySelector('main'), nav: !!document.querySelector('nav'), footer: !!document.querySelector('footer'), sections: document.querySelectorAll('section').length },
      ariaLive: document.querySelectorAll('[aria-live]').length,
      ariaModal: document.querySelectorAll('[aria-modal]').length,
      roleDialog: document.querySelectorAll('[role="dialog"]').length,
      imgNoAlt: [...document.querySelectorAll('img')].filter(i => !i.getAttribute('alt')).length,
      svgCount: document.querySelectorAll('svg').length,
      svgNoLabel: [...document.querySelectorAll('svg')].filter(s => !s.getAttribute('aria-label') && !s.querySelector('title') && s.getAttribute('aria-hidden') !== 'true').length,
      positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter(e => +e.getAttribute('tabindex') > 0).length,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      hardcodedWhite: textNodes.filter(e => css(e).color === 'rgb(255, 255, 255)').length,
      emoji: (document.body.innerText.match(/[\\u{1F300}-\\u{1FAFF}]/gu) || []).length,
      now: new Date().toString()
    };
  })()`);
  const body = await bodyText();
  const payload = { state: path.basename(file), dims, samples, facts, bodyText: body.slice(0, 2000), ...extra };
  fs.writeFileSync(path.join(OUT, `metrics-${path.basename(file, ".png")}.json`), JSON.stringify(payload, null, 2));
  console.log("  contrast:", samples.map(s => `${s.name}=${s.contrast ?? "?"}:1`).join(", "));
  return payload;
}

ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});

ws.addEventListener("open", async () => {
  try {
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Accessibility.enable");
    await waitFor(`/°/.test(document.body.innerText) && !/Loading weather/.test(document.body.innerText)`, "initial weather");
    await sleep(1200);

    // ---------- 01 default ----------
    const f1 = await shot("01-default-1000x700.png");
    await collect(f1, { label: "default San Francisco" });

    // ---------- 02 min window ----------
    await setViewport(800, 560);
    const f2 = await shot("02-min-800x560.png");
    await collect(f2, { label: "minimum window" });
    await clearViewport();

    // ---------- 03 maximized ----------
    await setViewport(1920, 1080);
    const f3 = await shot("03-maximized-1920x1080.png");
    await collect(f3, { label: "maximized" });
    await clearViewport();

    // ---------- 04 200% zoom proxy ----------
    await setViewport(500, 350);
    const f4 = await shot("04-zoom-200-500x350.png");
    const zoomFacts = await ev(`(() => {
      document.documentElement.style.fontSize = '200%';
      const t = [...document.querySelectorAll('span')].find(e => /^\\d+°$/.test((e.textContent||'').trim()));
      const after = t ? getComputedStyle(t).fontSize : null;
      document.documentElement.style.fontSize = '';
      return { heroFontAfterRoot200: after, note: 'px-based type does not respond to root font-size' };
    })()`);
    await collect(f4, { label: "200% zoom proxy", zoomFacts });
    await clearViewport();

    // ---------- 05 search empty ----------
    await openSearch(); await sleep(600);
    const f5 = await shot("05-search-empty.png");
    await collect(f5, { label: "search modal empty" });

    // ---------- 06 no results ----------
    await typeSearch("zzzzqqqx"); await sleep(2500);
    const f6 = await shot("06-search-no-results.png");
    const noResultsText = await ev(`document.querySelector('[role="dialog"]')?.innerText || document.body.innerText`);
    await collect(f6, { label: "search no results", noResultsText: noResultsText.slice(0, 600) });

    // ---------- 07 long query/results ----------
    await typeSearch("San"); await sleep(2200);
    const f7 = await shot("07-search-results.png");
    await collect(f7, { label: "search results" });

    // keyboard completion test inside modal
    const focusBefore = await ev(`(() => { const a=document.activeElement; return {tag:a.tagName, text:(a.innerText||'').trim().slice(0,40), placeholder:a.getAttribute&&a.getAttribute('placeholder')}; })()`);
    await pressEnter();
    const afterEnter = await ev(`({ modalStillOpen: !!document.querySelector('input[placeholder="Enter city name"]'), city: [...document.querySelectorAll('button')].find(b=>b.className.includes('rounded-full'))?.textContent.trim() })`);
    await pressEscape();
    const afterEscape = await ev(`({ modalStillOpen: !!document.querySelector('input[placeholder="Enter city name"]') })`);
    const searchKeys = { focusBefore, afterEnter, afterEscape };

    // focus containment: reopen and tab through
    await openSearch(); await sleep(500);
    const tabTrail = [];
    for (let i = 0; i < 8; i++) {
      await pressTab(1);
      tabTrail.push(await ev(`(() => { const a=document.activeElement; const r=a.getBoundingClientRect(); return {
        tag:a.tagName, text:(a.innerText||'').trim().slice(0,30), placeholder:a.getAttribute&&a.getAttribute('placeholder'),
        insideModal: !!a.closest('[role="dialog"]') || !!a.closest('.fixed.inset-0'),
        outline: getComputedStyle(a).outline, y: Math.round(r.y), h: Math.round(r.height)
      }; })()`));
    }
    const f8 = await shot("08-modal-focus-trail.png");
    await pressEscape();
    // ensure closed for next state (Cancel button, never the window close control)
    if (await ev(`!!document.querySelector('input[placeholder="Enter city name"]')`)) {
      await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel')?.click()`);
    }
    if (await ev(`!!document.querySelector('input[placeholder="Enter city name"]')`)) {
      await ev(`document.querySelector('.fixed.inset-0')?.click()`);
    }
    await sleep(600);

    // ---------- 09 Tokyo (daytime city: icon truth) ----------
    await openSearch(); await sleep(500);
    await typeSearch("Tokyo"); await sleep(2200);
    await selectResult("Tokyo, Japan|Tokyo.*Japan"); await sleep(3500);
    await waitFor(`/Tokyo/i.test(document.body.innerText)`, "Tokyo loaded");
    const f9 = await shot("09-tokyo-daytime.png");
    const iconTruth = await ev(`(() => {
      const cards = [...document.querySelectorAll('div,button,li')].filter(e => {
        const t = (e.innerText||'').trim();
        return /^(Now|\\d{1,2}(am|pm))\\n-?\\d+°/.test(t) && e.querySelectorAll('svg').length === 1;
      }).slice(0, 8).map(e => ({ label: (e.innerText||'').trim().split('\\n')[0], icon: e.querySelector('svg')?.getAttribute('class')||'' }));
      const city = document.querySelector('button.app-region-no-drag')?.textContent.trim();
      return { city, cards, localTime: new Date().toString(), localHour: new Date().getHours() };
    })()`);
    await collect(f9, { label: "Tokyo daytime (icon truth)", iconTruth });

    // daily names + forecast count
    const dailyTruth = await ev(`(() => {
      const t = document.body.innerText.split('\\n').map(s=>s.trim()).filter(Boolean);
      const i = t.findIndex(x => /10-DAY FORECAST/i.test(x));
      const days = []; for (let j=i+1; j<t.length && days.length<14; j+=3) { if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(t[j])) break; days.push({day:t[j], max:t[j+1], min:t[j+2]}); }
      return { label: t[i], rows: days.length, days };
    })()`);

    // ---------- 10 persistence across reload ----------
    await send("Page.reload", { ignoreCache: true });
    await sleep(4500);
    await waitFor(`/°/.test(document.body.innerText)`, "reload after Tokyo");
    const f10 = await shot("10-after-reload-persistence.png");
    const persistence = await ev(`({ city: document.querySelector('button.app-region-no-drag')?.textContent.trim() })`);
    await collect(f10, { label: "after reload", persistence });

    // ---------- 11 offline error ----------
    await send("Network.setBlockedURLs", { urls: ["*open-meteo.com*"] });
    await send("Page.reload", { ignoreCache: true });
    await sleep(2500);
    const f11 = await shot("11-offline-error.png");
    const offlineText = await ev(`document.body.innerText.slice(0, 800)`);
    await collect(f11, { label: "offline error", offlineText });

    // ---------- 12 loading skeleton ----------
    await send("Network.setBlockedURLs", { urls: [] });
    await send("Network.emulateNetworkConditions", { offline: false, latency: 5000, downloadThroughput: 20000, uploadThroughput: 20000 });
    await send("Page.reload", { ignoreCache: true });
    await sleep(1200);
    const f12 = await shot("12-loading.png");
    const loadingText = await ev(`document.body.innerText.slice(0, 300)`);
    await collect(f12, { label: "loading state", loadingText });
    await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await send("Page.reload", { ignoreCache: true });
    await sleep(4000);
    await waitFor(`/°/.test(document.body.innerText) && !/Loading weather/.test(document.body.innerText)`, "recovered weather", 30000);

    // ---------- 13 hover states ----------
    const beforeHover = await shot("13a-before-hover.png");
    const hovered = await hoverSelector(`(() => {
      const b = document.querySelector('button[title="Close"]'); if (!b) return null;
      const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()`);
    const f13 = await shot("13b-hover-close.png");
    const hoverCloseChanged = md5(beforeHover) !== md5(f13);
    const rowHovered = await hoverSelector(`(() => {
      const el = [...document.querySelectorAll('div,button,li')].find(e => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\n/.test((e.innerText||'').trim()) && e.getBoundingClientRect().width > 300);
      if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()`);
    const f13c = await shot("13c-hover-dayrow.png");
    const hoverRowChanged = md5(f13) !== md5(f13c);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });

    // ---------- 14 reduced motion ----------
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await sleep(400);
    const reduced = await ev(`(() => {
      const all = [...document.querySelectorAll('*')];
      const moving = all.filter(e => { const c = getComputedStyle(e); return c.transitionDuration !== '0s' || c.animationName !== 'none'; });
      return { prefersReduce: matchMedia('(prefers-reduced-motion: reduce)').matches, elementsStillAnimating: moving.length,
        sample: moving.slice(0,5).map(e => ({ cls: String(e.className).slice(0,60), td: getComputedStyle(e).transitionDuration, an: getComputedStyle(e).animationName })) };
    })()`);
    const f14 = await shot("14-reduced-motion.png");
    await collect(f14, { label: "reduced motion", reduced });

    // ---------- 15 forced colors ----------
    await send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
    await sleep(500);
    const f15 = await shot("15-forced-colors.png");
    await collect(f15, { label: "forced colors" });
    await send("Emulation.setEmulatedMedia", { features: [] });

    // ---------- 16 AX tree ----------
    const ax = await send("Accessibility.getFullAXTree");
    fs.writeFileSync(path.join(OUT, "ax-tree.json"), JSON.stringify(ax, null, 2));
    const axSummary = (ax.nodes || []).reduce((acc, n) => {
      const role = n.role?.value || "none";
      acc.roles[role] = (acc.roles[role] || 0) + 1;
      const name = n.name?.value || "";
      if (!name && ["button", "link", "textbox", "dialog", "heading"].includes(role)) acc.unnamed.push({ role, nodeId: n.nodeId });
      if (role === "heading") acc.headings.push({ level: n.properties?.find(p => p.name === "level")?.value?.value, name });
      return acc;
    }, { roles: {}, unnamed: [], headings: [] });
    fs.writeFileSync(path.join(OUT, "ax-summary.json"), JSON.stringify(axSummary, null, 2));

    // ---------- 17 keyboard traversal (page) ----------
    await ev(`document.activeElement && document.activeElement.blur()`);
    const pageTabs = [];
    for (let i = 0; i < 10; i++) {
      await pressTab(1);
      pageTabs.push(await ev(`(() => { const a=document.activeElement; return { tag:a.tagName, text:(a.innerText||'').trim().slice(0,30), title:a.getAttribute&&a.getAttribute('title'), outline:getComputedStyle(a).outline, y:Math.round(a.getBoundingClientRect().y) }; })()`));
    }
    const f17 = await shot("17-keyboard-traversal.png");

    // ---------- 18 API vs UI data ----------
    const uiData = await ev(`(() => {
      const t = document.body.innerText.split('\\n').map(s=>s.trim()).filter(Boolean);
      const city = [...document.querySelectorAll('button')].find(b=>b.className.includes('rounded-full'))?.textContent.trim();
      return { city, head: t.slice(0,10), hourlyIcons: [] };
    })()`);

    const summary = {
      capturedAt: new Date().toISOString(),
      zoomFacts, searchKeys, tabTrail, iconTruth, dailyTruth, persistence,
      offlineText, loadingText, hoverCloseChanged, hoverRowChanged, reduced, axSummary, pageTabs, uiData
    };

    // API cross-check for San Francisco and Tokyo (times are location-local per timezone=auto)
    const apiUrl = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=temperature_2m,weather_code&timezone=auto`;
    const [sfApi, tkApi] = await Promise.all([
      fetch(apiUrl(37.7749, -122.4194)).then(r => r.json()),
      fetch(apiUrl(35.6762, 139.6503)).then(r => r.json())
    ]);
    const apiCheck = {
      sf: {
        currentTemp: sfApi.current.temperature_2m,
        apparent: sfApi.current.apparent_temperature,
        todayMax: sfApi.daily.temperature_2m_max[0],
        todayMin: sfApi.daily.temperature_2m_min[0],
        dailyDaysReturned: sfApi.daily.time.length,
        hourlyHoursReturned: sfApi.hourly.time.length,
        firstDays: sfApi.daily.time.slice(0, 3),
        timezone: sfApi.timezone
      },
      tokyo: {
        currentTemp: tkApi.current.temperature_2m,
        todayMax: tkApi.daily.temperature_2m_max[0],
        todayMin: tkApi.daily.temperature_2m_min[0],
        dailyDaysReturned: tkApi.daily.time.length,
        timezone: tkApi.timezone,
        firstHourTimes: tkApi.hourly.time.slice(0, 4),
        hourOfDayNow: tkApi.current.time
      }
    };
    fs.writeFileSync(path.join(OUT, "api-check.json"), JSON.stringify(apiCheck, null, 2));
    summary.apiCheck = apiCheck;

    fs.writeFileSync(path.join(OUT, "deep-summary.json"), JSON.stringify(summary, null, 2));

    console.log("\n=== DEEP EVIDENCE COMPLETE ===");
    console.log(JSON.stringify({ zoomFacts, searchKeys, dailyTruth, persistence, hoverCloseChanged, hoverRowChanged, reduced, ax: { unnamed: axSummary.unnamed.length, headings: axSummary.headings }, pageTabs: pageTabs.length }, null, 2));
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error("CAPTURE ERROR:", e.stack || e.message);
    ws.close();
    process.exit(1);
  }
});
ws.addEventListener("error", (e) => { console.error("WS ERROR", e.message || e); process.exit(1); });
