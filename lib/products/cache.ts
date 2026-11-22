/**
 * Tiny in-memory TTL cache for catalog search results.
 *
 * Amazon's Associates Operating Agreement limits how long cached prices and
 * availability can be shown: prices must be refreshed and/or shown with a
 * timestamp. Keep PRODUCT_CACHE_TTL_SECONDS short (default 3600) and always
 * display CatalogProduct.fetchedAt ("Price as of ..."). Check the current
 * Operating Agreement before raising this TTL.
 */

const MAX_ENTRIES = 500;

function ttlSeconds(): number {
  const raw = Number(process.env.PRODUCT_CACHE_TTL_SECONDS ?? "3600");
  return Number.isFinite(raw) && raw > 0 ? raw : 3600;
}

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, Entry<unknown>>();

function evictExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function evictOldest(): void {
  const first = store.keys().next();
  if (!first.done) store.delete(first.value);
}

export function cacheGet<T>(key: string): T | undefined {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T): void {
  const now = Date.now();
  evictExpired(now);
  if (store.has(key)) store.delete(key);
  while (store.size >= MAX_ENTRIES) evictOldest();
  store.set(key, { value, expiresAt: now + ttlSeconds() * 1000 });
}

export function cacheKey(sourceId: string, query: string, category?: string): string {
  return `${sourceId}\0${query.trim().toLowerCase()}\0${category ?? ""}`;
}
