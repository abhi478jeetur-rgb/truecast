const ws = new WebSocket(process.argv[2]);
let id=0; const p=new Map();
const send=(m,pr={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const reqs = [];
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);
  if(m.method==="Network.requestWillBeSent" && /open-meteo\.com/.test(m.params.request.url)) reqs.push({url:m.params.request.url.slice(0,140), t:Date.now()});
  if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result)}});
ws.addEventListener("open",async()=>{
  try{
    await send("Network.enable"); await send("Page.enable");
    await send("Page.reload",{ignoreCache:true});
    await sleep(9000);
    const uniq = new Set(reqs.map(r=>r.url));
    console.log("forecast/geocode requests fired:", reqs.length, "unique URLs:", uniq.size);
    for (const r of reqs) console.log(" -", r.url);
    ws.close();process.exit(0);
  }catch(e){console.error("ERR",e.message);ws.close();process.exit(1)}
});