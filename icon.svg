async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
  const type=r.headers.get('content-type')||'';const raw=await r.text();
  if(!type.includes('application/json')){const e=new Error(`Der Server lieferte ${type||'einen unbekannten Inhaltstyp'} statt JSON. Wahrscheinlich läuft ein falscher oder veralteter API-Endpunkt.`);e.code='API_RETURNED_NON_JSON';e.details={status:r.status,preview:raw.slice(0,180),url};throw e;}
  let data={};try{data=raw?JSON.parse(raw):{};}catch{const e=new Error('Die Serverantwort war kein gültiges JSON.');e.code='API_INVALID_JSON';e.details={status:r.status,preview:raw.slice(0,180),url};throw e;}
  if(!r.ok){const e=new Error(data.error||'Anfrage fehlgeschlagen');e.code=data.code;e.details=data.details;throw e;}return data;
}
export const readVision=payload=>post('/api/vision/read',payload);
export const researchProduct=payload=>post('/api/research/product',payload);
export const researchText=payload=>post('/api/research/text',payload);
