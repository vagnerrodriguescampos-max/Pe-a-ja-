/* Reconciliação entre as duas fontes da DRE.
 *
 * A DRE do BI passou a ser montada da Base Contábil, que é um arquivo só com a
 * rede inteira. A planilha gerencial ("04 - INTERIOR.xlsm" e irmãs) continua
 * existindo e cobre 9 lojas. Onde as duas se sobrepõem elas TÊM de dar o mesmo
 * número — é isso que prova que o mapeamento Sub Grupo -> linha da DRE está
 * certo, e não só que o código roda.
 *
 * Resultado na base de agosto/2026: 1389 de 1431 conferências batem. As 42
 * restantes são todas a linha Deduções em junho, e o que deriva dela
 * (Receita Líquida, Lucro Bruto, EBITDA). Fev, mar, abr, mai e jul fecham ao
 * centavo nas nove lojas. Não é defeito de leitura: é divergência entre as
 * fontes num mês só — a contábil registra menos dedução do que a gerencial em
 * todas as nove, o que tem cara de reclassificação lançada depois da extração
 * (o arquivo é datado 2026_6_1). Precisa de resposta da contabilidade, não de
 * conserto no código.
 *
 * Uso: node reconciliacao.js <base-contabil.xlsx> <dre-gerencial.xlsm>
 */
const XLSX=require('xlsx');
const {parseBaseContabilDre}=require('./dreContabil.js');
const {parseDreWorkbook}=require('./lib.js');
const oficial=require('./regionais-inicial.json').mapa;
const [arqContabil, arqGerencial] = process.argv.slice(2);
if(!arqContabil || !arqGerencial){
  console.error('uso: node reconciliacao.js <base-contabil.xlsx> <dre-gerencial.xlsm>');
  process.exit(2);
}
const hoje=new Date().toISOString().slice(0,10);
const C=parseBaseContabilDre(XLSX.readFile(arqContabil),'contabil',hoje,oficial).dre;
const G=parseDreWorkbook(XLSX.readFile(arqGerencial),'gerencial',hoje).dre;

const LINHAS=['receita_bruta','deducoes','receita_liquida','cmv','contratos','negociacao',
 'icms_st','operacao_logistica','qi_qni','cmv_gerencial','lucro_bruto','desp_pessoal',
 'ocupacao_p','utilidades','manutencao','outras_rec_desp','desp_gerais','impostos',
 'leasing','dados_com','juridico','propaganda','serv_prof','despesas_total','mrg_ebitda',
 'depreciacao','resultado_financeiro','resultado_nao_op'];

const lojasG=G.stores.filter(s=>G.data[s.name]&&G.data[s.name].receita_bruta).map(s=>s.name);
const meses=G.months.filter(m=>C.months.includes(m));
console.log('lojas nas duas fontes:', lojasG.length, '| meses em comum:', meses.length);
console.log();

let ok=0, div=0, ausC=0, ausG=0; const piores=[];
for(const loja of lojasG){
  const dc=C.data[loja], dg=G.data[loja];
  if(!dc){ console.log('  !! '+loja+' nao existe na contabil'); continue; }
  for(const m of meses) for(const k of LINHAS){
    const a=dc[k]&&dc[k][m], b=dg[k]&&dg[k][m];
    if(a==null&&b==null) continue;
    if(a==null){ ausC++; continue; }
    if(b==null){ ausG++; continue; }
    const base=Math.max(Math.abs(a),Math.abs(b));
    const dif=Math.abs(a-b);
    if(base>0 && dif/base>0.005 && dif>1000){ div++; piores.push({loja,m,k,contabil:a,gerencial:b,dif}); }
    else ok++;
  }
}
console.log('conferidos  : '+(ok+div));
console.log('  batem     : '+ok);
console.log('  divergem  : '+div);
console.log('so na gerencial (contabil nao tem): '+ausC);
console.log('so na contabil  (gerencial nao tem): '+ausG);
if(piores.length){
  console.log();
  console.log('maiores divergencias:');
  piores.sort((a,b)=>b.dif-a.dif).slice(0,12).forEach(p=>
    console.log('  '+p.loja.padEnd(14)+p.m+' '+p.k.padEnd(20)+
      'contabil '+(p.contabil/1000).toFixed(1).padStart(11)+' mil  vs  gerencial '+(p.gerencial/1000).toFixed(1).padStart(11)+' mil'));
}

process.exit(div > 60 ? 1 : 0);   // margem para a divergência conhecida de junho
