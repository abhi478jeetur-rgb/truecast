const ws = new WebSocket(process.argv[2]);
let id=0; const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("DOM.enable"); await send("CSS.enable"); await send("Runtime.enable");
    const {root} = await send("DOM.getDocument",{depth:-1});
    const targets = [
      ["hero", "span.text-dynamic.text-\\[96px\\]"],
      ["condition", "span.text-2xl"],
      ["section", "h3"],
      ["date", "div.text-dynamic\\\\/90.text-sm"],
      ["pill", "button.app-region-no-drag"]
    ];
    for (const [name, sel] of targets) {
      try {
        const {nodeId} = await send("DOM.querySelector",{nodeId:root.nodeId, selector: sel});
        if (!nodeId) { console.log(name, "not found", sel); continue; }
        const r = await send("CSS.getPlatformFontsForNode",{nodeId});
        console.log(name, JSON.stringify(r.fonts));
      } catch (e) { console.log(name, "ERR", e.message.slice(0,120)); }
    }
    console.log("fonts check:", JSON.stringify(await ev(`({
      sf: document.fonts.check('16px "SF Pro Text"'),
      segoe: document.fonts.check('16px "Segoe UI"'),
      roboto: document.fonts.check('16px Roboto'),
      arial: document.fonts.check('16px Arial'),
      helvetica: document.fonts.check('16px "Helvetica Neue"'),
      dejavu: document.fonts.check('16px "DejaVu Sans"')
    })`)));
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.stack||e.message);ws.close();process.exit(1)}
});