/**
 * Branded navigation banners.
 *
 * Every banner owns a unique id, inscription, artwork file, palette signature
 * and target route. scripts/check-asset-uniqueness.mjs enforces that the
 * inscriptions, artwork files and visual placements are never reused.
 */
export type BannerTheme = 'primary' | 'secondary' | 'amber' | 'violet';

export interface NavigationBanner {
  id: string;
  inscription: string;
  subline: string;
  artwork: string;
  href: string;
  theme: BannerTheme;
  cta: string;
}

export const navigationBanners: NavigationBanner[] = [
  {
    id: 'banner-model-lab',
    inscription: 'Every model shows its working',
    subline: 'Dixon-Coles, Elo, boosted trees and the market prior, side by side, with calibration you can audit.',
    artwork: '/banners/svg/model-lab.svg',
    href: '/models',
    theme: 'primary',
    cta: 'Open the model lab'
  },
  {
    id: 'banner-live-desk',
    inscription: 'A live desk that never sleeps',
    subline: 'In-play prices refresh every cycle so the next decision is made on current numbers.',
    artwork: '/banners/svg/live-desk.svg',
    href: '/live',
    theme: 'secondary',
    cta: 'Watch live fixtures'
  },
  {
    id: 'banner-paper-ledger',
    inscription: 'A paper ledger that keeps score',
    subline: 'Logged bets settle honestly, month after month, with yield, drawdown and CLV in Naira.',
    artwork: '/banners/svg/paper-ledger.svg',
    href: '/paper',
    theme: 'amber',
    cta: 'Open the paper desk'
  },
  {
    id: 'banner-sport-languages',
    inscription: 'Five sports, five scoring languages',
    subline: 'Goals, points, runs, goals and sets are separate models — never a stretched football rule.',
    artwork: '/banners/svg/sport-languages.svg',
    href: '/sports',
    theme: 'violet',
    cta: 'Compare the sports'
  }
];
