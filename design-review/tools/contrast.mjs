import fs from "node:fs";
import { execFileSync } from "node:child_process";
const WS = process.argv[2];
const OUT = "/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const ws = new WebSocket(WS);
let id=0; const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+" "+(r.exceptionDetails.exception?.description||""));return r.result.value};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function pixel(file,x,y){const out=execFileSync("convert",[file,"-format",`%[pixel:p{${Math.round(x)},${Math.round(y)}}]`,"info:"]).toString().trim();
 let m=out.match(/srgb\((\d+),(\d+),(\d+)\)/); if(m) return {r:+m[1],g:+m[2],b:+m[3]};
 m=out.match(/srgba\((\d+),(\d+),(\d+)/); if(m) return {r:+m[1],g:+m[2],b:+m[3]};
 m=out.match(/srgb\(([\d.]+)%,([\d.]+)%,([\d.]+)%\)/); if(m) return {r:Math.round(+m[1]*2.55),g:Math.round(+m[2]*2.55),b:Math.round(+m[3]*2.55)};
 return null;}
const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
const contrast=(a,b)=>{const L1=lum(a),L2=lum(b);return +(((Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)).toFixed(2))};
const comp=(fg,bg,op)=>({r:Math.round(fg.r*op+bg.r*(1-op)),g:Math.round(fg.g*op+bg.g*(1-op)),b:Math.round(fg.b*op+bg.b*(1-op))});
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Page.enable");await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride",{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
    await sleep(900);
    await ev(`document.querySelector('.overflow-y-auto').scrollTo(0,0)`); await sleep(400);

    const targets = await ev(`(() => {
      const all=[...document.querySelectorAll('*')];
      const leaf=(re)=>all.find(e=>e.children.length===0 && re.test((e.textContent||'').trim()) && (e.textContent||'').trim().length<40);
      const pick=(el,name)=>{ if(!el) return null; const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
        return {name,text:(el.innerText||'').trim().slice(0,30),op:+cs.opacity,color:cs.color,size:cs.fontSize,weight:cs.fontWeight,
        x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
      const nameRow=all.find(e=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\n/.test((e.innerText||'').trim()) && e.getBoundingClientRect().width>300 && e.getBoundingClientRect().height<80);
      const rowLeaves=nameRow?[...nameRow.querySelectorAll('span')].filter(s=>s.children.length===0):[];
      return [
        pick(all.find(e=>e.tagName==='SPAN' && String(e.className).includes('96px')),'hero'),
        pick(leaf(/^H:\\d+°$/),'high'),
        pick(leaf(/^L:\\d+°$/),'low'),
        pick(document.querySelector('h3'),'section-label'),
        pick(rowLeaves[0],'day-name'),
        pick(rowLeaves[1],'day-max'),
        pick(rowLeaves[2],'day-min'),
        pick(leaf(/^HOURLY FORECAST$/i)?null:null,'none'),
        pick(all.find(e=>/^\\d+%$/.test((e.innerText||'').trim()) && e.children.length===0),'detail-value'),
        pick(leaf(/^HUMIDITY$/i),'detail-label'),
        pick(leaf(/^UV INDEX$/i),'uv-label'),
        pick(all.find(e=>/^\\d{1,2}°$/.test((e.innerText||'').trim()) && e.className.includes('text-sm')),'hourly-temp'),
        pick(leaf(/^(Now)$/),'hourly-now')
      ].filter(Boolean);
    })()`);

    const bgFile = OUT + "/24-contrast-1600x1000-bg.png";
    await shotTo("24-contrast-1600x1000.png");
    await ev(`(() => { const s=document.createElement('style'); s.id='audit-bg'; s.textContent='*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;}'; document.head.appendChild(s); })()`);
    await sleep(200);
    await send("Page.captureScreenshot",{format:"png",fromSurface:true}).then(r=>fs.writeFileSync(bgFile,Buffer.from(r.data,"base64")));
    await ev(`document.getElementById('audit-bg')?.remove()`);

    const rows=[];
    for (const t of targets){
      const bg=pixel(bgFile,t.x+t.w/2,t.y+t.h/2);
      let fg; const m=t.color.match(/rgba?\(([^)]+)\)/);
      if(m){const q=m[1].split(",").map(Number); fg={r:q[0],g:q[1],b:q[2]};}
      else if(t.color.startsWith('oklch')){
        const ok=t.color.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/); const L=+ok[1],C=+ok[2],h=(+ok[3]*Math.PI)/180;
        const a=C*Math.cos(h),b=C*Math.sin(h);
        const l_=L+0.3963377774*a+0.2158037573*b, m_=L-0.1055613458*a-0.0638541728*b, s_=L-0.0894841775*a-1.291485548*b;
        const l=l_**3,mm=m_**3,ss=s_**3;
        const gam=v=>Math.max(0,Math.min(255,Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055))));
        fg={r:gam(4.0767416621*l-3.3077115913*mm+0.2309699292*ss),g:gam(-1.2684380046*l+2.6097574011*mm-0.3413193965*ss),b:gam(-0.0041960863*l-0.7034186147*mm+1.707614701*ss)};
      }
      const eff=comp(fg,bg,t.op);
      rows.push({...t,bg,effective:eff,contrast:contrast(eff,bg)});
    }
    fs.writeFileSync(OUT+"/contrast-1600.json",JSON.stringify(rows,null,2));
    console.log("name            size  op   bg              eff             ratio  required");
    for(const r of rows){
      const req = parseFloat(r.size)>=18 || (parseFloat(r.size)>=14 && +r.weight>=700) ? 3 : 4.5;
      console.log(`${r.name.padEnd(14)} ${r.size.padEnd(5)} ${r.op}  rgb(${r.bg.r},${r.bg.g},${r.bg.b})`.padEnd(48)+` rgb(${r.effective.r},${r.effective.g},${r.effective.b})`.padEnd(20)+` ${String(r.contrast).padEnd(6)} ${req}  ${r.contrast>=req?'PASS':'FAIL'}`);
    }
    await send("Emulation.clearDeviceMetricsOverride");
    ws.close();process.exit(0);

    async function shotTo(n){const r=await send("Page.captureScreenshot",{format:"png",fromSurface:true});fs.writeFileSync(OUT+"/"+n,Buffer.from(r.data,"base64"));}
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});