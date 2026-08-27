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
function linhasDeLoja(rows,cNum){ const out=[]; for(let i=1;i<rows.length;i++){ const r=rows[i]; if(r&&r[cNum]!=null&&S(r[cNum])!=='')out.push(i); } return out; }
/* Cobertura = em quantas das linhas que TEM loja a coluna tambem tem valor.
   E o teste que separa um atributo da loja de uma lista avulsa parada ao lado
   da tabela: o atributo acompanha todas as linhas, a lista acaba nas primeiras. */
function cobertura(rows,c,linhas){ if(c<0||!linhas.length)return 0; let n=0; for(const i of linhas){ const r=rows[i]; if(r&&S(r[c])!=='')n++; } return n/linhas.length; }
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

  const linhas=linhasDeLoja(rows,num);
  const nomes=new Set(colValues(rows,nome).map(normTxt));
  const diagnostico=[];

  /* Uma coluna so e o regional da loja se ela existir em praticamente TODA linha
     que tem loja. Ja aconteceu de a planilha trazer, a direita da tabela, uma
     legenda com os nomes das regionais: ela passa em qualquer teste de conteudo
     (poucos valores distintos, texto de regional) e mesmo assim nao pertence a
     loja daquela linha -- as primeiras lojas saem trocadas e as demais vazias.
     A cobertura e o que derruba esse caso. */
  const COBERTURA_MINIMA=0.9;
  const avalia=c=>{
    if(c<0||c===num||c===nome) return null;
    const vals=colValues(rows,c); if(!vals.length) return null;
    const d=distinctCount(vals);
    const cob=cobertura(rows,c,linhas);
    const propNomeLoja=vals.filter(v=>nomes.has(normTxt(v))).length/vals.length;
    const numerica=isNumericCol(rows,c);
    const ok = d>=2 && d<=15 && propNomeLoja<0.5 && cob>=COBERTURA_MINIMA && !numerica;
    return {col:c, distintos:d, cobertura:Number(cob.toFixed(3)), propNomeLoja:Number(propNomeLoja.toFixed(3)), numerica, ok,
            cabecalho:S((rows[0]||[])[c]), exemplos:[...new Set(vals)].slice(0,4)};
  };
  for(let c=0;c<width;c++){ const a=avalia(c); if(a)diagnostico.push(a); }

  const candidatos=diagnostico.filter(a=>a.ok);
  const escolhida=regional>=0 ? diagnostico.find(a=>a.col===regional&&a.ok) : null;
  if(escolhida){
    regional=escolhida.col;
  } else {
    /* Sem cabecalho confiavel, vale a coluna que melhor se comporta como
       atributo: primeiro cobertura, depois a que menos parece nome de loja.
       O criterio antigo era "menos valores distintos", que elegia qualquer
       coluna de Status ou de SIM/NAO por ter so dois valores. */
    const ordenados=candidatos.slice().sort((a,b)=>
      b.cobertura-a.cobertura || a.propNomeLoja-b.propNomeLoja || a.col-b.col);
    if(regional>=0 && !ordenados.some(a=>a.col===regional))
      console.warn('Base nova regional: a coluna com cabecalho de regional (indice '+regional+
        ') nao acompanha todas as lojas (cobertura '+
        (diagnostico.find(a=>a.col===regional)||{cobertura:0}).cobertura+
        ') — parece uma lista avulsa ao lado da tabela e foi descartada.');
    regional = ordenados.length ? ordenados[0].col : -1;
  }
  return {nome,num,regional,diagnostico,lojasNaAba:linhas.length};
}

/* Acha a coluna de NUMERO DE LOJA que pertence ao mesmo bloco da coluna de
   regional. A aba "Base nova regional" traz mais de uma tabela lado a lado, e
   cada uma em sua propria ordem — a da esquerda em ordem alfabetica, a da
   direita nao. Usar o numero de loja da tabela principal para ler a regional da
   tabela vizinha casa lojas diferentes na mesma linha: os valores saem todos
   validos, a cobertura fica cheia, e mesmo assim cada loja recebe a regional de
   outra. Por isso a busca anda da coluna de regional para a esquerda ate achar o
   numero dela, e so entao o mapa e montado por chave, nao por posicao. */
function colunaChaveDoRegional(rows, cols){
  if(cols.regional<0) return {colNum:cols.num, mesmoBloco:true};
  const width=rows.reduce((w,r)=>Math.max(w,r?r.length:0),0);
  const numerosValidos=new Set();
  for(let i=1;i<rows.length;i++){ const r=rows[i]; if(r&&r[cols.num]!=null) numerosValidos.add(String(r[cols.num]).trim()); }
  const ehColunaDeNumeroDeLoja=c=>{
    if(c<0||c>=width) return false;
    if(!isNumericCol(rows,c)) return false;
    const vals=colValues(rows,c); if(!vals.length) return false;
    /* Tem de ser a MESMA populacao de lojas, senao e outra coluna numerica
       qualquer (metragem, ranking, ano) que por acaso e numerica. */
    return vals.filter(v=>numerosValidos.has(String(v).trim())).length/vals.length >= 0.9;
  };
  for(let c=cols.regional-1;c>=0;c--){ if(ehColunaDeNumeroDeLoja(c)) return {colNum:c, mesmoBloco:c!==cols.num}; }
  for(let c=cols.regional+1;c<width;c++){ if(ehColunaDeNumeroDeLoja(c)) return {colNum:c, mesmoBloco:c!==cols.num}; }
  return {colNum:cols.num, mesmoBloco:true};
}

/* Recebe um workbook SheetJS já lido e retorna o seed (mesma estrutura do aggregate.js). */
function buildSeedFromWorkbook(wb, fileName){
  const aoa = n => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true, defval:null}) : [];

  // ---- lojas canônicas ----
  const bnr = aoa('Base nova regional');
  const stores = {};
  const bnrCols = resolveStoreColumns(bnr);
  const parRegional = colunaChaveDoRegional(bnr, bnrCols);
  /* O log da escolha de coluna sai SEMPRE, com as concorrentes ao lado. Quando
     esse campo saiu errado, a unica pista disponivel era uma linha dizendo qual
     indice foi escolhido — sem as alternativas nao dava para saber se a decisao
     tinha sido boa nem por que. Com a tabela abaixo, uma importacao errada se
     explica sozinha na primeira leitura do log. */
  console.log('Base nova regional: ' + bnrCols.lojasNaAba + ' lojas na aba | colunas -> nome=' +
    bnrCols.nome + ' num=' + bnrCols.num + ' regional=' + bnrCols.regional +
    ' | regional casada pela coluna de numero ' + parRegional.colNum +
    (parRegional.colNum!==bnrCols.num ? ' (bloco vizinho — join por numero de loja)' : ' (mesma tabela)'));
  for(const d of bnrCols.diagnostico){
    console.log('   coluna ' + String(d.col).padStart(2) + (d.col===bnrCols.regional ? ' <=ESCOLHIDA' : '           ') +
      ' cabecalho="' + d.cabecalho + '" cobertura=' + d.cobertura + ' distintos=' + d.distintos +
      ' pareceNomeDeLoja=' + d.propNomeLoja + ' ' + (d.ok ? 'apta' : 'descartada') +
      ' ex: ' + JSON.stringify(d.exemplos));
  }
  if(bnrCols.regional<0) console.warn('Base nova regional: coluna de regional nao identificada — o filtro Regional ficara vazio.');
  /* A regional vem de um mapa loja->regional montado com a coluna de numero que
     fica JUNTO da coluna de regional, e nao com a da tabela principal. A aba tem
     dois blocos lado a lado em ordens diferentes: ler a regional pela posicao da
     linha casa a loja de um bloco com a regional de outro. Casar por numero de
     loja e imune a ordem. */
  const regionalPorLoja = {};
  if(bnrCols.regional>=0 && parRegional.colNum>=0){
    for(let i=1;i<bnr.length;i++){ const r=bnr[i]; if(!r)continue;
      const n=r[parRegional.colNum], v=S(r[bnrCols.regional]);
      if(n==null||S(n)===''||!v)continue;
      regionalPorLoja[n]=v; }
  }
  for(let i=1;i<bnr.length;i++){ const r=bnr[i]; if(!r||r[bnrCols.num]==null)continue;
    const n=r[bnrCols.num];
    stores[n]={num:n, name:S(r[bnrCols.nome]), regional:regionalPorLoja[n]||''}; }
  const bl = aoa('Base loja'); const nameByNum = {};
  for(const r of bl){ if(!r)continue; if(r[0]!=null&&r[1])nameByNum[r[0]]=S(r[1]); if(r[5]!=null&&r[4])nameByNum[r[5]]=S(r[4]); }
  for(const k in stores){ if(nameByNum[k]) stores[k].name = nameByNum[k]; }
  if(!Object.keys(stores).length) throw new Error('Nenhuma loja identificada (aba "Base nova regional").');
  {
    const porReg = {};
    let semReg = 0;
    for(const k in stores){ const rg = stores[k].regional || ''; if(!rg) semReg++; else porReg[rg] = (porReg[rg]||0)+1; }
    console.log('Base nova regional: resultado ->', JSON.stringify(porReg), semReg ? ('| ' + semReg + ' loja(s) SEM regional') : '| todas com regional');
  }

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
  /* A planilha é de terceiros e já mudou de forma duas vezes. Da última, os
     rótulos das contas saíram da coluna A para a B — e como o parser lia a
     coluna A fixa, ele não achou "Receita Bruta" em nenhum mês e devolveu uma
     DRE vazia. Não dá para continuar assumindo posição: agora as três âncoras
     (coluna dos rótulos, linha das regionais, linha dos nomes) são PROCURADAS
     pelo conteúdo, e o que foi encontrado é registrado no log. Se a planilha
     mudar de novo, a importação diz onde achou cada coisa em vez de falhar
     em silêncio. */

  /* Coluna dos rótulos: a que mais casa com os nomes de conta conhecidos. */
  const acharColunaRotulos=R=>{
    let melhor={col:0,acertos:-1};
    for(let c=0;c<8;c++){
      let acertos=0;
      for(const l of LINES){
        for(let i=0;i<R.length;i++){
          const lab=norm(R[i]&&R[i][c]); if(!lab) continue;
          if((l.m&&lab===l.m)||(l.mp&&lab.startsWith(l.mp))){ acertos++; break; }
        }
      }
      if(acertos>melhor.acertos) melhor={col:c,acertos};
    }
    return melhor;
  };

  /* Cabeçalho. A primeira tentativa aqui foi procurar a linha que contém
     "Total" — e estava errada: em Fev e Mar a planilha repete "Total" na linha
     das regionais E na dos nomes, então o teste escolhia a de cima e o parser
     passava a ler "REGIONAL INTERIOR" como se fosse o nome de uma loja.
     A âncora que de fato distingue é semântica: a linha das regionais é a que
     tem regionais reconhecíveis. Os nomes ficam na linha seguinte. */
  const acharCabecalho=R=>{
    let melhor={linha:-1,acertos:0};
    for(let i=0;i<Math.min(15,R.length);i++){
      const acertos=(R[i]||[]).filter(v=>REGMAP[norm(v)]).length;
      if(acertos>melhor.acertos) melhor={linha:i,acertos};
    }
    if(melhor.linha>=0&&melhor.acertos>=3) return {linhaNomes:melhor.linha+1, linhaRegional:melhor.linha};
    return {linhaNomes:4, linhaRegional:3};   // layout histórico
  };

  const rotulos=acharColunaRotulos(g(wb.SheetNames.find(n=>MONTHTABS.some(([t])=>t===n))||wb.SheetNames[0]));
  const COLROT=rotulos.col;

  const rowIndex=(R,line)=>{ for(let i=0;i<R.length;i++){ const lab=norm(R[i]&&R[i][COLROT]); if(!lab)continue;
    if(line.m&&lab===line.m)return i; if(line.mp&&lab.startsWith(line.mp))return i; } return -1; };
  const colMap=R=>{ const {linhaNomes,linhaRegional}=acharCabecalho(R);
    const reg=R[linhaRegional]||[],nm=R[linhaNomes]||[]; const cols=[]; let totalCol=-1; const semRegional=[];
    for(let c=0;c<nm.length;c++){ if(c===COLROT) continue;
      const name=String(nm[c]==null?'':nm[c]).trim(); if(!name)continue;
      if(norm(name)==='total'){totalCol=c;continue;} if(['matriz','cd barueri'].includes(norm(name)))continue;
      const rg=REGMAP[norm(reg[c])]; if(!rg){ semRegional.push(name); continue; }
      cols.push({name,regional:rg,col:c}); } return {cols,totalCol,semRegional,linhaNomes,linhaRegional}; };
  // estrutura base a partir de uma aba populada (procura a primeira com Receita Bruta Total numérica)
  let baseTab=null; for(const [tab,mm] of MONTHTABS){ if(!wb.SheetNames.includes(tab))continue; const R=g(tab); const {totalCol}=colMap(R);
    const rbLine=LINES.find(l=>l.key==='receita_bruta'); const ri=rowIndex(R,rbLine); if(ri>=0&&totalCol>=0&&typeof R[ri][totalCol]==='number'&&R[ri][totalCol]!==0){ baseTab=R; break; } }
  if(!baseTab){
    throw new Error('DRE: nenhuma aba de mês com dados encontrada. Rótulos das contas '+
      (rotulos.acertos>0 ? ('foram achados na coluna '+COLROT+' ('+rotulos.acertos+' de '+LINES.length+' contas)')
                         : 'NÃO foram achados em nenhuma das 8 primeiras colunas')+
      '. Abas no arquivo: '+wb.SheetNames.join(', '));
  }
  const {cols:STORECOLS,semRegional,linhaNomes,linhaRegional}=colMap(baseTab);
  console.log('[DRE] rótulos na coluna '+COLROT+' ('+rotulos.acertos+'/'+LINES.length+' contas reconhecidas)'+
    ' · regionais na linha '+(linhaRegional+1)+' · nomes na linha '+(linhaNomes+1));
  console.log('[DRE] '+STORECOLS.length+' lojas com regional');
  if(semRegional.length) console.log('[DRE] sem regional (ficaram de fora): '+semRegional.join(', '));
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
  const porRegional={};
  stores.forEach(s=>{ if(data[s.name].receita_bruta) porRegional[s.regional]=(porRegional[s.regional]||0)+1; });
  console.log('[DRE] meses: '+months.join(', '));
  console.log('[DRE] com P&L por regional: '+
    (Object.keys(porRegional).length ? Object.entries(porRegional).map(([r,n])=>r+'='+n).join(' · ') : 'NENHUMA'));
  const dre={ updated:today||null, source:fileName||'DRE.xlsx', unit:'R$', months, lines:LINES.map(({m,mp,...r})=>r), regionais, stores, data, total };
  return { dre, stats:{ months, storesTotal:stores.length, storesComPnL:nP } };
}

/**
 * Junta uma DRE recém-importada com a que já estava no seed.
 *
 * A operação mantém um arquivo por regional ("04 - INTERIOR.xlsm" e irmãos).
 * Cada arquivo traz a estrutura das 39 lojas, mas números só das lojas da sua
 * regional — as outras colunas vêm vazias. Substituir o seed a cada upload,
 * como era feito antes, significava que subir a segunda regional apagava a
 * primeira: no fim sobrava sempre a última planilha enviada, e a DRE parecia
 * ter só uma regional.
 *
 * A regra é simples e conservadora: valor ausente nunca apaga valor presente.
 * O parser só grava um número quando ele existe de fato na célula, então basta
 * deixar o novo sobrescrever onde tem e preservar o resto.
 */
function unirLinhas(a, b) {
  const A = a || [], B = b || [];
  const base = A.length >= B.length ? A : B;
  const outra = base === A ? B : A;
  const vistos = new Set(base.map(l => l.key));
  return [...base, ...outra.filter(l => !vistos.has(l.key))];
}

function mergeDre(anterior, novo) {
  /* Sempre listas, nunca contagens: quem chama faz `.length` e um número aqui
     vira "undefined loja(s) nova(s)" no log da importação. */
  if (!anterior || !anterior.data) {
    const comDados = (novo.stores || [])
      .filter(s => novo.data && novo.data[s.name] && novo.data[s.name].receita_bruta)
      .map(s => s.name);
    return { dre: novo, novasLojas: comDados, novosMeses: [...(novo.months || [])] };
  }

  const contabil = o => (o && o.origem) === 'base-contabil';
  const mandaOAnterior = contabil(anterior) && !contabil(novo);
  const dre = {
    ...novo,
    months: [...new Set([...(anterior.months || []), ...(novo.months || [])])].sort(),
    fontes: [...new Set([...(anterior.fontes || (anterior.source ? [anterior.source] : [])), novo.source].filter(Boolean))],
    /* A lista de linhas é o que a tabela da DRE renderiza. Herdar só a do último
       arquivo apagaria linhas da tela: a Base Contábil não descreve Rateio nem
       LAIR, e subi-la depois da gerencial faria os dois sumirem do relatório
       mesmo com o dado guardado. Vale a lista mais completa, com o que só a
       outra tiver anexado ao fim. */
    lines: unirLinhas(anterior.lines, novo.lines),
    origem: contabil(anterior) || contabil(novo) ? 'base-contabil' : novo.origem,
  };

  // lojas: união pelo nome; a regional vem de quem souber informá-la
  const porNome = new Map();
  for (const s of anterior.stores || []) porNome.set(s.name, { ...s });
  for (const s of novo.stores || []) {
    const j = porNome.get(s.name);
    if (j) { if (s.regional) j.regional = s.regional; }
    else porNome.set(s.name, { ...s });
  }
  dre.stores = [...porNome.values()];

  /* Quem ganha quando as duas fontes têm a MESMA linha, loja e mês?
   *
   * Não pode ser "a última que subiu". As duas divergem em junho na linha
   * Deduções, e deixar a ordem do upload decidir move o EBITDA da rede de
   * -8,01 Mi para -2,96 Mi — cinco milhões de diferença num indicador de
   * diretoria, dependendo de qual arquivo a pessoa arrastou primeiro. Um número
   * que muda por isso não é um número.
   *
   * A regra: a Base Contábil manda nas linhas contábeis, porque é o registro
   * oficial e cobre a rede inteira. A gerencial entra onde a contábil não
   * alcança — Rateio, LAIR, Qtd de Tickets, Quadro de Pessoal, Metragem, e
   * lojas ou meses que só ela tem. Assim o resultado é o mesmo em qualquer
   * ordem, e a divergência de junho fica visível na reconciliação em vez de
   * silenciosamente decidida por um arrastar de arquivo. */
  const juntarSerie = (a, b) => {
    const forte = mandaOAnterior ? (a || {}) : (b || {});
    const fraco = mandaOAnterior ? (b || {}) : (a || {});
    const out = {};
    for (const linha of new Set([...Object.keys(fraco), ...Object.keys(forte)])) {
      out[linha] = { ...(fraco[linha] || {}), ...(forte[linha] || {}) };
    }
    return out;
  };
  dre.data = {};
  for (const nome of porNome.keys()) {
    dre.data[nome] = juntarSerie((anterior.data || {})[nome], (novo.data || {})[nome]);
  }
  dre.total = juntarSerie(anterior.total, novo.total);

  const tinha = n => { const d = (anterior.data || {})[n]; return !!(d && d.receita_bruta); };
  const tem = n => { const d = dre.data[n]; return !!(d && d.receita_bruta); };
  const novasLojas = [...porNome.keys()].filter(n => tem(n) && !tinha(n));
  const novosMeses = dre.months.filter(m => !(anterior.months || []).includes(m));
  return { dre, novasLojas, novosMeses };
}

/**
 * Fecha as linhas que nenhuma das fontes entrega prontas.
 *
 * A planilha gerencial calcula LAIR e "Ebitda c/ rateio" por loja, mas deixa as
 * duas células VAZIAS na coluna Total — a fórmula não foi estendida até lá. A
 * Base Contábil não tem Rateio, então também não fecha LAIR. Resultado: o
 * indicador mais olhado pela diretoria ficava "N/D" na rede inteira, embora
 * todas as parcelas estivessem à mão.
 *
 * Derivar aqui não é inventar número: é a própria definição da DRE, conferida
 * ao centavo contra a planilha (Atibaia/jul: -13,422 -156,225 -32,000 -8,909
 * -9,964 = -220,520, exatamente o LAIR que a empresa publica).
 *
 * A regra que evita o abuso: só deriva quando TODAS as parcelas existem, e
 * nunca sobrescreve um valor que veio da fonte. Uma loja sem Rateio continua
 * sem LAIR — melhor um campo vazio do que um resultado bom demais porque
 * faltou o custo corporativo.
 */
function derivarFechamento(dre) {
  if (!dre || !dre.months) return 0;
  const PARCELAS = ['mrg_ebitda', 'rateio', 'depreciacao', 'resultado_financeiro', 'resultado_nao_op'];
  let derivados = 0;
  const fechar = o => {
    if (!o) return;
    for (const ym of dre.months) {
      const eb = o.mrg_ebitda && o.mrg_ebitda[ym];
      const rt = o.rateio && o.rateio[ym];
      if (typeof eb === 'number' && typeof rt === 'number' &&
          !(o.mrg_ebitda_rateio && o.mrg_ebitda_rateio[ym] != null)) {
        (o.mrg_ebitda_rateio = o.mrg_ebitda_rateio || {})[ym] = eb + rt;
      }
      if (o.lair && o.lair[ym] != null) continue;
      const vals = PARCELAS.map(k => o[k] && o[k][ym]);
      if (vals.some(v => typeof v !== 'number')) continue;
      (o.lair = o.lair || {})[ym] = vals.reduce((a, b) => a + b, 0);
      derivados++;
    }
  };
  Object.values(dre.data || {}).forEach(fechar);
  fechar(dre.total);
  return derivados;
}

module.exports = { buildSeedFromWorkbook, mergeSeed, parseDreWorkbook, mergeDre, derivarFechamento };
