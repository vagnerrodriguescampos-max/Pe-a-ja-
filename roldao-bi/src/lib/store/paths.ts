import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const IMPORTS_DIR = path.join(DATA_DIR, 'imports');
export const REGISTRY_PATH = path.join(DATA_DIR, 'registry.json');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

export function importDir(importId: string) {
  return path.join(IMPORTS_DIR, importId);
}

export function factsPath(importId: string) {
  return path.join(importDir(importId), 'facts.json');
}

export function rawPreviewPath(importId: string) {
  return path.join(importDir(importId), 'raw-preview.json');
}
