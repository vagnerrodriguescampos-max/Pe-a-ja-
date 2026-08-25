/* Página do módulo contábil/DRE, servida pela própria API (mesma origem,
   sem CORS). Autossuficiente: não depende do front de vendas no Netlify. */
const PAGINA_DRE = String.raw`<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roldão — Análise Contábil e DRE</title><style>
*{box-sizing:border-box}
:root{--bg:#0b1220;--surface:#131c2e;--surface2:#1b2740;--border:#26334d;--text:#e8edf7;--muted:#93a1bd;
--brand:#f5a623;--good:#22c55e;--warn:#f59e0b;--bad:#ef4444;--info:#3b82f6}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:20;background:rgba(11,18,32,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);padding:14px 20px}
.wrap{max-width:1400px;margin:0 auto}
h1{margin:0;font-size:17px;letter-spacing:-.2px}
.sub{color:var(--muted);font-size:12px;margin-top:2px}
nav{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
nav button{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all .18s}
nav button:hover{color:var(--text);border-color:#38486b}
nav button.on{background:var(--brand);border-color:var(--brand);color:#1a1206}
main{max-width:1400px;margin:0 auto;padding:20px}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:16px}
.f{display:flex;flex-direction:column;gap:5px}
.f label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
select,input[type=password],input[type=file]{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;min-width:150px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}
.card .k{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:700}
.card .v{font-size:22px;font-weight:700;margin-top:5px;letter-spacing:-.5px}
.card .d{font-size:11px;color:var(--muted);margin-top:3px}
table{width:100%;border-collapse:collapse;font-size:13px}
.tw{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:auto;max-height:66vh}
th{position:sticky;top:0;background:var(--surface2);text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid rgba(38,51,77,.5);white-space:nowrap}
tr:hover td{background:rgba(27,39,64,.5)}
.n{text-align:right;font-variant-numeric:tabular-nums}
.neg{color:#fca5a5}.pos{color:#86efac}.nd{color:var(--muted);font-style:italic}
.tag{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
.t-conciliado{background:rgba(34,197,94,.12);color:#86efac;border-color:rgba(34,197,94,.35)}
.t-divergente{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.35)}
.t-defasagem_provavel{background:rgba(59,130,246,.12);color:#93c5fd;border-color:rgba(59,130,246,.35)}
.t-fora_do_escopo{background:rgba(147,161,189,.1);color:var(--muted);border-color:var(--border)}
.t-sem_lancamento{background:rgba(245,158,11,.12);color:#fcd34d;border-color:rgba(245,158,11,.35)}
.t-sem_contabilizacao{background:rgba(245,158,11,.12);color:#fcd34d;border-color:rgba(245,158,11,.35)}
.t-conta_nao_mapeada{background:rgba(168,85,247,.12);color:#d8b4fe;border-color:rgba(168,85,247,.35)}
.t-aguardando_base{background:rgba(147,161,189,.1);color:var(--muted);border-color:var(--border)}
.note{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--info);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:var(--muted)}
.note b{color:var(--text)}
.empty{padding:50px 20px;text-align:center;color:var(--muted)}
.up{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.up .card button{width:100%;margin-top:10px;padding:10px;border:0;border-radius:8px;background:var(--brand);color:#1a1206;font-weight:700;cursor:pointer;font-size:13px}
.up .card button:disabled{opacity:.5;cursor:default}
#msg{margin-top:12px;padding:12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:none;white-space:pre-wrap;font-size:12.5px}
.gate{max-width:380px;margin:80px auto;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px}
.gate h2{margin:0 0 6px;font-size:17px}.gate p{margin:0 0 18px;color:var(--muted);font-size:13px}
.gate input{width:100%}.gate button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:9px;background:var(--brand);color:#1a1206;font-weight:700;font-size:15px;cursor:pointer}
.hint{font-size:11px;color:var(--muted);margin-top:6px}
</style></head><body>

<div id="gate" class="gate">
  <h2>Análise Contábil e DRE</h2>
  <p>Acesso restrito. Informe a senha do BI.</p>
  <input id="pw" type="password" placeholder="senha" autocomplete="current-password">
  <button onclick="entrar()">Entrar</button>
  <div id="gateErr" class="hint" style="color:#fca5a5"></div>
</div>

<div id="app" style="display:none">
<header><div class="wrap">
  <h1>Roldão Atacadista — Análise Contábil e DRE</h1>
  <div class="sub" id="statusLinha">carregando…</div>
  <nav>
    <button class="on" data-v="dre">DRE Consolidada</button>
    <button data-v="rec">Reconciliação</button>
    <button data-v="var">Variação e Justificativas</button>
    <button data-v="imp">Importar Bases</button>
  </nav>
</div></header>
<main>
  <div class="bar" id="filtros"></div>
  <div id="conteudo"><div class="empty">Carregando…</div></div>
</main>
</div>

<script>
var PW='', ST=null, VIEW='dre';
var $=function(s){return document.querySelector(s)};
var brl=function(v){return v==null?null:v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})};
var cel=function(v){return v==null?'<td class="n nd">N/D</td>':'<td class="n '+(v<0?'neg':'pos')+'">'+brl(v)+'</td>'};
var pctTxt=function(p){return p==null?'N/D':(p>=0?'+':'')+p.toFixed(1)+'%'};

function api(rota){return fetch(rota,{headers:{'x-bir-pw':PW}}).then(function(r){
  if(r.status===401){throw new Error('senha')} return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); return j; })})}

function entrar(){
  PW=$('#pw').value;
  if(!PW){$('#gateErr').textContent='Informe a senha.';return}
  api('/api/dre/status').then(function(s){
    ST=s; try{sessionStorage.setItem('bir_pw',PW)}catch(e){}
    $('#gate').style.display='none'; $('#app').style.display='block';
    linhaStatus(); render();
  }).catch(function(e){ $('#gateErr').textContent = e.message==='senha'?'Senha incorreta.':('Falha: '+e.message) });
}

function linhaStatus(){
  if(!ST.base){$('#statusLinha').textContent='Nenhuma Base Contábil importada — vá em "Importar Bases".';return}
  var d=ST.despesas||[];
  $('#statusLinha').textContent='Base Contábil: '+ST.base.meses[0]+' a '+ST.base.meses[ST.base.meses.length-1]+
    ' · '+ST.base.lojas+' lojas · '+ST.base.contas+' contas   |   Relatórios de despesa: '+d.length+
    (ST.justificativas?('   |   De-para: '+ST.justificativas.contas+' contas'):'');
}

document.addEventListener('click',function(e){
  var b=e.target.closest('nav button'); if(!b)return;
  document.querySelectorAll('nav button').forEach(function(x){x.classList.remove('on')});
  b.classList.add('on'); VIEW=b.dataset.v; render();
});

function selMeses(id,sel){ if(!ST.base)return'';
  return '<div class="f"><label>Mês</label><select id="'+id+'">'+ST.base.meses.map(function(m){
    return '<option value="'+m+'"'+(m===sel?' selected':'')+'>'+m+'</option>'}).join('')+'</select></div>'}

function render(){
  if(!ST.base && VIEW!=='imp'){ $('#filtros').innerHTML=''; 
    $('#conteudo').innerHTML='<div class="empty">Importe a Base Contábil para começar.</div>'; return }
  if(VIEW==='dre') viewDre(); else if(VIEW==='rec') viewRec(); else if(VIEW==='var') viewVar(); else viewImp();
}

/* ---------- DRE consolidada ---------- */
function viewDre(){
  $('#filtros').innerHTML='<div class="f"><label>Recorte</label><select id="rec">'+
    '<option value="">Empresa (todas as lojas)</option>'+
    '<optgroup label="Regionais">'+['REGIONAL GRANDE SP','REGIONAL OESTE','REGIONAL BAIXADA ABC','REGIONAL INTERIOR']
      .map(function(r){return '<option value="r:'+r+'">'+r+'</option>'}).join('')+'</optgroup>'+
    '<optgroup label="Lojas" id="ogLojas"></optgroup></select></div>'+
    '<div class="f"><label>&nbsp;</label><button onclick="carregarDre()" style="padding:9px 16px;border:0;border-radius:8px;background:var(--brand);color:#1a1206;font-weight:700;cursor:pointer">Gerar</button></div>';
  carregarDre();
}
function preencherLojas(id){
  api('/api/dre/consolidada?meses='+ST.base.meses[0]).then(function(d){
    var og=document.getElementById(id); if(!og||!d.lojas)return;
    og.innerHTML=d.lojas.map(function(l){return '<option value="l:'+l.num+'">'+l.num+' — '+l.unidade+'</option>'}).join('');
  }).catch(function(){});
}
function carregarDre(){
  var v=($('#rec')||{}).value||'', q='';
  if(v.indexOf('l:')===0) q='&loja='+v.slice(2); else if(v.indexOf('r:')===0) q='&regional='+encodeURIComponent(v.slice(2));
  $('#conteudo').innerHTML='<div class="empty">Calculando…</div>';
  api('/api/dre/consolidada?_=1'+q).then(function(d){
    var h='<div class="note"><b>DRE por competência</b>, montada linha a linha a partir da contabilidade — cada célula é a soma dos lançamentos daquele subgrupo. Onde não houve movimento, o valor aparece como <b>N/D</b>, nunca como zero.</div>';
    h+='<div class="tw"><table><thead><tr><th>Subgrupo</th>'+d.meses.map(function(m){return '<th class="n">'+m+'</th>'}).join('')+'<th class="n">Total</th></tr></thead><tbody>';
    d.linhas.forEach(function(l){
      h+='<tr><td><b>'+l.subGrupo+'</b></td>'+l.valores.map(cel).join('')+cel(l.total)+'</tr>';
    });
    h+='</tbody></table></div>';
    $('#conteudo').innerHTML=h;
    if(document.getElementById('ogLojas')&&!document.getElementById('ogLojas').innerHTML) preencherLojas('ogLojas');
  }).catch(function(e){$('#conteudo').innerHTML='<div class="empty">Erro: '+e.message+'</div>'});
}

/* ---------- Reconciliação ---------- */
function viewRec(){
  var ult=ST.base.meses[ST.base.meses.length-1];
  $('#filtros').innerHTML='<div class="f"><label>Loja</label><select id="recLoja"></select></div>'+
    selMeses('recMes',ult)+
    '<div class="f"><label>&nbsp;</label><button onclick="carregarRec()" style="padding:9px 16px;border:0;border-radius:8px;background:var(--brand);color:#1a1206;font-weight:700;cursor:pointer">Conciliar</button></div>';
  api('/api/dre/consolidada?meses='+ST.base.meses[0]).then(function(d){
    var s=document.getElementById('recLoja'); if(!s)return;
    var comDesp={}; (ST.despesas||[]).forEach(function(x){comDesp[x.loja]=true});
    s.innerHTML=d.lojas.map(function(l){return '<option value="'+l.num+'">'+l.num+' — '+l.unidade+(comDesp[l.num]?'  ✓':'  (aguardando base)')+'</option>'}).join('');
    var comuns=Object.keys(comDesp); if(comuns.length) s.value=comuns[0];
    carregarRec();
  });
}
function carregarRec(){
  var loja=($('#recLoja')||{}).value, mes=($('#recMes')||{}).value;
  if(!loja)return;
  $('#conteudo').innerHTML='<div class="empty">Conciliando…</div>';
  api('/api/dre/reconciliacao?loja='+loja+'&mes='+mes).then(function(d){
    var h='';
    if(!d.disponivel){
      h+='<div class="note" style="border-left-color:var(--warn)"><b>'+d.motivo+'</b><br>A coluna contábil está completa; a coluna de lançamentos aparece como N/D até que o relatório desta loja/mês seja importado.</div>';
    } else {
      h+='<div class="note"><b>Competência × Vencimento, lado a lado.</b> A contabilidade registra no mês do fato; o relatório de despesas, no mês do vencimento da fatura. Uma conta presente de um lado e ausente do outro pode ser apenas defasagem de data — por isso o sistema classifica cada linha em vez de apontar "faltou lançar".</div>';
      h+='<div class="cards">'+
        '<div class="card"><div class="k">Contábil (competência)</div><div class="v '+(d.totais.contabil<0?'neg':'pos')+'">'+brl(d.totais.contabil)+'</div></div>'+
        '<div class="card"><div class="k">Lançado (vencimento)</div><div class="v '+(d.totais.lancado<0?'neg':'pos')+'">'+brl(d.totais.lancado)+'</div><div class="d">'+(d.periodoLancamentos?d.periodoLancamentos.inicio+' a '+d.periodoLancamentos.fim:'')+'</div></div>'+
        '<div class="card"><div class="k">Diferença</div><div class="v">'+brl(d.totais.diferenca)+'</div><div class="d">inclui contas fora do escopo</div></div>'+
        '<div class="card"><div class="k">Exigem atenção</div><div class="v">'+((d.resumo.divergente||0)+(d.resumo.sem_lancamento||0)+(d.resumo.sem_contabilizacao||0))+'</div><div class="d">divergentes + sem par</div></div>'+
      '</div>';
      if(d.contasNaoMapeadas&&d.contasNaoMapeadas.length){
        h+='<div class="note" style="border-left-color:#a855f7"><b>'+d.contasNaoMapeadas.length+' contas do relatório sem correspondência na contabilidade.</b> O sistema não adivinha o de-para: '+d.contasNaoMapeadas.slice(0,6).join(' · ')+(d.contasNaoMapeadas.length>6?' …':'')+'</div>';
      }
    }
    h+='<div class="tw"><table><thead><tr><th>Conta</th><th>Descrição</th><th>Subgrupo</th><th class="n">Contábil</th><th class="n">Lançado</th><th class="n">Diferença</th><th>Situação</th></tr></thead><tbody>';
    d.linhas.forEach(function(l){
      h+='<tr><td>'+l.conta+'</td><td>'+l.descricao+'</td><td style="color:var(--muted)">'+l.subGrupo+'</td>'+
         cel(l.contabil)+cel(l.lancado)+cel(l.diferenca)+
         '<td><span class="tag t-'+l.status+'">'+l.status.replace(/_/g,' ')+'</span></td></tr>';
    });
    h+='</tbody></table></div>';
    $('#conteudo').innerHTML=h;
  }).catch(function(e){$('#conteudo').innerHTML='<div class="empty">Erro: '+e.message+'</div>'});
}

/* ---------- Variação ---------- */
function viewVar(){
  var ms=ST.base.meses, b=ms[ms.length-1], a=ms[ms.length-2]||ms[0];
  $('#filtros').innerHTML=
    '<div class="f"><label>Mês anterior</label><select id="vA">'+ms.map(function(m){return '<option'+(m===a?' selected':'')+'>'+m+'</option>'}).join('')+'</select></div>'+
    '<div class="f"><label>Mês atual</label><select id="vB">'+ms.map(function(m){return '<option'+(m===b?' selected':'')+'>'+m+'</option>'}).join('')+'</select></div>'+
    '<div class="f"><label>Recorte</label><select id="vR"><option value="">Empresa</option>'+
      ['REGIONAL GRANDE SP','REGIONAL OESTE','REGIONAL BAIXADA ABC','REGIONAL INTERIOR'].map(function(r){return '<option value="r:'+r+'">'+r+'</option>'}).join('')+'</select></div>'+
    '<div class="f"><label>&nbsp;</label><button onclick="carregarVar()" style="padding:9px 16px;border:0;border-radius:8px;background:var(--brand);color:#1a1206;font-weight:700;cursor:pointer">Comparar</button></div>';
  carregarVar();
}
function carregarVar(){
  var a=($('#vA')||{}).value,b=($('#vB')||{}).value,r=($('#vR')||{}).value||'';
  var q='?mesA='+a+'&mesB='+b+(r.indexOf('r:')===0?'&regional='+encodeURIComponent(r.slice(2)):'');
  $('#conteudo').innerHTML='<div class="empty">Comparando…</div>';
  api('/api/dre/variacao'+q).then(function(d){
    var h='<div class="note"><b>Formato oficial de justificativa</b> (Subgrupo · Conta · Descrição · Mês anterior · Mês atual · variação). Ordenado pelo impacto absoluto em reais — o que mais mexeu no resultado aparece primeiro.</div>';
    h+='<div class="tw"><table><thead><tr><th>Subgrupo</th><th>Conta</th><th>Descrição</th><th class="n">'+d.compA+'</th><th class="n">'+d.compB+'</th><th class="n">Δ R$</th><th class="n">Δ %</th><th>Justificativa</th></tr></thead><tbody>';
    d.linhas.slice(0,300).forEach(function(l){
      var mk=l.novaConta?' <span class="tag t-sem_lancamento">nova</span>':(l.contaEncerrada?' <span class="tag t-fora_do_escopo">encerrada</span>':'');
      h+='<tr><td style="color:var(--muted)">'+l.subGrupo+'</td><td>'+l.conta+'</td><td>'+l.descricao+mk+'</td>'+
         cel(l.mesAnterior)+cel(l.mesAtual)+cel(l.delta)+
         '<td class="n">'+pctTxt(l.variacaoPct)+'</td><td style="color:var(--muted)">'+(l.justificativa||'—')+'</td></tr>';
    });
    h+='</tbody></table></div>';
    $('#conteudo').innerHTML=h;
  }).catch(function(e){$('#conteudo').innerHTML='<div class="empty">Erro: '+e.message+'</div>'});
}

/* ---------- Importar ---------- */
function viewImp(){
  $('#filtros').innerHTML='';
  var defs=[
    ['Base Contábil','/api/upload-contabil','Lojas - Base Contabil_2026 — todas as lojas, aba Base_Real'],
    ['Relatório de Despesas','/api/upload-despesas','relatorioDespesasPeriodo — um por loja/período'],
    ['Justificativas (de-para)','/api/upload-justificativas','JUSTIFICATIVAS — mapeia conta para subgrupo da DRE'],
  ];
  var h='<div class="up">';
  defs.forEach(function(d,i){
    h+='<div class="card"><div class="k">'+d[0]+'</div><div class="d" style="margin:6px 0 10px">'+d[2]+'</div>'+
       '<input type="file" id="f'+i+'" accept=".xlsx,.xlsm,.xls"><button id="b'+i+'" onclick="enviar('+i+',\''+d[1]+'\',\''+d[0]+'\')">Enviar</button></div>';
  });
  h+='</div><div id="msg"></div>';
  $('#conteudo').innerHTML=h;
}
function enviar(i,rota,rotulo){
  var f=document.getElementById('f'+i).files[0], m=$('#msg');
  if(!f){m.style.display='block';m.textContent='Escolha o arquivo.';return}
  var fd=new FormData();fd.append('file',f);
  document.getElementById('b'+i).disabled=true;
  m.style.display='block';m.textContent='Enviando '+(f.size/1048576).toFixed(1)+' MB…';
  fetch(rota,{method:'POST',headers:{'x-bir-pw':PW},body:fd}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
  .then(function(x){
    document.getElementById('b'+i).disabled=false;
    if(!x.ok){m.textContent=rotulo+' — falhou: '+(x.j.error||'');return}
    m.textContent=rotulo+' importado com sucesso.'+String.fromCharCode(10)+JSON.stringify(x.j,null,1);
    return api('/api/dre/status').then(function(s){ST=s;linhaStatus()});
  }).catch(function(e){document.getElementById('b'+i).disabled=false;m.textContent='Erro: '+e.message});
}

try{var sp=sessionStorage.getItem('bir_pw'); if(sp){$('#pw').value=sp;entrar()}}catch(e){}
</script></body></html>`;
module.exports = { PAGINA_DRE };
