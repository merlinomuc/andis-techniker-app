import {Activity, RotateCw, Search} from 'lucide-react';

function n(value){return Number.isFinite(Number(value))?Number(value):0;}
function collect(usages=[]){
  return usages.filter(Boolean).reduce((sum,u)=>({
    input:sum.input+n(u.input_tokens),
    output:sum.output+n(u.output_tokens),
    total:sum.total+n(u.total_tokens || n(u.input_tokens)+n(u.output_tokens))
  }),{input:0,output:0,total:0});
}

export default function UsageSummary({vision,research}){
  const usages=research?[research.usage?.official,research.usage?.broad]:[vision?.usage||vision];
  const totals=collect(usages);
  const searches=research?[research.officialResponseId?1:0,research.broadResponseId?1:0].reduce((a,b)=>a+b,0):0;
  const retries=research?[research.officialMeta?.retried,research.broadMeta?.retried].filter(Boolean).length:(vision?.retry?1:0);
  if(!totals.total&&!searches&&!retries)return null;
  return <details className="usage-summary"><summary><Activity size={17}/> API-Verbrauch dieser Analyse</summary><div className="usage-grid">
    <div><span>Eingabe</span><b>{totals.input.toLocaleString('de-DE')} Tokens</b></div>
    <div><span>Ausgabe</span><b>{totals.output.toLocaleString('de-DE')} Tokens</b></div>
    {searches>0&&<div><span><Search size={13}/> Websuchen</span><b>{searches}</b></div>}
    <div><span><RotateCw size={13}/> Wiederholungen</span><b>{retries}</b></div>
  </div><p>Das ist eine Verbrauchsanzeige, keine exakte Kostenabrechnung. Das gesetzte Tokenlimit allein verursacht keine Kosten.</p></details>;
}
