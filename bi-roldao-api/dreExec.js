'use strict';
/**
 * Camada executiva da DRE.
 *
 * O módulo `dre.js` responde "quanto foi cada linha da DRE". Este responde as
 * perguntas que uma diretoria realmente faz: o que mudou, quanto isso custou no
 * resultado, quem puxou para cima, quem puxou para baixo e desde quando.
 *
 * ---------------------------------------------------------------------------
 * CONVENÇÃO DE SINAL — a decisão mais importante deste arquivo
 * ---------------------------------------------------------------------------
 * Na Base Contábil receita entra positiva e despesa entra negativa. Isso torna
 * a soma de qualquer recorte igual ao resultado daquele recorte, o que é ótimo
 * para consolidar e péssimo para ranquear: uma despesa que vai de -100 para
 * -150 "diminuiu" em valor com sinal, mas cresceu 50% na vida real.
 *
 * Um relatório executivo que inverte esse sinal perde a credibilidade na
 * primeira reunião. Então cada variação é publicada em DUAS leituras, e nunca
 * numa só:
 *
 *   movimento — o quanto a linha andou na própria natureza dela (a despesa
 *               cresceu 50%). É o número que o gestor da conta reconhece.
 *   impacto   — quanto isso somou ou tirou do resultado, já com sinal
 *               (-50). É o número que a diretoria soma.
 *
 * `impacto` é sempre simplesmente (valorB - valorA). Como despesa é negativa,
 * gastar mais dá impacto negativo sem nenhum tratamento especial — a aritmética
 * já conta a verdade. `movimento` aplica a natureza da linha por cima disso.
 */

const { norm, ORDEM_DRE, mesAnterior, MES_NOME } = require('./dre');

/* ------------------------------------------------------------------ BÁSICOS */

/** Percentual de variação. Base zero ou ausente = indefinido, nunca 0 nem 100. */
function pct(de, para) {
  if (de == null || para == null) return null;
  if (de === 0) return null;
  return ((para - de) / Math.abs(de)) * 100;
}

/**
 * Variação COMO O DONO DA CONTA LÊ.
 *
 * Despesa é negativa na base, então -100 -> -150 dá -50% na conta matemática
 * crua, quando o gasto na verdade subiu 50%. Publicar o número cru faz a DRE
 * anunciar queda justamente nas linhas que estouraram — o erro mais caro que
 * este relatório poderia cometer. Para linha de despesa o sinal é invertido,
 * de modo que positivo sempre significa "esta linha aumentou".
 *
 * Só vale para linha de natureza única (uma conta, um subgrupo). Totais que
 * misturam receita e despesa são resultado, e ali o sinal cru já é o certo.
 */
function pctMovimento(de, para, natureza) {
  const p = pct(de, para);
  if (p == null) return null;
  return natureza === 'despesa' ? -p : p;
}

/** Natureza da linha pelo acumulado: receita entra positiva, despesa negativa. */
function naturezaDe(total) {
  return total > 0 ? 'receita' : total < 0 ? 'despesa' : 'neutro';
}

/** Rótulo "jul/26" a partir da competência "2026-07". */
function rotuloMes(comp) {
  const [a, m] = String(comp).split('-');
  const nome = MES_NOME && MES_NOME[Number(m)] ? MES_NOME[Number(m)] : m;
  return `${String(nome).slice(0, 3).toLowerCase()}/${String(a).slice(2)}`;
}

function aplicaFiltro(f, filtro) {
  if (filtro.loja != null && f.l !== filtro.loja) return false;
  if (filtro.regional && norm(f.rg) !== norm(filtro.regional)) return false;
  if (filtro.subGrupo && norm(f.sg) !== norm(filtro.subGrupo)) return false;
  return true;
}

/** Ordena subgrupos pela ordem oficial da DRE; desconhecidos vão para o fim. */
function ordenarSubGrupos(lista) {
  const pos = s => {
    const i = ORDEM_DRE.findIndex(o => norm(o) === norm(s));
    return i < 0 ? 999 : i;
  };
  return [...lista].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, 'pt-BR'));
}

/* --------------------------------------------------------- SÉRIE MÊS A MÊS */

/**
 * Matriz completa conta (ou subgrupo) x mês, com análise vertical e horizontal.
 *
 * `nivel`:
 *   'subgrupo' — 26 linhas, a DRE gerencial que a diretoria lê.
 *   'conta'    — 156 linhas, agrupadas sob o subgrupo, para quem vai atrás do
 *                número. É o drill-down, não uma tela separada.
 *
 * Célula sem lançamento volta null e não zero: a diferença entre "não gastou"
 * e "não existe informação" é justamente o que uma provisão esquecida esconde.
 */
function serieCompleta(base, opts = {}) {
  const meses = (opts.meses && opts.meses.length ? opts.meses : base.meses).slice().sort();
  const filtro = opts.filtro || {};
  const nivel = opts.nivel === 'conta' ? 'conta' : 'subgrupo';

  const grade = new Map();   // chave -> { mes -> valor }
  const meta = new Map();    // chave -> { subGrupo, grupo, descricao }

  for (const f of base.fatos) {
    if (!meses.includes(f.m) || !aplicaFiltro(f, filtro)) continue;
    if (!f.sg) continue;
    const chave = nivel === 'conta' ? `${f.c}` : f.sg;
    if (!grade.has(chave)) {
      grade.set(chave, {});
      meta.set(chave, {
        subGrupo: f.sg,
        grupo: f.g,
        descricao: nivel === 'conta' ? (f.d || f.c) : f.sg,
        conta: nivel === 'conta' ? f.c : null,
      });
    }
    const linha = grade.get(chave);
    linha[f.m] = (linha[f.m] || 0) + f.v;
  }

  // Receita bruta por mês — denominador da análise vertical.
  const receita = meses.map(m => {
    let r = null;
    for (const f of base.fatos) {
      if (f.m !== m || !aplicaFiltro(f, filtro)) continue;
      if (norm(f.sg) !== 'receita bruta') continue;
      r = (r || 0) + f.v;
    }
    return r;
  });

  const chaves = nivel === 'conta'
    ? [...grade.keys()].sort((a, b) => {
        const ma = meta.get(a), mb = meta.get(b);
        const oa = ordenarSubGrupos([ma.subGrupo, mb.subGrupo]);
        if (norm(ma.subGrupo) !== norm(mb.subGrupo)) return oa[0] === ma.subGrupo ? -1 : 1;
        return ma.descricao.localeCompare(mb.descricao, 'pt-BR');
      })
    : ordenarSubGrupos([...grade.keys()]);

  const linhas = chaves.map(k => {
    const vals = grade.get(k);
    const valores = meses.map(m => (m in vals ? vals[m] : null));
    const total = valores.reduce((s, v) => s + (v || 0), 0);
    const natureza = naturezaDe(total);

    // AV: peso sobre a receita bruta do mesmo mês (sempre em módulo, para ler
    // "esta despesa consumiu 3,2% da receita" em vez de "-3,2%").
    const av = valores.map((v, i) => {
      const r = receita[i];
      if (v == null || r == null || r === 0) return null;
      return (Math.abs(v) / Math.abs(r)) * 100;
    });

    // AH: variação contra o mês anterior, já na leitura do dono da conta —
    // positivo significa que a linha aumentou, seja ela receita ou despesa.
    const ah = valores.map((v, i) => {
      if (i === 0) return null;
      return pctMovimento(valores[i - 1], v, natureza);
    });

    return {
      chave: k,
      conta: meta.get(k).conta,
      descricao: meta.get(k).descricao,
      subGrupo: meta.get(k).subGrupo,
      grupo: meta.get(k).grupo,
      natureza,
      valores, av, ah, total,
    };
  });

  return {
    nivel, meses, rotulos: meses.map(rotuloMes), filtro,
    receitaBruta: receita,
    linhas,
    totais: meses.map((m, i) => linhas.reduce((s, l) => s + (l.valores[i] || 0), 0)),
  };
}

/* ------------------------------------------------------------- COMPARATIVO */

/**
 * Compara dois meses linha a linha e ordena pelo que mais mexeu no resultado.
 *
 * Ordenar por impacto (e não por %) é deliberado: uma conta de R$ 800 que
 * triplicou rende um % espetacular e não muda nada no fechamento, enquanto uma
 * conta de R$ 8 Mi que subiu 9% decide o mês. A diretoria precisa ver a segunda
 * primeiro. O % continua na tabela, apenas não manda na ordenação.
 */
function comparativo(base, mesA, mesB, opts = {}) {
  const filtro = opts.filtro || {};
  const nivel = opts.nivel === 'conta' ? 'conta' : 'subgrupo';
  const s = serieCompleta(base, { meses: [mesA, mesB], filtro, nivel });
  const iA = s.meses.indexOf(mesA), iB = s.meses.indexOf(mesB);

  const linhas = s.linhas.map(l => {
    const a = l.valores[iA], b = l.valores[iB];
    const impacto = (b || 0) - (a || 0);           // efeito direto no resultado
    const movimento = l.natureza === 'despesa' ? -impacto : impacto;
    return {
      chave: l.chave, conta: l.conta, descricao: l.descricao,
      subGrupo: l.subGrupo, natureza: l.natureza,
      valorA: a, valorB: b,
      impacto,                                      // com sinal: + melhora, - piora
      movimento,                                    // na natureza da linha, em R$
      variacaoPct: pctMovimento(a, b, l.natureza),  // na natureza da linha, em %
      impactoPct: pct(a, b),                        // cru, para quem quiser o sinal contábil
      novaConta: (a == null || a === 0) && b != null && b !== 0,
      contaZerada: a != null && a !== 0 && (b == null || b === 0),
    };
  });

  const comImpacto = linhas.filter(l => l.impacto !== 0);
  const limite = opts.limite || 15;

  return {
    mesA, mesB, rotuloA: rotuloMes(mesA), rotuloB: rotuloMes(mesB), nivel, filtro,
    linhas: linhas.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto)),
    pioras: comImpacto.filter(l => l.impacto < 0).sort((x, y) => x.impacto - y.impacto).slice(0, limite),
    melhoras: comImpacto.filter(l => l.impacto > 0).sort((x, y) => y.impacto - x.impacto).slice(0, limite),
    resumo: {
      totalA: s.totais[iA], totalB: s.totais[iB],
      impactoTotal: s.totais[iB] - s.totais[iA],
      variacaoPct: pct(s.totais[iA], s.totais[iB]),
      receitaA: s.receitaBruta[iA], receitaB: s.receitaBruta[iB],
      linhasNovas: linhas.filter(l => l.novaConta).length,
      linhasZeradas: linhas.filter(l => l.contaZerada).length,
    },
  };
}

/* ------------------------------------------------------------ POR LOJA */

/**
 * Todas as lojas lado a lado num mês, com comparação contra o mês anterior.
 * É o relatório que a regional usa para saber onde entrar.
 *
 * Loja sem nenhum lançamento no mês não vira zero: fica de fora do ranking e é
 * devolvida em `semMovimento`, porque "não gastou nada" quase nunca é verdade —
 * quase sempre significa base não fechada.
 */
function porLoja(base, mes, opts = {}) {
  const mesRef = opts.mesComparacao || mesAnterior(mes);
  const soma = new Map();   // loja -> { atual, anterior, receitaAtual }

  const pega = l => {
    if (!soma.has(l)) soma.set(l, { atual: null, anterior: null, receitaAtual: null, receitaAnterior: null });
    return soma.get(l);
  };

  for (const f of base.fatos) {
    if (f.l == null) continue;
    if (opts.regional && norm(f.rg) !== norm(opts.regional)) continue;
    const ehReceita = norm(f.sg) === 'receita bruta';
    if (f.m === mes) {
      const s = pega(f.l);
      s.atual = (s.atual || 0) + f.v;
      if (ehReceita) s.receitaAtual = (s.receitaAtual || 0) + f.v;
    } else if (f.m === mesRef) {
      const s = pega(f.l);
      s.anterior = (s.anterior || 0) + f.v;
      if (ehReceita) s.receitaAnterior = (s.receitaAnterior || 0) + f.v;
    }
  }

  const cad = new Map(base.lojas.map(l => [l.num, l]));
  const todas = [...soma.entries()].map(([num, s]) => {
    const c = cad.get(num) || {};
    return {
      loja: num,
      unidade: c.unidade || '',
      regional: c.regional || '',
      atual: s.atual, anterior: s.anterior,
      impacto: s.atual == null || s.anterior == null ? null : s.atual - s.anterior,
      variacaoPct: pct(s.anterior, s.atual),
      receita: s.receitaAtual,
      receitaAnterior: s.receitaAnterior,
      receitaVarPct: pct(s.receitaAnterior, s.receitaAtual),
    };
  });

  const comMovimento = todas.filter(l => l.atual != null);
  const comparaveis = comMovimento.filter(l => l.impacto != null);

  return {
    mes, mesComparacao: mesRef, rotulo: rotuloMes(mes), rotuloComparacao: rotuloMes(mesRef),
    regional: opts.regional || null,
    lojas: comMovimento.sort((a, b) => (a.atual ?? 0) - (b.atual ?? 0)),
    pioras: comparaveis.filter(l => l.impacto < 0).sort((a, b) => a.impacto - b.impacto).slice(0, 10),
    melhoras: comparaveis.filter(l => l.impacto > 0).sort((a, b) => b.impacto - a.impacto).slice(0, 10),
    semMovimento: base.lojas.filter(l => !soma.has(l.num) || soma.get(l.num).atual == null)
      .map(l => ({ loja: l.num, unidade: l.unidade, regional: l.regional })),
    regionais: [...new Set(base.lojas.map(l => l.regional).filter(Boolean))].sort(),
  };
}

/* ------------------------------------------------------------- REGIONAIS */

/** Consolidado por regional, mês a mês — o recorte que a diretoria cobra. */
function porRegional(base, opts = {}) {
  const meses = (opts.meses && opts.meses.length ? opts.meses : base.meses).slice().sort();
  const grade = new Map();
  for (const f of base.fatos) {
    if (!meses.includes(f.m)) continue;
    const rg = f.rg || '(sem regional)';
    if (!grade.has(rg)) grade.set(rg, {});
    const linha = grade.get(rg);
    linha[f.m] = (linha[f.m] || 0) + f.v;
  }
  const lojasPor = new Map();
  for (const l of base.lojas) {
    const rg = l.regional || '(sem regional)';
    lojasPor.set(rg, (lojasPor.get(rg) || 0) + 1);
  }
  const linhas = [...grade.entries()].map(([rg, vals]) => {
    const valores = meses.map(m => (m in vals ? vals[m] : null));
    return {
      regional: rg,
      lojas: lojasPor.get(rg) || 0,
      valores,
      ah: valores.map((v, i) => (i === 0 ? null : pct(valores[i - 1], v))),
      total: valores.reduce((s, v) => s + (v || 0), 0),
    };
  }).sort((a, b) => a.total - b.total);
  return { meses, rotulos: meses.map(rotuloMes), linhas };
}

/* ------------------------------------------------------------- EXPORTAÇÃO */

const escapaCsv = v => {
  if (v == null) return 'N/D';
  // Dinheiro com 2 casas: sem isso o Excel recebe -678907,7999999989, que é
  // tecnicamente o float e visualmente um erro de sistema.
  const s = typeof v === 'number'
    ? (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace('.', ',')
    : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV para Excel brasileiro: separador ';', decimal ',' e BOM no início — sem
 * o BOM o Excel abre acentuação quebrada, que é o primeiro motivo de um
 * relatório voltar como "veio errado".
 */
function paraCsv(cabecalho, linhas) {
  const corpo = [cabecalho.map(escapaCsv).join(';')]
    .concat(linhas.map(l => l.map(escapaCsv).join(';')))
    .join('\r\n');
  return '﻿' + corpo;
}

function csvSerie(s) {
  const cab = ['Grupo', 'Sub Grupo', s.nivel === 'conta' ? 'Conta' : 'Linha', ...s.rotulos, 'Total'];
  const linhas = s.linhas.map(l => [
    l.grupo, l.subGrupo, s.nivel === 'conta' ? `${l.conta} - ${l.descricao}` : l.descricao,
    ...l.valores, l.total,
  ]);
  return paraCsv(cab, linhas);
}

function csvComparativo(c) {
  const cab = ['Sub Grupo', c.nivel === 'conta' ? 'Conta' : 'Linha',
    c.rotuloA, c.rotuloB, 'Variacao %', 'Impacto no resultado', 'Situacao'];
  const linhas = c.linhas.map(l => [
    l.subGrupo, l.descricao, l.valorA, l.valorB,
    l.variacaoPct == null ? null : Number(l.variacaoPct.toFixed(1)),
    l.impacto,
    l.novaConta ? 'Conta nova' : l.contaZerada ? 'Zerada no mes' : '',
  ]);
  return paraCsv(cab, linhas);
}

function csvLojas(r) {
  const cab = ['Loja', 'Unidade', 'Regional', r.rotuloComparacao, r.rotulo, 'Variacao %', 'Impacto', 'Receita Bruta'];
  const linhas = r.lojas.map(l => [
    l.loja, l.unidade, l.regional, l.anterior, l.atual,
    l.variacaoPct == null ? null : Number(l.variacaoPct.toFixed(1)),
    l.impacto, l.receita,
  ]);
  const pendentes = r.semMovimento.map(l => [l.loja, l.unidade, l.regional, null, null, null, null, null]);
  return paraCsv(cab, linhas.concat(pendentes));
}

function csvRegionais(r) {
  const cab = ['Regional', 'Lojas', ...r.rotulos, 'Total'];
  const linhas = r.linhas.map(l => [l.regional, l.lojas, ...l.valores, l.total]);
  return paraCsv(cab, linhas);
}

module.exports = {
  serieCompleta, comparativo, porLoja, porRegional,
  csvSerie, csvComparativo, csvLojas, csvRegionais, paraCsv,
  pct, pctMovimento, naturezaDe, rotuloMes,
};
