import { NextRequest, NextResponse } from 'next/server';
import { setActiveImport } from '@/lib/store/registry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  try {
    await setActiveImport(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 400 });
  }
}
