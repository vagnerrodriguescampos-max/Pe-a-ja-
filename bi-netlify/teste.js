/**
 * Teste do Painel executivo da DRE dentro do index.html do BI.
 *
 * O arquivo real busca a base numa API que este sandbox não alcança, então a
 * rota /api/seed é interceptada com um seed sintético que tem exatamente a
 * forma que parseDreWorkbook produz. Nada do BI é modificado para o teste.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');

const DIR = __dirname;
const SEED = fs.readFileSync(path.join(DIR, 'seed-teste.json'), 'utf8');

const srv = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const f = path.join(DIR, 'site', p === '/' ? 'index.html' : p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nao encontrado'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(f));
});

const falhas = [], erros = [];
function ok(cond, oque, detalhe) {
  console.log((cond ? '  ok   ' : '  FALHA') + '  ' + oque + (detalhe ? '  ->  ' + detalhe : ''));
  if (!cond) falhas.push(oque + (detalhe ? ' -> ' + detalhe : ''));
}

(async () => {
  await new Promise(r => srv.listen(8099, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

  await page.route('**/api/seed*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: SEED }));

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });

  // --- portão ---
  await page.waitForSelector('#gatePw', { timeout: 10000 });
  await page.fill('#gatePw', 'qualquer-coisa');
  await page.click('#gateBtn');
  await page.waitForSelector('.gate', { state: 'detached', timeout: 15000 });
  ok(true, 'portao aceitou a base interceptada');

  // --- navegar ate a DRE ---
  const foi = await page.evaluate(() => {
    const alvos = [...document.querySelectorAll('[data-page],[data-nav],a,button')]
      .filter(e => /^\s*DRE/i.test(e.textContent || ''));
    if (!alvos.length) return null;
    alvos[0].click();
    return alvos[0].outerHTML.slice(0, 120);
  });
  ok(!!foi, 'encontrou a entrada de menu da DRE', foi || 'nenhum elemento com texto DRE');
  await page.waitForTimeout(1200);

  // --- o painel e a aba de abertura ---
  const abaAtiva = await page.evaluate(() => {
    const b = document.querySelector('#dreTab button.on');
    return b ? (b.dataset.t + '|' + b.textContent.trim()) : null;
  });
  ok(abaAtiva && abaAtiva.startsWith('painel'), 'Painel e a aba de abertura', abaAtiva);

  // --- conteudo do painel ---
  const m = await page.evaluate(() => {
    const t = s => [...document.querySelectorAll(s)];
    const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim();
    const kpis = t('.kpis .kpi, .kpi');
    return {
      kpis: kpis.length,
      kpiTitulos: kpis.map(txt).map(s => s.slice(0, 46)),
      sparklines: t('.kpi svg polyline, .kpi svg path').length,
      svgs: t('svg').length,
      tabelas: t('table').length,
      linhasTabela: t('table tbody tr').length,
      alturaPagina: (document.querySelector('#view') || document.documentElement).scrollHeight,
      // o que o pedido chama de "uma tela": indicadores + o que mudou + o que
      // exige ação visíveis sem rolar. O resto do painel é aprofundamento.
      dobra: (() => {
        const v = document.querySelector('#view'), d = document.querySelector('.dre-two');
        if (!v || !d) return null;
        return Math.round(d.getBoundingClientRect().bottom - v.getBoundingClientRect().top);
      })(),
      textoPainel: txt(document.querySelector('#dreBody') || document.body).slice(0, 6000)
    };
  });

  ok(m.kpis >= 6, 'seis KPIs no topo', m.kpis + ' encontrados');
  ok(m.sparklines >= 6, 'sparkline em cada KPI', m.sparklines + ' tracados');
  ok(m.svgs >= 8, 'cascata e evolucao desenhadas', m.svgs + ' svgs');
  ok(m.tabelas >= 2, 'rankings de loja presentes', m.tabelas + ' tabelas');
  ok(m.linhasTabela > 0, 'rankings preenchidos', m.linhasTabela + ' linhas');

  const secoes = ['O que mudou', 'atenç', 'Receita Bruta', 'EBITDA', 'CMV'];
  for (const s of secoes) ok(m.textoPainel.toLowerCase().includes(s.toLowerCase()), 'painel cita "' + s + '"');

  // --- os dois paineis da primeira tela precisam dizer coisas diferentes ---
  const dup = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.dre-two .card')];
    if (cards.length < 2) return null;
    const mov = [...cards[0].querySelectorAll('.dre-mov .nm')].map(e => e.textContent.trim());
    const ale = [...cards[1].querySelectorAll('.dre-mov .nm b')].map(e => e.textContent.trim());
    return { repetidos: ale.filter(a => mov.includes(a)), ale: ale.length };
  });
  ok(dup && dup.ale > 0 && dup.repetidos.length === 0,
     'alertas nao repetem a lista de movimentos',
     dup ? (dup.repetidos.join(', ') || dup.ale + ' alertas, nenhum repetido') : 'paineis nao encontrados');

  // --- a regressao que ja aconteceu: verbo contra sinal ---
  const contradicoes = (m.textoPainel.match(/(subiu|caiu|cresceu|recuou)\s+-\s?[\d,.]+%/gi) || []);
  ok(contradicoes.length === 0, 'nenhum texto do tipo "subiu -N%"', contradicoes.join(' | ') || 'nenhum');

  // --- nada pode vazar para fora da largura util ---
  const vaza = await page.evaluate(() => {
    const v = document.querySelector('#view');
    const lim = v.getBoundingClientRect().right;
    return [...v.querySelectorAll('#dreBody .card, #dreBody table')]
      .filter(e => e.getBoundingClientRect().right > lim + 1)
      .map(e => (e.className || e.tagName) + ' +' +
                Math.round(e.getBoundingClientRect().right - lim) + 'px');
  });
  ok(vaza.length === 0, 'nenhum bloco vaza da largura da tela', vaza.join(', ') || 'nenhum');

  // --- cabe numa tela ---
  ok(m.dobra != null && m.dobra <= 1000, 'KPIs + decisao cabem na primeira tela', m.dobra + 'px ate o fim de .dre-two');
  console.log('  info    altura total do painel: ' + m.alturaPagina + 'px (o restante e aprofundamento)');

  // --- as abas de detalhe continuam funcionando ---
  const abas = await page.evaluate(() => [...document.querySelectorAll('[data-t]')].map(b => b.dataset.t));
  ok(abas.length >= 4, 'drill-down preservado', abas.join(', '));
  for (const a of abas.filter(x => x !== 'painel')) {
    await page.click(`[data-t="${a}"]`);
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const v = document.querySelector('#dreBody');
      const t = v ? (v.textContent || '').trim() : '';
      return { n: t.length, erro: !!(v && v.querySelector('.insight.crit')) && /Erro ao montar/.test(t) };
    });
    ok(st.n > 200 && !st.erro, 'aba "' + a + '" renderiza', st.erro ? 'erro ao montar' : st.n + ' chars');
  }

  await page.click('[data-t="painel"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR, 'out', 'painel.png'), fullPage: true });

  ok(erros.length === 0, 'nenhum erro de JS', erros.slice(0, 6).join(' || ') || 'nenhum');

  await browser.close();
  srv.close();

  console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo passou'));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('quebrou:', e); process.exit(2); });
