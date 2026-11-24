import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCache, readCache, writeCache, writeCacheIfChanged } from '#lib/server/cache';

describe('data-plane cache', () => {
  beforeEach(async () => {
    await deleteCache('test/roundtrip');
    await deleteCache('test/changed');
  });

  it('returns the stored value, not the storage envelope', async () => {
    await writeCache('test/roundtrip', { hello: 'world', rows: [1, 2, 3] }, 60_000);
    const hit = await readCache<{ hello: string; rows: number[] }>('test/roundtrip');
    expect(hit).not.toBeNull();
    expect(hit!.value).toEqual({ hello: 'world', rows: [1, 2, 3] });
    expect(hit!.value).not.toHaveProperty('storedAt');
    expect(hit!.stale).toBe(false);
  });

  it('keeps arrays intact so list consumers can iterate', async () => {
    await writeCache('test/roundtrip', [{ id: 'a' }, { id: 'b' }], 60_000);
    const hit = await readCache<{ id: string }[]>('test/roundtrip');
    expect(Array.isArray(hit!.value)).toBe(true);
    expect(hit!.value.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('skips the rewrite when the payload is unchanged', async () => {
    const first = await writeCacheIfChanged('test/changed', { n: 1 }, 60_000);
    const second = await writeCacheIfChanged('test/changed', { n: 1 }, 60_000);
    const third = await writeCacheIfChanged('test/changed', { n: 2 }, 60_000);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(third.changed).toBe(true);
    expect((await readCache<{ n: number }>('test/changed'))!.value).toEqual({ n: 2 });
  });

  it('flags expired entries as stale but still readable', async () => {
    await writeCache('test/roundtrip', [1], -1);
    const hit = await readCache<number[]>('test/roundtrip', true);
    expect(hit!.stale).toBe(true);
    expect(await readCache('test/roundtrip', false)).toBeNull();
  });
});
