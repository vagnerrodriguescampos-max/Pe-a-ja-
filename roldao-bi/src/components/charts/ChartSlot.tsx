import type { ReactNode } from 'react';
import { CalendarSearch } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Área de um gráfico com os três estados que ela realmente tem.
 *
 * O motivo de existir: as páginas escreviam
 *
 *     {loading || !pontos.length ? <Skeleton/> : <Grafico/>}
 *
 * o que trata "ainda carregando" e "não há nada para mostrar" como a mesma
 * coisa. Quem filtrava um mês sem movimento via um Skeleton — o retângulo
 * cinza de carregamento — parado para sempre. Não é um detalhe estético: o
 * usuário lê aquilo como "o gráfico sumiu" ou "o sistema travou", e não tem
 * como saber que o filtro é que não tem dado.
 *
 * Aqui os três estados ficam separados e nomeados:
 *   carregando -> Skeleton (a promessa de que algo vem)
 *   vazio      -> mensagem dizendo o que houve e o que fazer
 *   com dado   -> o gráfico
 *
 * A altura é a mesma nos três, para a página não pular quando o estado muda.
 */
export function ChartSlot({
  carregando,
  vazio,
  altura,
  titulo = 'Sem dados no período selecionado',
  descricao = 'Não há movimento registrado para os filtros atuais. Ajuste o período ou limpe os filtros para ver a evolução.',
  children,
}: {
  carregando: boolean;
  vazio: boolean;
  altura: number;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
}) {
  if (carregando) return <Skeleton className="w-full" style={{ height: altura }} />;

  if (vazio) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-base-border bg-base-surface2/40 px-6 text-center"
        style={{ height: altura }}
        role="status"
      >
        <div className="rounded-full bg-base-surface p-3 text-base-muted">
          <CalendarSearch size={22} />
        </div>
        <p className="text-sm font-semibold text-base-text">{titulo}</p>
        <p className="max-w-sm text-sm text-base-muted">{descricao}</p>
      </div>
    );
  }

  return <>{children}</>;
}
