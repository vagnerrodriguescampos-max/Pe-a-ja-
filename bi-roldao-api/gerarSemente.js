'use strict';
/**
 * Gera a semente da DRE a partir da Base Contábil.
 *
 * Por que embarcar dados no repositório: o volume do Railway guarda o seed, e
 * um deploy troca o CÓDIGO sem reprocessar o DADO. Sem isto, toda correção de
 * parser exige que alguém abra o BI e reenvie a planilha — e enquanto ninguém
 * reenvia, o BI mostra o resultado do parser antigo, que é exatamente o que
 * aconteceu aqui. A semente fecha esse buraco: sobe junto com o código e entra
 * sozinha no primeiro boot.
 *
 * Uso: node gerarSemente.js <base-contabil.xlsx> [versao]
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { parseBaseContabilDre } = require('./dreContabil');
const { derivarFechamento } = require('./lib');

const [arquivo, versaoArg] = process.argv.slice(2);
if (!arquivo) { console.error('uso: node gerarSemente.js <base-contabil.xlsx> [versao]'); process.exit(2); }

const oficial = JSON.parse(fs.readFileSync(path.join(__dirname, 'regionais-inicial.json'), 'utf8')).mapa;
const hoje = new Date().toISOString().slice(0, 10);
const { dre, stats } = parseBaseContabilDre(XLSX.readFile(arquivo), path.basename(arquivo), hoje, oficial);
const derivados = derivarFechamento(dre);

const versao = Number(versaoArg || 1);
const saida = { versao, geradoEm: new Date().toISOString(), origemArquivo: path.basename(arquivo), dre };
const destino = path.join(__dirname, 'dre-inicial.json');
fs.writeFileSync(destino, JSON.stringify(saida));

const comPnL = dre.stores.filter(s => dre.data[s.name] && dre.data[s.name].receita_bruta);
const porReg = {};
comPnL.forEach(s => { porReg[s.regional || '(sem)'] = (porReg[s.regional || '(sem)'] || 0) + 1; });
console.log('semente v' + versao + ' gravada em dre-inicial.json');
console.log('  ' + (fs.statSync(destino).size / 1048576).toFixed(2) + ' MB');
console.log('  ' + comPnL.length + ' lojas com P&L: ' + JSON.stringify(porReg));
console.log('  meses: ' + dre.months.join(', '));
console.log('  LAIR derivado em ' + derivados + ' escopo(s)');
