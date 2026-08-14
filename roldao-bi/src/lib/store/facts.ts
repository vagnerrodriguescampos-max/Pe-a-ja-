import type { FactRow } from '../types';
import { getBiStore } from './blobStore';

// Cache em memória do processo — só ajuda em invocações "quentes" (mesmo
// container reaproveitado); nunca é a fonte de verdade dos dados.
const cache = new Map<string, FactRow[]>();

function factsKey(importId: string) {
  return `facts/${importId}.json`;
}

function rawPreviewKey(importId: string) {
  return `raw-preview/${importId}.json`;
}

export async function saveFacts(importId: string, facts: FactRow[]): Promise<void> {
  const store = getBiStore();
  await store.setJSON(factsKey(importId), facts);
  cache.set(importId, facts);
}

export async function loadFacts(importId: string): Promise<FactRow[]> {
  const cached = cache.get(importId);
  if (cached) return cached;
  const store = getBiStore();
  const facts = (await store.get(factsKey(importId), { type: 'json' })) as FactRow[] | null;
  const result = facts ?? [];
  cache.set(importId, result);
  return result;
}

export async function saveRawPreview(importId: string, preview: Record<string, unknown[]>): Promise<void> {
  const store = getBiStore();
  await store.setJSON(rawPreviewKey(importId), preview);
}

export async function loadRawPreview(importId: string): Promise<Record<string, unknown[]>> {
  const store = getBiStore();
  const preview = await store.get(rawPreviewKey(importId), { type: 'json' });
  return (preview as Record<string, unknown[]>) ?? {};
}

export function clearFactsCache(importId?: string) {
  if (importId) cache.delete(importId);
  else cache.clear();
}
