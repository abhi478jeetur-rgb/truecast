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
    await send("Accessibility.enable");await send("Runtime.enable");
    if(!(await ev(`!!document.querySelector('input[placeholder="Enter city name"]')`))){
      await ev(`document.querySelector('button.app-region-no-drag')?.click()`); await sleep(600);
    }
    await ev(`(() => { const i=document.querySelector('input[placeholder="Enter city name"]'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,'San'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(2500);
    const {nodes}=await send("Accessibility.getFullAXTree");
    fs.writeFileSync(OUT+"/ax-modal.json",JSON.stringify(nodes,null,2));
    const interesting=nodes.filter(n=>["button","textbox","dialog","heading","list","listitem","paragraph"].includes(n.role?.value));
    const summary=interesting.map(n=>({role:n.role.value,name:n.name?.value||"",desc:n.description?.value||"",focusable:n.properties?.find(p=>p.name==="focusable")?.value?.value,modal:n.properties?.find(p=>p.name==="modal")?.value?.value}));
    console.log("counts:", JSON.stringify(summary.reduce((a,s)=>{a[s.role]=(a[s.role]||0)+1;return a},{})));
    console.log("unnamed buttons:", summary.filter(s=>s.role==="button"&&!s.name).length);
    console.log(JSON.stringify(summary.slice(0,14),null,1));
    // close via Cancel
    await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel')?.click()`);
    await sleep(500);
    console.log("focus after close:", await ev(`({tag:document.activeElement.tagName, text:(document.activeElement.innerText||'').trim().slice(0,30)})`));
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});