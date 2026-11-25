// The offline notice must be reachable without the Worker: the service worker
// precaches this HTML so a disconnected phone still gets a designed page.
export const prerender = true;
