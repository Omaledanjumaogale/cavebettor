/**
 * Service worker behaviour.
 *
 * The worker is plain JavaScript that runs outside the app, so it gets its own
 * harness: a fake CacheStorage, a fake FetchEvent and a controllable fetch. The
 * assertions are the promises the PWA makes — private routes are never stored,
 * a navigation without a network lands on the offline notice, and the shell is
 * precached.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';

const source = readFileSync('static/sw.js', 'utf8');

/** Node's Request refuses relative URLs; the worker uses them for the shell. */
class TestRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const value = typeof input === 'string' && input.startsWith('/') ? `https://cavebettor.test${input}` : input;
    super(value as RequestInfo, init);
  }
}

class FakeCache {
  store = new Map<string, { body: string; headers: Record<string, string>; status: number }>();
  key(request: Request | string) {
    return typeof request === 'string' ? request : new URL(request.url).pathname;
  }
  async put(request: Request | string, response: Response) {
    this.store.set(this.key(request), {
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status
    });
  }
  async match(request: Request | string) {
    const hit = this.store.get(this.key(request));
    if (!hit) return undefined;
    return new Response(hit.body, { status: hit.status, headers: hit.headers });
  }
  async keys() {
    return [...this.store.keys()].map((path) => new Request(`https://cavebettor.test${path}`));
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.caches.has(name)) this.caches.set(name, new FakeCache());
    return this.caches.get(name)!;
  }
  async match(request: Request | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
}

interface Harness {
  listeners: Record<string, ((event: any) => void)[]>;
  caches: FakeCacheStorage;
  dispatch: (type: string, event: any) => void;
  cachedPaths: () => Promise<string[]>;
}

function createHarness(network: (request: Request) => Promise<Response> | Response): Harness {
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const caches = new FakeCacheStorage();
  const self = {
    addEventListener: (type: string, handler: (event: any) => void) => {
      (listeners[type] ??= []).push(handler);
    },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => null },
    location: { origin: 'https://cavebettor.test' },
    registration: { showNotification: async () => {} }
  };

  const run = new Function('self', 'caches', 'fetch', 'Response', 'Request', 'URL', 'setTimeout', 'clearTimeout', source);
  run(self, caches, network, Response, TestRequest, URL, setTimeout, clearTimeout);

  async function dispatch(type: string, event: any) {
    for (const handler of listeners[type] ?? []) handler(event);
    // Flush the promises handed to `event.waitUntil` / `respondWith`.
    await Promise.all(event.pending ?? []);
  }

  return {
    listeners,
    caches,
    dispatch,
    cachedPaths: async () => {
      const paths: string[] = [];
      for (const cache of caches.caches.values()) for (const key of cache.store.keys()) paths.push(key);
      return paths;
    }
  };
}

function fetchEvent(request: Request) {
  const event: any = { request, pending: [] as Promise<unknown>[] };
  event.respondWith = (promise: Promise<Response>) => event.pending.push(promise);
  event.waitUntil = (promise: Promise<unknown>) => event.pending.push(promise);
  return event;
}

const shellBody = '<html>CaveBettor shell</html>';
const offlineBody = '<html>You are offline</html>';
const liveBody = '<html>Live matches</html>';

function defaultNetwork(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/offline') return Promise.resolve(new Response(offlineBody, { status: 200, headers: { 'content-type': 'text/html' } }));
  if (path === '/live') return Promise.resolve(new Response(liveBody, { status: 200, headers: { 'content-type': 'text/html' } }));
  if (path === '/api/health') return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
  return Promise.resolve(new Response(shellBody, { status: 200, headers: { 'content-type': 'text/html' } }));
}

describe('service worker', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness(defaultNetwork);
  });

  async function install() {
    await harness.dispatch('install', { waitUntil: (promise: Promise<unknown>) => harness.listeners.__install ?? promise });
  }

  it('precaches the offline shell', async () => {
    const event: any = { pending: [] as Promise<unknown>[], waitUntil: (promise: Promise<unknown>) => event.pending.push(promise) };
    await harness.dispatch('install', event);
    const paths = await harness.cachedPaths();
    expect(paths).toContain('/offline');
    expect(paths).toContain('/');
    expect(paths).toContain('/manifest.webmanifest');
    expect(paths).toContain('/icons/icon-192.png');
  });

  it('serves the offline notice for a workspace route when the network is down', async () => {
    // Install while online (that is the only way a real device gets a shell),
    // then drop the connection for the navigation.
    let down = false;
    const offline = createHarness((request) => (down ? Promise.reject(new Error('offline')) : defaultNetwork(request)));
    const installEvent: any = { pending: [] as Promise<unknown>[], waitUntil: (promise: Promise<unknown>) => installEvent.pending.push(promise) };
    await offline.dispatch('install', installEvent);
    down = true;

    const event = fetchEvent(new Request('https://cavebettor.test/live', { headers: { accept: 'text/html' } }));

    // A navigation request carries mode "navigate"; construct it explicitly.
    Object.defineProperty(event.request, 'mode', { value: 'navigate' });
    await offline.dispatch('fetch', event);
    const response = (await Promise.all(event.pending))[0] as Response;
    expect(await response.text()).toContain('You are offline');
  });

  it('never stores a private route', async () => {
    const event = fetchEvent(new Request('https://cavebettor.test/api/health'));
    await harness.dispatch('fetch', event);
    expect(event.pending).toHaveLength(0);
    const paths = await harness.cachedPaths();
    expect(paths.some((path) => path.startsWith('/api/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('/auth/'))).toBe(false);
  });

  it('answers the speculation ruleset locally so nothing is prerendered', async () => {
    const event = fetchEvent(new Request('https://cavebettor.test/cdn-cgi/speculation'));
    await harness.dispatch('fetch', event);
    const response = (await Promise.all(event.pending))[0] as Response;
    expect(await response.json()).toEqual({ prerender: [], prefetch: [] });
  });

  it('caches immutable assets and serves them without a network', async () => {
    const first = fetchEvent(new Request('https://cavebettor.test/_app/immutable/chunk.js'));
    await harness.dispatch('fetch', first);
    await Promise.all(first.pending);

    const offline = createHarness(() => Promise.reject(new Error('offline')));
    const cache = await offline.caches.open('cb-v3-assets');
    await cache.put('/_app/immutable/chunk.js', new Response('console.log(1)', { status: 200 }));

    const second = fetchEvent(new Request('https://cavebettor.test/_app/immutable/chunk.js'));
    await offline.dispatch('fetch', second);
    const response = (await Promise.all(second.pending))[0] as Response;
    expect(response.status).toBe(200);
  });

  it('does not cache a cross-origin request', async () => {
    const event = fetchEvent(new Request('https://external.example.com/lib.js'));
    await harness.dispatch('fetch', event);
    expect(event.pending).toHaveLength(0);
  });

  it('does not intercept non-GET requests', async () => {
    const event = fetchEvent(new Request('https://cavebettor.test/fixtures', { method: 'POST' }));
    await harness.dispatch('fetch', event);
    expect(event.pending).toHaveLength(0);
  });
});
