/* ===========================================================================
   Módulo de análise contábil / DRE do BI Roldão.

   Três fontes, três papéis distintos:

   1. Base Contábil  (aba "Base_Real.2026") — tabela plana, uma linha por
      loja × mês × conta contábil. É a verdade contábil por COMPETÊNCIA.
   2. Relatório de Despesas ("report") — lançamentos analíticos do sistema,
      um arquivo por loja/período, datados por VENCIMENTO.
   3. Justificativas ("DRE") — de-para Conta -> Sub Grupo da DRE e o formato
      oficial de justificativa de variação mês a mês.

   Competência != vencimento. Este módulo NUNCA mistura as duas bases: ele as
   apresenta lado a lado e explicita a defasagem, para que uma diferença de
   data nunca seja confundida com lançamento faltante.
   =========================================================================== */
const XLSX = require('xlsx');

const MESES = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
const MES_NOME = ['', 'Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Número tolerante a formato BR e a valores já numéricos. */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  // "1.234,56" (BR) vs "1,234.56" (US) vs "1234.56"
  const br = /,\d{1,2}$/.test(s);
  const limpo = br ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(limpo);
  return isFinite(n) ? n : 0;
}

/** "2026-07-31", Date ou "31/07/2026" -> "2026-07-31". */
function ymd(d) {
  if (d instanceof Date && !isNaN(d)) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  const s = String(d == null ? '' : d).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

/** "Fev"/"fevereiro"/2 -> "2026-02" dado o ano. */
function competencia(ano, mesTxt) {
  const n = norm(mesTxt).slice(0, 3);
  const m = MESES[n] || (Number(mesTxt) >= 1 && Number(mesTxt) <= 12 ? Number(mesTxt) : 0);
  if (!m || !ano) return null;
  return `${ano}-${String(m).padStart(2, '0')}`;
}

const aoa = (wb, nome) => wb.Sheets[nome]
  ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null })
  : null;

/** Localiza a linha de cabeçalho procurando por rótulos esperados. */
function acharCabecalho(linhas, obrigatorios, limite = 30) {
  const alvo = obrigatorios.map(norm);
  for (let i = 0; i < Math.min(limite, linhas.length); i++) {
    const cels = (linhas[i] || []).map(norm);
    if (alvo.every(a => cels.some(c => c === a || c.startsWith(a)))) return i;
  }
  return -1;
}

function mapaColunas(cabecalho) {
  const m = {};
  (cabecalho || []).forEach((h, i) => { const k = norm(h); if (k && !(k in m)) m[k] = i; });
  return m;
}

/** Busca o índice de uma coluna por qualquer um dos rótulos aceitos. */
function col(mapa, ...nomes) {
  for (const n of nomes) {
    const k = norm(n);
    if (k in mapa) return mapa[k];
    const achou = Object.keys(mapa).find(x => x.startsWith(k));
    if (achou) return mapa[achou];
  }
  return -1;
}

/* ---------------------------------------------------------------- BASE CONTÁBIL */
/**
 * Lê a aba plana "Base_Real.2026" (uma linha por loja × mês × conta).
 * Preferida sobre as abas-pivot por loja: mesma informação, sem ambiguidade
 * de layout e com Regional/Provisão/Recorrente já normalizados na origem.
 */
function parseBaseContabil(wb) {
  const nomeAba = wb.SheetNames.find(n => /base_real/i.test(n))
    || wb.SheetNames.find(n => /^base/i.test(n));
  if (!nomeAba) throw new Error('Base Contábil: aba "Base_Real.<ano>" não encontrada.');

  const linhas = aoa(wb, nomeAba);
  const iCab = acharCabecalho(linhas, ['Sub Grupo', 'C. Contábil', 'Valor'], 20);
  if (iCab < 0) throw new Error(`Base Contábil: cabeçalho não reconhecido na aba "${nomeAba}".`);
  const mapa = mapaColunas(linhas[iCab]);

  const c = {
    status: col(mapa, 'Status'),
    ano: col(mapa, 'Ano'),
    mes: col(mapa, 'Mês', 'Mes'),
    centro: col(mapa, 'Centro'),
    loja: col(mapa, 'Nº Lj BlueSoft', 'No Lj BlueSoft', 'Nº Lj', 'Loja'),
    unidade: col(mapa, 'Unidade'),
    recorrente: col(mapa, 'Recorrente'),
    provisao: col(mapa, 'Provisão', 'Provisao'),
    tp: col(mapa, 'Tp', 'Tipo'),
    conta: col(mapa, 'C. Contábil', 'C. Contabil', 'Conta Contábil'),
    descConta: col(mapa, 'Desc. Contabil', 'Desc. Contábil', 'Descrição'),
    grupo: col(mapa, 'Grupo'),
    subGrupo: col(mapa, 'Sub Grupo'),
    regional: col(mapa, 'Regional'),
    valor: col(mapa, 'Valor'),
  };
  for (const req of ['mes', 'conta', 'subGrupo', 'valor']) {
    if (c[req] < 0) throw new Error(`Base Contábil: coluna obrigatória "${req}" não encontrada.`);
  }

  const fatos = [];
  const meses = new Set(), lojas = new Map(), contas = new Map(), subGrupos = new Set();
  let ignoradas = 0;

  for (let r = iCab + 1; r < linhas.length; r++) {
    const L = linhas[r];
    if (!L) continue;
    const ano = c.ano >= 0 ? Number(L[c.ano]) : null;
    const comp = competencia(ano, L[c.mes]);
    const conta = L[c.conta];
    if (!comp || conta == null || String(conta).trim() === '') { ignoradas++; continue; }

    const lojaNum = c.loja >= 0 && L[c.loja] != null ? Number(L[c.loja]) : null;
    const f = {
      m: comp,
      l: Number.isFinite(lojaNum) ? lojaNum : null,
      u: c.unidade >= 0 ? String(L[c.unidade] ?? '').trim() : '',
      rg: c.regional >= 0 ? String(L[c.regional] ?? '').trim() : '',
      c: String(conta).trim(),
      d: c.descConta >= 0 ? String(L[c.descConta] ?? '').trim() : '',
      g: c.grupo >= 0 ? String(L[c.grupo] ?? '').trim() : '',
      sg: c.subGrupo >= 0 ? String(L[c.subGrupo] ?? '').trim() : '',
      rc: c.recorrente >= 0 ? String(L[c.recorrente] ?? '').trim() : '',
      pv: c.provisao >= 0 ? String(L[c.provisao] ?? '').trim() : '',
      tp: c.tp >= 0 ? String(L[c.tp] ?? '').trim() : '',
      v: num(L[c.valor]),
    };
    fatos.push(f);
    meses.add(f.m);
    if (f.l != null && !lojas.has(f.l)) lojas.set(f.l, { num: f.l, unidade: f.u, regional: f.rg });
    if (!contas.has(f.c)) contas.set(f.c, { conta: f.c, descricao: f.d, subGrupo: f.sg, grupo: f.g });
    if (f.sg) subGrupos.add(f.sg);
  }
  if (!fatos.length) throw new Error('Base Contábil: nenhuma linha válida encontrada.');

  return {
    fatos,
    meses: [...meses].sort(),
    lojas: [...lojas.values()].sort((a, b) => a.num - b.num),
    contas: [...contas.values()],
    subGrupos: [...subGrupos].sort(),
    stats: { linhas: fatos.length, ignoradas, aba: nomeAba },
  };
}

/* ------------------------------------------------------------ RELATÓRIO DESPESAS */
/**
 * Lê o relatório analítico de despesas do sistema. O bloco de filtros no topo
 * carrega a loja e o período — é dali que se sabe a QUEM e a QUANDO os
 * lançamentos pertencem, já que as linhas não repetem a loja.
 */
function parseDespesas(wb) {
  const nomeAba = wb.SheetNames.find(n => /report/i.test(n)) || wb.SheetNames[0];
  const linhas = aoa(wb, nomeAba);
  if (!linhas) throw new Error('Relatório de Despesas: planilha vazia.');

  let loja = null, dataInicial = null, dataFinal = null;
  for (let i = 0; i < Math.min(20, linhas.length); i++) {
    const txt = String((linhas[i] || [])[0] ?? '');
    let m = txt.match(/loja\s*:\s*(\d+)/i);            if (m) loja = Number(m[1]);
    m = txt.match(/data\s+inicial\s*:\s*(.+)/i);        if (m) dataInicial = ymd(m[1].trim());
    m = txt.match(/data\s+final\s*:\s*(.+)/i);          if (m) dataFinal = ymd(m[1].trim());
  }

  const iCab = acharCabecalho(linhas, ['Conta Contábil', 'Vencimento', 'Valor Líquido'], 25);
  if (iCab < 0) throw new Error('Relatório de Despesas: cabeçalho não reconhecido.');
  const mapa = mapaColunas(linhas[iCab]);
  const c = {
    conta: col(mapa, 'Conta Contábil'),
    fornecedor: col(mapa, 'Fornecedor'),
    descritivo: col(mapa, 'Descritivo'),
    vencimento: col(mapa, 'Vencimento'),
    fatura: col(mapa, 'Valor Fatura'),
    desconto: col(mapa, 'Desconto'),
    abatimento: col(mapa, 'Abatimento'),
    acrescimo: col(mapa, 'Acrescimo', 'Acréscimo'),
    liquido: col(mapa, 'Valor Líquido', 'Valor Liquido'),
  };

  const lancamentos = [];
  for (let r = iCab + 1; r < linhas.length; r++) {
    const L = linhas[r];
    if (!L) continue;
    const conta = c.conta >= 0 ? String(L[c.conta] ?? '').trim() : '';
    const venc = c.vencimento >= 0 ? ymd(L[c.vencimento]) : null;
    // linha de total: sem conta e sem vencimento, só valores
    if (!conta || !venc) continue;
    lancamentos.push({
      conta,
      fornecedor: c.fornecedor >= 0 ? String(L[c.fornecedor] ?? '').trim() : '',
      descritivo: c.descritivo >= 0 ? String(L[c.descritivo] ?? '').trim() : '',
      vencimento: venc,
      mesVenc: venc.slice(0, 7),
      valor: num(c.liquido >= 0 ? L[c.liquido] : L[c.fatura]),
      fatura: num(L[c.fatura]),
      desconto: num(L[c.desconto]),
      abatimento: num(L[c.abatimento]),
      acrescimo: num(L[c.acrescimo]),
    });
  }
  if (!lancamentos.length) throw new Error('Relatório de Despesas: nenhum lançamento encontrado.');
  if (loja == null) throw new Error('Relatório de Despesas: não foi possível identificar a loja no bloco de filtros.');

  const periodo = dataInicial && dataFinal
    ? { inicio: dataInicial, fim: dataFinal, mes: dataInicial.slice(0, 7) }
    : { inicio: null, fim: null, mes: lancamentos[0].mesVenc };

  return { loja, periodo, lancamentos, total: lancamentos.reduce((s, l) => s + l.valor, 0) };
}

/* -------------------------------------------------------------- JUSTIFICATIVAS */
/**
 * Lê o de-para oficial Conta -> Sub Grupo da DRE, além de eventuais
 * justificativas já preenchidas. Linhas "TotalSubGrupo"/"Total" são
 * marcadores de subtotal da planilha e não representam contas.
 */
function parseJustificativas(wb) {
  const nomeAba = wb.SheetNames.find(n => /dre/i.test(n)) || wb.SheetNames[0];
  const linhas = aoa(wb, nomeAba);
  if (!linhas) throw new Error('Justificativas: planilha vazia.');

  const iCab = acharCabecalho(linhas, ['Conta', 'Descrição'], 15);
  if (iCab < 0) throw new Error('Justificativas: cabeçalho não reconhecido.');
  const mapa = mapaColunas(linhas[iCab]);
  const c = {
    subGrupo: col(mapa, 'Sub Grupo', 'DRE Sub Grupo'),
    conta: col(mapa, 'Conta'),
    descricao: col(mapa, 'Descrição', 'Descricao'),
    justificativa: col(mapa, 'Justificativa'),
  };

  const dePara = {}; const registros = [];
  let subGrupoAtual = '';
  for (let r = iCab + 1; r < linhas.length; r++) {
    const L = linhas[r];
    if (!L) continue;
    const sg = c.subGrupo >= 0 ? String(L[c.subGrupo] ?? '').trim() : '';
    if (sg) subGrupoAtual = sg;                       // a planilha só repete o subgrupo na 1ª linha
    const conta = c.conta >= 0 ? String(L[c.conta] ?? '').trim() : '';
    const desc = c.descricao >= 0 ? String(L[c.descricao] ?? '').trim() : '';
    if (!conta || /^total/i.test(norm(desc))) continue;
    dePara[conta] = { subGrupo: subGrupoAtual, descricao: desc };
    registros.push({
      conta, descricao: desc, subGrupo: subGrupoAtual,
      justificativa: c.justificativa >= 0 ? String(L[c.justificativa] ?? '').trim() : '',
    });
  }
  if (!registros.length) throw new Error('Justificativas: nenhuma conta encontrada.');
  return { dePara, registros, stats: { contas: registros.length } };
}

module.exports = { parseBaseContabil, parseDespesas, parseJustificativas, norm, num, ymd, competencia, MES_NOME };

/* =========================================================================
   ANÁLISE 1 — RECONCILIAÇÃO  (competência × vencimento, lado a lado)

   A Base Contábil registra por COMPETÊNCIA; o relatório de despesas, por
   VENCIMENTO. Uma conta pode existir num e não no outro simplesmente porque
   a fatura vence no mês seguinte. Por isso o resultado NUNCA afirma
   "faltou lançar": ele separa o que é divergência real do que é apenas
   defasagem de data, e mostra as duas colunas sempre.
   ========================================================================= */

/* O relatório de despesas nomeia as contas com prefixos que a contabilidade
   não usa ("Despesas com Manutenção de Máquinas" x "Manutenção de Máquinas").
   Removê-los antes de comparar eleva muito a taxa de casamento sem recorrer a
   correspondência aproximada, que poderia unir contas realmente distintas. */
const PREFIXOS = [
  'despesas com ', 'despesa com ', 'despesas de ', 'despesas ', 'despesa ',
  'servicos terceiros ', 'servico terceiros ', 'servicos de ', 'servico de ', 'servicos ',
  'locacao de ', 'manutencao com ', 'gastos com ', 'gasto com ', 'outras ',
];
function chaveConta(txt) {
  let k = norm(txt).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const p of PREFIXOS) {
      if (k.startsWith(p) && k.length > p.length + 3) { k = k.slice(p.length).trim(); mudou = true; }
    }
  }
  return k;
}

/** Índice descrição -> conta, indexando tanto a forma literal quanto a reduzida. */
function indexarPorDescricao(fatos) {
  const idx = new Map();
  for (const f of fatos) {
    if (!f.d) continue;
    const reg = { conta: f.c, descricao: f.d, subGrupo: f.sg, grupo: f.g };
    for (const k of [norm(f.d), chaveConta(f.d)]) {
      if (k && !idx.has(k)) idx.set(k, reg);
    }
  }
  return idx;
}

/** Resolve o nome vindo do relatório contra o índice contábil. */
function acharConta(idx, nome) {
  return idx.get(norm(nome)) || idx.get(chaveConta(nome)) || null;
}

function mesAnterior(comp) {
  const [a, m] = comp.split('-').map(Number);
  return m === 1 ? `${a-1}-12` : `${a}-${String(m-1).padStart(2,'0')}`;
}
function mesSeguinte(comp) {
  const [a, m] = comp.split('-').map(Number);
  return m === 12 ? `${a+1}-01` : `${a}-${String(m+1).padStart(2,'0')}`;
}

/* Subgrupos e contas que, por natureza, não passam pelo contas a pagar. */
/* Deliberadamente conservador: só entram aqui os grupos que comprovadamente
   NÃO passam por contas a pagar. "Despesas c/ Pessoal" ficou de fora da lista
   porque contém itens que têm nota de fornecedor (refeitório terceirizado,
   consumo interno) — nesses casos a linha deve aparecer para conferência, não
   ser silenciosamente excluída. Numa ferramenta de auditoria, o custo de um
   falso positivo é muito menor que o de uma omissão. */
const SUBGRUPOS_FORA_ESCOPO = ['ocupacao (p)', 'ocupacao (t)',
  'depreciacao e amortizacao', 'resultado financeiro', 'impostos'];
const PADROES_FORA_ESCOPO = /salario|ordenado|inss|fgts|ferias|rescis|encargo|provis|13. salario|aluguel|alugueis|deprecia|amortiza|juros|iof|tarifa banc/;

function foraDoEscopo(cb) {
  if (SUBGRUPOS_FORA_ESCOPO.includes(norm(cb.subGrupo))) return true;
  return PADROES_FORA_ESCOPO.test(norm(cb.descricao));
}

/**
 * Reconcilia uma loja/mês. `despesas` é o resultado de parseDespesas (pode ser
 * null quando a loja ainda não teve o relatório importado — nesse caso o lado
 * "lançado" volta como indisponível, nunca como zero).
 */
function reconciliar(base, despesas, lojaNum, comp) {
  const doMes = base.fatos.filter(f => f.l === lojaNum && f.m === comp && f.g === 'Despesas');
  const idxDesc = indexarPorDescricao(base.fatos);

  // lado contábil, agregado por conta
  const contabil = new Map();
  for (const f of doMes) {
    const cur = contabil.get(f.c) || { conta: f.c, descricao: f.d, subGrupo: f.sg, valor: 0, recorrente: f.rc, provisao: f.pv };
    cur.valor += f.v;
    contabil.set(f.c, cur);
  }

  if (!despesas) {
    const linhas = [...contabil.values()].map(x => ({
      conta: x.conta, descricao: x.descricao, subGrupo: x.subGrupo,
      contabil: x.valor, lancado: null, diferenca: null,
      status: 'aguardando_base', recorrente: x.recorrente, provisao: x.provisao,
    })).sort((a, b) => Math.abs(b.contabil) - Math.abs(a.contabil));
    return {
      loja: lojaNum, competencia: comp, disponivel: false,
      motivo: 'Relatório de Despesas ainda não importado para esta loja/mês.',
      linhas, totais: { contabil: linhas.reduce((s, l) => s + l.contabil, 0), lancado: null, diferenca: null },
    };
  }

  // lado lançamentos, agregado por conta (casando pelo nome da conta)
  const lancado = new Map();
  const semCorrespondencia = [];
  for (const l of despesas.lancamentos) {
    const achado = acharConta(idxDesc, l.conta);
    const chave = achado ? achado.conta : `?${norm(l.conta)}`;
    const cur = lancado.get(chave) || {
      conta: achado ? achado.conta : null, descricao: achado ? achado.descricao : l.conta,
      subGrupo: achado ? achado.subGrupo : '', valor: 0, itens: 0, reconhecida: !!achado,
    };
    cur.valor += l.valor; cur.itens++;
    lancado.set(chave, cur);
    if (!achado) semCorrespondencia.push(l.conta);
  }

  // Detecta defasagem: conta sem par neste mês, mas presente no mês vizinho da contabilidade.
  const contasVizinhas = new Set(
    base.fatos.filter(f => f.l === lojaNum && (f.m === mesAnterior(comp) || f.m === mesSeguinte(comp)))
      .map(f => f.c)
  );

  const chaves = new Set([...contabil.keys(), ...lancado.keys()]);
  const linhas = [];
  for (const k of chaves) {
    const cb = contabil.get(k);
    const lc = lancado.get(k);
    const vCb = cb ? cb.valor : 0;
    // despesa é negativa na contabilidade; o relatório traz valor positivo a pagar
    const vLc = lc ? -Math.abs(lc.valor) : 0;
    const dif = vCb - vLc;

    /* Nem toda despesa transita pelo contas a pagar: folha, encargos, aluguel e
       provisões são lançados direto na contabilidade e jamais aparecerão no
       relatório de fornecedores. Marcá-las como "faltando lançar" seria um
       falso positivo — elas ficam fora do escopo da conciliação. */
    let status;
    if (cb && lc) status = Math.abs(dif) < 0.01 ? 'conciliado' : 'divergente';
    else if (cb && !lc) {
      if (foraDoEscopo(cb)) status = 'fora_do_escopo';
      else status = contasVizinhas.has(k) ? 'defasagem_provavel' : 'sem_lancamento';
    }
    else status = lc && !lc.reconhecida ? 'conta_nao_mapeada' : 'sem_contabilizacao';

    linhas.push({
      conta: (cb && cb.conta) || (lc && lc.conta) || String(k).replace(/^\?/, ''),
      descricao: (cb && cb.descricao) || (lc && lc.descricao) || '',
      subGrupo: (cb && cb.subGrupo) || (lc && lc.subGrupo) || '',
      contabil: cb ? vCb : null,
      lancado: lc ? vLc : null,
      itens: lc ? lc.itens : 0,
      diferenca: cb && lc ? dif : null,
      status,
      recorrente: cb ? cb.recorrente : '',
      provisao: cb ? cb.provisao : '',
    });
  }
  linhas.sort((a, b) => {
    const pa = Math.abs(a.diferenca ?? a.contabil ?? a.lancado ?? 0);
    const pb = Math.abs(b.diferenca ?? b.contabil ?? b.lancado ?? 0);
    return pb - pa;
  });

  const totCb = linhas.reduce((s, l) => s + (l.contabil || 0), 0);
  const totLc = linhas.reduce((s, l) => s + (l.lancado || 0), 0);
  return {
    loja: lojaNum, competencia: comp, disponivel: true,
    periodoLancamentos: despesas.periodo,
    linhas,
    totais: { contabil: totCb, lancado: totLc, diferenca: totCb - totLc },
    resumo: linhas.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {}),
    contasNaoMapeadas: [...new Set(semCorrespondencia)],
  };
}

/* =========================================================================
   ANÁLISE 2 — VARIAÇÃO MÊS A MÊS  (formato oficial de justificativa)
   ========================================================================= */
/**
 * Compara duas competências no nível de conta, no mesmo formato da planilha
 * JUSTIFICATIVAS (Sub Grupo | Conta | Descrição | Mês anterior | Mês atual |
 * A-1 % | Justificativa). `filtro` aceita { loja } ou { regional }.
 */
function variacao(base, compA, compB, filtro = {}, justificativas = null) {
  const aplica = f => {
    if (filtro.loja != null && f.l !== filtro.loja) return false;
    if (filtro.regional && norm(f.rg) !== norm(filtro.regional)) return false;
    return true;
  };
  const soma = comp => {
    const m = new Map();
    for (const f of base.fatos) {
      if (f.m !== comp || !aplica(f)) continue;
      const cur = m.get(f.c) || { conta: f.c, descricao: f.d, subGrupo: f.sg, grupo: f.g, valor: 0 };
      cur.valor += f.v; m.set(f.c, cur);
    }
    return m;
  };
  const A = soma(compA), B = soma(compB);
  const jt = justificativas && justificativas.dePara ? justificativas.dePara : {};

  const linhas = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const a = A.get(k), b = B.get(k);
    const vA = a ? a.valor : 0, vB = b ? b.valor : 0;
    const delta = vB - vA;
    // variação % sobre o valor absoluto do mês anterior (evita sinal invertido em despesa)
    const pct = Math.abs(vA) > 0.01 ? (Math.abs(vB) - Math.abs(vA)) / Math.abs(vA) * 100 : (Math.abs(vB) > 0.01 ? null : 0);
    const ref = b || a;
    linhas.push({
      subGrupo: ref.subGrupo, grupo: ref.grupo, conta: ref.conta, descricao: ref.descricao,
      mesAnterior: vA, mesAtual: vB, delta, variacaoPct: pct,
      novaConta: !a && !!b, contaEncerrada: !!a && !b,
      justificativa: (jt[ref.conta] && jt[ref.conta].justificativa) || '',
    });
  }
  linhas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const totalA = linhas.reduce((s, l) => s + l.mesAnterior, 0);
  const totalB = linhas.reduce((s, l) => s + l.mesAtual, 0);
  return {
    compA, compB, filtro, linhas,
    totais: { mesAnterior: totalA, mesAtual: totalB, delta: totalB - totalA,
              variacaoPct: Math.abs(totalA) > 0.01 ? (Math.abs(totalB)-Math.abs(totalA))/Math.abs(totalA)*100 : null },
  };
}

/* =========================================================================
   ANÁLISE 3 — DRE CONSOLIDADA por loja / regional / empresa
   ========================================================================= */
/** Ordem de apresentação das linhas da DRE (subgrupos vindos da contabilidade). */
const ORDEM_DRE = [
  'Receita Bruta', 'Descontos', 'Devolução', 'Impostos',
  'CMV', 'Contratos', 'Negociação', 'ICMS-ST Port.CAT-42', 'Operação Logística', 'QI e QNI c/ Verbas',
  'Despesas c/ Pessoal', 'Ocupação (P)', 'Ocupação (T)', 'Utilidades e Serviços',
  'Manutenção e Conservação', 'Outras Receitas e Despesas', 'Despesas Gerais', 'Impostos e Taxas',
  'Leasing e Alugueis', 'Dados e Comunicação', 'Processos Jurídicos', 'Propaganda e Publicidade',
  'Serviços Profissionais', 'Depreciação e Amortização', 'Resultado Financeiro', 'Resultado Não Operacional',
];

/**
 * Monta a DRE de um recorte (loja, regional ou empresa) para as competências
 * pedidas. Nada é estimado: cada célula é a soma dos lançamentos contábeis
 * daquele subgrupo. Subgrupos sem movimento voltam como null (indisponível),
 * nunca como zero — zero e "não existe" são coisas diferentes.
 */
function dreConsolidada(base, meses, filtro = {}) {
  const aplica = f => {
    if (filtro.loja != null && f.l !== filtro.loja) return false;
    if (filtro.regional && norm(f.rg) !== norm(filtro.regional)) return false;
    return true;
  };
  const grade = new Map();  // subGrupo -> { mes -> valor }
  for (const f of base.fatos) {
    if (!meses.includes(f.m) || !aplica(f) || !f.sg) continue;
    const linha = grade.get(f.sg) || {};
    linha[f.m] = (linha[f.m] || 0) + f.v;
    grade.set(f.sg, linha);
  }
  const presentes = [...grade.keys()];
  const ordenados = [
    ...ORDEM_DRE.filter(s => presentes.some(p => norm(p) === norm(s))),
    ...presentes.filter(p => !ORDEM_DRE.some(s => norm(s) === norm(p))),
  ];
  const linhas = ordenados.map(sg => {
    const chave = presentes.find(p => norm(p) === norm(sg)) || sg;
    const vals = grade.get(chave) || {};
    return {
      subGrupo: chave,
      valores: meses.map(m => (m in vals ? vals[m] : null)),
      total: meses.reduce((s, m) => s + (vals[m] || 0), 0),
    };
  });
  const receita = meses.map((m, i) => {
    const rb = linhas.find(l => norm(l.subGrupo) === 'receita bruta');
    return rb ? rb.valores[i] : null;
  });
  return { meses, filtro, linhas, receitaBruta: receita };
}

module.exports.reconciliar = reconciliar;
module.exports.variacao = variacao;
module.exports.dreConsolidada = dreConsolidada;
module.exports.mesAnterior = mesAnterior;
module.exports.mesSeguinte = mesSeguinte;
module.exports.ORDEM_DRE = ORDEM_DRE;
