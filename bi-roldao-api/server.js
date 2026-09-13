const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { buildSeedFromWorkbook, mergeSeed, parseDreWorkbook, mergeDre, derivarFechamento } = require('./lib');
const { parseBaseContabilDre } = require('./dreContabil');
const dre = require('./dre');
const X = require('./dreExec');
const { PAGINA_DRE } = require('./paginaDre');
const REG = require('./regionais');
const LOJAS = require('./lojas');
const { PAGINA_REGIONAIS } = require('./paginaRegionais');
const { PAGINA_DRE_EXEC } = require('./paginaDreExec');

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
/* Semente da DRE.
 *
 * O volume guarda o seed; um deploy troca o CÓDIGO e não reprocessa o DADO.
 * Isso já custou caro: o parser foi corrigido, o deploy saiu, e o BI continuou
 * mostrando o resultado do parser antigo porque ninguém tinha reenviado a
 * planilha. Corrigir código e depender de alguém lembrar de reimportar não é
 * uma correção — é uma pendência disfarçada.
 *
 * A semente sobe junto com o código e entra sozinha. É versionada, como a de
 * regionais, com duas travas:
 *   - só entra quando a versão embarcada é maior que a já aplicada;
 *   - nunca entra por cima de uma base que a própria operação subiu.
 * A segunda trava é a que importa: quem enviou a planilha pelo BI mandou mais
 * que qualquer coisa que eu embarque aqui. */
try {
  const arqSemente = path.join(__dirname, 'dre-inicial.json');
  if (fs.existsSync(arqSemente)) {
    /* Volume zerado não tem seed.json — a DRE não pode ficar de fora só por
       isso, senão um volume novo sobe sem resultado nenhum. */
    const s = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) : {};
    const semente = JSON.parse(fs.readFileSync(arqSemente, 'utf8'));
    const versaoAplicada = s.dreSementeVersao || 0;
    const daOperacao = !!s.dreDoUsuario;

    if (!s.dre) {
      s.dre = semente.dre; s.dreSementeVersao = semente.versao;
      fs.writeFileSync(SEED_FILE, JSON.stringify(s));
      console.log('DRE: semente v' + semente.versao + ' instalada (o volume não tinha DRE)');
    } else if (daOperacao) {
      console.log('DRE: semente v' + semente.versao + ' ignorada — a base atual foi enviada pela operação e manda mais');
    } else if (versaoAplicada < semente.versao) {
      const antes = (s.dre.stores || []).filter(x => s.dre.data && s.dre.data[x.name] && s.dre.data[x.name].receita_bruta).length;
      s.dre = semente.dre; s.dreSementeVersao = semente.versao;
      fs.writeFileSync(SEED_FILE, JSON.stringify(s));
      const depois = (semente.dre.stores || []).filter(x => semente.dre.data[x.name] && semente.dre.data[x.name].receita_bruta).length;
      console.log('DRE: semente v' + semente.versao + ' aplicada (v' + versaoAplicada + ' -> v' + semente.versao +
        ') | lojas com P&L: ' + antes + ' -> ' + depois + ' | origem: ' + semente.origemArquivo);
    } else {
      console.log('DRE: semente v' + semente.versao + ' já aplicada');
    }
  }
} catch (e) { console.error('falha ao aplicar semente da DRE:', e.message); }

/* De-para de NOMES de loja: mesma mecânica do de-para de regionais.
   A planilha de vendas, a Base Contábil e o cadastro da operação chamam a mesma
   loja de três jeitos ("F. Da Rocha" / "FRANCO DA ROCHA"). Sem isto, duas telas
   do mesmo BI parecem falar de lojas diferentes. */
try {
  const arqNomes = path.join(__dirname, 'lojas-inicial.json');
  if (fs.existsSync(arqNomes)) {
    const semente = JSON.parse(fs.readFileSync(arqNomes, 'utf8'));
    const atual = LOJAS.ler(DATA_DIR);
    if ((atual.sementeVersao || 0) < semente.versao) {
      const mapa = { ...semente.mapa, ...atual.mapa };   // ajuste manual sempre ganha
      const novas = Object.keys(semente.mapa).filter(n => !(n in atual.mapa));
      const salvo = LOJAS.gravar(DATA_DIR, mapa, semente.versao);
      console.log('nomes de loja: semente v' + semente.versao + ' aplicada | ' +
        Object.keys(salvo.mapa).length + ' no mapa | ' + novas.length + ' nova(s)');

      /* Aplicar na base já gravada, não só nas próximas importações: senão o
         de-para entra e nada muda na tela até alguém reimportar. */
      if (fs.existsSync(SEED_FILE)) {
        const sd = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
        const rv = LOJAS.aplicar(sd.stores || [], salvo.mapa);
        const rd = sd.dre ? LOJAS.aplicarNaDre(sd.dre, salvo.mapa) : { renomeadas: 0, trocas: [] };
        if (rv.renomeadas || rd.renomeadas) {
          fs.writeFileSync(SEED_FILE, JSON.stringify(sd));
          console.log('nomes de loja: ' + rv.renomeadas + ' na base de vendas, ' +
            rd.renomeadas + ' na DRE | ex.: ' +
            JSON.stringify([...rv.trocas, ...rd.trocas].slice(0, 4).map(t => t.de + ' -> ' + t.para)));
        } else {
          console.log('nomes de loja: a base já estava com os nomes oficiais');
        }
      }
    }
  }
} catch (e) { console.error('falha ao semear nomes de loja:', e.message); }

/* De-para de regionais: grava a lista oficial UMA VEZ, quando o volume ainda
   não tem a dele, e já corrige a base que estiver importada. Uma vez criado o
   arquivo, quem manda é a tela /regionais — o boot nunca mais mexe, senão uma
   loja removida de propósito voltaria sozinha no próximo deploy. */
try {
  const REG0 = require('./regionais');
  const semente = path.join(__dirname, 'regionais-inicial.json');
  if (fs.existsSync(semente)) {
    const inicial = JSON.parse(fs.readFileSync(semente, 'utf8'));
    const versao = Number(inicial.versao || 1);
    const atual = REG0.ler(DATA_DIR);
    /* A semente é versionada porque ela precisa poder ser COMPLEMENTADA depois:
       lojas que ficaram pendentes por falta de informação entram numa versão
       seguinte. Cada versão entra uma vez só, e apenas para loja que ainda não
       está no mapa — assim uma correção feita na tela nunca é sobrescrita pelo
       deploy. O preço é que uma loja apagada de propósito pode voltar se ela
       aparecer numa semente futura; nesse caso basta apagar de novo. */
    if (versao > (atual.sementeVersao || 0)) {
      const mesclado = Object.assign({}, inicial.mapa || {}, atual.mapa || {});
      const novas = Object.keys(inicial.mapa || {}).filter(k => !(k in (atual.mapa || {})));
      const salvo = REG0.gravar(DATA_DIR, mesclado, versao);
      console.log('de-para de regionais: semente v' + versao + ' aplicada |',
        Object.keys(salvo.mapa).length, 'lojas no mapa |', novas.length, 'nova(s):', JSON.stringify(novas));
      if (fs.existsSync(SEED_FILE)) {
        const s = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
        const ajuste = REG0.aplicar(s, salvo.mapa);
        fs.writeFileSync(SEED_FILE, JSON.stringify(s));
        console.log('de-para corrigiu', ajuste.corrigidas, 'loja(s) na base atual | regionais ->', JSON.stringify(s.regionals));
        if (ajuste.divergentes.length) console.log('   ', JSON.stringify(ajuste.divergentes.slice(0, 8)));
      }
    }
  }
} catch (e) { console.error('falha ao aplicar de-para inicial de regionais:', e.message); }

/* A base contábil vive em arquivo próprio, fora do seed.json: são ~35 mil
   linhas que o front de vendas não consome, e misturá-las encareceria todo
   GET /api/seed sem necessidade. */
const CONTABIL_FILE = path.join(DATA_DIR, 'contabil.json');

/* contabil.json passa de 7 MB. Ler e parsear isso a cada requisição custa
   centenas de milissegundos e some com a sensação de instantâneo na tela.
   O cache guarda o objeto já pronto e só reprocessa quando o arquivo muda —
   comparar mtime+tamanho é suficiente e não exige invalidação manual. */
let _contabilCache = null;
function lerContabil() {
  try {
    if (!fs.existsSync(CONTABIL_FILE)) return { base: null, despesas: {}, justificativas: null, atualizado: null };
    const st = fs.statSync(CONTABIL_FILE);
    const assinatura = st.mtimeMs + ':' + st.size;
    if (_contabilCache && _contabilCache.assinatura === assinatura) return _contabilCache.dados;
    const t0 = Date.now();
    const dados = JSON.parse(fs.readFileSync(CONTABIL_FILE, 'utf8'));
    /* A Base Contábil traz a própria coluna Regional, e ela diverge do cadastro
       oficial — Atibaia vem como "REGIONAL GRANDE SP" quando a operação a
       classifica em INTERIOR, e o vocabulário também é outro. Sem esta camada a
       DRE mostraria um recorte regional diferente do BI de vendas, com os
       mesmos números aparecendo em regionais diferentes conforme a tela. */
    aplicarRegionalOficial(dados);
    _contabilCache = { assinatura, dados };
    console.log('contabil.json carregado em', Date.now() - t0, 'ms (cache renovado)');
    return dados;
  } catch (e) { console.error('contabil.json ilegivel:', e.message); }
  return { base: null, despesas: {}, justificativas: null, atualizado: null };
}

/** Sobrepõe o de-para oficial de regionais nos fatos contábeis e no cadastro. */
function aplicarRegionalOficial(dados) {
  if (!dados || !dados.base || !Array.isArray(dados.base.fatos)) return;
  const mapa = REG.ler(DATA_DIR).mapa || {};
  if (!Object.keys(mapa).length) return;
  let trocados = 0;
  for (const f of dados.base.fatos) {
    const oficial = mapa[String(f.l)];
    if (oficial && f.rg !== oficial) { f.rg = oficial; trocados++; }
  }
  for (const l of dados.base.lojas || []) {
    const oficial = mapa[String(l.num)];
    if (oficial) l.regional = oficial;
  }
  if (trocados) console.log('DRE: regional oficial aplicada em', trocados, 'lançamentos contábeis');
}
function gravarContabil(c) {
  c.atualizado = new Date().toISOString();
  fs.writeFileSync(CONTABIL_FILE, JSON.stringify(c));
  _contabilCache = null;   // a próxima leitura reprocessa e reaplica o de-para
}

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
      /* O de-para oficial vale mais que a planilha: a aba de regionais já mudou
         de layout duas vezes de um jeito que enganou a detecção automática, e
         quem conferiu loja a loja é a fonte confiável. */
      const oficial = REG.ler(DATA_DIR);
      const ajuste = REG.aplicar(seed, oficial.mapa);
      fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
      console.log('base atualizada ->', seed.meta.maxDate, JSON.stringify(stats), 'em', ((Date.now() - t0) / 1000).toFixed(1) + 's');
      if (ajuste.corrigidas) console.log('de-para de regionais corrigiu', ajuste.corrigidas, 'loja(s):', JSON.stringify(ajuste.divergentes.slice(0, 10)));
      res.json({ ok: true, stats, meta: seed.meta, regionaisCorrigidas: ajuste.corrigidas, regionais: seed.regionals });
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
      /* Duas planilhas diferentes chegam pelo mesmo botão, e obrigar quem sobe a
         escolher o tipo certo é transferir para a pessoa um problema que o
         servidor resolve olhando o arquivo. A Base Contábil se identifica pela
         aba de lançamentos (colunas Unidade, Sub Grupo e Valor); qualquer outra
         coisa é tratada como a DRE gerencial. */
      const ehBaseContabil = wb.SheetNames.some(n => {
        const c = (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })[0] || [])
          .map(x => String(x == null ? '' : x).toLowerCase().trim());
        return c.includes('sub grupo') && c.includes('unidade') && c.includes('valor');
      });
      const oficial = REG.ler(DATA_DIR).mapa;
      const { dre: recebida, stats } = ehBaseContabil
        ? parseBaseContabilDre(wb, req.file.originalname, today, oficial)
        : parseDreWorkbook(wb, req.file.originalname, today);
      console.log('upload DRE reconhecido como:', ehBaseContabil ? 'Base Contábil (rede inteira)' : 'DRE gerencial (por regional)');
      let seed = {}; try { if (fs.existsSync(SEED_FILE)) seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch (e) {}
      // Soma com o que já existe: cada arquivo traz números de uma regional só,
      // e substituir apagaria as regionais importadas antes.
      const { dre, novasLojas, novosMeses } = mergeDre(seed.dre, recebida);
      const lairDerivados = derivarFechamento(dre);
      seed.dre = dre;
      // A partir daqui a base é da operação: nenhuma semente futura passa por cima.
      seed.dreDoUsuario = true;
      fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
      const comPnL = dre.stores.filter(x => dre.data[x.name] && dre.data[x.name].receita_bruta);
      const porRegional = {};
      comPnL.forEach(x => { porRegional[x.regional] = (porRegional[x.regional] || 0) + 1; });
      const semPnL = dre.stores.filter(x => !(dre.data[x.name] && dre.data[x.name].receita_bruta)).map(x => x.name);
      console.log('DRE atualizada ->', comPnL.length + '/' + dre.stores.length, 'lojas com P&L',
        '| por regional:', JSON.stringify(porRegional),
        '| meses:', JSON.stringify(dre.months),
        '| este arquivo trouxe', novasLojas.length, 'loja(s) nova(s)',
        '| LAIR derivado em', lairDerivados, 'escopo(s)',
        'em', ((Date.now() - t0) / 1000).toFixed(1) + 's');
      res.json({
        ok: true,
        stats: { ...stats, storesComPnL: comPnL.length, storesTotal: dre.stores.length, months: dre.months },
        acumulado: { porRegional, semPnL, fontes: dre.fontes || [dre.source] },
        esteArquivo: { novasLojas, novosMeses, arquivo: req.file.originalname,
                       tipo: ehBaseContabil ? 'base-contabil' : 'dre-gerencial',
                       subGruposNaoMapeados: stats.subGruposDesconhecidos || [],
                       grafiasMultiplas: stats.grafiasMultiplas || [] }
      });
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
      var m=r.meta?('\\nPeriodo: '+r.meta.periodMin+' ate '+r.meta.periodMax):'';
      msg(rotulo+' importado com sucesso.'+m+'\\n\\n'+JSON.stringify(r.stats||{},null,1),'ok');
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

/* ----------------------------- MÓDULO CONTÁBIL / DRE ----------------------------- */
app.get('/dre', (req, res) => res.type('html').send(PAGINA_DRE));

const exigeSenha = (req, res, next) => { if (!authed(req)) return res.status(401).json({ error: 'senha' }); next(); };

app.post('/api/upload-contabil', exigeSenha, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'sem arquivo' });
  try {
    const t0 = Date.now();
    console.log('upload BASE CONTABIL:', req.file.originalname, (req.file.size/1048576).toFixed(1)+'MB');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, dense: true });
    const base = dre.parseBaseContabil(wb);
    const c = lerContabil();
    c.base = { ...base, arquivo: req.file.originalname, importadoEm: new Date().toISOString() };
    gravarContabil(c);
    console.log('base contabil ->', base.stats.linhas, 'linhas,', base.lojas.length, 'lojas,', base.meses.join('/'), 'em', ((Date.now()-t0)/1000).toFixed(1)+'s');
    res.json({ ok: true, meses: base.meses, lojas: base.lojas.length, contas: base.contas.length, stats: base.stats });
  } catch (e) { console.error('erro upload-contabil:', e); res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/upload-despesas', exigeSenha, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'sem arquivo' });
  try {
    console.log('upload DESPESAS:', req.file.originalname);
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const d = dre.parseDespesas(wb);
    const c = lerContabil();
    const chave = `${d.loja}|${d.periodo.mes}`;
    c.despesas[chave] = { ...d, arquivo: req.file.originalname, importadoEm: new Date().toISOString() };
    gravarContabil(c);
    console.log('despesas -> loja', d.loja, d.periodo.mes, d.lancamentos.length, 'lancamentos');
    res.json({ ok: true, loja: d.loja, periodo: d.periodo, lancamentos: d.lancamentos.length, total: d.total });
  } catch (e) { console.error('erro upload-despesas:', e); res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/upload-justificativas', exigeSenha, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'sem arquivo' });
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const j = dre.parseJustificativas(wb);
    const c = lerContabil();
    c.justificativas = { ...j, arquivo: req.file.originalname, importadoEm: new Date().toISOString() };
    gravarContabil(c);
    console.log('justificativas ->', j.stats.contas, 'contas mapeadas');
    res.json({ ok: true, contas: j.stats.contas });
  } catch (e) { console.error('erro upload-justificativas:', e); res.status(500).json({ error: String(e.message || e) }); }
});

app.get('/api/dre/status', exigeSenha, (req, res) => {
  const c = lerContabil();
  res.json({
    base: c.base ? { meses: c.base.meses, lojas: c.base.lojas.length, contas: c.base.contas.length, arquivo: c.base.arquivo, importadoEm: c.base.importadoEm } : null,
    lojas: c.base ? c.base.lojas : [],
    regionais: c.base ? [...new Set(c.base.lojas.map(l => l.regional).filter(Boolean))].sort() : [],
    despesas: Object.keys(c.despesas || {}).map(k => { const [l, m] = k.split('|'); return { loja: Number(l), mes: m, lancamentos: c.despesas[k].lancamentos.length }; }),
    justificativas: c.justificativas ? { contas: c.justificativas.stats.contas } : null,
    atualizado: c.atualizado,
  });
});

app.get('/api/dre/reconciliacao', exigeSenha, (req, res) => {
  const c = lerContabil();
  if (!c.base) return res.status(404).json({ error: 'Base Contábil não importada.' });
  const loja = Number(req.query.loja);
  const mes = String(req.query.mes || c.base.meses[c.base.meses.length-1]);
  if (!Number.isFinite(loja)) return res.status(400).json({ error: 'informe ?loja=' });
  const d = c.despesas[`${loja}|${mes}`] || null;
  res.json(dre.reconciliar(c.base, d, loja, mes));
});

app.get('/api/dre/variacao', exigeSenha, (req, res) => {
  const c = lerContabil();
  if (!c.base) return res.status(404).json({ error: 'Base Contábil não importada.' });
  const ms = c.base.meses;
  const mesB = String(req.query.mesB || ms[ms.length-1]);
  const mesA = String(req.query.mesA || dre.mesAnterior(mesB));
  const filtro = {};
  if (req.query.loja) filtro.loja = Number(req.query.loja);
  if (req.query.regional) filtro.regional = String(req.query.regional);
  res.json(dre.variacao(c.base, mesA, mesB, filtro, c.justificativas));
});

app.get('/api/dre/consolidada', exigeSenha, (req, res) => {
  const c = lerContabil();
  if (!c.base) return res.status(404).json({ error: 'Base Contábil não importada.' });
  const meses = req.query.meses ? String(req.query.meses).split(',') : c.base.meses;
  const filtro = {};
  if (req.query.loja) filtro.loja = Number(req.query.loja);
  if (req.query.regional) filtro.regional = String(req.query.regional);
  res.json({ ...dre.dreConsolidada(c.base, meses, filtro), lojas: c.base.lojas });
});

/* ------------------------- DRE CONSOLIDADA — VISÃO EXECUTIVA -------------------------
   Servida numa rota própria para poder ser embutida por iframe dentro do BI que
   já existe sem arrastar junto as telas de importação e reconciliação. */
app.get('/dre-executiva', (req, res) => res.type('html').send(PAGINA_DRE_EXEC));

/* Lê a base contábil ou responde 404 — evita repetir a checagem em cada rota. */
function exigeBase(req, res) {
  const c = lerContabil();
  if (!c.base) { res.status(404).json({ error: 'Base Contábil não importada.' }); return null; }
  return c.base;
}
function recorte(req) {
  const f = {};
  if (req.query.loja) f.loja = Number(req.query.loja);
  if (req.query.regional) f.regional = String(req.query.regional);
  return f;
}
/* CSV vai como anexo, com charset explícito: sem isso o Excel ignora o BOM. */
function enviaCsv(res, nome, texto) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${nome}.csv"`);
  res.send(texto);
}

function serieDe(req, base) {
  return X.serieCompleta(base, {
    nivel: req.query.nivel === 'conta' ? 'conta' : 'subgrupo',
    filtro: recorte(req),
    meses: req.query.meses ? String(req.query.meses).split(',') : null,
  });
}
function comparativoDe(req, base) {
  const ms = base.meses;
  const mesB = String(req.query.mesB || ms[ms.length - 1]);
  const mesA = String(req.query.mesA || dre.mesAnterior(mesB));
  return X.comparativo(base, mesA, mesB, {
    nivel: req.query.nivel === 'conta' ? 'conta' : 'subgrupo',
    filtro: recorte(req),
  });
}

/* Tudo o que o painel mostra vem desta rota, numa resposta só. */
app.get('/api/dre/painel', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  res.json(X.painel(base, { mes: req.query.mes, filtro: recorte(req) }));
});

app.get('/api/dre/serie', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  res.json(serieDe(req, base));
});
app.get('/api/dre/serie.csv', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  enviaCsv(res, 'dre-mes-a-mes', X.csvSerie(serieDe(req, base)));
});

app.get('/api/dre/comparativo', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  res.json(comparativoDe(req, base));
});
app.get('/api/dre/comparativo.csv', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  enviaCsv(res, 'dre-comparativo', X.csvComparativo(comparativoDe(req, base)));
});

app.get('/api/dre/lojas', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  const mes = String(req.query.mes || base.meses[base.meses.length - 1]);
  res.json(X.porLoja(base, mes, { regional: req.query.regional, mesComparacao: req.query.mesComparacao }));
});
app.get('/api/dre/lojas.csv', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  const mes = String(req.query.mes || base.meses[base.meses.length - 1]);
  enviaCsv(res, 'dre-lojas', X.csvLojas(X.porLoja(base, mes, { regional: req.query.regional })));
});

app.get('/api/dre/regionais', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  res.json(X.porRegional(base, {}));
});
app.get('/api/dre/regionais.csv', exigeSenha, (req, res) => {
  const base = exigeBase(req, res); if (!base) return;
  enviaCsv(res, 'dre-regionais', X.csvRegionais(X.porRegional(base, {})));
});

/* -------------------------- DE-PARA LOJA -> REGIONAL -------------------------- */
app.get('/regionais', (req, res) => res.type('html').send(PAGINA_REGIONAIS));

function lerSeed() {
  try { if (fs.existsSync(SEED_FILE)) return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch (e) { console.error('seed ilegivel:', e.message); }
  return null;
}

app.get('/api/regionais', exigeSenha, (req, res) => {
  const seed = lerSeed();
  if (!seed) return res.status(404).json({ error: 'Nenhuma base importada ainda.' });
  const oficial = REG.ler(DATA_DIR);
  res.json({
    mapa: oficial.mapa,
    atualizado: oficial.atualizado,
    lojas: (seed.stores || []).map(s => ({ num: s.num, name: s.name, regional: s.regional || '' }))
      .sort((a, b) => a.num - b.num),
    regionais: REG.conhecidas(seed, oficial.mapa),
  });
});

app.post('/api/regionais', exigeSenha, express.json({ limit: '1mb' }), (req, res) => {
  const seed = lerSeed();
  if (!seed) return res.status(404).json({ error: 'Nenhuma base importada ainda.' });
  const mapa = (req.body && req.body.mapa) || {};
  if (typeof mapa !== 'object') return res.status(400).json({ error: 'mapa inválido' });
  try {
    const salvo = REG.gravar(DATA_DIR, mapa);
    _contabilCache = null;   // a DRE precisa reler com a regional nova
    const ajuste = REG.aplicar(seed, salvo.mapa);
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
    console.log('de-para de regionais salvo:', Object.keys(salvo.mapa).length, 'lojas |', ajuste.corrigidas, 'corrigidas na base');
    res.json({
      ok: true, lojasNoMapa: Object.keys(salvo.mapa).length, atualizado: salvo.atualizado,
      corrigidas: ajuste.corrigidas, divergentes: ajuste.divergentes, regionais: seed.regionals,
    });
  } catch (e) { console.error('erro ao salvar de-para:', e); res.status(500).json({ error: String(e.message || e) }); }
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use((err, req, res, next) => { res.status(400).json({ error: String((err && err.message) || err) }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('BI Roldao API na porta ' + PORT + ' | senha custom: ' + (!!process.env.BIR_PW)));
