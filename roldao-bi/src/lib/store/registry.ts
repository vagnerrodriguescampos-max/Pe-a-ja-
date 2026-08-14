import type { ImportRecord, Registry } from '../types';
import { getBiStore } from './blobStore';

const REGISTRY_KEY = 'registry.json';

async function readRaw(): Promise<Registry> {
  const store = getBiStore();
  try {
    const reg = await store.get(REGISTRY_KEY, { type: 'json' });
    return (reg as Registry) ?? { imports: [], activeImportId: null };
  } catch {
    return { imports: [], activeImportId: null };
  }
}

async function writeRaw(reg: Registry): Promise<void> {
  const store = getBiStore();
  await store.setJSON(REGISTRY_KEY, reg);
}

/** Lista o histórico completo de importações. Nunca é apagado automaticamente. */
export async function listImports(): Promise<ImportRecord[]> {
  const reg = await readRaw();
  return reg.imports.slice().sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
}

export async function getImport(id: string): Promise<ImportRecord | undefined> {
  const reg = await readRaw();
  return reg.imports.find((i) => i.id === id);
}

export async function getActiveImport(): Promise<ImportRecord | undefined> {
  const reg = await readRaw();
  if (!reg.activeImportId) return undefined;
  return reg.imports.find((i) => i.id === reg.activeImportId);
}

export async function getActiveImportId(): Promise<string | null> {
  const reg = await readRaw();
  return reg.activeImportId;
}

export async function upsertImport(record: ImportRecord): Promise<void> {
  const reg = await readRaw();
  const idx = reg.imports.findIndex((i) => i.id === record.id);
  if (idx >= 0) reg.imports[idx] = record;
  else reg.imports.push(record);
  await writeRaw(reg);
}

export async function setActiveImport(id: string): Promise<void> {
  const reg = await readRaw();
  if (!reg.imports.some((i) => i.id === id)) throw new Error('Importação não encontrada');
  reg.imports = reg.imports.map((i) => ({ ...i, isActive: i.id === id }));
  reg.activeImportId = id;
  await writeRaw(reg);
}
