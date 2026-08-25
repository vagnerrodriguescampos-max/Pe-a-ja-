const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { buildSeedFromWorkbook, mergeSeed, parseDreWorkbook } = require('./lib');

// abas realmente usadas — ler só elas reduz drasticamente a memória (pula "Procv categoria" 275k linhas etc.)
const NEEDED_SHEETS = ['Base nova regional','Base loja','Base Segmento','Base de Subcategoria','ORÇADO','Orçado de categoria ','BASE VENDA DIA ','BESE VENDA ACUMULADO ','BASE TELE E ECOMM','Piso'];
// A senha vem EXCLUSIVAMENTE de variável de ambiente. O original tinha um valor
// embutido como fallback; removido por estar versionado em repositório público.
// Sem BIR_PW definida, authed() falha para qualquer entrada (fail-closed).
const PW = process.env.BIR_PW || '';
if (!PW) console.error('ATENCAO: BIR_PW nao definida — nenhum acesso autenticado sera aceito.');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
// inicializa a base a partir do seed embutido, se ainda não existir
if (!fs.existsSync(SEED_FILE) && fs.existsSync(path.join(__dirname, 'seed-initial.json'))) {
  try { fs.copyFileSync(path.join(__dirname, 'seed-initial.json'), SEED_FILE); console.log('base inicial copiada para o volume'); }
  catch (e) { console.error('falha ao inicializar seed:', e.message); }
}
// injeta a DRE inicial se o seed ainda não tiver `dre` (ex.: volume criado antes da DRE existir)
try {
  if (fs.existsSync(SEED_FILE) && fs.existsSync(path.join(__dirname, 'dre-initial.json'))) {
    const s = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    if (!s.dre) { s.dre = JSON.parse(fs.readFileSync(path.join(__dirname, 'dre-initial.json'), 'utf8')); fs.writeFileSync(SEED_FILE, JSON.stringify(s)); console.log('DRE inicial injetada no seed'); }
  }
} catch (e) { console.error('falha ao injetar DRE inicial:', e.message); }

const app = express();
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'x-bir-pw, content-type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function authed(req) { const pw = req.get('x-bir-pw') || req.query.pw; return pw && pw === PW; }

app.get('/', (req, res) => res.type('text/plain').send('BI Roldao — API de dados. OK.'));
app.get('/health', (req, res) => {
  let meta = null, dre = null; try { const s = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); meta = s.meta; if (s.dre) dre = { updated: s.dre.updated, months: s.dre.months, stores: s.dre.stores.length, comPnL: s.dre.stores.filter(x => s.dre.data[x.name] && s.dre.data[x.name].receita_bruta).length }; } catch (e) {}
  res.json({ ok: true, hasSeed: fs.existsSync(SEED_FILE), meta, dre });
});

// devolve a base pronta (leve) — protegida por senha
app.get('/api/seed', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'senha' });
  if (!fs.existsSync(SEED_FILE)) return res.status(404).json({ error: 'sem base' });
  res.type('application/json').send(fs.readFileSync(SEED_FILE, 'utf8'));
});

// recebe o arquivo inteiro, processa e mescla SÓ o que é novo
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 90 * 1024 * 1024 } });
app.post('/api/upload',
  (req, res, next) => { if (!authed(req)) return res.status(401).json({ error: 'senha' }); next(); },
  upload.single('file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'sem arquivo' });
    try {
      const t0 = Date.now();
      console.log('upload recebido:', req.file.originalname, (req.file.size / 1048576).toFixed(1) + 'MB');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, dense: true, sheets: NEEDED_SHEETS });
      const inc = buildSeedFromWorkbook(wb, req.file.originalname);
      let base = null; try { if (fs.existsSync(SEED_FILE)) base = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch (e) {}
      const { seed, stats } = mergeSeed(base, inc);
      fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
      console.log('base atualizada ->', seed.meta.maxDate, JSON.stringify(stats), 'em', ((Date.now() - t0) / 1000).toFixed(1) + 's');
      res.json({ ok: true, stats, meta: seed.meta });
    } catch (e) { console.error('erro no upload:', e); res.status(500).json({ error: String(e.message || e) }); }
  }
);

// recebe a planilha de DRE (empresa toda ou parcial), parseia e grava seed.dre — sem tocar na venda
app.post('/api/upload-dre',
  (req, res, next) => { if (!authed(req)) return res.status(401).json({ error: 'senha' }); next(); },
  upload.single('file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'sem arquivo' });
    try {
      const t0 = Date.now();
      console.log('upload DRE:', req.file.originalname, (req.file.size / 1048576).toFixed(1) + 'MB');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const today = new Date().toISOString().slice(0, 10);
      const { dre, stats } = parseDreWorkbook(wb, req.file.originalname, today);
      let seed = {}; try { if (fs.existsSync(SEED_FILE)) seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch (e) {}
      seed.dre = dre;
      fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
      console.log('DRE atualizada ->', stats.storesComPnL + '/' + stats.storesTotal, 'lojas,', JSON.stringify(stats.months), 'em', ((Date.now() - t0) / 1000).toFixed(1) + 's');
      res.json({ ok: true, stats });
    } catch (e) { console.error('erro no upload-dre:', e); res.status(500).json({ error: String(e.message || e) }); }
  }
);

// --- Pagina de restauracao/importacao servida pela propria API -------------
// Mesma origem => sem CORS. Util quando o front nao consegue carregar (base
// vazia) e, ainda assim, e preciso subir uma planilha para reconstruir tudo.
const PAGINA_RESTAURAR = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BI Roldao — Importar base</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
.w{max-width:560px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}p.sub{color:#94a3b8;margin:0 0 24px;font-size:14px}
label{display:block;font-size:13px;font-weight:600;margin:16px 0 6px;color:#cbd5e1}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:15px}
input[type=file]{padding:10px}
button{width:100%;margin-top:18px;padding:14px;border:0;border-radius:10px;background:#f59e0b;color:#1f2937;font-size:16px;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
.alt{background:#334155;color:#e2e8f0;margin-top:10px}
#st{margin-top:18px;padding:14px;border-radius:10px;background:#1e293b;border:1px solid #334155;font-size:14px;white-space:pre-wrap;display:none}
.ok{border-color:#16a34a!important}.err{border-color:#dc2626!important}
.bar{height:8px;background:#334155;border-radius:99px;overflow:hidden;margin-top:12px;display:none}
.bar i{display:block;height:100%;width:0;background:#f59e0b;transition:width .2s}
</style></head><body><div class="w">
<h1>Importar base do BI</h1>
<p class="sub">Envie a planilha para reconstruir ou atualizar os dados.</p>
<label>Senha</label><input id="pw" type="password" autocomplete="current-password" placeholder="senha de acesso">
<label>Planilha (.xlsx)</label><input id="f" type="file" accept=".xlsx,.xls,.xlsm">
<button id="b1">Enviar INFORMATIVO DE VENDAS</button>
<button id="b2" class="alt">Enviar planilha de DRE</button>
<div class="bar" id="bar"><i id="barI"></i></div>
<div id="st"></div>
</div><script>
var st=document.getElementById('st'),bar=document.getElementById('bar'),barI=document.getElementById('barI');
function msg(t,c){st.style.display='block';st.textContent=t;st.className=c||''}
function enviar(rota,rotulo){
  var pw=document.getElementById('pw').value, f=document.getElementById('f').files[0];
  if(!pw){return msg('Informe a senha.','err')}
  if(!f){return msg('Escolha o arquivo .xlsx.','err')}
  var fd=new FormData();fd.append('file',f);
  var x=new XMLHttpRequest();x.open('POST',rota);x.setRequestHeader('x-bir-pw',pw);
  document.getElementById('b1').disabled=true;document.getElementById('b2').disabled=true;
  bar.style.display='block';
  x.upload.onprogress=function(e){if(e.lengthComputable){barI.style.width=(e.loaded/e.total*100).toFixed(0)+'%'}};
  x.onload=function(){
    document.getElementById('b1').disabled=false;document.getElementById('b2').disabled=false;
    var r;try{r=JSON.parse(x.responseText)}catch(_){r={}}
    if(x.status===200){
      var m=r.meta?('\nPeriodo: '+r.meta.periodMin+' ate '+r.meta.periodMax):'';
      msg(rotulo+' importado com sucesso.'+m+'\n\n'+JSON.stringify(r.stats||{},null,1),'ok');
    } else if(x.status===401){ msg('Senha incorreta.','err') }
    else { msg('Falhou ('+x.status+'): '+(r.error||x.responseText||''),'err') }
  };
  x.onerror=function(){document.getElementById('b1').disabled=false;document.getElementById('b2').disabled=false;msg('Falha de rede durante o envio.','err')};
  msg('Enviando '+(f.size/1048576).toFixed(1)+' MB... o processamento leva cerca de 15s depois do envio.');
  x.send(fd);
}
document.getElementById('b1').onclick=function(){enviar('/api/upload','Informativo de vendas')};
document.getElementById('b2').onclick=function(){enviar('/api/upload-dre','DRE')};
</script></body></html>`;
app.get('/restaurar', (req, res) => res.type('html').send(PAGINA_RESTAURAR));

app.use((err, req, res, next) => { res.status(400).json({ error: String((err && err.message) || err) }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('BI Roldao API na porta ' + PORT + ' | senha custom: ' + (!!process.env.BIR_PW)));
