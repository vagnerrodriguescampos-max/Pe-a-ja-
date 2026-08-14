// Gera uma planilha de exemplo (.xlsx) com a MESMA estrutura de abas do
// "INFORMATIVO DE VENDAS - Lojas" do Roldão Atacadista, com dados fictícios
// e pequenos, apenas para demonstrar/testar o motor de importação.
//
// Uso: npm run sample:generate  -> gera ./sample/roldao-informativo-vendas-exemplo.xlsx
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'sample');
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOJAS = [
  { cod: 2, nome: 'FREGUESIA DO', regional: 'C. OESTE' },
  { cod: 3, nome: 'MOOCA', regional: 'GRANDE SP' },
  { cod: 4, nome: 'BUTANTÃ', regional: 'C. OESTE' },
  { cod: 5, nome: 'OSASCO', regional: 'C. OESTE' },
  { cod: 6, nome: 'CAMPO LIMPO', regional: 'C. OESTE' },
  { cod: 7, nome: 'SANTO ANDRÉ', regional: 'BAIXADA/ABC' },
  { cod: 8, nome: 'JUNDIAÍ', regional: 'INTERIOR' },
  { cod: 9, nome: 'GUARULHOS', regional: 'GRANDE SP' },
];

const HIERARQUIA = [
  { categoria: 'MERCEARIA', segmento: 'ACUCAR', subcategorias: ['ACUCAR REFINADO', 'ACUCAR CRISTAL'] },
  { categoria: 'ACOUGUE', segmento: 'BOVINOS', subcategorias: ['ACOUGUE BOVINO', 'ACOUGUE SUINO'] },
  { categoria: 'BEBIDAS', segmento: 'REFRIGERANTE', subcategorias: ['REFRI COLA', 'REFRI GUARANA'] },
  { categoria: 'LATICINIOS', segmento: 'LEITE UHT', subcategorias: ['LEITE INTEGRAL', 'LEITE DESNATADO'] },
  { categoria: 'LIMPEZA', segmento: 'LIMPEZA GERAL', subcategorias: ['DETERGENTE', 'SABAO EM PO'] },
];

const ANO = 2026;
const MES = 8; // agosto
const DIAS = 31;

let seed = 42;
function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function between(min, max) { return min + rand() * (max - min); }

function lojaBase(loja) { return 250000 + loja.cod * 15000 + between(-8000, 8000); }

const wb = XLSX.utils.book_new();
function addSheet(name, aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ---------- ORÇADO: orçamento diário por loja (agosto/2026) ----------
{
  const header = ['Loja', 'Nº', ...Array.from({ length: DIAS }, (_, d) => `${d + 1}/${MES}`), 'Total'];
  const rows = [header];
  for (const loja of LOJAS) {
    const base = lojaBase(loja) * 0.98;
    const dias = Array.from({ length: DIAS }, () => Math.round(base * between(0.85, 1.15)));
    rows.push([loja.nome, loja.cod, ...dias, dias.reduce((a, b) => a + b, 0)]);
  }
  addSheet('ORÇADO', rows);
}

// ---------- base: fato diário granular por loja (venda realizada) ----------
{
  const rows = [['Data', 'Loja', 'Venda Valor', 'Ticket Médio', 'Qtde Clientes']];
  for (let d = 1; d <= DIAS; d++) {
    const data = new Date(Date.UTC(ANO, MES - 1, d));
    for (const loja of LOJAS) {
      const base = lojaBase(loja);
      const venda = Math.round(base * between(0.8, 1.25));
      const clientes = Math.round(venda / between(140, 190));
      rows.push([data, loja.cod, venda, Math.round((venda / clientes) * 100) / 100, clientes]);
    }
  }
  addSheet('base', rows);
}

// ---------- Vendas: painel executivo mestre ----------
{
  const rows = [
    ['Vendas INFORMATIVO DE VENDAS - ATACADISTA ROLDÃO LTDA'],
    ['', '', '', '', '', '', '', 'Televendas', '', '', '', 'E-commerce', '', '', '', 'Clientes', '', '', ''],
    ['Loja', 'Nº loja', 'Meta', `ago.-${String(ANO - 1).slice(2)}`, `ago.-${String(ANO).slice(2)}`, 'aa %', 'Meta %', `ago.-${String(ANO - 1).slice(2)}`, `ago.-${String(ANO).slice(2)}`, 'aa %', 'Part %', `ago.-${String(ANO - 1).slice(2)}`, `ago.-${String(ANO).slice(2)}`, 'aa %', 'Part %', `ago.-${String(ANO - 1).slice(2)}`, `ago.-${String(ANO).slice(2)}`, 'aa %'],
  ];
  for (const loja of LOJAS) {
    const meta = Math.round(lojaBase(loja) * DIAS * 0.98);
    const vendaAtual = Math.round(lojaBase(loja) * DIAS * between(0.9, 1.12));
    const vendaAnterior = Math.round(vendaAtual * between(0.85, 1.05));
    const tele25 = Math.round(vendaAnterior * 0.05), tele26 = Math.round(vendaAtual * 0.045);
    const ecomm25 = Math.round(vendaAnterior * 0.02), ecomm26 = Math.round(vendaAtual * 0.028);
    const cli25 = Math.round(vendaAnterior / 165), cli26 = Math.round(vendaAtual / 160);
    rows.push([
      loja.nome, loja.cod, meta, vendaAnterior, vendaAtual, ((vendaAtual - vendaAnterior) / vendaAnterior) * 100, (vendaAtual / meta) * 100,
      tele25, tele26, ((tele26 - tele25) / tele25) * 100, (tele26 / vendaAtual) * 100,
      ecomm25, ecomm26, ((ecomm26 - ecomm25) / ecomm25) * 100, (ecomm26 / vendaAtual) * 100,
      cli25, cli26, ((cli26 - cli25) / cli25) * 100,
    ]);
  }
  addSheet('Vendas', rows);
}

// ---------- Piso ----------
{
  const rows = [['Loja', 'Nº', `${ANO} Acumulado`, `${ANO - 1} Acumulado`, `${ANO} Piso`, `${ANO - 1} Piso`]];
  for (const loja of LOJAS) {
    const acumAtual = Math.round(lojaBase(loja) * DIAS * between(0.85, 1.1));
    const acumAnterior = Math.round(acumAtual * between(0.85, 1.05));
    const piso = Math.round(acumAtual * between(0.78, 0.98));
    rows.push([loja.nome, loja.cod, acumAtual, acumAnterior, piso, Math.round(piso * 0.95)]);
  }
  addSheet('Piso', rows);
}

// ---------- BASE TELE E ECOMM ----------
{
  const rows = [['Data', 'Loja', 'Canal Venda', 'Venda Bruta R$']];
  for (let d = 1; d <= DIAS; d++) {
    const data = new Date(Date.UTC(ANO, MES - 1, d));
    for (const loja of LOJAS) {
      const base = lojaBase(loja);
      rows.push([data, loja.cod, 'TELEVENDAS', Math.round(base * between(0.03, 0.07))]);
      rows.push([data, loja.cod, 'E-COMMERCE', Math.round(base * between(0.015, 0.04))]);
    }
  }
  addSheet('BASE TELE E ECOMM', rows);
}

// ---------- BESE VENDA ACUMULADO ----------
{
  const rows = [['Loja', 'Nº', `${ANO} Venda Acumulada`, `${ANO - 1} Venda Acumulada`, `${ANO} Clientes`, `${ANO - 1} Clientes`, `${ANO} Ticket`, `${ANO - 1} Ticket`]];
  for (const loja of LOJAS) {
    const atual = Math.round(lojaBase(loja) * DIAS * between(0.9, 1.1));
    const anterior = Math.round(atual * between(0.85, 1.05));
    const cliAtual = Math.round(atual / 165), cliAnterior = Math.round(anterior / 170);
    rows.push([loja.nome, loja.cod, atual, anterior, cliAtual, cliAnterior, Math.round((atual / cliAtual) * 100) / 100, Math.round((anterior / cliAnterior) * 100) / 100]);
  }
  addSheet('BESE VENDA ACUMULADO', rows);
}

// ---------- BASE VENDA DIA ----------
{
  const rows = [['Loja', 'Nº', `${ANO} Venda Dia`, `${ANO - 1} Venda Dia`, `${ANO} Clientes`, `${ANO - 1} Clientes`, `${ANO} Ticket`, `${ANO - 1} Ticket`]];
  for (const loja of LOJAS) {
    const base = lojaBase(loja);
    const atual = Math.round(base * between(0.85, 1.15));
    const anterior = Math.round(atual * between(0.85, 1.05));
    const cliAtual = Math.round(atual / 165), cliAnterior = Math.round(anterior / 170);
    rows.push([loja.nome, loja.cod, atual, anterior, cliAtual, cliAnterior, Math.round((atual / cliAtual) * 100) / 100, Math.round((anterior / cliAnterior) * 100) / 100]);
  }
  addSheet('BASE VENDA DIA', rows);
}

// ---------- Subcategoria (pivot venda bruta 2025 x 2026) ----------
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

// ---------- Orçado de categoria: orçamento diário por loja x subcategoria ----------
{
  const header = ['Loja', 'Ano', 'Sub-Categoria', ...Array.from({ length: DIAS }, (_, d) => `${d + 1}-ago.`), 'Total'];
  const rows = [header];
  for (const loja of LOJAS) {
    for (const h of HIERARQUIA) {
      for (const sub of h.subcategorias) {
        const base = between(4000, 25000);
        const dias = Array.from({ length: DIAS }, () => Math.round(base * between(0.8, 1.2)));
        rows.push([loja.nome, ANO, sub, ...dias, dias.reduce((a, b) => a + b, 0)]);
      }
    }
  }
  addSheet('Orçado de categoria', rows);
}

// ---------- Base Segmento: fato diário granular por segmento ----------
{
  const rows = [['Data', 'Seção', 'Nº', 'Regional', 'Loja', 'Venda Valor']];
  for (let d = 1; d <= DIAS; d++) {
    const data = new Date(Date.UTC(ANO, MES - 1, d));
    for (const loja of LOJAS) {
      for (const h of HIERARQUIA) {
        rows.push([data, h.segmento, loja.cod, loja.regional, loja.nome, Math.round(between(2000, 18000))]);
      }
    }
  }
  addSheet('Base Segmento', rows);
}

// ---------- Base de Subcategoria: fato diário granular por subcategoria ----------
{
  const rows = [['Data', 'Subcategoria', 'Nº', 'Regional', 'Loja', 'Venda Valor']];
  for (let d = 1; d <= DIAS; d += 2) { // amostragem a cada 2 dias para manter o arquivo enxuto
    const data = new Date(Date.UTC(ANO, MES - 1, d));
    for (const loja of LOJAS) {
      for (const h of HIERARQUIA) {
        for (const sub of h.subcategorias) {
          rows.push([data, sub, loja.cod, loja.regional, loja.nome, Math.round(between(400, 6000))]);
        }
      }
    }
  }
  addSheet('Base de Subcategoria', rows);
}

// ---------- Base loja: cadastro ----------
{
  const rows = [['Nº Loja', 'Loja', 'Regional', 'Empresa']];
  for (const loja of LOJAS) rows.push([loja.cod, loja.nome, loja.regional, 'ATACADISTA ROLDÃO LTDA']);
  addSheet('Base loja', rows);
}

// ---------- Base nova regional ----------
{
  const rows = [['Nº Loja', 'Regional']];
  for (const loja of LOJAS) rows.push([loja.cod, loja.regional]);
  addSheet('Base nova regional', rows);
}

// ---------- Procv categoria: hierarquia categoria/segmento/subcategoria ----------
{
  const rows = [['Subcategoria', 'Segmento', 'Categoria']];
  for (const h of HIERARQUIA) for (const sub of h.subcategorias) rows.push([sub, h.segmento, h.categoria]);
  addSheet('Procv categoria', rows);
}

// ---------- Planilha1: aba residual, sem estrutura relevante ----------
addSheet('Planilha1', [['obs'], ['planilha auxiliar, sem uso analítico']]);

// ---------- Orçado dia / Orçado dia subcategoria: pivots de um único dia ----------
{
  const dia = 14;
  const rows = [['Meta /loja', 'Nº', `${dia}/${MES}`, '', 'Sub-Categoria', 'Total']];
  let i = 0;
  for (const loja of LOJAS) {
    const h = HIERARQUIA[i % HIERARQUIA.length];
    rows.push([loja.nome, loja.cod, Math.round(lojaBase(loja) * 0.98), '', h.segmento, Math.round(between(600000, 1800000))]);
    i++;
  }
  addSheet('Orçado dia', rows);
}
{
  const rows = [['Loja AJUST', `(Vários itens) 14-ago`, `(Tudo) Soma de 14-ago`, 'Sub-Categoria', 'Total']];
  for (const h of HIERARQUIA) for (const sub of h.subcategorias) rows.push(['', '', '', sub, Math.round(between(200000, 900000))]);
  addSheet('Orçado dia subcategoria', rows);
}

const outPath = path.join(OUT_DIR, 'roldao-informativo-vendas-exemplo.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Planilha de exemplo gerada em: ${outPath}`);
console.log(`Abas: ${wb.SheetNames.join(', ')}`);
