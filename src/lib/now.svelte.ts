/**
 * Client clock and schedule auto-reset.
 *
 * The boards are ordered by absolute kick-off, so the order is already correct
 * on every request. What changes second by second is the *relative* part: "next
 * up", "in 12m", "live", and whether a fixture has quietly become due. A single
 * 30-second tick keeps those labels honest without polling the server, and the
 * data itself is re-fetched only when the tab comes back after a long absence —
 * one request, on the user's return, never a background loop.
 */
import { invalidateAll } from '$app/navigation';

class Clock {
  now = $state(Date.now());
  #timer: ReturnType<typeof setInterval> | null = null;
  #started = false;

  start(): void {
    if (this.#started || typeof window === 'undefined') return;
    this.#started = true;
    this.now = Date.now();
    this.#timer = setInterval(() => (this.now = Date.now()), 30_000);

    // A phone that slept for an hour must not wake up on stale buckets.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.now = Date.now();
      this.#maybeRefresh();
    });
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#started = false;
  }

  /** How old the server data is, in milliseconds, if the page recorded it. */
  #generatedAt: number | null = null;

  /** Called by a page with the timestamp of the payload it rendered. */
  markLoaded(generatedAt: string | null | undefined): void {
    const parsed = generatedAt ? Date.parse(generatedAt) : NaN;
    this.#generatedAt = Number.isFinite(parsed) ? parsed : null;
  }

  #maybeRefresh(): void {
    if (!this.#generatedAt) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    // Under four minutes old the ordering cannot be wrong in a way that matters.
    if (Date.now() - this.#generatedAt < 4 * 60_000) return;
    invalidateAll().catch(() => {});
  }
}

export const clock = new Clock();
