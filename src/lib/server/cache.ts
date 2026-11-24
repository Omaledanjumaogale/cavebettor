/**
 * Bulk-data cache (data plane).
 *
 * Convex is deliberately NOT used for provider payloads: fixtures, odds,
 * training archives and provider responses are large, rewritten often and
 * would burn the free-tier database and egress allowances. They live in
 * Cloudflare R2 instead, and Convex only keeps tiny pointers/metadata.
 *
 * Outside Cloudflare (local dev, vitest) the same interface is served from an
 * in-process map with the same TTL semantics, so behaviour is identical.
 */

export interface CacheMeta {
  key: string;
  body: string;
  contentType: string;
  storedAt: number;
  expiresAt: number;
  bytes: number;
  provider?: string;
  etag?: string;
}

interface R2BucketLike {
  get(key: string): Promise<{ text(): Promise<string>; httpEtag?: string } | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: unknown): Promise<{ etag?: string } | void>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<{ size?: number; etag?: string } | null>;
}

export interface CacheEnv {
  R2?: R2BucketLike;
}

const memory = new Map<string, CacheMeta>();
const MAX_MEMORY_ENTRIES = 240;

export function cacheEnv(): CacheEnv | undefined {
  const holder = globalThis as unknown as { __cavebettorEnv?: CacheEnv };
  return holder.__cavebettorEnv;
}

export function registerCacheEnv(env: CacheEnv | undefined) {
  if (!env) return;
  const holder = globalThis as unknown as { __cavebettorEnv?: CacheEnv };
  holder.__cavebettorEnv = { ...(holder.__cavebettorEnv ?? {}), ...env };
}

function bucket(): R2BucketLike | undefined {
  return cacheEnv()?.R2;
}

function keyPath(key: string): string {
  return `cavebettor/${key}.json`;
}

export interface CacheReadResult<T = unknown> {
  value: T;
  storedAt: number;
  expiresAt: number;
  bytes: number;
  stale: boolean;
  source: 'r2' | 'memory';
}

/** Read a cached payload. Stale entries are returned but flagged. */
export async function readCache<T = unknown>(key: string, allowStale = true): Promise<CacheReadResult<T> | null> {
  const r2 = bucket();
  if (r2) {
    try {
      const object = await r2.get(keyPath(key));
      if (object) {
        const body = await object.text();
        const parsed = JSON.parse(body) as { value: T; storedAt: number; expiresAt: number };
        const stale = parsed.expiresAt <= Date.now();
        if (!stale || allowStale) {
          return {
            value: parsed.value,
            storedAt: parsed.storedAt,
            expiresAt: parsed.expiresAt,
            bytes: body.length,
            stale,
            source: 'r2'
          };
        }
        return null;
      }
    } catch {
      /* fall through to memory */
    }
  }

  const hit = memory.get(key);
  if (!hit) return null;
  const stale = hit.expiresAt <= Date.now();
  if (stale && !allowStale) return null;
  return {
    value: JSON.parse(hit.body) as T,
    storedAt: hit.storedAt,
    expiresAt: hit.expiresAt,
    bytes: hit.bytes,
    stale,
    source: 'memory'
  };
}

/** Write a payload to the data plane. */
export async function writeCache(key: string, value: unknown, ttlMs: number, provider?: string): Promise<CacheMeta> {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const body = JSON.stringify({ value, storedAt: now, expiresAt });
  const meta: CacheMeta = {
    key,
    body,
    contentType: 'application/json',
    storedAt: now,
    expiresAt,
    bytes: body.length,
    provider
  };

  const r2 = bucket();
  if (r2) {
    try {
      await r2.put(keyPath(key), body, { httpMetadata: { contentType: 'application/json' } });
    } catch {
      /* keep the in-memory copy so the request still succeeds */
    }
  }

  if (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, meta);
  return meta;
}

/** Remove a cached payload. */
export async function deleteCache(key: string): Promise<void> {
  memory.delete(key);
  const r2 = bucket();
  if (r2) {
    try {
      await r2.delete(keyPath(key));
    } catch {
      /* already gone or permission issue — nothing else to do */
    }
  }
}

/** Drop a payload only when it actually changed, so R2 writes stay rare. */
export async function writeCacheIfChanged(key: string, value: unknown, ttlMs: number, provider?: string): Promise<{ changed: boolean; meta: CacheMeta }> {
  const existing = await readCache<unknown>(key, true);
  const next = JSON.stringify(value);
  if (existing) {
    const previous = JSON.stringify(existing.value);
    if (previous === next) {
      return { changed: false, meta: { key, body: previous, contentType: 'application/json', storedAt: existing.storedAt, expiresAt: existing.expiresAt, bytes: existing.bytes, provider } };
    }
  }
  const meta = await writeCache(key, value, ttlMs, provider);
  return { changed: true, meta };
}
