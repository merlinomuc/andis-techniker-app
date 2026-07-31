function clean(value='') { return String(value).replace(/\s+/g, ' ').trim(); }
function compactPart(value='') { return clean(value).toUpperCase().replace(/\s*[-–—]\s*/g, '-'); }
const providers = [
  {
    id: 'siemens', match: ({manufacturer, partNumber, rawText}) => /siemens/i.test(manufacturer || rawText) || /\b(?:6ES7|6SL|3RT|7ML)[A-Z0-9 -]+/i.test(partNumber || rawText),
    normalize(data) {
      const joined = `${data.partNumber || ''}\n${data.rawText || ''}`;
      const hit = joined.match(/\b(6ES7|6SL|3RT|7ML)\s*([0-9A-Z]{3})\s*-?\s*([0-9A-Z]{4})\s*-?\s*([0-9A-Z]{4})\b/i);
      return { ...data, manufacturer: data.manufacturer || 'Siemens', partNumber: hit ? `${hit[1].toUpperCase()} ${hit[2].toUpperCase()}-${hit[3].toUpperCase()}-${hit[4].toUpperCase()}` : compactPart(data.partNumber) };
    },
    researchHint: 'Bevorzuge Siemens Industry Online Support, SiePortal und offizielle Siemens-PDFs. Suche nach MLFB/Bestellnummer exakt.'
  },
  {
    id: 'shimano', match: ({manufacturer, rawText}) => /shimano|deore/i.test(manufacturer || rawText),
    normalize(data) { const hit = `${data.partNumber || ''} ${data.rawText || ''}`.match(/\b(?:RD|FD|SL|BR|FC)-[A-Z0-9-]+\b/i); return { ...data, manufacturer: data.manufacturer || 'Shimano', partNumber: hit?.[0]?.toUpperCase() || compactPart(data.partNumber) }; },
    researchHint: 'Bevorzuge Shimano Technical Documents, Explosionszeichnungen und Händlerhandbücher.'
  }
];
export function selectProvider(data) { return providers.find(p => p.match(data)) || { id:'generic', normalize:d=>({...d, partNumber:compactPart(d.partNumber)}), researchHint:'Bevorzuge offizielle Herstellerquellen und Originaldokumente.' }; }
export function normalizeIdentifiers(data) { const provider = selectProvider(data); return { provider: provider.id, data: provider.normalize(data), researchHint: provider.researchHint }; }
