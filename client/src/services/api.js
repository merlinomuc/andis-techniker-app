async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(data.error||'Anfrage fehlgeschlagen');e.code=data.code;e.details=data.details;throw e;}return data;}
export const readVision=payload=>post('/api/vision/read',payload);
export const researchProduct=payload=>post('/api/research/product',payload);
