'use strict';
/**
 * Tela do de-para loja -> regional.
 *
 * Existe para tirar do sistema a última palavra sobre uma informação que ele não
 * tem como saber sozinho. A planilha diz uma coisa, esta tela diz a definitiva, e
 * a diferença entre as duas fica visível na própria linha — quem confere precisa
 * enxergar o que a importação trouxe antes de sobrescrever.
 */

const PAGINA_REGIONAIS = String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roldão — Regionais por Loja</title>
<style>
:root{--bg:#0a0e17;--surf:#111725;--surf2:#161d2e;--line:#1f2937;--txt:#e8edf6;
  --mut:#8b97ad;--brand:#f5a623;--pos:#34d399;--neg:#f87171}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
#gate{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:50}
#gate .box{width:340px;text-align:center}
#gate h2{font-size:19px;font-weight:650;margin-bottom:6px}
#gate p{color:var(--mut);font-size:13px;margin-bottom:18px}
#gate input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid var(--line);background:var(--surf);color:var(--txt);font-size:14px;margin-bottom:10px}
#gate button,.btn{padding:10px 16px;border:0;border-radius:9px;background:var(--brand);color:#1a1206;font-weight:700;cursor:pointer;font-family:inherit;font-size:13.5px}
#gate button{width:100%}
.btn.sec{background:var(--surf);color:var(--txt);border:1px solid var(--line);font-weight:500}
#gateErr{color:#fca5a5;font-size:12.5px;margin-top:10px;min-height:16px}
header{border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:18px;position:sticky;top:0;background:var(--bg);z-index:20}
.htop{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
h1{font-size:17px;font-weight:650}
h1 small{display:block;color:var(--mut);font-size:11.5px;font-weight:400;margin-top:3px}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;
  border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left}
th{background:var(--surf2);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut)}
tr:last-child td{border-bottom:0}
td select,td input{background:var(--surf);border:1px solid var(--line);color:var(--txt);
  border-radius:7px;padding:6px 9px;font-size:12.5px;font-family:inherit;width:100%;max-width:230px}
tbody tr:hover td{background:var(--surf2)}
.dif{color:var(--brand);font-weight:600}
.vaz{color:var(--neg);font-style:italic}
.hint{color:var(--mut);font-size:12px;line-height:1.6;margin:14px 2px 18px}
#msg{margin:14px 0;padding:11px 14px;border-radius:9px;background:var(--surf);
  border:1px solid var(--line);font-size:13px;display:none;white-space:pre-wrap}
.barra{display:flex;gap:10px;align-items:center;margin:16px 0;flex-wrap:wrap}
</style></head><body>

<div id="gate"><div class="box">
  <h2>Regionais por Loja</h2>
  <p>Acesso restrito. Informe a senha do BI.</p>
  <input id="pw" type="password" placeholder="senha" autocomplete="current-password">
  <button onclick="entrar()">Entrar</button>
  <div id="gateErr"></div>
</div></div>

<div id="app" style="display:none"><div class="wrap">
<header><div class="htop">
  <h1>Regionais por Loja<small id="sub"></small></h1>
  <div class="barra" style="margin:0">
    <button class="btn sec" onclick="location.href='/dre-executiva'">Ir para a DRE</button>
    <button class="btn" id="btSalvar">Salvar de-para</button>
  </div>
</div></header>

<p class="hint">Esta tela manda mais que a planilha. O que você gravar aqui passa a valer no BI para
a base já importada e para as próximas, sem precisar reimportar.<br>
A coluna <b>Da planilha</b> mostra o que a última importação trouxe — quando ela diverge do de-para,
fica destacada, e é isso que você quer conferir. Loja deixada em branco no de-para continua usando
o valor da planilha.</p>

<div id="msg"></div>
<div id="tabela"></div>
</div></div>

<script>
var PW='', DADOS=null;
var el=function(i){return document.getElementById(i)};
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] }) }

function api(rota,opts){
  opts=opts||{};
  opts.headers=Object.assign({'x-bir-pw':PW},opts.headers||{});
  return fetch(rota,opts).then(function(r){
    if(r.status===401) throw new Error('senha');
    return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); return j })
  });
}
function entrar(){ var v=el('pw').value; if(!v){el('gateErr').textContent='Informe a senha.';return} autenticar(v) }
function autenticar(senha){
  PW=senha;
  api('/api/regionais').then(function(d){
    DADOS=d;
    try{ sessionStorage.setItem('bir_pw',PW) }catch(e){}
    el('gate').style.display='none'; el('app').style.display='block';
    render();
  }).catch(function(e){
    el('gateErr').textContent = e.message==='senha'?'Senha incorreta.':('Falha: '+e.message);
  });
}

function render(){
  var d=DADOS;
  el('sub').textContent = d.lojas.length+' lojas na base'+
    (d.atualizado ? '  ·  de-para salvo em '+new Date(d.atualizado).toLocaleString('pt-BR')
                  : '  ·  de-para ainda não preenchido');

  var opcoes=d.regionais.slice();
  var h='<table><thead><tr><th style="width:70px">Loja</th><th>Nome</th>'+
    '<th style="width:200px">Da planilha</th><th style="width:250px">Regional oficial</th></tr></thead><tbody>';
  d.lojas.forEach(function(l){
    var oficial=d.mapa[String(l.num)]||'';
    var diverge = oficial && oficial!==(l.regional||'');
    var daPlan = l.regional ? esc(l.regional) : '<span class="vaz">vazio</span>';
    h+='<tr><td>'+l.num+'</td><td>'+esc(l.name||'')+'</td>'+
       '<td class="'+(diverge?'dif':'')+'">'+daPlan+'</td>'+
       '<td><select class="rg" data-loja="'+l.num+'">'+
         '<option value="">— usar o da planilha —</option>'+
         opcoes.map(function(r){
           return '<option value="'+esc(r)+'"'+(r===oficial?' selected':'')+'>'+esc(r)+'</option>' }).join('')+
       '</select></td></tr>';
  });
  h+='</tbody></table>';
  el('tabela').innerHTML=h;
}

el('btSalvar').addEventListener('click',function(){
  var mapa={};
  document.querySelectorAll('select.rg').forEach(function(s){
    if(s.value) mapa[s.dataset.loja]=s.value;
  });
  var m=el('msg'); m.style.display='block'; m.textContent='Salvando…';
  this.disabled=true; var bt=this;
  api('/api/regionais',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({mapa:mapa})}).then(function(r){
    bt.disabled=false;
    var linhas=['De-para salvo. '+r.lojasNoMapa+' lojas definidas.'];
    if(r.corrigidas) linhas.push(r.corrigidas+' loja(s) tiveram a regional corrigida na base atual:');
    (r.divergentes||[]).slice(0,20).forEach(function(d){
      linhas.push('   loja '+d.loja+' '+(d.nome||'')+': "'+(d.daPlanilha||'vazio')+'" -> "'+d.oficial+'"'); });
    if(!r.corrigidas) linhas.push('A base já estava de acordo com o de-para — nada mudou.');
    linhas.push('');
    linhas.push('Regionais agora no BI: '+(r.regionais||[]).join(', '));
    m.textContent=linhas.join(String.fromCharCode(10));
    return api('/api/regionais').then(function(d){ DADOS=d; render() });
  }).catch(function(e){ bt.disabled=false; m.textContent='Erro ao salvar: '+e.message });
});

try{ var sp=sessionStorage.getItem('bir_pw'); if(sp){ el('pw').value=sp; autenticar(sp) } }catch(e){}
</script></body></html>`;

module.exports = { PAGINA_REGIONAIS };
