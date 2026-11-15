import fs from "node:fs";
const OUT = "/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const ws = new WebSocket(process.argv[2]);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true }); fs.writeFileSync(OUT + "/" + name, Buffer.from(r.data, "base64")); console.log("shot", name); };
async function waitFor(expr, label, ms = 12000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(300); } throw new Error("timeout " + label); }
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
ws.addEventListener("open", async () => {
  try {
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: [] });

    // clean slate: close modal if open
    if (await ev(`!!document.querySelector('input[placeholder="Enter city name"]')`)) {
      await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel')?.click()`);
      await sleep(600);
    }
    const before = await ev(`({ city: document.querySelector('button.app-region-no-drag')?.textContent.trim() })`);
    console.log("BEFORE", JSON.stringify(before));

    await ev(`document.querySelector('button.app-region-no-drag').click()`);
    await sleep(700);
    const setVal = (v) => ev(`(() => { const i=document.querySelector('input[placeholder="Enter city name"]'); if(!i) return false;
      const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      s.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true}));
      s.call(i,${JSON.stringify(v)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await setVal("Berlin");
    await waitFor(`[...document.querySelectorAll('button')].some(b=>/Berlin/i.test(b.textContent) && b.textContent.length>7)`, "Berlin results");
    console.log("results ok");

    // Now break only the forecast API, keep geocoding working
    await send("Network.setBlockedURLs", { urls: ["https://api.open-meteo.com/*"] });
    const picked = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Berlin/i.test(x.textContent) && /Germany/i.test(x.textContent)); if(!b) return null; const t=b.textContent.trim(); b.click(); return t; })()`);
    console.log("PICKED", picked);
    await sleep(4500);

    const after = await ev(`(() => {
      const t = document.body.innerText;
      return {
        city: document.querySelector('button.app-region-no-drag')?.textContent.trim(),
        hasErrorCopy: /Unable to load|error|failed|offline|retry/i.test(t),
        hasSpinner: /Loading weather/i.test(t),
        snippet: t.split('\\n').map(s=>s.trim()).filter(Boolean).slice(0, 16)
      };
    })()`);
    await shot("19-offline-switch-failure.png");
    console.log("AFTER", JSON.stringify(after, null, 2));
    fs.writeFileSync(OUT + "/offline-switch.json", JSON.stringify({ before, picked, after }, null, 2));
    await send("Network.setBlockedURLs", { urls: [] });
    ws.close(); process.exit(0);
  } catch (e) { console.error("ERR", e.stack || e.message); ws.close(); process.exit(1); }
});