import { NextResponse } from 'next/server';

/**
 * Envolve um handler de rota para nunca deixar uma exceção não tratada
 * virar uma resposta HTML/erro genérico do Next (o que quebraria o
 * `res.json()` do lado do cliente). Toda falha vira um JSON `{ error }`
 * com status 500, logada no servidor — nunca silenciada.
 *
 * Isso é especialmente importante porque uma falha de conectividade com o
 * Blob Store não pode ser confundida, no front-end, com "ainda não há
 * importação" — ver `NoDataGate`.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error('[api] erro não tratado na rota:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Erro interno ao processar a requisição.' },
        { status: 500 }
      );
    }
  };
}
