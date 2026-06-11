// Send Queue — in-memory store + operations (SCAFFOLD).
//
// A tiny observable store so the UI can subscribe via useSyncExternalStore.
// No persistence and no transmission: releaseItem flips an item to 'released'
// and stamps releasedAt — it does NOT send anything. TODO(real: Supabase +
// transmission) — persist items and wire releaseItem to the email/fax sender.

import type { QueueFilter, QueueItem } from './types';

let items: QueueItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  // New array identity so useSyncExternalStore's getSnapshot sees a change.
  items = [...items];
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getItems(): QueueItem[] {
  return items;
}

export function enqueue(item: QueueItem): void {
  items.push(item);
  emit();
}

export function listQueue(filter?: QueueFilter): QueueItem[] {
  return items.filter((it) => {
    if (filter?.status && it.status !== filter.status) return false;
    if (filter?.actionType && it.actionType !== filter.actionType) return false;
    if (filter?.matterId && it.matterId !== filter.matterId) return false;
    return true;
  });
}

// ready -> released. Incomplete/draft items are blocked (must be completed
// first). Returns true on success.
export function releaseItem(id: string, auto = false): boolean {
  const it = items.find((x) => x.id === id);
  if (!it) return false;
  if (it.status !== 'ready') return false; // incomplete/draft cannot release
  it.status = 'released';
  it.releasedAt = new Date().toISOString();
  it.autoReleased = auto;
  emit();
  return true;
}

export function releaseBatch(ids: string[]): { released: string[]; skipped: string[] } {
  const released: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) (releaseItem(id) ? released : skipped).push(id);
  return { released, skipped };
}

export function markFailed(id: string, reason: string): void {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.status = 'failed';
  it.renderedBody = `[FAILED: ${reason}]\n\n${it.renderedBody}`;
  emit();
}

// Inline edit / fill-missing-fields. Patches the item and recomputes status:
// once nothing required is missing, an 'incomplete' item becomes 'ready'.
export function updateItem(id: string, patch: Partial<QueueItem>): void {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  Object.assign(it, patch);
  if (it.status === 'incomplete' && (it.missingFields?.length ?? 0) === 0) {
    it.status = 'ready';
  }
  emit();
}

export function resetQueue(seed: QueueItem[] = []): void {
  items = [...seed];
  emit();
}
