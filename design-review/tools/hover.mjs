import fs from "node:fs";
import { execFileSync } from "node:child_process";
const ws = new WebSocket(process.argv[2]);
let id=0; const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const OUT="/home/tarun-bansal/dev/weather-app/design-review/evidence-deep";
const shot=async(n)=>{const r=await send("Page.captureScreenshot",{format:"png",fromSurface:true});const f=OUT+"/"+n;fs.writeFileSync(f,Buffer.from(r.data,"base64"));return f};
const md5=(f)=>execFileSync("md5sum",[f]).toString().split(" ")[0];
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Page.enable"); await send("Runtime.enable");
    await ev(`document.querySelector('.overflow-y-auto').scrollTo(0,0)`); await sleep(300);
    await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:2,y:300}); await sleep(400);
    const before = await shot("23a-hover-before.png");
    const box = await ev(`(() => { const el=[...document.querySelectorAll('div')].find(e=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\n/.test((e.innerText||'').trim()) && e.getBoundingClientRect().width>300 && e.getBoundingClientRect().height<80); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,rect:{x:r.x,y:r.y,w:r.width,h:r.height}, bg:getComputedStyle(el).backgroundColor}; })()`);
    console.log("row", JSON.stringify(box));
    await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:Math.round(box.x),y:Math.round(box.y)});
    await sleep(700);
    const after = await shot("23b-hover-dayrow.png");
    console.log("changed:", md5(before)!==md5(after), md5(before).slice(0,8), md5(after).slice(0,8));
    // now sample the day row's max/min text contrast on the hovered state
    const txt = await ev(`(() => {
      const el=[...document.querySelectorAll('div')].find(e=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\n/.test((e.innerText||'').trim()) && e.getBoundingClientRect().width>300 && e.getBoundingClientRect().height<80);
      const leaves=[...el.querySelectorAll('span')].filter(s=>s.children.length===0).map(s=>({t:s.innerText.trim(), op:getComputedStyle(s).opacity, color:getComputedStyle(s).color, x:Math.round(s.getBoundingClientRect().x), y:Math.round(s.getBoundingClientRect().y), w:Math.round(s.getBoundingClientRect().width), h:Math.round(s.getBoundingClientRect().height)}));
      return leaves;
    })()`);
    console.log("leaves", JSON.stringify(txt));
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});