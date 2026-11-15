import fs from "node:fs";
import { execFileSync } from "node:child_process";
const OUT="/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const ws=new WebSocket(process.argv[2]);
let id=0;const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+" "+(r.exceptionDetails.exception?.description||""));return r.result.value};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const shot=async(n)=>{const r=await send("Page.captureScreenshot",{format:"png",fromSurface:true});fs.writeFileSync(OUT+"/"+n,Buffer.from(r.data,"base64"));};
function pixel(f,x,y){const o=execFileSync("convert",[f,"-format",`%[pixel:p{${Math.round(x)},${Math.round(y)}}]`,"info:"]).toString().trim();
 let m=o.match(/srgb\((\d+),(\d+),(\d+)\)/); if(m)return{r:+m[1],g:+m[2],b:+m[3]};
 m=o.match(/srgba\((\d+),(\d+),(\d+)/); if(m)return{r:+m[1],g:+m[2],b:+m[3]};
 m=o.match(/srgb\(([\d.]+)%,([\d.]+)%,([\d.]+)%\)/); if(m)return{r:Math.round(+m[1]*2.55),g:Math.round(+m[2]*2.55),b:Math.round(+m[3]*2.55)};
 return null;}
const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
const cr=(a,b)=>{const A=lum(a),B=lum(b);return +(((Math.max(A,B)+0.05)/(Math.min(A,B)+0.05)).toFixed(2))};
const comp=(f,b,o)=>({r:Math.round(f.r*o+b.r*(1-o)),g:Math.round(f.g*o+b.g*(1-o)),b:Math.round(f.b*o+b.b*(1-o))});
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Page.enable");await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride",{width:1000,height:700,deviceScaleFactor:1,mobile:false});
    await sleep(600);
    await ev(`(() => { const r=document.documentElement; r.style.setProperty('--bg-gradient','linear-gradient(180deg,#bfdbfe 0%,#60a5fa 100%)'); r.style.setProperty('--text-on-bg','#0f172a'); document.querySelector('.overflow-y-auto')?.scrollTo(0,0); return getComputedStyle(document.body).backgroundImage; })()`);
    await sleep(700);
    await shot("25-day-theme-synthetic.png");
    const info = await ev(`(() => {
      const all=[...document.querySelectorAll('*')];
      const leaf=re=>all.find(e=>e.children.length===0&&re.test((e.textContent||'').trim())&&(e.textContent||'').trim().length<40);
      const pick=(el,n)=>{if(!el)return null;const cs=getComputedStyle(el);const r=el.getBoundingClientRect();return {n,text:(el.innerText||'').trim().slice(0,20),color:cs.color,op:+cs.opacity,size:cs.fontSize,w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y)};};
      const row=all.find(e=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\n/.test((e.innerText||'').trim())&&e.getBoundingClientRect().width>300&&e.getBoundingClientRect().height<80);
      const spans=row?[...row.querySelectorAll('span')].filter(s=>s.children.length===0):[];
      return {theme:{bg:getComputedStyle(document.body).backgroundImage, color:getComputedStyle(document.body).color},
        samples:[pick(document.querySelector('h1,span.text-dynamic'),'hero'),pick(leaf(/^H:\\d+°$/),'high'),pick(spans[0],'day-name'),pick(spans[2],'day-min'),pick(leaf(/^HOURLY FORECAST$/i),'section')].filter(Boolean),
        borders:[...document.querySelectorAll('div')].slice(0,0).length};
    })()`);
    await ev(`(() => { const s=document.createElement('style'); s.id='bg'; s.textContent='*{color:transparent!important;-webkit-text-fill-color:transparent!important;}'; document.head.appendChild(s); })()`);
    await sleep(200); await shot("25-day-theme-synthetic-bg.png"); await ev(`document.getElementById('bg')?.remove()`);
    const rows=[];
    for(const s of info.samples){
      const bg=pixel(OUT+"/25-day-theme-synthetic-bg.png", s.x+s.w/2, s.y+s.h/2);
      const m=s.color.match(/rgba?\(([^)]+)\)/); let fg=null;
      if(m){const q=m[1].split(",").map(Number);fg={r:q[0],g:q[1],b:q[2]};}
      if(!bg||!fg){rows.push({...s,bg,contrast:null});continue;}
      rows.push({...s,bg,contrast:cr(comp(fg,bg,s.op),bg)});
    }
    fs.writeFileSync(OUT+"/day-theme.json",JSON.stringify({theme:info.theme,rows},null,2));
    console.log("theme:",info.theme.bg,"text:",info.theme.color);
    for(const r of rows) console.log(`${r.n.padEnd(12)} ${r.size.padEnd(5)} op${r.op} ${r.color.padEnd(20)} on rgb(${r.bg?.r},${r.bg?.g},${r.bg?.b}) => ${r.contrast}:1`);
    // restore theme from live data by reloading is unnecessary; but reset so app is coherent
    await ev(`(() => { const r=document.documentElement; r.style.removeProperty('--bg-gradient'); r.style.removeProperty('--text-on-bg'); })()`);
    await send("Emulation.clearDeviceMetricsOverride");
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});