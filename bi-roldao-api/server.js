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

app.use((err, req, res, next) => { res.status(400).json({ error: String((err && err.message) || err) }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('BI Roldao API na porta ' + PORT + ' | senha custom: ' + (!!process.env.BIR_PW)));
