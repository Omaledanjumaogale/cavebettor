<script lang="ts">
  import { ArrowRight, Sparkles, ShieldCheck, BrainCircuit, Coins, Gauge, Wallet, Network, CircleCheck, Download, ExternalLink } from '@lucide/svelte';
  import ResponsiveImage from '#lib/components/media/ResponsiveImage.svelte';
  import ImageSlider from '#lib/components/media/ImageSlider.svelte';
  import MotionGraphic from '#lib/components/media/MotionGraphic.svelte';
  import NavigationBanner from '#lib/components/banners/NavigationBanner.svelte';
  import StorySequence from '#lib/components/storytelling/StorySequence.svelte';
  import { navigationBanners } from '#lib/config/navigation-banners';
  import { BOOKMAKERS, LEAGUES, MODELS, SPORTS, SUBSCRIPTION_PLANS } from '#lib/data/catalog';
  import { SPORT_PROFILES } from '#lib/data/sportProfiles';

  const media = {
    hero: '/images/generated/hero-command-centre.webp',
    slides: [
      {
        id: 'promo-slide-01',
        image: '/images/generated/promo-slide-01.webp',
        alt: 'Two analysts comparing model probabilities against bookmaker prices on wide screens at night.',
        headline: 'The market moves. Your process should not.',
        subhead:
          'CaveBettor lines every fixture against eight bookmakers, prices the fair probability, then shows you the gap in Naira — before you commit a single naira.',
        keywords: ['Model ensemble', 'Eight-book pricing', 'Naira staking'],
        primary: { label: 'Open the command centre', href: '/dashboard' },
        secondary: { label: 'See pricing', href: '/pricing' }
      },
      {
        id: 'promo-slide-02',
        image: '/images/generated/promo-slide-02.webp',
        alt: 'A floodlit football stadium seen through drifting fog with the pitch glowing.',
        headline: 'Twenty leagues. Fourteen sports. One desk.',
        subhead:
          'NPFL, Premier League, NBA, ATP, NHL, MLB — every competition mapped onto the right scoring language, so a hockey total means goals and a basketball total means points.',
        keywords: ['NPFL', 'Premier League', 'NBA', 'ATP'],
        primary: { label: 'Browse the sport desks', href: '/sports' },
        secondary: { label: 'Live now', href: '/live' }
      },
      {
        id: 'promo-slide-03',
        image: '/images/generated/promo-slide-03.webp',
        alt: 'Close-up of a basketball and baseball resting on a dark analysis desk beside a tablet.',
        headline: 'Markets that fit the sport, not the template.',
        subhead:
          'Handicaps with pushes, over/under lines, half-time and full-time, sets and quarters — each generated from that sport’s own distribution, never stretched from football.',
        keywords: ['Goals', 'Points', 'Runs', 'Sets'],
        primary: { label: 'Explore the value board', href: '/predictions' },
        secondary: { label: 'Model lab', href: '/models' }
      }
    ],
    story: [
      {
        id: 'story-customer',
        image: '/images/generated/story-customer.webp',
        alt: 'A focused football analyst in Lagos studying a phone before a match.',
        label: 'Stage one',
        title: 'The sharp analyst',
        body: 'You follow a handful of leagues properly. You want an edge that survives a bad week, not a tip sheet that promises everything.'
      },
      {
        id: 'story-challenge',
        image: '/images/generated/story-challenge.webp',
        alt: 'A person surrounded by conflicting odds boards and paper notes in dim light.',
        label: 'Stage two',
        title: 'The noise problem',
        body: 'Six bookmakers, four spreadsheets, one WhatsApp group. The real edge is buried in the gap between what you believe and what the book pays.'
      },
      {
        id: 'story-discovery',
        image: '/images/generated/story-discovery.webp',
        alt: 'A calm desk with a single clean probability chart glowing on a wide monitor.',
        label: 'Stage three',
        title: 'Finding the edge',
        body: 'CaveBettor prices every market, de-viggs the book and surfaces the selections where model probability sits above implied probability.'
      },
      {
        id: 'story-guide',
        image: '/images/generated/story-guide.webp',
        alt: 'A command-centre dashboard glowing on a desk, deep green interface light.',
        label: 'Stage four',
        title: 'The desk',
        body: 'Fixtures, live prices, value board, paper ledger and research notes — one console, one set of numbers, one source of truth.'
      },
      {
        id: 'story-experience',
        image: '/images/generated/story-experience.webp',
        alt: 'Hands building a multi-leg slip on a tablet showing price comparisons.',
        label: 'Stage five',
        title: 'Building the slip',
        body: 'Pick markets across fixtures, let the slip builder price the accumulator from your own model probabilities, then download or share it.'
      },
      {
        id: 'story-outcome',
        image: '/images/generated/story-outcome.webp',
        alt: 'A satisfied analyst reviewing a bankroll chart that trends upward on a laptop.',
        label: 'Stage six',
        title: 'Keeping the record',
        body: 'Every logged selection settles honestly into a paper ledger: yield, drawdown, CLV and stake plan in plain Nigerian Naira.'
      }
    ],
    features: [
      {
        id: 'feature-learning',
        image: '/images/generated/feature-learning.webp',
        alt: 'An open notebook of model notes beside training charts on a dark desk.',
        icon: BrainCircuit,
        title: 'Models that show their working',
        body: 'Dixon-Coles, Elo, boosted trees, sequence models and the market prior — every number comes with its weight, its accuracy and its calibration curve.',
        href: '/models'
      },
      {
        id: 'feature-workflow',
        image: '/images/generated/feature-workflow.webp',
        alt: 'A calm evening workflow desk with data streams flowing across three monitors.',
        icon: Gauge,
        title: 'A pipeline, not a spreadsheet',
        body: 'Paid feeds are rationed to your daily cap, results are cached in Cloudflare R2, and the models retrain every night at 4 a.m. Nigeria time.',
        href: '/scrapers'
      },
      {
        id: 'feature-community',
        image: '/images/generated/feature-community.webp',
        alt: 'A group of analysts working together in a Lagos studio around shared screens.',
        icon: Network,
        title: 'One workspace across the ecosystem',
        body: 'CaveBettor signs you in through Google, GitHub or E-WIN single sign-on, and shares research notes across the E-WIN project family.',
        href: '/workspace'
      },
      {
        id: 'dashboard-ecosystem',
        image: '/images/generated/dashboard-ecosystem.webp',
        alt: 'Abstract network of linked sport nodes glowing in lime and mint on a dark background.',
        icon: Coins,
        title: 'One ecosystem of markets',
        body: 'Twenty competitions, eight bookmakers and every market they quote, lined up so you can see where the prices disagree with each other.',
        href: '/odds'
      }
    ]
  };

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro') ?? SUBSCRIPTION_PLANS[0];
  const stats = [
    { value: String(LEAGUES.length), label: 'competitions tracked' },
    { value: String(SPORT_PROFILES.length), label: 'sport-specific engines' },
    { value: String(BOOKMAKERS.length), label: 'bookmakers priced' },
    { value: String(MODELS.length), label: 'production models' }
  ];
</script>

<svelte:head>
  <title>CaveBettor — Sports intelligence, priced in Naira</title>
  <meta
    name="description"
    content="CaveBettor is a model-led sports intelligence workspace: live fixtures, eight-book odds comparison, calibrated probabilities per sport and an honest paper ledger in Nigerian Naira."
  />
</svelte:head>

<!-- ── Hero ───────────────────────────────────────────────────────────── -->
<section class="relative overflow-hidden border-b border-white/[0.06]">
  <MotionGraphic variant="grid" />
  <div class="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-lime/10 blur-[120px]"></div>

  <div class="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
    <div>
      <span class="chip chip-lime"><Sparkles size={10} /> Naira-first sports intelligence</span>
      <h1 class="display mt-5 text-[32px] font-bold leading-[1.08] tracking-tight text-white sm:text-[44px]">
        The market moves.<br />
        <span class="text-gradient">Your process shouldn't.</span>
      </h1>
      <p class="mt-4 max-w-lg text-[13.5px] leading-relaxed text-fog">
        CaveBettor prices every fixture against the books, models the outcome per sport, and hands you the decisions
        worth making — with the reasoning, the stake plan and the record, all in Nigerian Naira.
      </p>

      <div class="mt-7 flex flex-wrap items-center gap-3">
        <a href="/auth/register" class="btn btn-primary !py-3 text-[12px] font-semibold">
          Start free <ArrowRight size={14} />
        </a>
        <a href="/dashboard" class="btn btn-ghost !py-3 text-[12px] font-semibold">Explore the command centre</a>
      </div>

      <dl class="mt-9 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {#each stats as stat}
          <div>
            <dt class="text-[10px] uppercase tracking-[0.14em] text-fog-dim">{stat.label}</dt>
            <dd class="display num mt-1 text-[22px] font-bold text-lime">{stat.value}</dd>
          </div>
        {/each}
      </dl>
    </div>

    <div class="relative">
      <div class="overflow-hidden rounded-3xl border border-white/[0.08] bg-pitch-900/60 shadow-panel">
        <ResponsiveImage
          src={media.hero}
          alt="The CaveBettor command centre glowing on a wide desk at night."
          width={1248}
          height={832}
          sizes="(max-width: 1024px) 100vw, 48vw"
          eager
          class="block"
        />
      </div>
      <div class="pointer-events-none absolute -bottom-6 -left-4 hidden rounded-2xl border border-white/10 bg-pitch-950/90 px-4 py-3 backdrop-blur-sm sm:block">
        <div class="text-[9.5px] uppercase tracking-[0.16em] text-fog-dim">Paper bankroll</div>
        <div class="display num text-[17px] font-bold text-mint">₦1,250,000</div>
      </div>
    </div>
  </div>
</section>

<!-- ── Promotional slider ────────────────────────────────────────────── -->
<section class="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
  <ImageSlider slides={media.slides} />
</section>

<!-- ── Platform features ──────────────────────────────────────────────── -->
<section id="platform" class="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-14 sm:px-6">
  <div class="max-w-2xl">
    <span class="chip chip-lime"><CircleCheck size={10} /> The platform</span>
    <h2 class="display mt-4 text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">
      Four systems that hold together
    </h2>
    <p class="mt-2.5 text-[13px] leading-relaxed text-fog">
      Collection, models, markets and a ledger that keeps score. Each part is replaceable, each part is auditable.
    </p>
  </div>

  <div class="mt-8 grid gap-5 md:grid-cols-2">
    {#each media.features as feature}
      <article class="panel panel-hover overflow-hidden">
        <div class="relative aspect-[16/9] overflow-hidden">
          <ResponsiveImage
            src={feature.image}
            alt={feature.alt}
            width={1248}
            height={832}
            sizes="(max-width: 768px) 100vw, 50vw"
            class="absolute inset-0"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/30 to-transparent"></div>
          <span class="absolute bottom-3 left-4 flex h-9 w-9 items-center justify-center rounded-xl border border-lime/25 bg-pitch-950/80 text-lime">
            <feature.icon size={16} />
          </span>
        </div>
        <div class="px-5 py-5">
          <h3 class="text-[15px] font-semibold text-white">{feature.title}</h3>
          <p class="mt-1.5 text-[12px] leading-relaxed text-fog">{feature.body}</p>
          <a href={feature.href} class="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-lime hover:underline">
            Explore <ArrowRight size={12} />
          </a>
        </div>
      </article>
    {/each}
  </div>
</section>

<!-- ── Navigation banner ──────────────────────────────────────────────── -->
<section class="mx-auto max-w-[1200px] px-4 sm:px-6">
  <NavigationBanner banner={navigationBanners[0]} />
</section>

<!-- ── Story sequence ─────────────────────────────────────────────────── -->
<section class="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
  <StorySequence stages={media.story} />
</section>

<!-- ── Sports strip ───────────────────────────────────────────────────── -->
<section class="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6">
  <div class="panel overflow-hidden">
    <div class="flex flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div class="max-w-md">
        <h2 class="display text-[19px] font-bold tracking-tight text-white">Five sports, five different books</h2>
        <p class="mt-1.5 text-[12px] leading-relaxed text-fog">
          A hockey total is goals. A basketball total is points. A baseball line is a run line. A tennis market settles
          on sets. CaveBettor keeps them apart.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each SPORTS as sport}
          <a
            href={`/sports/${sport.id}`}
            class="chip border-white/10 bg-white/[0.04] !px-3 !py-2 text-[11.5px] text-fog transition hover:border-lime/40 hover:text-white"
          >
            {sport.name}
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<section class="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6">
  <NavigationBanner banner={navigationBanners[3]} />
</section>

<section class="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6">
  <NavigationBanner banner={navigationBanners[1]} />
</section>

<!-- ── Pricing teaser ─────────────────────────────────────────────────── -->
<section class="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
  <div class="panel relative overflow-hidden px-5 py-10 sm:px-10">
    <MotionGraphic variant="pulse" />
    <div class="relative max-w-2xl">
      <span class="chip chip-lime"><Wallet size={10} /> Simple, Naira-first pricing</span>
      <h2 class="display mt-4 text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">
        ₦{plan.priceNgn.toLocaleString('en-NG')} a month for the whole workspace
      </h2>
      <p class="mt-2.5 text-[12.5px] leading-relaxed text-fog">
        Every model, every market, every league and the full paper ledger. No per-market fees, no wallet, no deposits —
        CaveBettor is research tooling, not a bookmaker.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="/auth/register" class="btn btn-primary !py-2.5 text-[11.5px] font-semibold">Create your workspace</a>
        <a href="/pricing" class="btn btn-ghost !py-2.5 text-[11.5px]">Compare plans</a>
      </div>
      <p class="mt-4 flex items-center gap-1.5 text-[10.5px] text-fog-dim">
        <ShieldCheck size={12} /> Research-only. No deposits are accepted and no bets are ever placed.
      </p>
    </div>
  </div>
</section>

<section class="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
  <NavigationBanner banner={navigationBanners[2]} />
</section>

<!-- ── Ecosystem footer ────────────────────────────────────────────────── -->
<footer class="border-t border-white/[0.07] bg-black/20">
  <div class="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-9 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
    <div class="max-w-md">
      <div class="flex items-center gap-2 text-[12px] font-semibold text-white">
        <Network size={14} class="text-sky" /> Part of the E-WIN Project ecosystem
      </div>
      <p class="mt-1.5 text-[10.5px] leading-relaxed text-fog-dim">
        One E-WIN identity across every application. CaveBettor is installable as an app on your phone, keeps working
        on a weak connection, and never takes a deposit or places a bet. 18+.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <a
        class="btn btn-ghost !py-2 text-[11px]"
        href="https://ewinproject.org"
        target="_blank"
        rel="noopener"
      >
        E-WIN Project hub <ExternalLink size={11} />
      </a>
      <a class="btn btn-ghost !py-2 text-[11px]" href="/dashboard">
        <Download size={12} /> Install the app
      </a>
      <a class="btn btn-ghost !py-2 text-[11px]" href="/auth/login">Sign in</a>
      <a class="btn btn-primary !py-2 text-[11px]" href="/auth/register">Create workspace</a>
    </div>
  </div>
  <div class="mx-auto max-w-[1200px] border-t border-white/[0.05] px-4 py-4 text-[9.5px] text-fog-dim sm:px-6">
    CaveBettor · Lagos, Nigeria · Naira-first sports intelligence · Research only, no wagering services.
  </div>
</footer>
