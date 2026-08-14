import type { FactRow, SheetRole } from '../types';

/**
 * Várias abas da planilha descrevem a MESMA venda em recortes diferentes
 * (por loja/dia, por segmento, por subcategoria, por canal, resumo mensal
 * executivo...). Somar `venda_bruta`/`orcamento` cegamente por todas elas
 * multiplicaria o total. Por isso, para os números de "empresa / loja /
 * regional" (o grão mais agregado) usamos como fonte primária apenas a(s)
 * aba(s) mais granular(es) e completa(s) do período — a mesma lógica de
 * "priorizar o indicador oficial da base, sem inventar nem duplicar dados"
 * da seção 40. As análises por categoria/segmento/subcategoria/canal
 * continuam usando integralmente as abas específicas de cada corte (elas
 * não se sobrepõem às abas primárias, pois só uma delas tem cada dimensão).
 */
const PRIMARY_VENDA_ROLES: SheetRole[] = ['BASE_DIARIA_LOJA'];
const PRIMARY_ORCAMENTO_ROLES: SheetRole[] = ['ORCADO_LOJA_DIA'];
const PRIMARY_ROLES = new Set<SheetRole>([...PRIMARY_VENDA_ROLES, ...PRIMARY_ORCAMENTO_ROLES]);

/** true se a base importada (como um todo) contém as abas primárias esperadas. */
export function hasPrimarySheets(facts: FactRow[]): boolean {
  return facts.some((f) => PRIMARY_ROLES.has(f.sheetRole));
}

/**
 * Restringe a fatos das abas primárias (venda + orçamento por loja/dia).
 * `usesPrimary` deve vir de `hasPrimarySheets(allFacts)` calculado UMA VEZ
 * sobre a base inteira (não sobre um recorte já filtrado por ano/período) —
 * senão um recorte legítimo sem dados no ano anterior, por exemplo, cairia
 * incorretamente no modo de fallback e voltaria a somar abas sobrepostas.
 * Sem abas primárias na planilha (formato diferente), cai de volta para
 * todos os fatos sem dimensão de categoria/segmento/subcategoria/canal —
 * para não deixar os KPIs zerados.
 */
export function restrictToPrimary(facts: FactRow[], usesPrimary: boolean): FactRow[] {
  if (usesPrimary) return facts.filter((f) => PRIMARY_ROLES.has(f.sheetRole));
  return facts.filter((f) => !f.categoria && !f.segmento && !f.subcategoria && !f.canal);
}
