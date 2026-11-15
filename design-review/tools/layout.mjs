import fs from "node:fs";
const ws = new WebSocket(process.argv[2]);
let id=0; const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+" "+(r.exceptionDetails.exception?.description||""));return r.result.value};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Page.enable");await send("Runtime.enable");
    await sleep(400);
    await ev(`document.querySelector('.overflow-y-auto').scrollTo(0,0)`); await sleep(400);
    const r = await ev(`(() => {
      const R = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const cs = e => getComputedStyle(e);
      const all = [...document.querySelectorAll('*')];
      const t = (re) => all.find(e => e.children.length === 0 && re.test((e.textContent||'').trim()) && (e.textContent||'').trim().length < 40);
      const scroll = document.querySelector('.overflow-y-auto');
      const hero = t(/^\\d+°$/);
      const label = t(/^HOURLY FORECAST$/i);
      const dayLabel = t(/^10-DAY FORECAST$/i);
      const pill = document.querySelector('button.app-region-no-drag');
      const dayRow = all.filter(e => e.children.length>0 && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test((e.innerText||'').trim()) && e.getBoundingClientRect().width > 300 && e.getBoundingClientRect().height < 90).pop();
      const detail = t(/^UV INDEX$/);
      const sun = t(/^SUNRISE \\/ SUNSET$/i);
      const firstCard = all.find(e => /^Now\\n/.test((e.innerText||'').trim()) && e.querySelectorAll('svg').length === 1);
      const h3s = [...document.querySelectorAll('h1,h2,h3')].map(h => ({ tag:h.tagName, text:h.innerText.trim(), size: cs(h).fontSize, weight: cs(h).fontWeight, tracking: cs(h).letterSpacing, rect: R(h) }));
      const btn = [...document.querySelectorAll('button')].map(b => ({ title: b.getAttribute('title'), text: b.innerText.trim().slice(0,25), rect: R(b), outline: cs(b).outline }));
      return {
        viewport: { w: innerWidth, h: innerHeight },
        scroll: { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, scrollTop: scroll.scrollTop, overflowY: cs(scroll).overflowY },
        hero: hero && { rect: R(hero), size: cs(hero).fontSize, weight: cs(hero).fontWeight, color: cs(hero).color, tracking: cs(hero).letterSpacing },
        hourlyLabel: label && { rect: R(label), size: cs(label).fontSize, tracking: cs(label).letterSpacing, weight: cs(label).fontWeight, color: cs(label).color },
        tenDayLabel: dayLabel && { rect: R(dayLabel), size: cs(dayLabel).fontSize, tracking: cs(dayLabel).letterSpacing },
        pill: pill && { rect: R(pill), radius: cs(pill).borderTopLeftRadius },
        dayRow: dayRow && { rect: R(dayRow), bg: cs(dayRow).backgroundColor, radius: cs(dayRow).borderTopLeftRadius },
        firstCard: firstCard && { rect: R(firstCard), gap: cs(firstCard).gap, bg: cs(firstCard).backgroundColor },
        detailLabel: detail && { rect: R(detail), size: cs(detail).fontSize, color: cs(detail).color },
        sunrise: sun && { rect: R(sun) },
        headings: h3s,
        buttons: btn,
        gridCols: (() => { const g = document.querySelector('.grid'); return g && { class: g.className, cols: cs(g).gridTemplateColumns }; })(),
        fontFamilies: [...new Set(all.map(e => cs(e).fontFamily))],
        minZoom: window.devicePixelRatio
      };
    })()`);
    fs.writeFileSync('/home/tarun-bansal/dev/weather-app/design-review/evidence-deep/measure-layout.json', JSON.stringify(r,null,2));
    console.log(JSON.stringify(r,null,1));
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});