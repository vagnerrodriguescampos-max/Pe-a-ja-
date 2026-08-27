/* =========================== PAINEL EXECUTIVO ===========================
   Tela de abertura da DRE. Responde, sem rolagem e sem cliques, as quatro
   perguntas de quem decide: o que aconteceu, o que mudou, o que exige ação e
   onde agir. O detalhamento continua nas outras abas — este painel é o ponto
   de partida, não o substituto delas.

   Convenção de sinal: custo é guardado NEGATIVO na base da DRE, então o
   impacto de uma linha no resultado é simplesmente (mês atual − mês anterior).
   O que a leitura humana exige é o verbo certo: uma despesa que piora o
   resultado SUBIU, uma receita que piora CAIU. Publicar "subiu -1,7%" para uma
   receita em queda destrói a credibilidade do relatório na primeira reunião. */

/* Linhas que somam no resultado. Subtotais e totais ficam de fora para não
   contar duas vezes; contadores e médias não são componentes de resultado. */
const DRE_AGREGADOS = new Set([...DRE_SUBTOTAIS,
  'qtd_tickets','ticket_medio','quadro_pessoal','custo_medio_colab','metragem',
  'despesas_total','cmv_gerencial']);

function dreComponentes(){
  return DRE.lines.map(l=>l.key).filter(k=>!DRE_AGREGADOS.has(k) && DRE_ORIENT[k]!=='neutral');
}

/* Movimento de uma linha entre dois meses, já traduzido para leitura humana. */
function dreMovimento(scope,key,ym,cmp){
  const a=dreVal(scope,key,cmp), b=dreVal(scope,key,ym);
  if(a==null&&b==null) return null;
  const impacto=(b||0)-(a||0);                 // efeito direto no resultado
  const orient=DRE_ORIENT[key]||'neutral';
  // "quanto a linha andou nela mesma": para custo (negativo), crescer é -impacto
  const movimento = orient==='cost' ? -impacto : impacto;
  const base = a==null?null:Math.abs(a);
  const pct = (base&&base!==0)? (movimento/base) : null;
  return { key, label:dreLineLabel(key), orient, a, b, impacto, movimento, pct,
           nova:(a==null||a===0)&&b!=null&&b!==0,
           zerada:a!=null&&a!==0&&(b==null||b===0) };
}

function dreVerbo(m){
  if(m.pct==null) return 'mudou sem base de comparação';
  if(Math.abs(m.pct)<0.0005) return 'ficou estável';
  return (m.movimento>0?'subiu ':'caiu ')+fmtPct(Math.abs(m.pct));
}

/* ---------- alertas: cada um sai de uma comparação explícita ----------
   Este painel NÃO repete a lista do lado esquerdo. "O que mudou" já ordena as
   contas que puxaram o resultado, com valor e percentual; reproduzir as mesmas
   quatro linhas aqui gastaria metade da primeira tela dizendo duas vezes a
   mesma coisa. O que entra aqui é o que aquela lista não consegue mostrar:
   ruptura de série (conta que nasceu ou zerou), deterioração de margem, e o
   corte por loja — onde a decisão do diretor e do gerente realmente acontece. */
function drePainelAlertas(scope,ym,cmp,movs,lojas,jaListadas){
  const out=[];
  const rb=dreVal(scope,'receita_bruta',ym)||0;
  const material=Math.max(50000, Math.abs(rb)*0.002);   // 0,2% da receita

  /* Conta que já está na lista ao lado não vira alerta: lá ela aparece com
     "mudou sem base de comparação", que é a mesma informação. O alerta serve
     para a conta que nasceu ou zerou FORA do top de movimentos e por isso
     passaria despercebida. */
  movs.forEach(m=>{
    if(jaListadas && jaListadas.has(m.label)) return;
    if(m.nova && Math.abs(m.b)>=material)
      out.push({n:'warn', t:m.label, x:`sem valor em ${ymLabel(cmp)} e com ${fmtMoney(Math.abs(m.b),true)} em ${ymLabel(ym)}`});
    if(m.zerada && Math.abs(m.a)>=material)
      out.push({n:'warn', t:m.label, x:`tinha ${fmtMoney(Math.abs(m.a),true)} em ${ymLabel(cmp)} e zerou — verificar provisão em falta`});
  });

  const me=drePct(scope,'mrg_ebitda',ym), mec=drePct(scope,'mrg_ebitda',cmp);
  if(me!=null&&mec!=null&&me<mec)
    out.push({n:'warn', t:'Margem EBITDA caiu', x:`${fmtPct(mec)} para ${fmtPct(me)} em um mês`});

  const cm=drePct(scope,'cmv',ym), cmc=drePct(scope,'cmv',cmp);
  if(cm!=null&&cmc!=null&&Math.abs(cm)>Math.abs(cmc))
    out.push({n:'warn', t:'CMV pesou mais sobre a receita', x:`${fmtPct(Math.abs(cmc))} para ${fmtPct(Math.abs(cm))} da Receita Bruta`});

  /* corte por loja: prejuízo operacional e a maior perda do mês */
  const negativas=(lojas||[]).filter(l=>(l.ebitda||0)<0).sort((a,b)=>a.ebitda-b.ebitda);
  if(negativas.length) out.push({n:'crit', t:`${negativas.length} loja(s) com EBITDA negativo`,
    x:`${negativas.slice(0,3).map(l=>titleCase(l.nome)+' ('+fmtMoney(l.ebitda,true)+')').join(', ')}${negativas.length>3?' e outras':''}`});

  const quedas=(lojas||[]).filter(l=>l.impacto!=null&&l.impacto<0).sort((a,b)=>a.impacto-b.impacto);
  if(quedas.length && Math.abs(quedas[0].impacto)>=material){
    const q=quedas[0];
    out.push({n:'warn', t:`${titleCase(q.nome)} — maior queda de EBITDA`,
      x:`${fmtMoney(Math.abs(q.impacto),true)} a menos que em ${ymLabel(cmp)} · margem hoje ${fmtPct(q.margem)}`});
  }

  if(scope.type==='rede'){
    const sem=DRE.stores.filter(s=>!dreHasPnL(s.name));
    if(sem.length) out.push({n:'crit', t:`${sem.length} loja(s) sem resultado detalhado`,
      x:`${sem.slice(0,5).map(s=>titleCase(s.name)).join(', ')}${sem.length>5?' e outras':''} — os totais da rede estão incompletos`});
  }
  /* Uma conta que despencou e é nova na base dispara os dois testes acima.
     Repetir o nome gasta a linha mais cara do painel e faz o leitor achar que
     são dois problemas — fica só o alerta mais grave de cada conta. */
  const ordem={crit:0,warn:1,info:2};
  const vistos=new Set();
  return out.sort((a,b)=>ordem[a.n]-ordem[b.n])
            .filter(a=>{ if(vistos.has(a.t)) return false; vistos.add(a.t); return true; })
            .slice(0,7);
}

/* ---------- ranking de lojas por margem EBITDA ---------- */
function drePainelLojas(ym,cmp){
  const linhas=[];
  DRE.stores.forEach(s=>{
    if(!dreHasPnL(s.name)) return;
    const sc={type:'loja',loja:s.name};
    const eb=dreVal(sc,'mrg_ebitda',ym), ebc=dreVal(sc,'mrg_ebitda',cmp);
    const mg=drePct(sc,'mrg_ebitda',ym);
    if(eb==null) return;
    linhas.push({ nome:s.name, regional:s.regional, ebitda:eb, margem:mg,
                  impacto: ebc==null?null:eb-ebc });
  });
  return linhas;
}

function drePainel(){
  const scope=curScope(), ym=dreState.ym, cmp=dreState.cmp;
  const root=h('<div></div>');
  if(!dreScopeHasData(scope,ym)){ root.appendChild(dreNoData(scope)); return root; }

  const V=k=>dreVal(scope,k,ym), Vc=k=>dreVal(scope,k,cmp);
  const dPct=k=>{ const a=Vc(k),b=V(k); return (a!=null&&b!=null&&a!==0)?(b-a)/Math.abs(a):undefined; };
  const spark=k=>sparkline(DRE.months.map(m=>dreVal(scope,k,m)),'--s1',84,26);

  /* ---------- 1. o que aconteceu ---------- */
  const kg=h('<div class="kpi-grid dre-kpi6" style="margin-bottom:10px"></div>');
  kg.innerHTML=[
    kpiCard({title:'Receita Bruta',icon:'money',accent:'--brand',value:fmtMoney(V('receita_bruta'),true),
      delta:dPct('receita_bruta'),cmp:'vs '+ymLabel(cmp),src:'fonte',spark:spark('receita_bruta')}),
    kpiCard({title:'Lucro Bruto',icon:'sales',accent:'--s3',value:fmtMoney(V('lucro_bruto'),true),
      delta:dPct('lucro_bruto'),cmp:fmtPct(drePct(scope,'lucro_bruto',ym))+' s/ Rec. Bruta',src:'fonte',spark:spark('lucro_bruto')}),
    kpiCard({title:'EBITDA',icon:'bolt',accent:(V('mrg_ebitda')||0)>=0?'--s7':'--crit',value:fmtMoney(V('mrg_ebitda'),true),
      delta:dPct('mrg_ebitda'),cmp:'Margem '+fmtPct(drePct(scope,'mrg_ebitda',ym)),src:'fonte',spark:spark('mrg_ebitda')}),
    kpiCard({title:'LAIR',icon:'scale',accent:(V('lair')||0)>=0?'--s7':'--crit',value:fmtMoney(V('lair'),true),
      delta:dPct('lair'),cmp:'Margem '+fmtPct(drePct(scope,'lair',ym)),src:'fonte',spark:spark('lair')}),
    /* CMV e Despesas aparecem em módulo (positivo) porque é assim que a
       diretoria lê um custo. Com isso a variação inverte de significado: o
       delta é quanto o custo cresceu, e `deltaRuim` faz a cor acompanhar o
       impacto no resultado em vez do sinal do número. */
    kpiCard({title:'CMV',icon:'box',accent:'--s2',value:fmtMoney(Math.abs(V('cmv')||0),true),
      delta:dPct('cmv')!=null?-dPct('cmv'):undefined, deltaRuim:true,
      cmp:fmtPct(Math.abs(drePct(scope,'cmv',ym)||0))+' s/ Rec. Bruta',src:'fonte',spark:spark('cmv')}),
    kpiCard({title:'Despesas',icon:'grid',accent:'--s6',value:fmtMoney(Math.abs(V('despesas_total')||0),true),
      delta:dPct('despesas_total')!=null?-dPct('despesas_total'):undefined, deltaRuim:true,
      cmp:fmtPct(Math.abs(drePct(scope,'despesas_total',ym)||0))+' s/ Rec. Bruta',src:'fonte',spark:spark('despesas_total')}),
  ].join('');
  root.appendChild(kg);

  /* ---------- 2 e 3. o que mudou e o que exige ação, lado a lado ---------- */
  const movs=dreComponentes().map(k=>dreMovimento(scope,k,ym,cmp)).filter(Boolean)
    .filter(m=>m.impacto!==0).sort((a,b)=>Math.abs(b.impacto)-Math.abs(a.impacto));
  const contra=movs.filter(m=>m.impacto<0).slice(0,6);
  const ajuda=movs.filter(m=>m.impacto>0).slice(0,6);
  const listadas=new Set([...contra,...ajuda].map(m=>m.label));
  const lojas=drePainelLojas(ym,cmp);
  const alertas=drePainelAlertas(scope,ym,cmp,movs,lojas,listadas);

  const movHtml=l=>l.length? l.map(m=>`<div class="dre-mov ${m.impacto<0?'bad':'good'}">
      <span class="nm">${m.label}</span>
      <span class="vs">${fmtMoney(m.a,true)} → ${fmtMoney(m.b,true)} · ${dreVerbo(m)}</span>
      <span class="amt">${fmtMoney(m.impacto,true)}</span></div>`).join('')
    : `<div class="dre-mov"><span class="nm mut" style="font-weight:500;color:var(--ink-3)">Nada nesta direção.</span></div>`;

  const linha2=h(`<div class="dre-two" style="margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>O que mudou vs ${ymLabel(cmp)}</h3>
      <span class="src-tag src-calc">CALC</span><span class="hint">${scope.label}</span></div>
      <div class="card-b" style="padding:0">
        <div style="padding:9px 12px 3px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-3);font-weight:700">Pesou contra</div>
        ${movHtml(contra)}
        <div style="padding:11px 12px 3px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-3);font-weight:700;border-top:1px solid var(--line)">Ajudou</div>
        ${movHtml(ajuda)}
      </div></div>
    <div class="card"><div class="card-h"><h3>Exige atenção</h3>
      <span class="pill ${alertas.some(a=>a.n==='crit')?'crit':'aten'}">${alertas.length}</span></div>
      <div class="card-b" style="padding:0">
        ${alertas.length? alertas.map(a=>`<div class="dre-mov ${a.n==='crit'?'bad':''}" style="align-items:flex-start">
            <span style="width:3px;align-self:stretch;border-radius:2px;background:var(--${a.n==='crit'?'crit':'warn'});flex:none"></span>
            <span class="nm"><b>${a.t}</b><br><span style="font-weight:500;color:var(--ink-3);font-size:11.5px">${a.x}</span></span>
          </div>`).join('')
          : `<div class="dre-mov"><span class="nm" style="font-weight:500;color:var(--ink-3)">Nenhum desvio material nesta competência.</span></div>`}
      </div></div>
  </div>`);
  root.appendChild(linha2);

  /* ---------- cascata: como a receita virou EBITDA ---------- */
  const rb=V('receita_bruta'), rl=V('receita_liquida'), lb=V('lucro_bruto'), eb=V('mrg_ebitda');
  const casc=h(`<div class="card" style="margin-bottom:14px"><div class="card-h">
    <h3>Cascata do resultado — ${ymLabel(ym)}</h3><span class="src-tag src-calc">CALC</span>
    <span class="hint">${scope.label}</span></div><div class="card-b"></div></div>`);
  $('.card-b',casc).appendChild(waterfallChart({
    start:{label:'Receita',value:rb},
    steps:[{label:'Deduções',delta:(rl-rb)},{label:'Custo (CMV)',delta:(lb-rl)},{label:'Despesas',delta:(eb-lb)}],
    end:{label:'EBITDA',value:eb}, width:820, height:300
  }));
  root.appendChild(casc);

  /* ---------- 4. onde agir ---------- */
  if(lojas.length){
    const porMargem=lojas.slice().sort((a,b)=>(b.margem||-9)-(a.margem||-9));
    const top=porMargem.slice(0,5), bot=porMargem.slice(-5).reverse();
    const linhaLoja=l=>`<tr><td style="font-weight:650">${titleCase(l.nome)}<span class="rg">${l.regional||'—'}</span></td>
      <td class="num">${fmtMoney(l.ebitda,true)}</td>
      <td class="num" style="color:var(--${(l.margem||0)>=0?'good-ink':'crit-ink'})">${fmtPct(l.margem)}</td>
      <td class="num">${l.impacto==null?'<span style="color:var(--ink-3)">—</span>':fmtMoney(l.impacto,true)}</td></tr>`;
    /* mês abreviado no cabeçalho: "vs Junho/2026" por extenso empurra a coluna
       para fora do cartão, que ocupa metade da tela. */
    const mesCurto=MESES[+cmp.slice(5)-1];
    const cab=`<thead><tr><th>Loja</th><th class="num">EBITDA</th><th class="num">Margem</th><th class="num">vs ${mesCurto}</th></tr></thead>`;
    const cLoja=h(`<div class="dre-two"><div class="card">
        <div class="card-h"><h3>Maiores margens EBITDA</h3><span class="hint">${ymLabel(ym)}</span></div>
        <div class="card-b" style="padding:0"><div class="tbl-wrap" style="border:0">
        <table class="data dre-table dre-rank">${cab}<tbody>${top.map(linhaLoja).join('')}</tbody></table></div></div></div>
      <div class="card">
        <div class="card-h"><h3>Menores margens EBITDA</h3><span class="hint">exigem plano de ação</span></div>
        <div class="card-b" style="padding:0"><div class="tbl-wrap" style="border:0">
        <table class="data dre-table dre-rank">${cab}<tbody>${bot.map(linhaLoja).join('')}</tbody></table></div></div></div>
    </div>`);
    root.appendChild(cLoja);
  }

  /* ---------- para onde o resultado vem caminhando ---------- */
  const ev=h(`<div class="card" style="margin-top:14px"><div class="card-h">
    <h3>Evolução mensal</h3><span class="hint">${scope.label}</span></div><div class="card-b"></div></div>`);
  $('.card-b',ev).appendChild(lineChart({
    xLabels:DRE.months.map(m=>MESES[+m.slice(5)-1]),
    series:[
      {name:'Receita Bruta',color:'--brand',fill:true,data:DRE.months.map(m=>({y:dreVal(scope,'receita_bruta',m)}))},
      {name:'Lucro Bruto',color:'--s3',data:DRE.months.map(m=>({y:dreVal(scope,'lucro_bruto',m)}))},
      {name:'EBITDA',color:'--s2',data:DRE.months.map(m=>({y:dreVal(scope,'mrg_ebitda',m)}))},
    ], width:820, height:260, zeroMin:true
  }));
  root.appendChild(ev);

  root.appendChild(h(`<div style="margin-top:12px;color:var(--ink-3);font-size:11px;line-height:1.6">
    <b>EBITDA</b> = resultado antes de depreciação, financeiro e impostos sobre o lucro ·
    <b>Margem</b> = a linha sobre a Receita Bruta ·
    as variações são lidas na natureza da linha (<b>+</b> significa que ela aumentou: bom em receita, ruim em custo) ·
    os alertas ignoram valores abaixo de 0,2% da receita, porque um painel que aponta uma conta pequena que dobrou deixa de ser lido.
  </div>`));
  return root;
}
