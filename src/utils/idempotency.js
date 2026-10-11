const STORAGE_PREFIX = 'kinoxii:idempotency:';
const memoryKeys = new Map();

const createKey = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const getIdempotencyKey = (operation) => {
  const storageKey = `${STORAGE_PREFIX}${operation}`;
  const existing = memoryKeys.get(storageKey);
  if (existing) return existing;

  try {
    const stored = globalThis.sessionStorage?.getItem(storageKey);
    if (stored) {
      memoryKeys.set(storageKey, stored);
      return stored;
    }
  } catch {
    // Storage may be disabled; keep the operation key in memory instead.
  }

  const key = createKey();
  memoryKeys.set(storageKey, key);
  try {
    globalThis.sessionStorage?.setItem(storageKey, key);
  } catch {
    // In-memory keys still deduplicate retries in the current page.
  }
  return key;
};

export const clearIdempotencyKey = (operation) => {
  const storageKey = `${STORAGE_PREFIX}${operation}`;
  memoryKeys.delete(storageKey);
  try {
    globalThis.sessionStorage?.removeItem(storageKey);
  } catch {
    // Nothing else to clear when session storage is unavailable.
  }
};