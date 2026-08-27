'use strict';
/**
 * DRE Consolidada — visão executiva.
 *
 * Página autocontida (sem CDN, sem build) desenhada para viver em dois lugares
 * sem alteração: aberta direto em /dre-executiva ou embutida como iframe dentro
 * do BI que já existe. Por isso a autenticação aceita dois caminhos — a própria
 * página pergunta a senha, ou o site que a embute manda por postMessage — e
 * nunca a senha na URL, que ficaria gravada no histórico do navegador e no
 * cabeçalho Referer de qualquer requisição.
 *
 * Densidade é proposital: quem lê DRE compara linha com linha e mês com mês, e
 * paginar isso em cartões bonitos só obriga o usuário a decorar números entre
 * uma tela e outra. A referência aqui é terminal financeiro, não dashboard.
 */

const PAGINA_DRE_EXEC = String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roldão — DRE Consolidada</title>
<style>
:root{
  --bg:#0a0e17; --surf:#111725; --surf2:#161d2e; --line:#1f2937;
  --txt:#e8edf6; --mut:#8b97ad; --dim:#5d6b85;
  --brand:#f5a623; --pos:#34d399; --neg:#f87171; --info:#60a5fa;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1680px;margin:0 auto;padding:0 20px}

/* ---- gate ---- */
#gate{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:50}
#gate .box{width:340px;text-align:center}
#gate h2{font-size:19px;font-weight:650;margin-bottom:6px}
#gate p{color:var(--mut);font-size:13px;margin-bottom:18px}
#gate input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid var(--line);
  background:var(--surf);color:var(--txt);font-size:14px;margin-bottom:10px}
#gate input:focus{outline:0;border-color:var(--brand)}
#gate button{width:100%;padding:11px;border:0;border-radius:9px;background:var(--brand);
  color:#1a1206;font-weight:700;font-size:14px;cursor:pointer}
#gateErr{color:#fca5a5;font-size:12.5px;margin-top:10px;min-height:16px}

/* ---- topo ---- */
header{border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0d1220,#0a0e17);
  position:sticky;top:0;z-index:30}
.htop{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0 12px;flex-wrap:wrap}
h1{font-size:17px;font-weight:650;letter-spacing:-.2px}
h1 small{display:block;color:var(--mut);font-size:11.5px;font-weight:400;margin-top:3px;letter-spacing:0}
.ctrl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
select,.btn{background:var(--surf);border:1px solid var(--line);color:var(--txt);
  border-radius:8px;padding:7px 11px;font-size:12.5px;cursor:pointer;font-family:inherit}
select:focus{outline:0;border-color:var(--brand)}
.btn:hover{background:var(--surf2);border-color:#334155}
.btn.pri{background:var(--brand);color:#1a1206;border-color:var(--brand);font-weight:650}
nav{display:flex;gap:4px;padding-bottom:0}
nav button{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--mut);
  padding:9px 14px;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500}
nav button:hover{color:var(--txt)}
nav button.on{color:var(--brand);border-bottom-color:var(--brand)}

/* ---- kpis ---- */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;
  background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:14px 0}
.kpis:empty{display:none}
.kpi{background:var(--surf);padding:13px 15px}
.kpi .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);margin-bottom:5px}
.kpi .v{font-size:20px;font-weight:650;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
.kpi .s{font-size:11.5px;color:var(--mut);margin-top:3px}
.pos{color:var(--pos)} .neg{color:var(--neg)} .nd{color:var(--dim);font-style:italic}

/* ---- tabelas ---- */
.tbox{border:1px solid var(--line);border-radius:12px;overflow:auto;background:var(--surf);max-height:70vh}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
th,td{padding:7px 11px;white-space:nowrap;border-bottom:1px solid var(--line)}
thead th{position:sticky;top:0;background:var(--surf2);z-index:2;font-size:10.5px;text-transform:uppercase;
  letter-spacing:.5px;color:var(--mut);font-weight:600;text-align:right}
thead th:first-child{text-align:left;left:0;z-index:3}
tbody td{font-variant-numeric:tabular-nums;text-align:right}
tbody td:first-child{text-align:left;position:sticky;left:0;background:var(--surf);font-variant-numeric:normal}
tbody tr:hover td{background:var(--surf2)}
tbody tr:hover td:first-child{background:var(--surf2)}
tr.grupo td{background:#0d1424;font-weight:650;color:var(--brand);font-size:11px;
  text-transform:uppercase;letter-spacing:.5px}
tr.grupo td:first-child{background:#0d1424}
tr.tot td{background:#0d1424;font-weight:700;border-top:2px solid var(--line)}
tr.tot td:first-child{background:#0d1424}
.sub{color:var(--mut);font-size:11px}
.pill{display:inline-block;padding:1px 7px;border-radius:20px;font-size:10.5px;font-weight:600}
.pill.n{background:rgba(248,113,113,.14);color:var(--neg)}
.pill.p{background:rgba(52,211,153,.14);color:var(--pos)}
.pill.i{background:rgba(96,165,250,.14);color:var(--info)}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:1000px){.grid2{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:12px;background:var(--surf);overflow:hidden}
.card h3{font-size:12px;text-transform:uppercase;letter-spacing:.6px;padding:12px 15px;
  border-bottom:1px solid var(--line);color:var(--mut);font-weight:600}
.card h3 b{color:var(--txt);font-weight:650}
main{padding:0 0 24px}
.empty{padding:70px 20px;text-align:center;color:var(--mut)}
.hint{color:var(--mut);font-size:11.5px;margin:10px 2px 0;line-height:1.6}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0 12px}

/* ---- painel executivo ---- */
.pgrid{display:grid;grid-template-columns:1.05fr 1.15fr .95fr;gap:14px;align-items:start}
@media(max-width:1280px){.pgrid{grid-template-columns:1fr 1fr}}
@media(max-width:820px){.pgrid{grid-template-columns:1fr}}
.pgrid2{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;margin-top:10px;align-items:start}
@media(max-width:1100px){.pgrid2{grid-template-columns:1fr}}
/* Altura travada é o que faz o painel caber numa tela: sem isso a coluna mais
   longa empurra lojas e regionais para baixo da dobra, e um painel que exige
   rolagem deixa de ser um painel. O excesso rola dentro do próprio cartão. */
.card .body{padding:12px 15px;max-height:330px;overflow:auto}
.pgrid .dupla > div{max-height:330px;overflow:auto}
.pgrid2 .card .body{max-height:220px}
.pgrid2 .dupla > div{max-height:220px;overflow:auto}
.card .body::-webkit-scrollbar,.dupla > div::-webkit-scrollbar{width:6px}
.card .body::-webkit-scrollbar-thumb,.dupla > div::-webkit-scrollbar-thumb{
  background:var(--line);border-radius:3px}
.linha{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:baseline;padding:7px 0;
  border-bottom:1px solid var(--line)}
.linha:last-child{border-bottom:0}
.linha .nm{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.linha .vl{font-size:12.5px;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.linha .dt{font-size:11px;color:var(--mut);grid-column:1/-1;margin-top:-4px}
.trilho{grid-column:1/-1;height:4px;background:var(--surf2);border-radius:3px;overflow:hidden;margin-top:5px}
.trilho i{display:block;height:100%;background:var(--brand);border-radius:3px}
.alerta{display:grid;grid-template-columns:3px 1fr;gap:11px;padding:9px 0;border-bottom:1px solid var(--line)}
.alerta:last-child{border-bottom:0}
.alerta .risco{border-radius:3px;background:var(--mut)}
.alerta.alto .risco{background:var(--neg)}
.alerta.medio .risco{background:var(--brand)}
.alerta .tt{font-size:12.5px;font-weight:600;margin-bottom:2px}
.alerta .tx{font-size:11.5px;color:var(--mut);line-height:1.5}
.spark{display:block;width:100%;height:34px;margin-top:6px}
.kpi .spark{margin-top:8px}
.dupla{display:grid;grid-template-columns:1fr 1fr;gap:0}
.dupla > div{padding:0 15px 12px}
.dupla > div:first-child{border-right:1px solid var(--line)}
.dupla h4{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);
  font-weight:600;padding:11px 0 6px}
.chip{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:600;
  background:var(--surf2);color:var(--mut)}
.bar label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);margin-right:-4px}
</style></head><body>

<div id="gate"><div class="box">
  <h2>DRE Consolidada</h2>
  <p>Acesso restrito. Informe a senha do BI.</p>
  <input id="pw" type="password" placeholder="senha" autocomplete="current-password">
  <button onclick="entrar()">Entrar</button>
  <div id="gateErr"></div>
</div></div>

<div id="app" style="display:none">
<header><div class="wrap">
  <div class="htop">
    <h1>DRE Consolidada — Roldão Atacadista<small id="sub">carregando…</small></h1>
    <div class="ctrl">
      <select id="recorte"></select>
      <button class="btn" id="btExp">Exportar CSV</button>
    </div>
  </div>
  <nav>
    <button class="on" data-v="painel">Painel</button>
    <button data-v="mes">Mês a Mês</button>
    <button data-v="comp">Comparativo</button>
    <button data-v="lojas">Lojas</button>
    <button data-v="reg">Regionais</button>
  </nav>
</div></header>
<main class="wrap">
  <div id="kpis" class="kpis"></div>
  <div id="bar" class="bar"></div>
  <div id="conteudo"><div class="empty">Carregando…</div></div>
  <div id="rodape" class="hint"></div>
</main>
</div>

<script>
var PW='', ST=null, VIEW='painel', DADOS={};

var $=function(s){return document.querySelector(s)};
var el=function(s){return document.getElementById(s)};

/* ---------- formatação ---------- */
function brl(v,curto){
  if(v==null) return null;
  if(curto){
    var a=Math.abs(v);
    if(a>=1e9) return (v/1e9).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' bi';
    if(a>=1e6) return (v/1e6).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' Mi';
    if(a>=1e3) return (v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mil';
  }
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
}
function cel(v,curto){
  if(v==null) return '<td class="nd">N/D</td>';
  return '<td class="'+(v<0?'neg':'')+'">'+brl(v,curto)+'</td>';
}
function pctTxt(p){ return p==null?'N/D':(p>=0?'+':'')+p.toFixed(1)+'%' }
/* Em % de movimento, positivo = a linha aumentou. Para despesa isso é ruim,
   para receita é bom — quem decide a cor é a natureza, não o sinal. */
function celPct(p,natureza){
  if(p==null) return '<td class="nd">N/D</td>';
  var ruim = natureza==='despesa' ? p>0 : p<0;
  return '<td class="'+(Math.abs(p)<0.05?'':(ruim?'neg':'pos'))+'">'+pctTxt(p)+'</td>';
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] }) }

/* ---------- api ---------- */
function api(rota){
  return fetch(rota,{headers:{'x-bir-pw':PW}}).then(function(r){
    if(r.status===401) throw new Error('senha');
    return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); return j })
  });
}
function entrar(){
  var v=el('pw').value;
  if(!v){ el('gateErr').textContent='Informe a senha.'; return }
  autenticar(v);
}
function autenticar(senha){
  PW=senha;
  api('/api/dre/status').then(function(s){
    ST=s;
    try{ sessionStorage.setItem('bir_pw',PW) }catch(e){}
    el('gate').style.display='none'; el('app').style.display='block';
    if(!ST.base){
      el('sub').textContent='Nenhuma Base Contábil importada.';
      el('conteudo').innerHTML='<div class="empty">A Base Contábil ainda não foi importada.<br><br>'+
        '<a class="btn pri" style="text-decoration:none;display:inline-block" href="/dre">Ir para a importação</a></div>';
      el('kpis').innerHTML=''; return;
    }
    var b=ST.base;
    el('sub').textContent = 'Base Contábil: '+b.meses[0]+' a '+b.meses[b.meses.length-1]+
      ' · '+b.lojas+' lojas · '+b.contas+' contas' +
      (b.arquivo ? '  |  ' + b.arquivo : '') +
      (b.importadoEm ? '  ·  importada em ' + new Date(b.importadoEm).toLocaleString('pt-BR') : '');
    montarRecorte(); render();
  }).catch(function(e){
    el('gateErr').textContent = e.message==='senha' ? 'Senha incorreta.' : ('Falha: '+e.message);
  });
}

/* O BI que embute esta página manda a senha por postMessage — assim o usuário
   não digita duas vezes e a senha não passa pela URL. */
window.addEventListener('message',function(ev){
  if(ev.data && ev.data.tipo==='bir-auth' && ev.data.senha && !ST) autenticar(ev.data.senha);
});

/* ---------- recorte ---------- */
function montarRecorte(){
  var h='<option value="">Empresa — todas as lojas</option>';
  (ST.regionais||[]).forEach(function(r){ h+='<option value="r:'+esc(r)+'">'+esc(r)+'</option>' });
  (ST.lojas||[]).forEach(function(l){
    h+='<option value="l:'+l.num+'">Loja '+l.num+(l.unidade?' — '+esc(l.unidade):'')+'</option>' });
  el('recorte').innerHTML=h;
}
function filtroAtual(){
  var v=el('recorte').value;
  if(!v) return '';
  return v.charAt(0)==='r' ? '&regional='+encodeURIComponent(v.slice(2)) : '&loja='+v.slice(2);
}
function rotuloRecorte(){
  var s=el('recorte'); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : 'Empresa';
}

/* ---------- navegação ---------- */
function irPara(v){
  VIEW=v;
  document.querySelectorAll('nav button').forEach(function(b){ b.classList.toggle('on', b.dataset.v===v) });
  render();
}
document.addEventListener('click',function(e){
  var b=e.target.closest('nav button'); if(b) irPara(b.dataset.v);
});
document.addEventListener('change',function(e){
  if(e.target.id==='recorte'||e.target.classList.contains('rf')) render();
});

function render(){
  if(!ST||!ST.base) return;
  el('conteudo').innerHTML='<div class="empty">Calculando…</div>';
  if(VIEW==='painel') viewPainel();
  else if(VIEW==='mes') viewMes(); else if(VIEW==='comp') viewComp();
  else if(VIEW==='lojas') viewLojas(); else viewReg();
}

/* ================= PAINEL EXECUTIVO ================= */
/* Minificha de tendência: doze pontos numa faixa de 34px dizem mais sobre o
   rumo do que qualquer número isolado, e cabem dentro do próprio cartão. */
function sparkline(vals, cor){
  var v=vals.filter(function(x){return x!=null});
  if(v.length<2) return '';
  var mn=Math.min.apply(null,v), mx=Math.max.apply(null,v), amp=(mx-mn)||1;
  var w=100, h=30, n=vals.length;
  var pts=[], area=[];
  vals.forEach(function(x,i){
    if(x==null) return;
    var px=(i/(n-1))*w, py=h-((x-mn)/amp)*(h-4)-2;
    pts.push(px.toFixed(1)+','+py.toFixed(1));
  });
  if(pts.length<2) return '';
  area=pts.slice(); area.unshift('0,'+h); area.push(w+','+h);
  var id='g'+Math.random().toString(36).slice(2,8);
  return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
    '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="'+cor+'" stop-opacity=".28"/>'+
      '<stop offset="100%" stop-color="'+cor+'" stop-opacity="0"/></linearGradient></defs>'+
    '<polygon points="'+area.join(' ')+'" fill="url(#'+id+')"/>'+
    '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+cor+'" stroke-width="1.6" '+
      'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
}

function kpiSpark(k,v,s,cls,vals,cor){
  return '<div class="kpi"><div class="k">'+k+'</div><div class="v '+(cls||'')+'">'+(v==null?'N/D':v)+
    '</div><div class="s">'+(s||'')+'</div>'+(vals?sparkline(vals,cor):'')+'</div>';
}

function viewPainel(){
  var ms=ST.base.meses, mes=DADOS.mesP||ms[ms.length-1];
  el('bar').innerHTML='<label>Competência</label>'+selMes2('mesP',mes,ms);
  DADOS.mesP=el('mesP').value;

  api('/api/dre/painel?mes='+DADOS.mesP+filtroAtual()).then(function(p){
    DADOS.painel=p;
    var k=p.kpis;

    /* --- faixa de KPIs --- */
    var deltaRes = k.resultadoImpacto==null ? '' :
      (k.resultadoImpacto>=0?'+':'')+brl(k.resultadoImpacto,true)+' vs '+k.rotuloAnterior;
    el('kpis').innerHTML =
      kpiSpark('Receita Bruta', brl(k.receita,true),
        k.receitaVar==null?rotuloRecorte():pctTxt(k.receitaVar)+' vs '+k.rotuloAnterior,
        k.receitaVar==null?'':(k.receitaVar>=0?'pos':'neg'), p.tendencia.receita, '#60a5fa') +
      kpiSpark('Resultado '+k.rotulo, brl(k.resultado,true), deltaRes,
        k.resultadoImpacto==null?'':(k.resultadoImpacto>=0?'pos':'neg'), p.tendencia.resultado, '#f5a623') +
      kpiSpark('Total de Despesas', brl(k.despesa,true),
        k.despesaVar==null?'':pctTxt(k.despesaVar)+' vs '+k.rotuloAnterior,
        k.despesaVar==null?'':(k.despesaVar>0?'neg':'pos')) +
      kpiSpark('Margem s/ Receita', k.margem==null?'N/D':k.margem.toFixed(1)+'%',
        k.margemPontos==null?'':(k.margemPontos>=0?'+':'')+k.margemPontos.toFixed(1)+' p.p. vs '+k.rotuloAnterior,
        k.margemPontos==null?'':(k.margemPontos>=0?'pos':'neg')) +
      kpiSpark('Lojas na competência', p.lojas?String(p.lojas.total):'—',
        p.lojas&&p.lojas.semBase?p.lojas.semBase+' aguardando base':'todas com lançamento',
        p.lojas&&p.lojas.semBase?'neg':'') +
      kpiSpark('Recorte', rotuloRecorte().replace('Empresa — todas as lojas','Empresa'),
        p.rotulos[0]+' a '+p.rotulos[p.rotulos.length-1]);

    /* --- coluna 1: para onde foi o dinheiro --- */
    var maxComp = p.composicao.length ? p.composicao[0].valor : 1;
    var h1='<div class="card"><h3>Para onde foi o dinheiro — <b>'+k.rotulo+'</b></h3><div class="body">';
    if(!p.composicao.length) h1+='<div class="tx" style="color:var(--mut);font-size:12px">Sem despesas na competência.</div>';
    p.composicao.forEach(function(c){
      h1+='<div class="linha"><div class="nm">'+esc(c.subGrupo)+'</div>'+
          '<div class="vl">'+brl(-c.valor,true)+'</div>'+
          '<div class="trilho"><i style="width:'+Math.max(2,(c.valor/maxComp)*100).toFixed(1)+'%"></i></div>'+
          '<div class="dt">'+(c.av==null?'':c.av.toFixed(1)+'% da receita')+
            (c.ah==null?'':'  ·  '+pctTxt(c.ah)+' vs mês anterior')+'</div></div>';
    });
    h1+='</div></div>';

    /* --- coluna 2: o que mudou --- */
    var h2='<div class="card"><h3>O que mudou vs <b>'+(k.rotuloAnterior||'—')+'</b></h3><div class="dupla">'+
      '<div><h4>Pesou contra</h4>'+ listaImpacto(p.pioras,'neg') +'</div>'+
      '<div><h4>Ajudou</h4>'+ listaImpacto(p.melhoras,'pos') +'</div></div></div>';

    /* --- coluna 3: exige atenção --- */
    var h3='<div class="card"><h3>Exige atenção <span class="chip">'+p.alertas.length+'</span></h3><div class="body">';
    if(!p.alertas.length) h3+='<div class="tx" style="color:var(--mut);font-size:12px">Nenhum desvio material nesta competência.</div>';
    p.alertas.forEach(function(a){
      h3+='<div class="alerta '+a.nivel+'"><div class="risco"></div><div>'+
          '<div class="tt">'+esc(a.titulo)+'</div><div class="tx">'+esc(a.texto)+'</div></div></div>';
    });
    h3+='</div></div>';

    /* --- faixa inferior: lojas e regionais --- */
    var h4='';
    if(p.lojas){
      h4+='<div class="card"><h3>Lojas — variação vs '+(k.rotuloAnterior||'—')+'</h3><div class="dupla">'+
        '<div><h4>Maiores quedas</h4>'+listaLoja(p.lojas.pioras,'neg')+'</div>'+
        '<div><h4>Maiores altas</h4>'+listaLoja(p.lojas.melhoras,'pos')+'</div></div>';
      if(p.lojas.semBase) h4+='<div class="body" style="border-top:1px solid var(--line)">'+
        '<div class="tx" style="font-size:11.5px;color:var(--mut)">Fora do ranking por não terem lançamento em '+k.rotulo+': '+
        p.lojas.semBaseNomes.map(function(l){return esc(String(l.loja)+' '+(l.unidade||''))}).join(', ')+'</div></div>';
      h4+='</div>';
    }
    var h5='';
    if(p.regionais){
      h5='<div class="card"><h3>Regionais</h3><div class="body">';
      var mx=Math.max.apply(null,p.regionais.map(function(r){return Math.abs(r.valor||0)}))||1;
      p.regionais.forEach(function(r){
        h5+='<div class="linha"><div class="nm">'+esc(r.regional)+' <span class="sub">'+r.lojas+' lojas</span></div>'+
            '<div class="vl">'+brl(r.valor,true)+'</div>'+
            '<div class="trilho"><i style="width:'+Math.max(2,(Math.abs(r.valor||0)/mx)*100).toFixed(1)+'%"></i></div>'+
            '<div class="dt">'+(r.ah==null?'':pctTxt(r.ah)+' vs mês anterior')+'</div></div>';
      });
      h5+='</div></div>';
    }

    el('conteudo').innerHTML='<div class="pgrid">'+h1+h2+h3+'</div>'+
      ((h4||h5)?'<div class="pgrid2">'+h4+h5+'</div>':'');
    /* Uma linha só: o painel precisa caber na tela, e a explicação longa das
       fórmulas vive nas abas de detalhe, onde há espaço para ela. */
    el('rodape').innerHTML='<b>Resultado</b> = receita menos despesas na competência  ·  '+
      '<b>Margem</b> = resultado sobre a Receita Bruta (<b>p.p.</b> = diferença em pontos, não variação relativa)  ·  '+
      'alertas ignoram valores abaixo do limiar de materialidade';
  }).catch(erro);
}

function listaImpacto(lista,cls){
  if(!lista.length) return '<div class="tx" style="color:var(--mut);font-size:12px;padding:6px 0">Nada nesta direção.</div>';
  var h='';
  lista.forEach(function(l){
    h+='<div class="linha"><div class="nm">'+esc(l.descricao)+'</div>'+
       '<div class="vl '+cls+'">'+brl(l.impacto,true)+'</div>'+
       '<div class="dt">'+brl(l.valorA,true)+' -> '+brl(l.valorB,true)+
         (l.variacaoPct==null?'':'  ·  '+pctTxt(l.variacaoPct))+'</div></div>';
  });
  return h;
}
function listaLoja(lista,cls){
  if(!lista.length) return '<div class="tx" style="color:var(--mut);font-size:12px;padding:6px 0">Sem lojas comparáveis.</div>';
  var h='';
  lista.forEach(function(l){
    h+='<div class="linha"><div class="nm">'+l.loja+' '+esc(l.unidade||'')+'</div>'+
       '<div class="vl '+cls+'">'+brl(l.impacto,true)+'</div>'+
       '<div class="dt">'+esc(l.regional||'')+(l.variacaoPct==null?'':'  ·  '+pctTxt(l.variacaoPct))+'</div></div>';
  });
  return h;
}

/* ================= MÊS A MÊS ================= */
function viewMes(){
  /* A barra é recriada a cada render, então a escolha do usuário precisa ser
     lida ANTES de o select ser destruído e reimpressa depois — sem isso trocar
     para "Conta contábil" ou para "% AH" volta sozinho para o padrão. */
  if(el('nivel')) DADOS.nivel = el('nivel').value;
  if(el('modo'))  DADOS.modo  = el('modo').value;
  var n = DADOS.nivel || 'subgrupo';
  var modo = DADOS.modo || 'valor';
  var op = function(v,rot,sel){ return '<option value="'+v+'"'+(v===sel?' selected':'')+'>'+rot+'</option>' };
  el('bar').innerHTML =
    '<label>Detalhe</label><select class="rf" id="nivel">'+
      op('subgrupo','Linhas da DRE (Sub Grupo)',n)+op('conta','Conta contábil (detalhado)',n)+
    '</select>'+
    '<label>Exibir</label><select class="rf" id="modo">'+
      op('valor','Valores em R$',modo)+op('av','% sobre a Receita (AV)',modo)+
      op('ah','% vs mês anterior (AH)',modo)+
    '</select>';

  api('/api/dre/serie?nivel='+n+filtroAtual()).then(function(s){
    DADOS.serie=s;
    var i=s.meses.length-1;

    /* KPIs do último mês do período */
    var res=s.totais[i], resAnt=i>0?s.totais[i-1]:null;
    var d = resAnt==null?null:res-resAnt;
    var desp = s.linhas.filter(function(l){return l.natureza==='despesa'})
      .reduce(function(a,l){return a+(l.valores[i]||0)},0);
    var maior = s.linhas.filter(function(l){return l.ah[i]!=null && l.natureza==='despesa'})
      .sort(function(a,b){return b.ah[i]-a.ah[i]})[0];
    el('kpis').innerHTML =
      kpi('Resultado '+s.rotulos[i], brl(res,true), d==null?'':'vs '+s.rotulos[i-1]+': '+brl(d,true), d==null?'':(d>=0?'pos':'neg')) +
      kpi('Receita Bruta', brl(s.receitaBruta[i],true), rotuloRecorte()) +
      kpi('Total de Despesas', brl(Math.abs(desp),true), s.linhas.filter(function(l){return l.natureza==='despesa'}).length+' linhas') +
      kpi('Maior alta de despesa', maior?esc(maior.descricao):'—', maior?pctTxt(maior.ah[i])+' vs mês anterior':'', 'neg') +
      kpi('Período', s.rotulos[0]+' a '+s.rotulos[i], s.meses.length+' meses de competência');

    var h='<div class="tbox"><table><thead><tr><th>'+(n==='conta'?'Conta contábil':'Linha da DRE')+'</th>';
    s.rotulos.forEach(function(r){ h+='<th>'+r+'</th>' });
    if(modo==='valor') h+='<th>Total</th>';
    h+='</tr></thead><tbody>';

    var sgAtual=null;
    s.linhas.forEach(function(l){
      if(n==='conta' && l.subGrupo!==sgAtual){
        sgAtual=l.subGrupo;
        h+='<tr class="grupo"><td colspan="'+(s.meses.length+2)+'">'+esc(sgAtual)+'</td></tr>';
      }
      h+='<tr><td>'+esc(l.descricao)+(n==='conta'?' <span class="sub">'+esc(l.conta)+'</span>':'')+'</td>';
      if(modo==='valor'){ l.valores.forEach(function(v){ h+=cel(v,true) }); h+=cel(l.total,true) }
      else if(modo==='av'){ l.av.forEach(function(p){ h+= p==null?'<td class="nd">N/D</td>':'<td>'+p.toFixed(2)+'%</td>' }) }
      else { l.ah.forEach(function(p){ h+=celPct(p,l.natureza) }) }
      h+='</tr>';
    });
    if(modo==='valor'){
      h+='<tr class="tot"><td>Resultado do período</td>';
      s.totais.forEach(function(v){ h+=cel(v,true) });
      h+=cel(s.totais.reduce(function(a,b){return a+b},0),true)+'</tr>';
    }
    h+='</tbody></table></div>';
    el('conteudo').innerHTML=h;
    el('rodape').innerHTML='<b>AV</b> = peso da linha sobre a Receita Bruta do mesmo mês. '+
      '<b>AH</b> = variação contra o mês anterior, lida na natureza da linha: <b>+</b> significa que a linha aumentou '+
      '(bom em receita, ruim em despesa). Célula <span class="nd">N/D</span> = sem lançamento na competência — '+
      'não é zero, é ausência de informação.';
  }).catch(erro);
}

/* ================= COMPARATIVO ================= */
function viewComp(){
  var ms=ST.base.meses, n=ms.length;
  var a=DADOS.mesA||ms[n-2]||ms[0], b=DADOS.mesB||ms[n-1];
  if(el('nivelC')) DADOS.nivelC = el('nivelC').value;
  var nv = DADOS.nivelC || 'subgrupo';
  var opc = function(v,rot){ return '<option value="'+v+'"'+(v===nv?' selected':'')+'>'+rot+'</option>' };
  el('bar').innerHTML='<label>De</label>'+selMes('mesA',a)+'<label>para</label>'+selMes('mesB',b)+
    '<label>Detalhe</label><select class="rf" id="nivelC">'+
      opc('subgrupo','Linhas da DRE')+opc('conta','Conta contábil')+'</select>';
  DADOS.mesA=el('mesA').value; DADOS.mesB=el('mesB').value;

  api('/api/dre/comparativo?mesA='+DADOS.mesA+'&mesB='+DADOS.mesB+'&nivel='+nv+filtroAtual()).then(function(c){
    DADOS.comp=c;
    var r=c.resumo;
    el('kpis').innerHTML =
      kpi('Resultado '+c.rotuloA, brl(r.totalA,true), '') +
      kpi('Resultado '+c.rotuloB, brl(r.totalB,true), '') +
      kpi('Impacto no resultado', brl(r.impactoTotal,true), pctTxt(r.variacaoPct), r.impactoTotal>=0?'pos':'neg') +
      kpi('Contas que surgiram', String(r.linhasNovas), 'sem valor em '+c.rotuloA) +
      kpi('Contas zeradas', String(r.linhasZeradas), 'tinham valor em '+c.rotuloA);

    el('conteudo').innerHTML =
      '<div class="grid2">'+
        cardLista('Maiores <b>pioras</b> do resultado', c.pioras, c, 'neg')+
        cardLista('Maiores <b>melhoras</b> do resultado', c.melhoras, c, 'pos')+
      '</div>'+
      '<div class="card" style="margin-top:16px"><h3>Todas as linhas — ordenadas por impacto no resultado</h3>'+
      tabelaComp(c)+'</div>';
    el('rodape').innerHTML='Ordenado por <b>impacto em R$</b>, não por percentual: uma conta pequena que triplicou '+
      'rende um % espetacular e não muda o fechamento, enquanto uma conta grande que subiu 9% decide o mês. '+
      'A coluna <b>Variação</b> é lida na natureza da linha (+ = aumentou); a coluna <b>Impacto</b> é o efeito com sinal no resultado.';
  }).catch(erro);
}
function selMes(id,sel){
  return '<select class="rf" id="'+id+'">'+ST.base.meses.map(function(m){
    return '<option value="'+m+'"'+(m===sel?' selected':'')+'>'+rot(m)+'</option>' }).join('')+'</select>';
}
function rot(m){
  var N=['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var p=m.split('-'); return N[Number(p[1])]+'/'+p[0].slice(2);
}
function cardLista(titulo,lista,c,cls){
  if(!lista.length) return '<div class="card"><h3>'+titulo+'</h3><div class="empty" style="padding:30px">Nenhuma linha nesta direção.</div></div>';
  var h='<div class="card"><h3>'+titulo+'</h3><div class="tbox" style="border:0;border-radius:0;max-height:none">'+
    '<table><thead><tr><th>Linha</th><th>'+c.rotuloA+'</th><th>'+c.rotuloB+'</th><th>Variação</th><th>Impacto</th></tr></thead><tbody>';
  lista.forEach(function(l){
    h+='<tr><td>'+esc(l.descricao)+(l.conta?' <span class="sub">'+esc(l.conta)+'</span>':'')+'</td>'+
       cel(l.valorA,true)+cel(l.valorB,true)+celPct(l.variacaoPct,l.natureza)+
       '<td class="'+cls+'">'+brl(l.impacto,true)+'</td></tr>';
  });
  return h+'</tbody></table></div></div>';
}
function tabelaComp(c){
  var h='<div class="tbox" style="border:0;border-radius:0"><table><thead><tr><th>Linha</th><th>Sub Grupo</th>'+
    '<th>'+c.rotuloA+'</th><th>'+c.rotuloB+'</th><th>Variação</th><th>Impacto</th><th>Situação</th></tr></thead><tbody>';
  c.linhas.forEach(function(l){
    var sit = l.novaConta?'<span class="pill i">conta nova</span>'
            : l.contaZerada?'<span class="pill n">zerada</span>':'';
    h+='<tr><td>'+esc(l.descricao)+(l.conta?' <span class="sub">'+esc(l.conta)+'</span>':'')+'</td>'+
       '<td style="text-align:left" class="sub">'+esc(l.subGrupo)+'</td>'+
       cel(l.valorA,true)+cel(l.valorB,true)+celPct(l.variacaoPct,l.natureza)+
       '<td class="'+(l.impacto>=0?'pos':'neg')+'">'+brl(l.impacto,true)+'</td><td>'+sit+'</td></tr>';
  });
  return h+'</tbody></table></div>';
}

/* ================= LOJAS ================= */
function viewLojas(){
  var ms=ST.base.meses, mes=DADOS.mesL||ms[ms.length-1];
  el('bar').innerHTML='<label>Competência</label>'+selMes2('mesL',mes,ms);
  DADOS.mesL=el('mesL').value;
  api('/api/dre/lojas?mes='+DADOS.mesL).then(function(r){
    DADOS.lojas=r;
    var comp=r.lojas.filter(function(l){return l.impacto!=null});
    var pior=r.pioras[0], melhor=r.melhoras[0];
    el('kpis').innerHTML =
      kpi('Lojas com movimento', String(r.lojas.length), 'em '+r.rotulo) +
      kpi('Aguardando base', String(r.semMovimento.length), r.semMovimento.length?'sem lançamento na competência':'todas fecharam') +
      kpi('Pior variação', pior?('Loja '+pior.loja):'—', pior?brl(pior.impacto,true)+' vs '+r.rotuloComparacao:'', 'neg') +
      kpi('Melhor variação', melhor?('Loja '+melhor.loja):'—', melhor?brl(melhor.impacto,true)+' vs '+r.rotuloComparacao:'', 'pos') +
      kpi('Comparáveis', String(comp.length), 'com os dois meses fechados');

    var h='<div class="tbox"><table><thead><tr><th>Loja</th><th>Regional</th>'+
      '<th>'+r.rotuloComparacao+'</th><th>'+r.rotulo+'</th><th>Variação</th><th>Impacto</th><th>Receita Bruta</th></tr></thead><tbody>';
    r.lojas.forEach(function(l){
      h+='<tr><td>'+l.loja+(l.unidade?' <span class="sub">'+esc(l.unidade)+'</span>':'')+'</td>'+
         '<td style="text-align:left" class="sub">'+esc(l.regional||'—')+'</td>'+
         cel(l.anterior,true)+cel(l.atual,true)+
         (l.variacaoPct==null?'<td class="nd">N/D</td>':'<td class="'+(l.variacaoPct>=0?'pos':'neg')+'">'+pctTxt(l.variacaoPct)+'</td>')+
         (l.impacto==null?'<td class="nd">N/D</td>':'<td class="'+(l.impacto>=0?'pos':'neg')+'">'+brl(l.impacto,true)+'</td>')+
         cel(l.receita,true)+'</tr>';
    });
    r.semMovimento.forEach(function(l){
      h+='<tr><td>'+l.loja+(l.unidade?' <span class="sub">'+esc(l.unidade)+'</span>':'')+'</td>'+
         '<td style="text-align:left" class="sub">'+esc(l.regional||'—')+'</td>'+
         '<td colspan="5" class="nd" style="text-align:left">N/D — aguardando Base Contábil desta competência</td></tr>';
    });
    el('conteudo').innerHTML=h+'</tbody></table></div>';
    el('rodape').innerHTML='Loja sem nenhum lançamento na competência aparece como <span class="nd">N/D — aguardando Base</span> '+
      'e fica fora do ranking. Zerar essa loja a colocaria como a melhor do mês, o que seria falso: '+
      '"não gastou nada" quase sempre significa base ainda não fechada.';
  }).catch(erro);
}
function selMes2(id,sel,ms){
  return '<select class="rf" id="'+id+'">'+ms.map(function(m){
    return '<option value="'+m+'"'+(m===sel?' selected':'')+'>'+rot(m)+'</option>' }).join('')+'</select>';
}

/* ================= REGIONAIS ================= */
function viewReg(){
  el('bar').innerHTML='';
  api('/api/dre/regionais').then(function(r){
    DADOS.reg=r;
    var i=r.meses.length-1;
    var tot=r.linhas.reduce(function(a,l){return a+(l.valores[i]||0)},0);
    var pior=r.linhas.filter(function(l){return l.ah[i]!=null}).sort(function(a,b){return a.ah[i]-b.ah[i]})[0];
    el('kpis').innerHTML =
      kpi('Regionais', String(r.linhas.length), 'com movimento em '+r.rotulos[i]) +
      kpi('Resultado consolidado', brl(tot,true), r.rotulos[i]) +
      kpi('Pior variação', pior?esc(pior.regional):'—', pior?pctTxt(pior.ah[i])+' vs mês anterior':'', 'neg') +
      kpi('Lojas mapeadas', String(r.linhas.reduce(function(a,l){return a+l.lojas},0)), 'distribuídas nas regionais');

    var h='<div class="tbox"><table><thead><tr><th>Regional</th><th>Lojas</th>';
    r.rotulos.forEach(function(x){ h+='<th>'+x+'</th>' });
    h+='<th>Total</th></tr></thead><tbody>';
    r.linhas.forEach(function(l){
      h+='<tr><td>'+esc(l.regional)+'</td><td>'+l.lojas+'</td>';
      l.valores.forEach(function(v){ h+=cel(v,true) });
      h+=cel(l.total,true)+'</tr>';
    });
    h+='<tr class="tot"><td>Consolidado</td><td>'+r.linhas.reduce(function(a,l){return a+l.lojas},0)+'</td>';
    r.meses.forEach(function(m,j){ h+=cel(r.linhas.reduce(function(a,l){return a+(l.valores[j]||0)},0),true) });
    h+=cel(r.linhas.reduce(function(a,l){return a+l.total},0),true)+'</tr>';
    el('conteudo').innerHTML=h+'</tbody></table></div>';
    el('rodape').innerHTML='Valores são o resultado do recorte (receita menos despesas). '+
      'A regional vem da própria Base Contábil, não de cadastro paralelo.';
  }).catch(erro);
}

/* ---------- utilitários ---------- */
function kpi(k,v,s,cls){
  return '<div class="kpi"><div class="k">'+k+'</div><div class="v '+(cls||'')+'">'+(v==null?'N/D':v)+
    '</div><div class="s">'+(s||'')+'</div></div>';
}
function erro(e){
  if(e.message==='senha'){ location.reload(); return }
  el('conteudo').innerHTML='<div class="empty">Não foi possível carregar.<br><br><span class="neg">'+esc(e.message)+'</span></div>';
  el('kpis').innerHTML='';
}

/* Exportação: o navegador baixa direto da API, com a senha no cabeçalho. */
el('btExp').addEventListener('click',function(){
  var rota, nome;
  if(VIEW==='painel'||VIEW==='mes'){ rota='/api/dre/serie.csv?nivel='+(DADOS.nivel||'subgrupo')+filtroAtual(); nome='dre-mes-a-mes'; }
  else if(VIEW==='comp'){ rota='/api/dre/comparativo.csv?mesA='+DADOS.mesA+'&mesB='+DADOS.mesB+
      '&nivel='+(DADOS.nivelC||'subgrupo')+filtroAtual(); nome='dre-comparativo'; }
  else if(VIEW==='lojas'){ rota='/api/dre/lojas.csv?mes='+DADOS.mesL; nome='dre-lojas'; }
  else { rota='/api/dre/regionais.csv'; nome='dre-regionais'; }
  var bt=this; bt.textContent='Gerando…'; bt.disabled=true;
  fetch(rota,{headers:{'x-bir-pw':PW}}).then(function(r){ return r.blob() }).then(function(b){
    var u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download=nome+'-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    bt.textContent='Exportar CSV'; bt.disabled=false;
  }).catch(function(){ bt.textContent='Falhou'; bt.disabled=false });
});

try{ var sp=sessionStorage.getItem('bir_pw'); if(sp){ el('pw').value=sp; autenticar(sp) } }catch(e){}
</script></body></html>`;

module.exports = { PAGINA_DRE_EXEC };
