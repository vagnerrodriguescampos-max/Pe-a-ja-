/* Base de teste com a forma exata que parseDreWorkbook produz.
   As linhas da DRE são extraídas do próprio parser (bi-roldao-api/lib.js) em vez
   de copiadas: uma cópia envelhece em silêncio e o teste passaria a validar um
   formato que a produção não gera mais. */
const LINES = (() => {
  const src = require('fs').readFileSync(
    process.env.LIB_JS || '/home/user/Pe-a-ja-/bi-roldao-api/lib.js', 'utf8');
  const ini = src.indexOf('const LINES=[');
  const fim = src.indexOf('\n  ];', ini);
  if (ini < 0 || fim < 0) throw new Error('nao achei a tabela LINES em lib.js');
  return eval('(' + src.slice(src.indexOf('[', ini), fim + 4) + ')');
})();

const REG=['Interior','Grande SP','Oeste','Baixada/ABC'];
const NOMES=['SOROCABA','CAMPINAS','JUNDIAI','ITU','SALTO','MOOCA','IPIRANGA','SANTANA','GUARULHOS',
 'BUTANTA','OSASCO','JANDIRA','SANTOS','GUARUJA','MAUA','SAO VICENTE'];
const meses=['2026-03','2026-04','2026-05','2026-06','2026-07'];

const stores=NOMES.map((n,i)=>({name:n,regional:REG[i%4]}));
const data={}, total={};
stores.forEach(s=>data[s.name]={});

function set(o,k,ym,v){ (o[k]=o[k]||{})[ym]=v; }

stores.forEach((s,idx)=>{
  // 3 lojas sem P&L, para exercitar o caminho "aguardando fonte"
  if(idx>=13) return;
  meses.forEach((ym,mi)=>{
    const cresc = 1 + mi*0.015 + (mi===4?0.04:0);      // salto em julho
    const rb = (7_000_000 + idx*420_000) * cresc;
    const ded = -rb*0.11;
    const rl = rb+ded;
    /* Cada loja opera com um CMV próprio: sem isso todas terminam com a mesma
       margem EBITDA e os rankings de melhores/piores ficam empatados, o que
       esconderia exatamente o defeito de ordenação que eles deveriam expor. */
    const eficiencia = 0.74 + (idx % 7) * 0.014;      // 74% a 82% de CMV s/ RL
    const cmv = -rl*eficiencia * (mi===4?1.03:1);      // CMV pesa mais em julho
    const lb = rl+cmv;
    const desps = {
      desp_pessoal:-rb*0.055*(mi===4?1.12:1), ocupacao_p:-rb*0.008, ocupacao_t:-rb*0.004,
      utilidades:-rb*0.009, manutencao:-rb*0.003, outras_rec_desp:rb*0.002,
      desp_gerais:-rb*0.006, impostos:-rb*0.002, leasing:-rb*0.004,
      dados_com:-rb*0.0015*(mi===4?1.9:1), juridico:-rb*0.0008,
      propaganda:-rb*0.004, serv_prof:-rb*0.0025,
    };
    const dTot=Object.values(desps).reduce((a,b)=>a+b,0);
    const eb = lb+dTot;
    const rateio=-rb*0.004, ebr=eb+rateio;
    const dep=-rb*0.012, rfin=-rb*0.006, rnop=rb*0.0005;
    const lair=ebr+dep+rfin+rnop;
    const o=data[s.name];
    set(o,'receita_bruta',ym,rb); set(o,'deducoes',ym,ded); set(o,'receita_liquida',ym,rl);
    set(o,'cmv',ym,cmv); set(o,'lucro_bruto',ym,lb);
    Object.keys(desps).forEach(k=>set(o,k,ym,desps[k]));
    set(o,'despesas_total',ym,dTot); set(o,'mrg_ebitda',ym,eb);
    set(o,'rateio',ym,rateio); set(o,'mrg_ebitda_rateio',ym,ebr);
    set(o,'depreciacao',ym,dep); set(o,'resultado_financeiro',ym,rfin);
    set(o,'resultado_nao_op',ym,rnop); set(o,'lair',ym,lair);
    set(o,'qtd_tickets',ym,Math.round(rb/95)); set(o,'ticket_medio',ym,95);
    set(o,'quadro_pessoal',ym,120+idx); set(o,'metragem',ym,3800+idx*90);
    // uma conta que só aparece em julho, para exercitar o alerta de conta nova
    if(mi===4) set(o,'icms_st',ym,-rb*0.011);
  });
});
// total da rede = soma das lojas
LINES.forEach(({key:k})=>{ meses.forEach(ym=>{
  let s=null; stores.forEach(st=>{ const v=data[st.name][k]&&data[st.name][k][ym]; if(v!=null) s=(s||0)+v; });
  if(s!=null) set(total,k,ym,s);
});});

/* ---- restante da base (vendas), só o suficiente para o BI carregar ----
   O alvo do teste é a DRE; as demais páginas precisam apenas de uma base
   coerente para que render() e generateAlerts() não quebrem. */
const nums = stores.map((s,i)=>i+2);
const diasDoMes = ym => { const [y,m]=ym.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({length:n},(_,i)=>ym+'-'+String(i+1).padStart(2,'0')); };
const mesesVenda = ['2025-07','2026-06','2026-07'];   // inclui o ano anterior p/ comparativo

const dailyStore={}, budgetStore={}, piso={}, teleEcomm={}, vendaDia={}, vendaAcum={};
const segStoreMonthly=[], subStoreMonthly=[], budgetSub=[];
const SEG=['MERCEARIA','PERECIVEIS','BAZAR','FRIOS'];
const SUB=['ALTO GIRO','ACOUGUE','BAZAR','CONGELADOS','FLV','LIMPEZA'];

nums.forEach((n,idx)=>{
  const base = 180_000 + idx*9_000;
  dailyStore[n]={}; budgetStore[n]={daily:{}};
  mesesVenda.forEach(ym=>{
    const fator = ym==='2025-07' ? 0.95 : (ym==='2026-07' ? 1.06 : 1.0);
    diasDoMes(ym).forEach((d,di)=>{
      /* Padrão semanal real: sábado é o pico do varejo, domingo cai.
         Sem isso o gráfico de melhor dia da semana daria sete barras iguais e
         não provaria nada. */
      const dow = new Date(d + 'T12:00:00').getDay();
      const peso = [0.72, 0.95, 0.93, 0.97, 1.02, 1.18, 1.35][dow];
      const v = base*fator*peso*(1 + Math.sin(di/3)*0.06);
      dailyStore[n][d]=Math.round(v);
      if(ym!=='2026-07') budgetStore[n].daily[d]=Math.round(v*1.05);
    });
    SEG.forEach((s,si)=>segStoreMonthly.push({l:n,s,m:ym,v:Math.round(base*28*(0.4-si*0.09))}));
    SUB.forEach((s,si)=>subStoreMonthly.push({l:n,s,m:ym,v:Math.round(base*28*(0.28-si*0.04))}));
  });
  SUB.forEach(s=>budgetSub.push({l:n,s,t:Math.round(base*28*0.2)}));
  const acc26 = base*28*7, acc25 = acc26*0.96;
  piso[n]={acc26,acc25,cli26:Math.round(acc26/95),cli25:Math.round(acc25/95),
    piso2026:acc26*0.82,piso2025:acc25*0.85,accPiso26:acc26,accPiso25:acc25};
  teleEcomm[n]={tele26acc:acc26*0.04,tele25acc:acc25*0.035,ecom26acc:acc26*0.02,ecom25acc:acc25*0.014};
  vendaDia[n]={v:Math.round(base)};
  vendaAcum[n]={v:Math.round(acc26)};
});

const seed={
  meta:{ maxDate:'2026-07-31', updated:'2026-08-27', curYM:'2026-07',
         periodMin:'2025-07-01', periodMax:'2026-07-31', source:'Base de teste (sintética)' },
  imports:[{date:'2026-08-27',file:'teste.xlsx',rows:12345}],
  stores:stores.map((s,i)=>({num:i+2,name:s.name,regional:s.regional.toUpperCase()})),
  regionals:REG.map(r=>r.toUpperCase()),
  segments:SEG, subcats:SUB,
  dailyStore, budgetStore, budgetSub, segStoreMonthly, subStoreMonthly,
  piso, teleEcomm, vendaDia, vendaAcum,
  dre:{ updated:'2026-08-27', source:'DRE.xlsx', unit:'R$', months:meses,
        lines:LINES, regionais:REG, stores, data, total }
};
require('fs').writeFileSync(process.argv[2], JSON.stringify(seed));
console.log('seed de teste:', stores.length,'lojas |',meses.length,'meses de DRE | 13 com P&L, 3 aguardando fonte');
