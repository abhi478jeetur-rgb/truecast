import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const WS = process.argv[2];
const OUT = "/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const ws = new WebSocket(WS);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || "")); return r.result.value; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(expr, label, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch {} await sleep(250); } throw new Error("timeout " + label); }
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64")); console.log("shot", name); };

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
  return null;
}
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b); return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)); };
const parseColor = (s) => { const m = (s || "").match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const composite = (fg, bg) => ({ r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)), g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)), b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)) });

const SAMPLES = `(() => {
  const all = [...document.querySelectorAll('*')];
  const byText = (re) => all.find(e => e.children.length === 0 && re.test((e.textContent||'').trim()) && (e.textContent||'').trim().length < 50);
  const pick = (el, name) => { if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { name, text:(el.innerText||el.textContent||'').trim().slice(0,50), color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} }; };
  return [
    pick(byText(/^\\\\d+°$/), 'hero'),
    pick(byText(/^(Clear|Overcast|Cloudy|Rain|Snow|Fog|Light drizzle|Partly cloudy|Mainly clear)$/), 'condition'),
    pick(document.querySelector('button.app-region-no-drag'), 'city-pill'),
    pick(byText(/^HOURLY FORECAST$/i), 'section-label'),
    pick(byText(/^H:\\\\d+°$/), 'high-low'),
    pick(byText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/), 'day-name'),
    pick(byText(/^\\\\d+%$/), 'detail-value'),
    pick(byText(/^UV INDEX$/), 'detail-label'),
    pick(byText(/^(FRIDAY|THURSDAY|SATURDAY|SUNDAY|MONDAY|TUESDAY|WEDNESDAY),/), 'date')
  ].filter(Boolean);
})()`;

async function sampleState(file) {
  const samples = await ev(SAMPLES);
  const dims = await ev(`({w:innerWidth,h:innerHeight})`);
  const bg = file.replace(/\.png$/, "-bg.png");
  await ev(`(() => { const s=document.createElement('style'); s.id='audit-bg'; s.textContent='*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;}'; document.head.appendChild(s); })()`);
  await sleep(150);
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(bg, Buffer.from(r.data, "base64"));
  await ev(`document.getElementById('audit-bg')?.remove()`);
  for (const s of samples) {
    const x = Math.min(Math.max(s.rect.x + s.rect.w / 2, 0), dims.w - 1);
    const y = Math.min(Math.max(s.rect.y + s.rect.h / 2, 0), dims.h - 1);
    const px = pixel(bg, x, y);
    s.bg = px; s.contrast = null;
    const fg = parseColor(s.color);
    if (px && fg) s.contrast = contrast(fg.a < 1 ? composite(fg, px) : fg, px);
  }
  const theme = await ev(`(() => { const cs = getComputedStyle(document.body); return { color: cs.color, backgroundImage: cs.backgroundImage, bgColor: cs.backgroundColor }; })()`);
  console.log(`  ${path.basename(file)} theme=${theme.backgroundImage.slice(0,60)}`);
  for (const s of samples) console.log(`   ${s.name.padEnd(13)} ${String(s.fontSize).padEnd(5)} ${s.color.padEnd(22)} on rgb(${s.bg?.r},${s.bg?.g},${s.bg?.b}) => ${s.contrast}:1`);
  fs.writeFileSync(path.join(OUT, `metrics-${path.basename(file, ".png")}.json`), JSON.stringify({ dims, samples, theme }, null, 2));
  return { samples, theme };
}

ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
ws.addEventListener("open", async () => {
  try {
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: [] });
    await send("Emulation.clearDeviceMetricsOverride");
    await send("Page.reload", { ignoreCache: true });
    await sleep(4000);
    await waitFor(`!!document.querySelector('button.app-region-no-drag')`, "city pill after reload", 30000);
    await sleep(800);

    const selectCity = async (q, re) => {
      const open = await ev(`(() => { const b=document.querySelector('button.app-region-no-drag'); if(!b) return false; b.click(); return true; })()`);
      if (!open) throw new Error("no city pill");
      await sleep(700);
      await ev(`(() => { const i=document.querySelector('input[placeholder="Enter city name"]'); if(!i) return false;
        const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        s.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true}));
        s.call(i,${JSON.stringify(q)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
      await waitFor(`[...document.querySelectorAll('button')].some(b=>new RegExp(${JSON.stringify(re)}).test(b.textContent) && b.textContent.length>6)`, "results " + q);
      const picked = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>new RegExp(${JSON.stringify(re)}).test(x.textContent) && x.textContent.length>6); if(!b) return null; const t=b.textContent.trim(); b.click(); return t; })()`);
      console.log("picked:", picked);
      await sleep(3500);
    };

    // ---- daytime city: Sydney (UTC+11) ----
    await selectCity("Sydney", "Australia");
    await waitFor(`/Sydney/i.test(document.body.innerText) && /°/.test(document.body.innerText)`, "sydney loaded");
    await sleep(1200);
    await shot("20-sydney-daytime.png");
    const sydney = await sampleState(path.join(OUT, "20-sydney-daytime.png"));
    const sydneyFacts = await ev(`(() => {
      const t = document.body.innerText.split('\\n').map(s=>s.trim()).filter(Boolean);
      return { city: document.querySelector('button.app-region-no-drag')?.textContent.trim(), head: t.slice(0,14),
        icons: [...document.querySelectorAll('div')].filter(e=>/^(Now|\\d{1,2}(am|pm))\\n-?\\d+°/.test((e.innerText||'').trim()) && e.querySelectorAll('svg').length===1).slice(0,6).map(e=>({l:(e.innerText||'').trim().split('\\n')[0], i:e.querySelector('svg')?.getAttribute('class')})) };
    })()`);

    // ---- long city name: truncation ----
    await selectCity("Llanfairpwllgwyngyll", "Llanfair");
    const longFacts = await ev(`(() => {
      const b = document.querySelector('button.app-region-no-drag'); const r = b?.getBoundingClientRect();
      return { pill: b?.textContent.trim(), pillWidth: r && Math.round(r.width), scrollW: b?.scrollWidth, clientW: b?.clientWidth,
        overflowsViewport: r ? r.right > innerWidth : null, wrap: b ? Math.round(r.height) : null };
    })()`);
    await shot("21-long-city-name.png");

    // ---- modal at min window ----
    await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 560, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await ev(`document.querySelector('button.app-region-no-drag')?.click()`);
    await sleep(500);
    await ev(`(() => { const i=document.querySelector('input[placeholder="Enter city name"]'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,'San'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(2500);
    const modal800 = await ev(`(() => { const p = document.querySelector('.max-w-md'); const r = p.getBoundingClientRect();
      const list = document.querySelector('.max-h-60'); const lr = list.getBoundingClientRect();
      return { panel:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, list:{h:Math.round(lr.height), scrollH:list.scrollHeight},
        innerScroll: getComputedStyle(document.querySelector('.overflow-y-auto')).overflowY, modalFits: r.top>=0 && r.bottom<=innerHeight }; })()`);
    await shot("22-modal-800x560.png");
    await send("Emulation.clearDeviceMetricsOverride");
    await sleep(300);
    await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel')?.click()`);
    await sleep(600);

    // restore default city
    await ev(`(() => { document.querySelector('button.app-region-no-drag')?.click(); })()`);
    await sleep(600);
    await ev(`(() => { const i=document.querySelector('input[placeholder="Enter city name"]'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true})); s.call(i,'San Francisco'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(2500);
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/San Francisco/i.test(x.textContent) && x.textContent.length>10); if(!b) return null; b.click(); return true; })()`);
    await sleep(3000);

    const payload = { sydney: { facts: sydneyFacts, theme: sydney.theme }, longName: longFacts, modal800 };
    fs.writeFileSync(path.join(OUT, "daylight-check.json"), JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ sydneyHead: sydneyFacts.head.slice(0,8), sydneyIcons: sydneyFacts.icons, long: longFacts, modal800 }, null, 1));
    ws.close(); process.exit(0);
  } catch (e) { console.error("ERR", e.stack || e.message); ws.close(); process.exit(1); }
});