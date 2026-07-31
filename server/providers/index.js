function clean(value='') { return String(value).replace(/\s+/g, ' ').trim(); }
function compactPart(value='') { return clean(value).toUpperCase().replace(/\s*[-–—]\s*/g, '-'); }
function matchCode(text, patterns=[]) { for (const pattern of patterns) { const hit=String(text||'').match(pattern); if(hit) return compactPart(hit[0]); } return ''; }

const providers = [
  {
    id:'siemens', name:'Siemens', domains:['siemens.com','support.industry.siemens.com','mall.industry.siemens.com'],
    match:({manufacturer,partNumber,model,rawText,query})=>/siemens|simatic|sitop/i.test(`${manufacturer} ${model} ${rawText} ${query}`)||/\b(?:6ES7|6SL|6EP1|3RT|7ML)[A-Z0-9 -]+/i.test(`${partNumber} ${rawText} ${query}`),
    normalize(data){const joined=`${data.partNumber||''}\n${data.model||''}\n${data.rawText||''}\n${data.query||''}`;const part=matchCode(joined,[/\b6ES7\s*[0-9A-Z]{3}\s*-?\s*[0-9A-Z]{4,5}\s*-?\s*[0-9A-Z]{4}\b/i,/\b6EP1\s*[0-9A-Z]{3}\s*-?\s*[0-9A-Z]{5}\b/i,/\b6SL[0-9A-Z -]{8,}\b/i,/\b3RT[0-9A-Z -]{6,}\b/i,/\b7ML[0-9A-Z -]{6,}\b/i]);return{...data,manufacturer:data.manufacturer||'Siemens',partNumber:part||compactPart(data.partNumber)};},
    officialHint:'Suche zuerst bei Siemens Industry Online Support, SiePortal und offiziellen Siemens-PDFs. Nutze die MLFB/Bestellnummer exakt.'
  },
  {
    id:'shimano', name:'Shimano', domains:['shimano.com','si.shimano.com'],
    match:({manufacturer,rawText,query})=>/shimano|deore/i.test(`${manufacturer} ${rawText} ${query}`),
    normalize(data){const part=matchCode(`${data.partNumber||''} ${data.rawText||''} ${data.query||''}`,[/\b(?:RD|FD|SL|BR|FC)-[A-Z0-9-]+\b/i]);return{...data,manufacturer:data.manufacturer||'Shimano',partNumber:part||compactPart(data.partNumber)};},
    officialHint:'Suche zuerst in Shimano Technical Documents, Explosionszeichnungen und Händlerhandbüchern.'
  },
  {id:'pfeiffer',name:'Pfeiffer Vacuum',domains:['pfeiffer-vacuum.com'],match:d=>/pfeiffer|vacuum|pbt 200/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>({...d,manufacturer:d.manufacturer||'Pfeiffer Vacuum',partNumber:compactPart(d.partNumber)}),officialHint:'Suche zuerst bei Pfeiffer Vacuum nach Produktseite, Betriebsanleitung, Datenblatt und Ersatzteilen.'},
  {id:'heidenhain',name:'HEIDENHAIN',domains:['heidenhain.com','heidenhain.de'],match:d=>/heidenhain|endat|pdp03/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>({...d,manufacturer:d.manufacturer||'HEIDENHAIN',partNumber:compactPart(d.partNumber)}),officialHint:'Suche zuerst bei HEIDENHAIN nach Produktdokumentation, Schnittstellenbeschreibung und ID-Nummer.'},
  {id:'phoenix',name:'Phoenix Contact',domains:['phoenixcontact.com'],match:d=>/phoenix contact|mcr-f-ui-dc/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>({...d,manufacturer:d.manufacturer||'Phoenix Contact',partNumber:compactPart(d.partNumber)}),officialHint:'Suche zuerst bei Phoenix Contact nach Produktseite, Datenblatt, Anschlussplan und Downloads.'},
  {id:'schneider',name:'Schneider Electric',domains:['se.com','schneider-electric.com'],match:d=>/schneider|telemecanique|zcp21/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>{const hit=matchCode(`${d.partNumber||''} ${d.model||''} ${d.query||''} ${d.rawText||''}`,[/\bZCP[0-9A-Z-]+\b/i]);return({...d,manufacturer:d.manufacturer||'Schneider Electric',partNumber:hit||compactPart(d.partNumber||d.model)})},officialHint:'Suche zuerst bei Schneider Electric beziehungsweise Telemecanique Sensors nach Produktdaten und Nachfolgern.'},
  {id:'gossen',name:'Gossen Metrawatt',domains:['gossenmetrawatt.com'],match:d=>/gossen|metrawatt|profitest/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>({...d,manufacturer:d.manufacturer||'Gossen Metrawatt',partNumber:compactPart(d.partNumber)}),officialHint:'Suche zuerst bei Gossen Metrawatt nach Bedienungsanleitung, Messfunktion und technischen Daten.'},
  {id:'siebert',name:'Siebert',domains:['siebert-group.com','siebert.de'],match:d=>/siebert/i.test(`${d.manufacturer} ${d.model} ${d.rawText} ${d.query}`),normalize:d=>({...d,manufacturer:d.manufacturer||'Siebert',partNumber:compactPart(d.partNumber)}),officialHint:'Suche zuerst bei Siebert nach Anzeige-, Profibus- und Geräteunterlagen.'}
];

const generic={id:'generic',name:'Unbekannter Hersteller',domains:[],normalize:d=>({...d,partNumber:compactPart(d.partNumber)}),officialHint:'Ermittle zuerst den Hersteller und bevorzuge anschließend dessen offizielle Produktseiten und Originaldokumente.'};
export function selectProvider(data){return providers.find(p=>p.match(data))||generic;}
export function normalizeIdentifiers(data){const base={manufacturer:clean(data.manufacturer),productFamily:clean(data.productFamily),partNumber:clean(data.partNumber),model:clean(data.model),serialNumber:clean(data.serialNumber),errorCode:clean(data.errorCode),rawText:clean(data.rawText),query:clean(data.query)};const provider=selectProvider(base);return{provider:provider.id,providerName:provider.name,domains:provider.domains,data:provider.normalize(base),officialHint:provider.officialHint};}
export function providerCatalog(){return providers.map(({id,name,domains})=>({id,name,domains}));}
