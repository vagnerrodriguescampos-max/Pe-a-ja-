// Gera a planilha de DEMONSTRAÇÃO (.xlsx) usada para apresentar o BI.
//
// Mesma estrutura de abas de um "Informativo de Vendas" de rede atacadista
// real — é ela que exercita o motor de importação —, porém com uma rede
// INTEIRAMENTE FICTÍCIA: nome da empresa, nome das lojas e regionais são
// inventados, e todos os números são gerados aqui.
//
// Por que fictício: esta base é aberta em apresentações comerciais, para
// pessoas de fora. Nome de loja e faturamento por unidade de um cliente real
// não podem sair da empresa dele. Trocar a identidade não custa nada e
// elimina o risco inteiro.
//
// Por que o histórico é longo: com um único mês, os indicadores de
// comparação — crescimento vs ano anterior, margem vs ano anterior, matriz
// de performance — não têm com o que comparar e aparecem vazios justamente
// na tela que se quer mostrar. O período abaixo cobre todo o ano anterior,
// de modo que QUALQUER recorte do ano corrente tem contrapartida.
//
// Personalização para uma demo específica (opcional):
//   DEMO_EMPRESA="ATACADO EXEMPLO LTDA" npm run sample:generate
//
// Uso: npm run sample:generate  ->  ./sample/informativo-vendas-demo.xlsx
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'sample');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------------------------------------------------------------- identidade
   Rede fictícia. Nenhum destes nomes corresponde a uma loja real. */
const EMPRESA = process.env.DEMO_EMPRESA || 'PRIMA ATACADISTA LTDA';

const LOJAS = [
  { cod: 2, nome: 'VILA AURORA', regional: 'CAPITAL' },
  { cod: 3, nome: 'JARDIM ATLÂNTICO', regional: 'CAPITAL' },
  { cod: 4, nome: 'PARQUE IPÊ', regional: 'CAPITAL' },
  { cod: 5, nome: 'NOVA ESPERANÇA', regional: 'METROPOLITANA' },
  { cod: 6, nome: 'SANTA MÔNICA', regional: 'METROPOLITANA' },
  { cod: 7, nome: 'BOA VISTA', regional: 'METROPOLITANA' },
  { cod: 8, nome: 'MONTE AZUL', regional: 'INTERIOR' },
  { cod: 9, nome: 'RIO VERDE', regional: 'INTERIOR' },
  { cod: 10, nome: 'SERRA DOURADA', regional: 'INTERIOR' },
  { cod: 11, nome: 'PORTO NOVO', regional: 'LITORAL' },
  { cod: 12, nome: 'COSTA DO SOL', regional: 'LITORAL' },
  { cod: 13, nome: 'ENSEADA', regional: 'LITORAL' },
];

const HIERARQUIA = [
  { categoria: 'MERCEARIA', segmento: 'ACUCAR', subcategorias: ['ACUCAR REFINADO', 'ACUCAR CRISTAL'] },
  { categoria: 'ACOUGUE', segmento: 'BOVINOS', subcategorias: ['ACOUGUE BOVINO', 'ACOUGUE SUINO'] },
  { categoria: 'BEBIDAS', segmento: 'REFRIGERANTE', subcategorias: ['REFRI COLA', 'REFRI GUARANA'] },
  { categoria: 'LATICINIOS', segmento: 'LEITE UHT', subcategorias: ['LEITE INTEGRAL', 'LEITE DESNATADO'] },
  { categoria: 'LIMPEZA', segmento: 'LIMPEZA GERAL', subcategorias: ['DETERGENTE', 'SABAO EM PO'] },
];

/* ------------------------------------------------------------------ período
   ANO/MÊS de referência = o "mês corrente" da demonstração.
   O histórico começa em janeiro do ano anterior: assim todo dia de 2026 tem
   o mesmo dia de 2025 para comparar, inclusive num filtro de ano inteiro. */
const ANO = 2026;
const MES = 8;
const DIAS_MES = new Date(Date.UTC(ANO, MES, 0)).getUTCDate();

/* 13 meses: o mês de referência e os 12 anteriores. Cobre o mês corrente da
   demonstração com o mesmo mês do ano anterior ao lado — que é o que os
   indicadores de comparação precisam — sem inflar o arquivo a ponto de a
   importação deixar de ser instantânea na apresentação. */
const INICIO = Date.UTC(ANO - 1, MES - 1, 1);
const FIM = Date.UTC(ANO, MES - 1, DIAS_MES);

function* datas(passo = 1) {
  for (let t = INICIO; t <= FIM; t += passo * 86400000) yield new Date(t);
}
function diasDoAnoCorrente() {
  const out = [];
  for (let t = Date.UTC(ANO, 0, 1); t <= FIM; t += 86400000) out.push(new Date(t));
  return out;
}

/* -------------------------------------------------------- gerador de números
   Sequência determinística: a mesma planilha sai igual em toda execução, o
   que mantém prints de apresentação e testes estáveis. */
let seed = 42;
function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function between(min, max) { return min + rand() * (max - min); }

const MES_NOME = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* Sazonalidade do atacado alimentar: dezembro forte, começo de ano fraco. */
const SAZONAL = [0.88, 0.86, 0.94, 0.97, 1.00, 0.98, 1.01, 1.02, 0.99, 1.03, 1.06, 1.26];
/* Dia da semana (0 = domingo): sábado é o pico, segunda o vale. */
const DIA_SEMANA = [0.82, 0.85, 0.92, 0.98, 1.05, 1.18, 1.30];

/* Cada loja cresce (ou encolhe) no seu próprio ritmo. É isso que faz a
   matriz de performance e os rankings terem dispersão em vez de virarem
   uma nuvem de pontos idênticos. */
const PERFIL = LOJAS.map((loja) => ({
  cod: loja.cod,
  base: 250000 + loja.cod * 15000 + between(-8000, 8000),
  crescimentoAno: between(-0.06, 0.18),   // variação vs ano anterior
  margemPct: between(0.17, 0.245),        // margem bruta da loja
  derivaMargem: between(-0.018, 0.022),   // quanto a margem mudou vs ano anterior
  ticket: between(145, 195),
}));
const perfilDe = (loja) => PERFIL.find((p) => p.cod === loja.cod);

/** Venda bruta realizada de uma loja num dia. */
function vendaDia(loja, data) {
  const p = perfilDe(loja);
  const anosDesdeInicio = data.getUTCFullYear() - (ANO - 1);
  const tendencia = (1 + p.crescimentoAno) ** anosDesdeInicio;
  const sazonal = SAZONAL[data.getUTCMonth()];
  const semana = DIA_SEMANA[data.getUTCDay()];
  return Math.round(p.base * tendencia * sazonal * semana * between(0.92, 1.08));
}

/** Margem bruta em R$ do dia — a margem % anda um pouco de um ano para o outro. */
function margemDia(loja, data, venda) {
  const p = perfilDe(loja);
  const atual = data.getUTCFullYear() === ANO;
  return Math.round(venda * (p.margemPct + (atual ? p.derivaMargem : 0)));
}

/** Orçamento do dia: a meta persegue a venda, sem colar nela. */
function orcamentoDia(loja, data) {
  return Math.round(vendaDia(loja, data) * between(0.93, 1.07));
}

const wb = XLSX.utils.book_new();
function addSheet(name, aoa) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
}

/* ---------- ORÇADO: orçamento diário por loja, colunas = dias do ano -------
   O cabeçalho "d/m" não carrega o ano — o importador o resolve pelo ano
   padrão da planilha —, então esta aba cobre só o ano corrente, como o
   arquivo real (o orçamento publicado é o do ano em curso). */
{
  const dias = diasDoAnoCorrente();
  const header = ['Loja', 'Nº', ...dias.map((d) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`), 'Total'];
  const rows = [header];
  for (const loja of LOJAS) {
    const valores = dias.map((d) => orcamentoDia(loja, d));
    rows.push([loja.nome, loja.cod, ...valores, valores.reduce((a, b) => a + b, 0)]);
  }
  addSheet('ORÇADO', rows);
}

/* ---------- base: fato diário por loja — é a fonte primária de venda ------ */
{
  const rows = [['Data', 'Loja', 'Venda Valor', 'Venda Líquida', 'Margem', 'Ticket Médio', 'Qtde Clientes']];
  for (const data of datas()) {
    for (const loja of LOJAS) {
      const p = perfilDe(loja);
      const venda = vendaDia(loja, data);
      const clientes = Math.round(venda / (p.ticket * between(0.95, 1.05)));
      rows.push([
        data, loja.cod, venda,
        Math.round(venda * between(0.855, 0.875)), // líquido de impostos sobre venda
        margemDia(loja, data, venda),
        Math.round((venda / clientes) * 100) / 100,
        clientes,
      ]);
    }
  }
  addSheet('base', rows);
}

/* ---------- Vendas: painel executivo mestre do mês de referência ---------- */
{
  const aa = `${MES_NOME[MES - 1]}.-${String(ANO - 1).slice(2)}`;
  const at = `${MES_NOME[MES - 1]}.-${String(ANO).slice(2)}`;
  const rows = [
    [`Vendas INFORMATIVO DE VENDAS - ${EMPRESA}`],
    ['', '', '', '', '', '', '', 'Televendas', '', '', '', 'E-commerce', '', '', '', 'Clientes', '', '', ''],
    ['Loja', 'Nº loja', 'Meta', aa, at, 'aa %', 'Meta %', aa, at, 'aa %', 'Part %', aa, at, 'aa %', 'Part %', aa, at, 'aa %'],
  ];
  const somaMes = (loja, ano, fn) => {
    let total = 0;
    const ultimo = new Date(Date.UTC(ano, MES, 0)).getUTCDate();
    for (let d = 1; d <= ultimo; d++) total += fn(loja, new Date(Date.UTC(ano, MES - 1, d)));
    return Math.round(total);
  };
  for (const loja of LOJAS) {
    const meta = somaMes(loja, ANO, orcamentoDia);
    const vendaAtual = somaMes(loja, ANO, vendaDia);
    const vendaAnterior = somaMes(loja, ANO - 1, vendaDia);
    const tele25 = Math.round(vendaAnterior * 0.05), tele26 = Math.round(vendaAtual * 0.045);
    const ecomm25 = Math.round(vendaAnterior * 0.02), ecomm26 = Math.round(vendaAtual * 0.028);
    const cli25 = Math.round(vendaAnterior / 165), cli26 = Math.round(vendaAtual / 160);
    rows.push([
      loja.nome, loja.cod, meta, vendaAnterior, vendaAtual,
      ((vendaAtual - vendaAnterior) / vendaAnterior) * 100, (vendaAtual / meta) * 100,
      tele25, tele26, ((tele26 - tele25) / tele25) * 100, (tele26 / vendaAtual) * 100,
      ecomm25, ecomm26, ((ecomm26 - ecomm25) / ecomm25) * 100, (ecomm26 / vendaAtual) * 100,
      cli25, cli26, ((cli26 - cli25) / cli25) * 100,
    ]);
  }
  addSheet('Vendas', rows);
}

/* ---------- Piso ---------------------------------------------------------- */
{
  const rows = [['Loja', 'Nº', `${ANO} Acumulado`, `${ANO - 1} Acumulado`, `${ANO} Piso`, `${ANO - 1} Piso`]];
  for (const loja of LOJAS) {
    const p = perfilDe(loja);
    const acumAtual = Math.round(p.base * 240 * (1 + p.crescimentoAno));
    const acumAnterior = Math.round(p.base * 240);
    const piso = Math.round(acumAtual * between(0.78, 0.98));
    rows.push([loja.nome, loja.cod, acumAtual, acumAnterior, piso, Math.round(piso * 0.95)]);
  }
  addSheet('Piso', rows);
}

/* ---------- BASE TELE E ECOMM: canais, dia a dia -------------------------- */
{
  const PASSO = 2;
  const rows = [['Data', 'Loja', 'Canal Venda', 'Venda Bruta R$']];
  for (const data of datas(PASSO)) {
    for (const loja of LOJAS) {
      const venda = vendaDia(loja, data) * PASSO;
      rows.push([data, loja.cod, 'TELEVENDAS', Math.round(venda * between(0.03, 0.07))]);
      rows.push([data, loja.cod, 'E-COMMERCE', Math.round(venda * between(0.015, 0.04))]);
    }
  }
  addSheet('BASE TELE E ECOMM', rows);
}

/* ---------- BESE VENDA ACUMULADO / BASE VENDA DIA ------------------------- */
{
  const rows = [['Loja', 'Nº', `${ANO} Venda Acumulada`, `${ANO - 1} Venda Acumulada`, `${ANO} Clientes`, `${ANO - 1} Clientes`, `${ANO} Ticket`, `${ANO - 1} Ticket`]];
  for (const loja of LOJAS) {
    const p = perfilDe(loja);
    const atual = Math.round(p.base * 240 * (1 + p.crescimentoAno));
    const anterior = Math.round(p.base * 240);
    const cliAtual = Math.round(atual / p.ticket), cliAnterior = Math.round(anterior / (p.ticket * 0.97));
    rows.push([loja.nome, loja.cod, atual, anterior, cliAtual, cliAnterior,
      Math.round((atual / cliAtual) * 100) / 100, Math.round((anterior / cliAnterior) * 100) / 100]);
  }
  addSheet('BESE VENDA ACUMULADO', rows);
}
{
  const rows = [['Loja', 'Nº', `${ANO} Venda Dia`, `${ANO - 1} Venda Dia`, `${ANO} Clientes`, `${ANO - 1} Clientes`, `${ANO} Ticket`, `${ANO - 1} Ticket`]];
  const dia = new Date(Date.UTC(ANO, MES - 1, DIAS_MES));
  const diaAA = new Date(Date.UTC(ANO - 1, MES - 1, DIAS_MES));
  for (const loja of LOJAS) {
    const p = perfilDe(loja);
    const atual = vendaDia(loja, dia), anterior = vendaDia(loja, diaAA);
    const cliAtual = Math.round(atual / p.ticket), cliAnterior = Math.round(anterior / (p.ticket * 0.97));
    rows.push([loja.nome, loja.cod, atual, anterior, cliAtual, cliAnterior,
      Math.round((atual / cliAtual) * 100) / 100, Math.round((anterior / cliAnterior) * 100) / 100]);
  }
  addSheet('BASE VENDA DIA', rows);
}

/* ---------- pivots ano x ano por subcategoria/segmento -------------------- */
function pivotSheet(name, itens, spread) {
  const rows = [['Rótulos de Linha', String(ANO - 1), String(ANO), '%']];
  for (const item of itens) {
    const v25 = Math.round(between(300000, 1800000) * spread);
    const v26 = Math.round(v25 * between(0.75, 1.35));
    rows.push([item, v25, v26, ((v26 - v25) / v25) * 100]);
  }
  addSheet(name, rows);
}
pivotSheet('Subcategoria', HIERARQUIA.flatMap((h) => h.subcategorias), 1);
pivotSheet('Segmento', HIERARQUIA.map((h) => h.segmento), 3.2);
pivotSheet('Venda por Segmento', HIERARQUIA.map((h) => h.segmento), 3.0);

/* ---------- Orçado de categoria: mês de referência, por subcategoria ------ */
{
  const abrev = MES_NOME[MES - 1];
  const header = ['Loja', 'Ano', 'Sub-Categoria', ...Array.from({ length: DIAS_MES }, (_, d) => `${d + 1}-${abrev}.`), 'Total'];
  const rows = [header];
  for (const loja of LOJAS) {
    for (const h of HIERARQUIA) {
      for (const sub of h.subcategorias) {
        const base = between(4000, 25000);
        const dias = Array.from({ length: DIAS_MES }, () => Math.round(base * between(0.8, 1.2)));
        rows.push([loja.nome, ANO, sub, ...dias, dias.reduce((a, b) => a + b, 0)]);
      }
    }
  }
  addSheet('Orçado de categoria', rows);
}

/* ---------- Base Segmento / Base de Subcategoria: fatos granulares --------
   Amostragem: o corte por segmento é lido em gráficos de tendência, então
   vale um ponto a cada 2 dias; subcategoria é usado em ranking e participação,
   onde o total do período importa mais que a curva — daí o passo maior.
   Cada ponto é multiplicado pelo passo para o total do período fechar. */
{
  const PASSO = 2;
  const rows = [['Data', 'Seção', 'Nº', 'Regional', 'Loja', 'Venda Valor']];
  for (const data of datas(PASSO)) {
    for (const loja of LOJAS) {
      const venda = vendaDia(loja, data);
      for (const h of HIERARQUIA) {
        rows.push([data, h.segmento, loja.cod, loja.regional, loja.nome,
          Math.round((venda / HIERARQUIA.length) * PASSO * between(0.7, 1.3))]);
      }
    }
  }
  addSheet('Base Segmento', rows);
}
{
  const PASSO = 4;
  const rows = [['Data', 'Subcategoria', 'Nº', 'Regional', 'Loja', 'Venda Valor']];
  const subs = HIERARQUIA.flatMap((h) => h.subcategorias);
  for (const data of datas(PASSO)) {
    for (const loja of LOJAS) {
      const venda = vendaDia(loja, data);
      for (const sub of subs) {
        rows.push([data, sub, loja.cod, loja.regional, loja.nome,
          Math.round((venda / subs.length) * PASSO * between(0.6, 1.4))]);
      }
    }
  }
  addSheet('Base de Subcategoria', rows);
}

/* ---------- dimensões ----------------------------------------------------- */
{
  const rows = [['Nº Loja', 'Loja', 'Regional', 'Empresa']];
  for (const loja of LOJAS) rows.push([loja.cod, loja.nome, loja.regional, EMPRESA]);
  addSheet('Base loja', rows);
}
{
  const rows = [['Nº Loja', 'Regional']];
  for (const loja of LOJAS) rows.push([loja.cod, loja.regional]);
  addSheet('Base nova regional', rows);
}
{
  const rows = [['Subcategoria', 'Segmento', 'Categoria']];
  for (const h of HIERARQUIA) for (const sub of h.subcategorias) rows.push([sub, h.segmento, h.categoria]);
  addSheet('Procv categoria', rows);
}

/* ---------- abas residuais, presentes no arquivo real --------------------- */
addSheet('Planilha1', [['obs'], ['planilha auxiliar, sem uso analítico']]);
{
  const dia = 14;
  const rows = [['Meta /loja', 'Nº', `${dia}/${MES}`, '', 'Sub-Categoria', 'Total']];
  let i = 0;
  for (const loja of LOJAS) {
    const h = HIERARQUIA[i++ % HIERARQUIA.length];
    rows.push([loja.nome, loja.cod, orcamentoDia(loja, new Date(Date.UTC(ANO, MES - 1, dia))),
      '', h.segmento, Math.round(between(600000, 1800000))]);
  }
  addSheet('Orçado dia', rows);
}
{
  const abrev = MES_NOME[MES - 1];
  const rows = [['Loja AJUST', `(Vários itens) 14-${abrev}`, `(Tudo) Soma de 14-${abrev}`, 'Sub-Categoria', 'Total']];
  for (const h of HIERARQUIA) for (const sub of h.subcategorias) rows.push(['', '', '', sub, Math.round(between(200000, 900000))]);
  addSheet('Orçado dia subcategoria', rows);
}

const outPath = path.join(OUT_DIR, 'informativo-vendas-demo.xlsx');
XLSX.writeFile(wb, outPath);

const inicio = new Date(INICIO), fim = new Date(FIM);
console.log(`Planilha de demonstração gerada em: ${outPath}`);
console.log(`Empresa (fictícia): ${EMPRESA} — ${LOJAS.length} lojas, ${new Set(LOJAS.map((l) => l.regional)).size} regionais`);
console.log(`Período: ${inicio.toISOString().slice(0, 10)} a ${fim.toISOString().slice(0, 10)}`);
console.log(`Abas (${wb.SheetNames.length}): ${wb.SheetNames.join(', ')}`);
