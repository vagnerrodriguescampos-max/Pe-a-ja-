import fs from 'node:fs';
import type { ImportRecord, Registry } from '../types';
import { ensureDataDirs, REGISTRY_PATH } from './paths';

function readRaw(): Registry {
  ensureDataDirs();
  if (!fs.existsSync(REGISTRY_PATH)) return { imports: [], activeImportId: null };
  try {
    const txt = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(txt) as Registry;
  } catch {
    return { imports: [], activeImportId: null };
  }
}

function writeRaw(reg: Registry) {
  ensureDataDirs();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2), 'utf-8');
}

/** Lista o histórico completo de importações. Nunca é apagado automaticamente. */
export function listImports(): ImportRecord[] {
  return readRaw().imports.slice().sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
}

export function getImport(id: string): ImportRecord | undefined {
  return readRaw().imports.find((i) => i.id === id);
}

export function getActiveImport(): ImportRecord | undefined {
  const reg = readRaw();
  if (!reg.activeImportId) return undefined;
  return reg.imports.find((i) => i.id === reg.activeImportId);
}

export function getActiveImportId(): string | null {
  return readRaw().activeImportId;
}

export function upsertImport(record: ImportRecord) {
  const reg = readRaw();
  const idx = reg.imports.findIndex((i) => i.id === record.id);
  if (idx >= 0) reg.imports[idx] = record;
  else reg.imports.push(record);
  writeRaw(reg);
}

export function setActiveImport(id: string) {
  const reg = readRaw();
  if (!reg.imports.some((i) => i.id === id)) throw new Error('Importação não encontrada');
  reg.imports = reg.imports.map((i) => ({ ...i, isActive: i.id === id }));
  reg.activeImportId = id;
  writeRaw(reg);
}
