/* Biblioteca de processamento do BI Roldão (lado servidor).
   Porta fiel de aggregate.js (buildSeedFromWorkbook) + mergeSeed (app_boot.js). */
const XLSX = require('xlsx');
const num = v => (typeof v==='number' && isFinite(v))? v : (typeof v==='string'? (parseFloat(v.replace(/\./g,'').replace(',','.'))||0):0);
const S = s => (s==null?'':s.toString().trim());
function ymd(d){
  if(d instanceof Date){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+dd;}
  if(typeof d==='string'){ const m=d.match(/(\d{2})\/(\d{2})\/(\d{4})/); if(m)return m[3]+'-'+m[2]+'-'+m[1]; }
  return null;
}

/* --- resolucao das colunas da aba "Base nova regional" --------------------
   O layout era assumido como fixo: A=nome, B=numero, C=regional. Basta uma
   coluna a mais na planilha de origem para deslocar tudo e fazer "regional"
   receber nome de loja -- exatamente o sintoma visto no seletor Regional.
   Agora as colunas sao localizadas pelo cabecalho e validadas pelo conteudo,
   caindo para os indices antigos quando nada for reconhecido. */
const normTxt = s => String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
function colValues(rows,c){ const out=[]; if(c<0)return out; for(let i=1;i<rows.length;i++){ const r=rows[i]; if(!r)continue; const v=S(r[c]); if(v)out.push(v); } return out; }
function distinctCount(vals){ return new Set(vals.map(normTxt)).size; }
function isNumericCol(rows,c){ let seen=0,nums=0; for(let i=1;i<rows.length&&seen<30;i++){ const r=rows[i]; if(!r)continue; const v=r[c]; if(v==null||v==='')continue; seen++; if(typeof v==='number'||/^\d+$/.test(String(v).trim()))nums++; } return seen>0 && nums/seen>=0.8; }
function resolveStoreColumns(rows){
  const width=rows.reduce((w,r)=>Math.max(w,r?r.length:0),0);
  const hdr=(rows[0]||[]).map(normTxt);
  const find=re=>{ for(let c=0;c<width;c++){ if(hdr[c]&&re.test(hdr[c]))return c; } return -1; };
  let num=find(/^n[.oº°]?$|codigo|^cod\b|numero|loja n/);
  let regional=find(/regional|regiao/);
  let nome=find(/^loja$|nome|filial|unidade/);
  if(num<0||!isNumericCol(rows,num)){ num=-1; for(let c=0;c<width;c++){ if(isNumericCol(rows,c)){num=c;break;} } }
  if(num<0) num=1;
  if(nome<0||nome===num) nome=(num===0?1:0);
  if(regional===num||regional===nome) regional=-1;
  const nomes=new Set(colValues(rows,nome).map(normTxt));
  const pareceRegional=c=>{
    if(c<0||c===num||c===nome) return false;
    const vals=colValues(rows,c); if(!vals.length) return false;
    const d=distinctCount(vals); if(d===0||d>15) return false;
    return vals.filter(v=>nomes.has(normTxt(v))).length/vals.length < 0.5;
  };
  if(!pareceRegional(regional)){
    let melhor=-1,melhorD=Infinity;
    for(let c=0;c<width;c++){ if(!pareceRegional(c))continue; const d=distinctCount(colValues(rows,c)); if(d<melhorD){melhorD=d;melhor=c;} }
    regional=melhor;
  }
  return {nome,num,regional};
}

/* Recebe um workbook SheetJS já lido e retorna o seed (mesma estrutura do aggregate.js). */
function buildSeedFromWorkbook(wb, fileName){
  const aoa = n => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true, defval:null}) : [];

  // ---- lojas canônicas ----
  const bnr = aoa('Base nova regional');
  const stores = {};
  const bnrCols = resolveStoreColumns(bnr);
  if(bnrCols.regional<0) console.warn('Base nova regional: coluna de regional nao identificada — o filtro Regional ficara vazio.');
  else if(bnrCols.nome!==0||bnrCols.num!==1||bnrCols.regional!==2) console.log('Base nova regional: layout diferente do padrao, colunas detectadas ->', JSON.stringify(bnrCols));
  for(let i=1;i<bnr.length;i++){ const r=bnr[i]; if(!r||r[bnrCols.num]==null)continue;
    stores[r[bnrCols.num]]={num:r[bnrCols.num], name:S(r[bnrCols.nome]), regional:bnrCols.regional>=0?S(r[bnrCols.regional]):''}; }
  const bl = aoa('Base loja'); const nameByNum = {};
  for(const r of bl){ if(!r)continue; if(r[0]!=null&&r[1])nameByNum[r[0]]=S(r[1]); if(r[5]!=null&&r[4])nameByNum[r[5]]=S(r[4]); }
  for(const k in stores){ if(nameByNum[k]) stores[k].name = nameByNum[k]; }
  if(!Object.keys(stores).length) throw new Error('Nenhuma loja identificada (aba "Base nova regional").');

  // ---- Base Segmento ----
  const bs = aoa('Base Segmento');
  const dailyStore={}, segStoreMonthly={}, segSet=new Set(); let maxDate='0';
  for(let i=1;i<bs.length;i++){ const r=bs[i]; if(!r||r[0]==null)continue;
    const date=ymd(r[0]); if(!date)continue; const seg=S(r[1]); const loja=r[2]; const v=num(r[5]);
    if(loja==null||!stores[loja])continue;
    segSet.add(seg); if(date>maxDate)maxDate=date;
    (dailyStore[loja]=dailyStore[loja]||{}); dailyStore[loja][date]=(dailyStore[loja][date]||0)+v;
    const ym=date.slice(0,7);
    (segStoreMonthly[loja]=segStoreMonthly[loja]||{}); (segStoreMonthly[loja][seg]=segStoreMonthly[loja][seg]||{});
    segStoreMonthly[loja][seg][ym]=(segStoreMonthly[loja][seg][ym]||0)+v;
  }
  if(maxDate==='0') throw new Error('Não foi possível ler datas/vendas da aba Base Segmento.');
  const curYM=maxDate.slice(0,7); const prevYM=(parseInt(curYM.slice(0,4))-1)+curYM.slice(4); const curYear=parseInt(curYM.slice(0,4));

  // ---- Base de Subcategoria (estende dailyStore só nos dias ausentes) ----
  const bsub = aoa('Base de Subcategoria');
  const subStoreMonthly={}, subSet=new Set(), subDailyStore={};
  for(let i=1;i<bsub.length;i++){ const r=bsub[i]; if(!r||r[0]==null)continue;
    const date=ymd(r[0]); if(!date)continue; const loja=r[1]; const sub=S(r[3]); const v=num(r[4]);
    if(loja==null||!stores[loja])continue; subSet.add(sub);
    const ym=date.slice(0,7);
    (subStoreMonthly[loja]=subStoreMonthly[loja]||{}); (subStoreMonthly[loja][sub]=subStoreMonthly[loja][sub]||{});
    subStoreMonthly[loja][sub][ym]=(subStoreMonthly[loja][sub][ym]||0)+v;
    (subDailyStore[loja]=subDailyStore[loja]||{}); subDailyStore[loja][date]=(subDailyStore[loja][date]||0)+v;
  }
  for(const loja in subDailyStore){ dailyStore[loja]=dailyStore[loja]||{};
    for(const date in subDailyStore[loja]){ if(!(date in dailyStore[loja])) dailyStore[loja][date]=subDailyStore[loja][date]; } }

  // ---- ORÇADO ----
  const orc=aoa('ORÇADO'); const budgetStore={};
  if(orc.length){ const hdr=orc[0]; const seen={};
    hdr.forEach((h,idx)=>{ const d=ymd(h); if(d && d.slice(0,7)===curYM) seen[d]=idx; });
    const dailyCols=Object.keys(seen).sort().map(d=>({idx:seen[d],date:d}));
    for(let i=1;i<orc.length;i++){ const r=orc[i]; if(!r)continue;
      let n=null; for(let c=1;c<6;c++){ if(typeof r[c]==='number'){n=r[c];break;} }
      if(n==null||!stores[n])continue;
      const daily={}; let tot=0; dailyCols.forEach(dc=>{ const v=num(r[dc.idx]); daily[dc.date]=Math.round(v); tot+=v; });
      const lastTotal=num(r[r.length-1]); budgetStore[n]={total:Math.round(lastTotal||tot), daily};
    }
  }

  // ---- Orçado de categoria ----
  const oc=aoa('Orçado de categoria '); const budgetSub=[];
  if(oc.length){ const hdr=oc[0]; const dcs=[]; hdr.forEach((h,idx)=>{ const d=ymd(h); if(d && d.slice(0,7)===curYM)dcs.push(idx); });
    for(let i=1;i<oc.length;i++){ const r=oc[i]; if(!r)continue; const loja=r[1]; const ano=r[2]; const sub=S(r[3]); if(loja==null||!sub||!stores[loja])continue;
      if(ano!=null && +ano!==curYear)continue; let t=0; dcs.forEach(c=>t+=num(r[c])); budgetSub.push({l:+loja,s:sub,t:Math.round(t)}); }
  }

  // ---- pares (venda dia / acumulado) ----
  function pairSheet(name){ const a=aoa(name); const out={}; for(let i=2;i<a.length;i++){ const r=a[i]; if(!r||r[0]==null)continue; out[r[0]]={v26:num(r[1]),v25:num(r[3]),c26:num(r[6]),c25:num(r[8]),t26:num(r[11]),t25:num(r[13])}; } return out; }
  const vendaDia=pairSheet('BASE VENDA DIA '); const vendaAcum=pairSheet('BESE VENDA ACUMULADO ');

  const te=aoa('BASE TELE E ECOMM'); const teleEcomm={};
  for(let i=1;i<te.length;i++){ const r=te[i]; if(!r||r[0]==null)continue; teleEcomm[r[0]]={tele25dia:num(r[1]),tele25acc:num(r[3]),tele26dia:num(r[6]),tele26acc:num(r[8]),ecom25dia:num(r[11]),ecom25acc:num(r[13]),ecom26dia:num(r[16]),ecom26acc:num(r[18])}; }

  const pz=aoa('Piso'); const piso={};
  for(let i=1;i<pz.length;i++){ const r=pz[i]; if(!r||r[0]==null)continue; piso[r[0]]={acc26:num(r[2]),cli26:num(r[3]),tk26:num(r[4]),acc25:num(r[6]),cli25:num(r[7]),tk25:num(r[8]),accPiso26:num(r[24]),accPiso25:num(r[25]),piso2026:num(r[31]),piso2025:num(r[32]),pisoPct:num(r[33])}; }

  // ---- agregados ----
  const companyDaily={}; for(const l in dailyStore)for(const d in dailyStore[l])companyDaily[d]=(companyDaily[d]||0)+dailyStore[l][d];
  const dailyStoreR={}; for(const l in dailyStore){ dailyStoreR[l]={}; for(const d in dailyStore[l]) dailyStoreR[l][d]=Math.round(dailyStore[l][d]); }
  const compDailyR={}; for(const d in companyDaily) compDailyR[d]=Math.round(companyDaily[d]);
  const segSMarr=[]; for(const l in segStoreMonthly)for(const s in segStoreMonthly[l])for(const m in segStoreMonthly[l][s]){ const v=Math.round(segStoreMonthly[l][s][m]); if(v)segSMarr.push({l:+l,s,m,v}); }
  const subSMarr=[]; for(const l in subStoreMonthly)for(const s in subStoreMonthly[l])for(const m in subStoreMonthly[l][s]){ const v=Math.round(subStoreMonthly[l][s][m]); if(v)subSMarr.push({l:+l,s,m,v}); }
  const periodMin=Object.keys(compDailyR).sort()[0];
  const today=new Date().toISOString().slice(0,10);
  const fname=fileName||'importado';

  return {
    meta:{ source:fname, curYM, prevYM, maxDate, generated:today, periodMin, periodMax:maxDate },
    imports:[{file:fname, date:today, periodMin, periodMax:maxDate, curYM}],
    stores: Object.values(stores),
    regionals:[...new Set(Object.values(stores).map(s=>s.regional))],
    segments:[...segSet].sort(),
    subcats:[...subSet].sort(),
    dailyStore: dailyStoreR,
    segStoreMonthly: segSMarr,
    subStoreMonthly: subSMarr,
    budgetStore, budgetSub,
    vendaDia, vendaAcum, teleEcomm, piso
  };
}

/* Mescla incremental (união; nunca apaga; adiciona/atualiza o novo). Igual ao app_boot.js. */
function mergeSeed(base, inc){
  if(!base) return {seed:inc, stats:null};
  const out={};
  const storeMap={}; (base.stores||[]).forEach(s=>storeMap[s.num]=s);
  // Um 'regional' que na verdade e nome de loja nunca pode sobrescrever um valor bom ja conhecido.
  const nomesInc=new Set((inc.stores||[]).map(s=>normTxt(s.name)));
  const newStores=[]; (inc.stores||[]).forEach(s=>{
    if(!storeMap[s.num])newStores.push(s.num);
    const anterior=storeMap[s.num]; const novo=Object.assign({},anterior,s);
    const incRuim = !novo.regional || nomesInc.has(normTxt(novo.regional));
    if(anterior && anterior.regional && incRuim && !nomesInc.has(normTxt(anterior.regional))) novo.regional=anterior.regional;
    storeMap[s.num]=novo;
  });
  out.stores=Object.values(storeMap);
  out.regionals=[...new Set(out.stores.map(s=>s.regional))];
  out.segments=[...new Set([...(base.segments||[]),...(inc.segments||[])])].sort();
  out.subcats=[...new Set([...(base.subcats||[]),...(inc.subcats||[])])].sort();
  const ds={}; const baseDates=new Set();
  for(const l in (base.dailyStore||{})){ ds[l]=Object.assign({},base.dailyStore[l]); for(const d in base.dailyStore[l])baseDates.add(d); }
  const newDates=new Set();
  for(const l in (inc.dailyStore||{})){ ds[l]=ds[l]||{}; for(const d in inc.dailyStore[l]){ if(!baseDates.has(d))newDates.add(d); ds[l][d]=inc.dailyStore[l][d]; } }
  out.dailyStore=ds;
  function mergeMonthly(a,b){ const map=new Map(); (a||[]).forEach(r=>map.set(r.l+'|'+r.s+'|'+r.m,r)); let added=0; (b||[]).forEach(r=>{const k=r.l+'|'+r.s+'|'+r.m; if(!map.has(k))added++; map.set(k,r);}); return {arr:[...map.values()],added}; }
  const sm=mergeMonthly(base.segStoreMonthly,inc.segStoreMonthly); out.segStoreMonthly=sm.arr;
  const um=mergeMonthly(base.subStoreMonthly,inc.subStoreMonthly); out.subStoreMonthly=um.arr;
  const bstore={}; for(const l in (base.budgetStore||{})) bstore[l]={total:base.budgetStore[l].total, daily:Object.assign({},base.budgetStore[l].daily)};
  const baseBudgetDates=new Set(); for(const l in bstore)for(const d in bstore[l].daily)baseBudgetDates.add(d);
  const newBudgetMonths=new Set();
  for(const l in (inc.budgetStore||{})){ const ib=inc.budgetStore[l]; bstore[l]=bstore[l]||{total:0,daily:{}}; for(const d in (ib.daily||{})){ if(!baseBudgetDates.has(d))newBudgetMonths.add(d.slice(0,7)); bstore[l].daily[d]=ib.daily[d]; } if(ib.total!=null)bstore[l].total=ib.total; }
  out.budgetStore=bstore;
  const bsMap=new Map(); (base.budgetSub||[]).forEach(r=>bsMap.set(r.l+'|'+r.s,r)); (inc.budgetSub||[]).forEach(r=>bsMap.set(r.l+'|'+r.s,r)); out.budgetSub=[...bsMap.values()];
  const snap=(a,b)=>Object.assign({},a||{},b||{});
  out.piso=snap(base.piso,inc.piso); out.vendaDia=snap(base.vendaDia,inc.vendaDia); out.vendaAcum=snap(base.vendaAcum,inc.vendaAcum); out.teleEcomm=snap(base.teleEcomm,inc.teleEcomm);
  let maxDate='0',minDate='9999'; const allMonths=new Set();
  for(const l in ds)for(const d in ds[l]){ if(d>maxDate)maxDate=d; if(d<minDate)minDate=d; allMonths.add(d.slice(0,7)); }
  const curYM=maxDate.slice(0,7); const pym=(parseInt(curYM.slice(0,4))-1)+curYM.slice(4);
  out.meta={ source:inc.meta.source, curYM, prevYM:pym, maxDate, generated:inc.meta.generated, periodMin:minDate, periodMax:maxDate };
  out.imports=[...(base.imports||[]),...(inc.imports||[])];
  out.dre = inc.dre || base.dre;   // a DRE é independente da venda: preserva no merge do informativo
  const baseMonths=new Set([...baseDates].map(d=>d.slice(0,7)));
  const newMonths=[...new Set([...newDates].map(d=>d.slice(0,7)))].filter(m=>!baseMonths.has(m));
  const stats={ newStores:newStores.length, newDates:newDates.size, newMonths, newSegRows:sm.added, newSubRows:um.added, newBudgetMonths:[...newBudgetMonths], storesTotal:out.stores.length, mesesTotal:allMonths.size };
  return {seed:out, stats};
}

/* ============ Parser da DRE (Resultado Gerencial) ============ */
/* Recebe o workbook da planilha DRE e retorna o objeto `dre` (mesma estrutura do parse_dre.js). */
function parseDreWorkbook(wb, fileName, today){
  const g=n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null});
  const norm=s=>String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
  const LINES=[
    {key:'qtd_tickets',label:'Qtd de Tickets',group:'topo',kind:'count',m:'qtd de tickets'},
    {key:'ticket_medio',label:'Ticket médio',group:'topo',kind:'ticket',m:'ticket medio'},
    {key:'receita_bruta',label:'Receita Bruta',group:'receita',kind:'money',m:'receita bruta'},
    {key:'deducoes',label:'Deduções',group:'receita',kind:'money',m:'deducoes'},
    {key:'receita_liquida',label:'Receita Líquida',group:'receita',kind:'money',m:'receita liquida'},
    {key:'cmv',label:'CMV',group:'custo',kind:'money',m:'cmv'},
    {key:'verbas',label:'Verbas',group:'custo',kind:'money',m:'verbas'},
    {key:'contratos',label:'Contratos',group:'custo',kind:'money',m:'contratos'},
    {key:'negociacao',label:'Negociação',group:'custo',kind:'money',m:'negociacao'},
    {key:'icms_st',label:'ICMS-ST Port. CAT-42',group:'custo',kind:'money',mp:'icms-st'},
    {key:'operacao_logistica',label:'Operação Logística',group:'custo',kind:'money',m:'operacao logistica'},
    {key:'qi_qni',label:'QI e QNI c/ Verbas',group:'custo',kind:'money',mp:'qi e qni'},
    {key:'cmv_gerencial',label:'CMV Gerencial',group:'custo',kind:'money',m:'cmv gerencial'},
    {key:'lucro_bruto',label:'Lucro Bruto',group:'lb',kind:'money',m:'lucro bruto'},
    {key:'desp_pessoal',label:'Despesas c/ Pessoal',group:'despesa',kind:'money',mp:'despesas c/ pessoal'},
    {key:'ocupacao_p',label:'Ocupação (P)',group:'despesa',kind:'money',m:'ocupacao (p)'},
    {key:'ocupacao_t',label:'Ocupação (T)',group:'despesa',kind:'money',m:'ocupacao (t)'},
    {key:'utilidades',label:'Utilidades e Serviços',group:'despesa',kind:'money',mp:'utilidades e servico'},
    {key:'manutencao',label:'Manutenção e Conservação',group:'despesa',kind:'money',mp:'manutencao e conserv'},
    {key:'outras_rec_desp',label:'Outras Receitas e Despesas',group:'despesa',kind:'money',mp:'outras receitas e desp'},
    {key:'desp_gerais',label:'Despesas Gerais',group:'despesa',kind:'money',m:'despesas gerais'},
    {key:'impostos',label:'Impostos e Taxas',group:'despesa',kind:'money',mp:'impostos e taxa'},
    {key:'leasing',label:'Leasing e Aluguéis',group:'despesa',kind:'money',mp:'leasing e alug'},
    {key:'dados_com',label:'Dados e Comunicação',group:'despesa',kind:'money',mp:'dados e comunic'},
    {key:'juridico',label:'Processos Jurídicos',group:'despesa',kind:'money',mp:'processos juridic'},
    {key:'propaganda',label:'Propaganda e Publicidade',group:'despesa',kind:'money',mp:'propaganda e public'},
    {key:'serv_prof',label:'Serviços Profissionais',group:'despesa',kind:'money',mp:'servicos profissiona'},
    {key:'despesas_total',label:'Despesas (total)',group:'despesa',kind:'money',m:'despesas'},
    {key:'mrg_ebitda',label:'Margem EBITDA',group:'ebitda',kind:'money',m:'mrg ebitda'},
    {key:'rateio',label:'Rateio',group:'ebitda',kind:'money',m:'rateio'},
    {key:'mrg_ebitda_rateio',label:'EBITDA c/ rateio',group:'ebitda',kind:'money',mp:'mrg ebitda c/ rateio'},
    {key:'depreciacao',label:'Depreciação e Amortização',group:'resultado',kind:'money',mp:'depreciacao e amort'},
    {key:'resultado_financeiro',label:'Resultado Financeiro',group:'resultado',kind:'money',m:'resultado financeiro'},
    {key:'resultado_nao_op',label:'Resultado não operacional',group:'resultado',kind:'money',mp:'resultado nao operac'},
    {key:'lair',label:'LAIR (Resultado antes IR)',group:'resultado',kind:'money',m:'lair'},
    {key:'quadro_pessoal',label:'Quadro de Pessoal',group:'op',kind:'count',m:'quadro de pessoal'},
    {key:'custo_medio_colab',label:'Custo Médio/Colaborador',group:'op',kind:'money',mp:'custo medio'},
    {key:'metragem',label:'Metragem (área de vendas)',group:'op',kind:'area',mp:'metragem'},
  ];
  const MONTHTABS=[['Fev','02'],['Mar','03'],['Abr','04'],['Mai','05'],['Jun','06'],['Jul','07'],['Ago','08'],['Set','09'],['Out','10'],['Nov','11'],['Dez','12']];
  const YEAR='2026';
  const REGMAP={'regional interior':'Interior','regional grande sp':'Grande SP','regional oeste':'Oeste','regional baixada abc':'Baixada/ABC'};
  const rowIndex=(R,line)=>{ for(let i=0;i<R.length;i++){ const lab=norm(R[i]&&R[i][0]); if(!lab)continue;
    if(line.m&&lab===line.m)return i; if(line.mp&&lab.startsWith(line.mp))return i; } return -1; };
  const colMap=R=>{ const reg=R[3]||[],nm=R[4]||[]; const cols=[]; let totalCol=-1;
    for(let c=1;c<nm.length;c++){ const name=String(nm[c]==null?'':nm[c]).trim(); if(!name)continue;
      if(norm(name)==='total'){totalCol=c;continue;} if(['matriz','cd barueri'].includes(norm(name)))continue;
      const rg=REGMAP[norm(reg[c])]; if(!rg)continue; cols.push({name,regional:rg,col:c}); } return {cols,totalCol}; };
  // estrutura base a partir de uma aba populada (procura a primeira com Receita Bruta Total numérica)
  let baseTab=null; for(const [tab,mm] of MONTHTABS){ if(!wb.SheetNames.includes(tab))continue; const R=g(tab); const {totalCol}=colMap(R);
    const rbLine=LINES.find(l=>l.key==='receita_bruta'); const ri=rowIndex(R,rbLine); if(ri>=0&&totalCol>=0&&typeof R[ri][totalCol]==='number'&&R[ri][totalCol]!==0){ baseTab=R; break; } }
  if(!baseTab){ throw new Error('DRE: nenhuma aba de mês com dados encontrada'); }
  const {cols:STORECOLS}=colMap(baseTab);
  const stores=STORECOLS.map(s=>({name:s.name,regional:s.regional}));
  const regionais=['Interior','Grande SP','Oeste','Baixada/ABC'];
  const data={}, total={}; const monthsSet=new Set(); stores.forEach(s=>data[s.name]={});
  for(const [tab,mm] of MONTHTABS){ if(!wb.SheetNames.includes(tab))continue; const R=g(tab); const {cols,totalCol:tc}=colMap(R);
    const ridx={}; LINES.forEach(l=>ridx[l.key]=rowIndex(R,l));
    const rbTot=ridx.receita_bruta>=0&&tc>=0?R[ridx.receita_bruta][tc]:null;
    if(!(typeof rbTot==='number'&&rbTot!==0))continue;
    const ym=YEAR+'-'+mm; monthsSet.add(ym); const scaleOf=l=>l.kind==='money'?1000:1;
    cols.forEach(cd=>{ const st=stores.find(s=>s.name===cd.name); if(!st)return;
      LINES.forEach(l=>{ const ri=ridx[l.key]; if(ri<0)return; const v=R[ri][cd.col];
        if(typeof v==='number'&&(v!==0||l.kind!=='money')){ (data[cd.name][l.key]=data[cd.name][l.key]||{})[ym]=v*scaleOf(l); } }); });
    if(tc>=0){ LINES.forEach(l=>{ const ri=ridx[l.key]; if(ri<0)return; const v=R[ri][tc];
      if(typeof v==='number'){ (total[l.key]=total[l.key]||{})[ym]=v*scaleOf(l); } }); }
  }
  const months=[...monthsSet].sort();
  const nP=stores.filter(s=>data[s.name].receita_bruta).length;
  const dre={ updated:today||null, source:fileName||'DRE.xlsx', unit:'R$', months, lines:LINES.map(({m,mp,...r})=>r), regionais, stores, data, total };
  return { dre, stats:{ months, storesTotal:stores.length, storesComPnL:nP } };
}

module.exports = { buildSeedFromWorkbook, mergeSeed, parseDreWorkbook };
