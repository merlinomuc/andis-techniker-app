import test from 'node:test'; import assert from 'node:assert/strict'; import {normalizeIdentifiers} from '../providers/index.js';
const cases=[
 ['Siemens S7','6ES7 318-3FL01-0AB0','siemens','6ES7 318-3FL01-0AB0'],
 ['Siemens SITOP','6EP1 436-3BA00','siemens','6EP1 436-3BA00'],
 ['Shimano','SHIMANO DEORE LX RD-M581','shimano','RD-M581'],
 ['Phoenix','Phoenix Contact MCR-f-UI-DC','phoenix',''],
 ['HEIDENHAIN','Gateway Profibus-DP EnDat22 PDP03','heidenhain',''],
 ['Schneider','ZCP21 Telemecanique','schneider','ZCP21']
];
for(const [name,text,provider,part] of cases)test(`Provider: ${name}`,()=>{const out=normalizeIdentifiers({query:text,rawText:text});assert.equal(out.provider,provider);if(part)assert.equal(out.data.partNumber,part);});
test('Unbekannter Typ bleibt generisch',()=>{const out=normalizeIdentifiers({query:'ABC-123 exotisches Gerät'});assert.equal(out.provider,'generic');});
