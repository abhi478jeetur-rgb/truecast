import fs from "node:fs";
const OUT="/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const ws=new WebSocket(process.argv[2]);
let id=0;const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Page.enable");await send("Runtime.enable");
    const before = await ev(`(() => ({
      pill: document.querySelector('button.app-region-no-drag')?.textContent.trim(),
      hero: [...document.querySelectorAll('span')].find(s=>/^\\d+°$/.test((s.textContent||'').trim()))?.textContent.trim(),
      condition: [...document.querySelectorAll('span')].find(s=>/^(Clear|Mainly clear|Partly cloudy|Light drizzle|Overcast)$/.test((s.textContent||'').trim()))?.textContent.trim(),
      now: new Date().toString()
    }))()`);
    console.log("BEFORE", JSON.stringify(before));
    // Wait through the 10-minute auto-refresh boundary is impractical; instead prove the code path by reloading and
    // observing the label, then documenting the source line that drops the name.
    await send("Page.reload",{ignoreCache:true});
    await sleep(7000);
    const after = await ev(`(() => ({
      pill: document.querySelector('button.app-region-no-drag')?.textContent.trim(),
      hero: [...document.querySelectorAll('span')].find(s=>/^\\d+°$/.test((s.textContent||'').trim()))?.textContent.trim(),
      now: new Date().toString()
    }))()`);
    console.log("AFTER RELOAD", JSON.stringify(after));
    const payload = { before, afterReload: after,
      source: {
        refreshCall: "useWeather.ts:38-42 — loadWeather(data.city.latitude, data.city.longitude) with no cityName",
        merge: "useWeather.ts:52-58 — name: cityName ?? weather.city.name; fetchWeather returns city.name: ''",
        render: "CurrentWeatherHeader.tsx:48 — {city.name || 'Search city'}"
      }};
    fs.writeFileSync(OUT+"/auto-refresh-name.json",JSON.stringify(payload,null,2));
    console.log("saved auto-refresh-name.json");
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});