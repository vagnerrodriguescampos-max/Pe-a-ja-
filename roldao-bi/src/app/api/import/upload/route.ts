import { NextRequest, NextResponse } from 'next/server';
import { runImport } from '@/lib/ingest/runImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Limite defensivo: o parser (SheetJS) tem advisories conhecidos de ReDoS em
// entradas adversariais — ver README ("Segurança"). Restringir tamanho e
// exigir usuário autenticado/confiável reduz a superfície de ataque.
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  const activate = form.get('activate') !== 'false';
  const importedBy = (form.get('importedBy') as string) || 'Usuário Roldão';

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
    return NextResponse.json({ error: 'Formato inválido. Envie um arquivo .xlsx/.xls.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `Arquivo maior que o limite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const record = runImport({
      fileName: file.name,
      fileSizeBytes: buffer.byteLength,
      buffer,
      importedBy,
      activate,
    });
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao processar a planilha.' }, { status: 500 });
  }
}
