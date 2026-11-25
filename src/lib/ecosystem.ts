/**
 * E-WIN ecosystem contract.
 *
 * CaveBettor is one application inside the E-WIN Project ecosystem. The hub
 * needs three things from every member app and this module is the single place
 * they are defined, so the static descriptor, the live API and the navigation
 * link can never disagree:
 *
 *   1. identity — a stable `appId`, name, icon and canonical URL;
 *   2. entry points — the SSO start and redeem URLs, plus the app's own health;
 *   3. a manifest the hub can poll to show the app as online.
 *
 * Everything here is public information: no secret, no session, no key.
 */

export const ECOSYSTEM = {
  id: 'cavebettor',
  name: 'CaveBettor',
  tagline: 'Model-led sports prediction, odds intelligence and bankroll analytics',
  /** Default hub. Overridable per environment with EWIN_SITE_URL. */
  hubUrl: 'https://ewinproject.org',
  category: 'sports-intelligence',
  version: '1.1.0',
  currency: 'NGN',
  locale: 'en-NG',
  ageGate: 18,
  capabilities: [
    'sso',
    'shared-identity',
    'shared-session-mirror',
    'health',
    'pwa',
    'deep-links',
    'market-intelligence',
    'progressive-scores',
    'settlement-archive'
  ],
  /** Routes the hub may deep-link into. */
  deepLinks: [
    { id: 'dashboard', label: 'Command centre', path: '/dashboard' },
    { id: 'live', label: 'Live now', path: '/live' },
    { id: 'fixtures', label: 'Fixtures', path: '/fixtures' },
    { id: 'value', label: 'Value board', path: '/predictions' },
    { id: 'betslip', label: 'Betslip builder', path: '/betslip' },
    { id: 'pricing', label: 'Plans', path: '/pricing' }
  ]
} as const;

export interface EcosystemDescriptor {
  version: 1;
  appId: string;
  name: string;
  tagline: string;
  category: string;
  appVersion: string;
  url: string;
  icon: string;
  manifest: string;
  locale: string;
  currency: string;
  ageGate: number;
  capabilities: string[];
  endpoints: {
    health: string;
    manifest: string;
    session: string;
    ssoStart: string;
    ssoCallback: string;
  };
  deepLinks: { id: string; label: string; path: string; url: string }[];
  pwa: {
    installable: boolean;
    display: 'standalone';
    startUrl: string;
    scope: string;
    themeColor: string;
  };
  updatedAt: string;
}

/** Resolve the hub origin: environment first, canonical default second. */
export function hubUrl(configured?: string | null): string {
  const value = (configured || process.env.EWIN_SITE_URL || ECOSYSTEM.hubUrl).trim();
  return value.replace(/\/$/, '');
}

/** Resolve this app's own public origin. */
export function appUrl(configured?: string | null): string {
  return (configured || process.env.PUBLIC_SITE_URL || 'https://cavebettor.ewinproject.org').replace(/\/$/, '');
}

export function ecosystemDescriptor(base: string, publishedAt = new Date().toISOString()): EcosystemDescriptor {
  const root = base.replace(/\/$/, '');
  return {
    version: 1,
    appId: ECOSYSTEM.id,
    name: ECOSYSTEM.name,
    tagline: ECOSYSTEM.tagline,
    category: ECOSYSTEM.category,
    appVersion: ECOSYSTEM.version,
    url: root,
    icon: `${root}/icons/icon-512.png`,
    manifest: `${root}/manifest.webmanifest`,
    locale: ECOSYSTEM.locale,
    currency: ECOSYSTEM.currency,
    ageGate: ECOSYSTEM.ageGate,
    capabilities: [...ECOSYSTEM.capabilities],
    endpoints: {
      health: `${root}/api/health`,
      manifest: `${root}/api/ecosystem/manifest`,
      session: `${root}/api/ecosystem/session`,
      ssoStart: `${root}/auth/ewin`,
      ssoCallback: `${root}/auth/ewin/callback`
    },
    deepLinks: ECOSYSTEM.deepLinks.map((link) => ({ ...link, url: `${root}${link.path}` })),
    pwa: {
      installable: true,
      display: 'standalone',
      startUrl: `${root}/dashboard?source=pwa`,
      scope: `${root}/`,
      themeColor: '#070d0b'
    },
    updatedAt: publishedAt
  };
}
