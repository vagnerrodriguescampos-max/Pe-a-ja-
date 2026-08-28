'use strict';
/**
 * Constrói a DRE gerencial a partir da Base Contábil.
 *
 * POR QUE ESTE MÓDULO EXISTE
 * A DRE gerencial da empresa vem em um arquivo por regional, e cada um traz
 * números só das suas lojas. Juntar as quatro é possível, mas depende de quatro
 * arquivos chegarem sempre — e basta um atrasar para o BI mostrar uma regional
 * zerada. A Base Contábil resolve isso na origem: é UM arquivo, com a aba
 * Base_Real, onde cada linha é (loja × mês × conta) para a rede inteira.
 *
 * O que foi conferido antes de escrever isto, na loja Atibaia em julho/2026,
 * comparando com a DRE gerencial da mesma competência:
 *   Receita Bruta   contábil 7.530,047  ==  gerencial 7.530,047
 *   Lucro Bruto     contábil   888,139  ==  gerencial   888,139
 *   Mrg Ebitda      contábil   -13,422  ==  gerencial   -13,422
 * Mesma convenção de sinal (receita positiva, custo negativo), mesma escala.
 *
 * O QUE ESTE MÓDULO NÃO CONSEGUE ENTREGAR
 * A contábil não tem Rateio (a alocação de custo corporativo por loja), nem
 * Qtd de Tickets, Ticket médio, Quadro de Pessoal ou Metragem — esses só
 * existem na planilha gerencial. Sem Rateio não há LAIR. Em vez de inventar um
 * número, essas linhas ficam ausentes e o BI mostra "—". Quem quiser LAIR sobe
 * também a gerencial: a importação soma as duas fontes.
 */

const MESES = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06',
                jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' };

const norm = s => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/* Sub Grupo da contabilidade -> linha da DRE gerencial. */
const SUBGRUPO = {
  'receita bruta': 'receita_bruta',
  'descontos': '_deducao', 'devolucao': '_deducao', 'impostos': '_deducao',
  'cmv': 'cmv', 'contratos': 'contratos', 'negociacao': 'negociacao',
  'icms-st port.cat-42': 'icms_st', 'operacao logistica': 'operacao_logistica',
  'qi e qni c/ verbas': 'qi_qni',
  'despesas c/ pessoal': 'desp_pessoal', 'ocupacao (p)': 'ocupacao_p',
  'ocupacao (t)': 'ocupacao_t', 'utilidades e servicos': 'utilidades',
  'manutencao e conservacao': 'manutencao', 'outras receitas e despesas': 'outras_rec_desp',
  'despesas gerais': 'desp_gerais', 'impostos e taxas': 'impostos',
  'leasing e alugueis': 'leasing', 'dados e comunicacao': 'dados_com',
  'processos juridicos': 'juridico', 'propaganda e publicidade': 'propaganda',
  'servicos profissionais': 'serv_prof',
  'depreciacao e amortizacao': 'depreciacao',
  'resultado financeiro': 'resultado_financeiro',
  'resultado nao operacional': 'resultado_nao_op',
};

/* Componentes do CMV Gerencial. Verbas NÃO entra: na planilha gerencial ela é
   um subtotal de Contratos + Negociação, e somá-la contaria os dois duas vezes
   (conferido em Atibaia/jul: só sem Verbas o CMV Gerencial fecha em -5.875,284). */
const CMV_GER = ['cmv', 'contratos', 'negociacao', 'icms_st', 'operacao_logistica', 'qi_qni'];
const DESPESAS = ['desp_pessoal', 'ocupacao_p', 'ocupacao_t', 'utilidades', 'manutencao',
  'outras_rec_desp', 'desp_gerais', 'impostos', 'leasing', 'dados_com', 'juridico',
  'propaganda', 'serv_prof'];

const FORA = new Set(['matriz', 'cd barueri']);

/** Acha a aba de lançamentos pelo conteúdo do cabeçalho, não pelo nome (que carrega o ano). */
function acharAbaFatos(wb) {
  for (const nome of wb.SheetNames) {
    const linhas = require('xlsx').utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null });
    const cab = (linhas[0] || []).map(norm);
    if (cab.includes('sub grupo') && cab.includes('unidade') && cab.some(c => c === 'valor')) return nome;
  }
  return null;
}

function parseBaseContabilDre(wb, fileName, today, regionalOficial) {
  const XLSX = require('xlsx');
  const aba = acharAbaFatos(wb);
  if (!aba) throw new Error('Base Contábil: não achei a aba de lançamentos (preciso de uma com as colunas Unidade, Sub Grupo e Valor)');

  const cru = XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: null });
  if (!cru.length) throw new Error('Base Contábil: a aba ' + aba + ' está vazia');

  /* Os nomes das colunas vêm com espaços sobrando (" Valor ", "Centro ").
     Normalizar na entrada evita espalhar essa fragilidade pelo resto do código. */
  const chaves = {};
  /* Além dos espaços sobrando, o cabeçalho tem "Nº Lj BlueSoft" — e o "º" não é
     acento, então NFD não o remove e uma busca por "n lj bluesoft" não casa.
     Perder essa coluna não dá erro: o código cai no campo Regional do próprio
     arquivo, que é exatamente o que diverge do cadastro (a contábil marca
     Atibaia como GRANDE SP; oficialmente ela é INTERIOR). Por isso a chave de
     busca descarta tudo que não for letra ou número. */
  const simplifica = k => norm(k).replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(cru[0])) chaves[simplifica(k)] = k;
  const cx = n => chaves[simplifica(n)];
  const cVal = cx('valor'), cUni = cx('unidade'), cMes = cx('mes'), cAno = cx('ano'),
        cSub = cx('sub grupo'), cNum = cx('n lj bluesoft'),
        cReg = cx('regional'), cSt = cx('status');
  if (!cNum) console.warn('[contábil] coluna do número da loja não encontrada — o de-para oficial de regionais não será aplicado');
  for (const [rot, c] of [['Valor', cVal], ['Unidade', cUni], ['Mês', cMes], ['Sub Grupo', cSub]])
    if (!c) throw new Error('Base Contábil: coluna "' + rot + '" não encontrada. Colunas do arquivo: ' + Object.keys(cru[0]).join(', '));

  /* Agrupar por NOME parece natural e está errado: a base traz a mesma loja
     grafada de dois jeitos ("F. da Rocha" e "F. Da Rocha", ambas nº 17), e
     agrupar por texto parte os números dela ao meio sem avisar ninguém. A
     identidade é o número da loja; o nome é só rótulo, e o rótulo escolhido é a
     grafia que aparece na maioria dos lançamentos. */
  const data = {}, total = {}, meses = new Set(), lojas = new Map();
  const grafias = new Map();          // chave -> { grafia: quantidade }
  const subDesconhecidos = new Map();
  let usados = 0, ignoradosStatus = 0, ignoradosUnidade = 0;

  for (const r of cru) {
    if (cSt && norm(r[cSt]) && norm(r[cSt]) !== 'real') { ignoradosStatus++; continue; }
    const unidade = String(r[cUni] == null ? '' : r[cUni]).trim();
    if (!unidade || FORA.has(norm(unidade))) { ignoradosUnidade++; continue; }
    const mm = MESES[norm(r[cMes]).slice(0, 3)];
    if (!mm) continue;
    const ym = (r[cAno] ? String(r[cAno]) : String(new Date().getFullYear())) + '-' + mm;
    const v = Number(r[cVal]);
    if (!isFinite(v)) continue;

    const chave = SUBGRUPO[norm(r[cSub])];
    if (!chave) { const s = String(r[cSub] || '(vazio)'); subDesconhecidos.set(s, (subDesconhecidos.get(s) || 0) + v); continue; }

    const num = r[cNum] == null ? null : String(r[cNum]).trim();
    const idLoja = num || norm(unidade);
    if (!lojas.has(idLoja)) {
      const oficial = num && regionalOficial ? regionalOficial[num] : null;
      lojas.set(idLoja, { name: unidade, num: num || null,
        regional: regionalDoArquivo(oficial) || regionalDoArquivo(r[cReg]) || '' });
    }
    const g = grafias.get(idLoja) || grafias.set(idLoja, new Map()).get(idLoja);
    g.set(unidade, (g.get(unidade) || 0) + 1);

    meses.add(ym);
    const alvo = chave === '_deducao' ? 'deducoes' : chave;
    const d = data[idLoja] || (data[idLoja] = {});
    (d[alvo] = d[alvo] || {})[ym] = (d[alvo][ym] || 0) + v;
    (total[alvo] = total[alvo] || {})[ym] = (total[alvo][ym] || 0) + v;
    usados++;
  }

  /* Subtotais: calculados aqui, não lidos, porque a contábil não os traz. */
  const soma = (o, chaves, ym) => {
    let s = null;
    for (const k of chaves) { const v = o[k] && o[k][ym]; if (typeof v === 'number') s = (s || 0) + v; }
    return s;
  };
  const derivar = o => {
    for (const ym of meses) {
      const rb = o.receita_bruta && o.receita_bruta[ym];
      const ded = o.deducoes && o.deducoes[ym];
      if (typeof rb === 'number') (o.receita_liquida = o.receita_liquida || {})[ym] = rb + (ded || 0);
      const cmvg = soma(o, CMV_GER, ym);
      if (cmvg != null) (o.cmv_gerencial = o.cmv_gerencial || {})[ym] = cmvg;
      const rl = o.receita_liquida && o.receita_liquida[ym];
      if (typeof rl === 'number' && cmvg != null) (o.lucro_bruto = o.lucro_bruto || {})[ym] = rl + cmvg;
      const desp = soma(o, DESPESAS, ym);
      if (desp != null) (o.despesas_total = o.despesas_total || {})[ym] = desp;
      const lb = o.lucro_bruto && o.lucro_bruto[ym];
      if (typeof lb === 'number' && desp != null) (o.mrg_ebitda = o.mrg_ebitda || {})[ym] = lb + desp;
      // LAIR exigiria Rateio, que a contábil não traz — fica ausente de propósito.
    }
  };
  Object.values(data).forEach(derivar);
  derivar(total);

  /* Do agrupamento por número de volta para o nome, agora um por loja. */
  const grafiasMultiplas = [];
  const dadosPorNome = {};
  for (const [id, loja] of lojas) {
    const g = grafias.get(id);
    if (g && g.size > 1) grafiasMultiplas.push({ loja: loja.num || id, grafias: [...g.keys()] });
    if (g) loja.name = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0];
    dadosPorNome[loja.name] = data[id] || {};
  }
  const stores = [...lojas.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const dre = {
    updated: today || null, source: fileName || 'Base Contábil.xlsx', unit: 'R$',
    months: [...meses].sort(), lines: LINHAS_DRE, regionais: [...new Set(stores.map(s => s.regional).filter(Boolean))].sort(),
    stores, data: dadosPorNome, total, origem: 'base-contabil',
    /* O "Total" daqui é a SOMA DAS LOJAS. A coluna Total da planilha gerencial
       é outra coisa: inclui Matriz e CD Barueri, cuja contribuição líquida em
       julho (-5,27 Mi) é quase exatamente o Rateio que ela distribui entre as
       lojas. São duas definições legítimas de "rede", e misturá-las sem avisar
       produziria um EBITDA que ninguém consegue reconciliar. O BI mostra qual
       está em tela. */
    totalEscopo: 'lojas',
    totalNota: 'soma das lojas — não inclui Matriz nem CD Barueri',
  };
  const comPnL = stores.filter(s => dadosPorNome[s.name] && dadosPorNome[s.name].receita_bruta).length;
  return { dre, stats: {
    aba, months: dre.months, storesTotal: stores.length, storesComPnL: comPnL,
    lancamentosUsados: usados, ignoradosStatus, ignoradosUnidade, grafiasMultiplas,
    subGruposDesconhecidos: [...subDesconhecidos.entries()].map(([s, v]) => ({ subGrupo: s, valor: v })),
  } };
}

function regionalDoArquivo(v) {
  const n = norm(v).replace(/^regional /, '');
  /* Dois vocabulários convivem: o cadastro oficial fala "C. OESTE" e
     "BAIXADA/ABC"; a contábil fala "REGIONAL OESTE" e "REGIONAL BAIXADA ABC".
     Ambos precisam desaguar no mesmo rótulo, senão a mesma regional aparece
     duas vezes no filtro do BI. */
  const m = { 'interior': 'Interior', 'grande sp': 'Grande SP',
              'oeste': 'Oeste', 'c. oeste': 'Oeste', 'c oeste': 'Oeste', 'centro oeste': 'Oeste',
              'baixada abc': 'Baixada/ABC', 'baixada/abc': 'Baixada/ABC', 'baixada e abc': 'Baixada/ABC' };
  return m[n] || null;
}

/* As mesmas linhas da DRE gerencial, para as duas fontes renderizarem igual. */
const LINHAS_DRE = [
  { key: 'receita_bruta', label: 'Receita Bruta', group: 'receita', kind: 'money' },
  { key: 'deducoes', label: 'Deduções', group: 'receita', kind: 'money' },
  { key: 'receita_liquida', label: 'Receita Líquida', group: 'receita', kind: 'money' },
  { key: 'cmv', label: 'CMV', group: 'custo', kind: 'money' },
  { key: 'contratos', label: 'Contratos', group: 'custo', kind: 'money' },
  { key: 'negociacao', label: 'Negociação', group: 'custo', kind: 'money' },
  { key: 'icms_st', label: 'ICMS-ST Port. CAT-42', group: 'custo', kind: 'money' },
  { key: 'operacao_logistica', label: 'Operação Logística', group: 'custo', kind: 'money' },
  { key: 'qi_qni', label: 'QI e QNI c/ Verbas', group: 'custo', kind: 'money' },
  { key: 'cmv_gerencial', label: 'CMV Gerencial', group: 'custo', kind: 'money' },
  { key: 'lucro_bruto', label: 'Lucro Bruto', group: 'lb', kind: 'money' },
  { key: 'desp_pessoal', label: 'Despesas c/ Pessoal', group: 'despesa', kind: 'money' },
  { key: 'ocupacao_p', label: 'Ocupação (P)', group: 'despesa', kind: 'money' },
  { key: 'ocupacao_t', label: 'Ocupação (T)', group: 'despesa', kind: 'money' },
  { key: 'utilidades', label: 'Utilidades e Serviços', group: 'despesa', kind: 'money' },
  { key: 'manutencao', label: 'Manutenção e Conservação', group: 'despesa', kind: 'money' },
  { key: 'outras_rec_desp', label: 'Outras Receitas e Despesas', group: 'despesa', kind: 'money' },
  { key: 'desp_gerais', label: 'Despesas Gerais', group: 'despesa', kind: 'money' },
  { key: 'impostos', label: 'Impostos e Taxas', group: 'despesa', kind: 'money' },
  { key: 'leasing', label: 'Leasing e Aluguéis', group: 'despesa', kind: 'money' },
  { key: 'dados_com', label: 'Dados e Comunicação', group: 'despesa', kind: 'money' },
  { key: 'juridico', label: 'Processos Jurídicos', group: 'despesa', kind: 'money' },
  { key: 'propaganda', label: 'Propaganda e Publicidade', group: 'despesa', kind: 'money' },
  { key: 'serv_prof', label: 'Serviços Profissionais', group: 'despesa', kind: 'money' },
  { key: 'despesas_total', label: 'Despesas (total)', group: 'despesa', kind: 'money' },
  { key: 'mrg_ebitda', label: 'Mrg Ebitda', group: 'ebitda', kind: 'money' },
  { key: 'depreciacao', label: 'Depreciação e Amortização', group: 'resultado', kind: 'money' },
  { key: 'resultado_financeiro', label: 'Resultado Financeiro', group: 'resultado', kind: 'money' },
  { key: 'resultado_nao_op', label: 'Resultado não operacional', group: 'resultado', kind: 'money' },
];

module.exports = { parseBaseContabilDre, LINHAS_DRE };
