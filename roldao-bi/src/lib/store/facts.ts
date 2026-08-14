import fs from 'node:fs';
import type { FactRow } from '../types';
import { ensureDataDirs, factsPath, importDir, rawPreviewPath } from './paths';

const cache = new Map<string, FactRow[]>();

export function saveFacts(importId: string, facts: FactRow[]) {
  ensureDataDirs();
  fs.mkdirSync(importDir(importId), { recursive: true });
  fs.writeFileSync(factsPath(importId), JSON.stringify(facts), 'utf-8');
  cache.set(importId, facts);
}

export function loadFacts(importId: string): FactRow[] {
  const cached = cache.get(importId);
  if (cached) return cached;
  const p = factsPath(importId);
  if (!fs.existsSync(p)) return [];
  const facts = JSON.parse(fs.readFileSync(p, 'utf-8')) as FactRow[];
  cache.set(importId, facts);
  return facts;
}

export function saveRawPreview(importId: string, preview: Record<string, unknown[]>) {
  ensureDataDirs();
  fs.mkdirSync(importDir(importId), { recursive: true });
  fs.writeFileSync(rawPreviewPath(importId), JSON.stringify(preview), 'utf-8');
}

export function loadRawPreview(importId: string): Record<string, unknown[]> {
  const p = rawPreviewPath(importId);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function clearFactsCache(importId?: string) {
  if (importId) cache.delete(importId);
  else cache.clear();
}
