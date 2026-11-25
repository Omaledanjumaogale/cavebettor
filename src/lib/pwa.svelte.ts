/**
 * PWA runtime.
 *
 * Registers the service worker, exposes the install prompt to the UI and tells
 * the shell whether CaveBettor is running as an installed app. Everything is
 * guarded: a blocked service worker, a private-mode Safari or a browser
 * without `beforeinstallprompt` must degrade to "no install button", never to
 * a broken page.
 */

export type InstallState = 'unsupported' | 'available' | 'installed' | 'ios-manual' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cb_install_dismissed';
const DISMISS_DAYS = 7;

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

class PwaStore {
  /** What the install UI should offer right now. */
  state = $state<InstallState>('unsupported');
  standalone = $state(false);
  swReady = $state(false);
  updateReady = $state(false);
  /** True once the worker has cached the shell, so offline copy is honest. */
  offlineReady = $state(false);

  #prompt: BeforeInstallPromptEvent | null = null;
  #registration: ServiceWorkerRegistration | null = null;

  get canInstall(): boolean {
    return this.state === 'available';
  }

  /** Wire listeners once, from the root layout. */
  init(): void {
    if (typeof window === 'undefined') return;
    this.standalone = isStandalone();
    if (this.standalone) this.state = 'installed';

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.#prompt = event as BeforeInstallPromptEvent;
      if (!isStandalone() && !readDismissed()) this.state = 'available';
    });

    window.addEventListener('appinstalled', () => {
      this.#prompt = null;
      this.standalone = true;
      this.state = 'installed';
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* storage blocked */
      }
    });

    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (event) => {
      this.standalone = event.matches;
      if (event.matches) this.state = 'installed';
    });

    if (!isStandalone()) {
      if (isIos()) this.state = 'ios-manual';
      else if (!('serviceWorker' in navigator)) this.state = 'unsupported';
    }

    this.register();
  }

  async register(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.#registration = registration;
      this.swReady = true;
      if (registration.active) this.offlineReady = true;

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) this.updateReady = true;
        });
      });

      navigator.serviceWorker.ready.then(() => (this.offlineReady = true)).catch(() => {});
    } catch {
      this.swReady = false;
    }
  }

  /** Show the native install sheet (Chromium). Returns true if accepted. */
  async install(): Promise<boolean> {
    if (!this.#prompt) {
      if (this.state === 'ios-manual' || this.state === 'unsupported') return false;
      return false;
    }
    await this.#prompt.prompt();
    const choice = await this.#prompt.userChoice;
    this.#prompt = null;
    if (choice.outcome === 'accepted') {
      this.state = 'installed';
      return true;
    }
    this.dismiss();
    return false;
  }

  dismiss(): void {
    this.state = 'dismissed';
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked: the in-memory state still hides the card */
    }
  }

  /** Activate a waiting worker and reload onto the new build. */
  applyUpdate(): void {
    const waiting = this.#registration?.waiting;
    if (waiting) {
      waiting.postMessage('SKIP_WAITING');
      waiting.addEventListener('statechange', () => {
        if (waiting.state === 'activated') location.reload();
      });
      return;
    }
    location.reload();
  }
}

export const pwa = new PwaStore();
