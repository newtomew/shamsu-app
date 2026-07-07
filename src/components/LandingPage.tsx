import {
  MousePointerClick,
  CheckCircle2,
  Zap,
  Database,
  Workflow,
  Lock,
  Blocks,
  Store,
  ArrowRight,
} from 'lucide-react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/CodeBlock';

const HOW_IT_WORKS = [
  {
    icon: MousePointerClick,
    title: 'Record',
    body: 'Click through the flow you want on any website — the Shamsu extension captures every request and response.',
  },
  {
    icon: CheckCircle2,
    title: 'Confirm',
    body: 'Review what was captured, point out the response with the real data, and confirm it as a live endpoint.',
  },
  {
    icon: Zap,
    title: 'Call',
    body: 'Call your new endpoint with an API key from any app, script, or no-code tool — get clean JSON back.',
  },
];

const USE_CASES = [
  {
    icon: Database,
    title: 'Data extraction',
    body: 'Turn product listings, prices, or search results into a clean JSON feed you can poll on demand.',
  },
  {
    icon: Workflow,
    title: 'Form automation',
    body: 'Automate repetitive form submissions and multi-step web flows without writing a scraper.',
  },
  {
    icon: Lock,
    title: 'Logged-in data',
    body: 'Record flows behind a login and keep pulling your own data — statements, dashboards, internal tools.',
  },
  {
    icon: Store,
    title: 'Marketplace',
    body: 'List any API you build for others to buy by the call, or buy one instead of building it yourself.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      <Header />
      <Hero />
      <HowItWorks />
      <UseCases />
      <MarketplaceTeaser />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Wordmark() {
  return (
    <a href="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-display text-sm font-bold text-white">
        S
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ink">Shamsu</span>
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-sm font-medium text-muted hover:text-ink">
            How it works
          </a>
          <a href="#pricing" className="text-sm font-medium text-muted hover:text-ink">
            Pricing
          </a>
          <a href="/marketplace" className="text-sm font-medium text-muted hover:text-ink">
            Marketplace
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/login" className="hidden text-sm font-medium text-ink hover:text-accent sm:block">
            Log in
          </a>
          <a href="/signup" className={buttonClasses('primary', 'sm')}>
            Start free
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">No-code API platform</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl md:text-6xl">
            Turn any website into an <span className="text-accent">API</span> — no code
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Record a browser flow once. Shamsu turns it into a callable endpoint you can hit from any app —
            no scraping code, no maintenance.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/signup" className={buttonClasses('primary', 'lg')}>
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href="#how-it-works" className={buttonClasses('secondary', 'lg')}>
              See how it works
            </a>
          </div>
          <p className="mt-4 font-mono text-xs text-muted">5 free API creations/day · no credit card required</p>
        </div>

        <PipelineVisual />
      </div>
    </section>
  );
}

function PipelineVisual() {
  const steps: { icon: typeof MousePointerClick; label: string; tone: BadgeVariant }[] = [
    { icon: MousePointerClick, label: 'Record', tone: 'neutral' },
    { icon: CheckCircle2, label: 'Confirm', tone: 'success' },
    { icon: Zap, label: 'Call', tone: 'accent' },
  ];

  return (
    <Card className="relative p-6">
      <div className="absolute left-[38px] top-10 bottom-24 w-px bg-border" aria-hidden>
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent animate-flow" />
      </div>
      <ol className="relative space-y-6">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-start gap-4">
            <span
              className={
                'flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-white shadow-soft ' +
                (step.tone === 'accent'
                  ? 'bg-accent text-white'
                  : step.tone === 'success'
                    ? 'bg-success text-white'
                    : 'bg-ink text-white')
              }
            >
              <step.icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <Badge variant={step.tone}>Step {i + 1}</Badge>
              <p className="mt-1.5 font-display text-base font-bold text-ink">{step.label}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="relative mt-2">
        <CodeBlock code={'GET /api/call/checkout_flow\n→ { "id": 128, "total": 42.50, "status": "paid" }'} />
      </div>
    </Card>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
            Three steps. No scraping code.
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent">
                <step.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Use cases</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Built for real workflows</h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((uc) => (
            <Card key={uc.title} className="p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-page text-ink">
                <uc.icon className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">{uc.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{uc.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketplaceTeaser() {
  return (
    <section className="border-y border-border bg-ink py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-center md:px-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10 text-accent">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Buy ready-made APIs, or sell your own.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/60">
              Every API on Shamsu can be listed on the marketplace. Sellers keep{' '}
              <span className="font-semibold text-accent">60% of every call</span> — we handle billing, keys,
              and delivery.
            </p>
          </div>
        </div>
        <div className="flex flex-none flex-wrap gap-3">
          <a href="/marketplace" className={buttonClasses('secondary', 'md')}>
            Browse marketplace
          </a>
          <a href="/signup" className={buttonClasses('primary', 'md')}>
            Start selling
          </a>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Pricing</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
            Simple, honest, pay-as-you-go
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Free</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-ink">৳0</p>
            <p className="mt-1 text-sm text-muted">to get started</p>
            <ul className="mt-6 space-y-3 text-sm text-ink">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />5 new API creations per day
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />
                No credit card required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />
                Full access to the marketplace
              </li>
            </ul>
            <a href="/signup" className={buttonClasses('secondary', 'md', 'mt-8 w-full')}>
              Start free
            </a>
          </Card>

          <Card className="relative p-8">
            <span className="absolute -top-3 left-8">
              <Badge variant="accent">Pay as you go</Badge>
            </span>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Calls</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-ink">
              ৳0.015<span className="text-lg font-medium text-muted"> / call</span>
            </p>
            <p className="mt-1 text-sm text-muted">150 BDT per 10,000 calls</p>
            <ul className="mt-6 space-y-3 text-sm text-ink">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />
                No subscription, no minimums
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />
                Failed calls billed at half price
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-none text-success" aria-hidden />
                Top up anytime via bKash
              </li>
            </ul>
            <a href="/signup" className={buttonClasses('primary', 'md', 'mt-8 w-full')}>
              Start free
            </a>
          </Card>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border bg-white py-20">
      <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Ready to turn your first flow into an <span className="text-accent">API</span>?
        </h2>
        <p className="mt-4 text-muted">Free to start. No code required. Five minutes to your first live endpoint.</p>
        <a href="/signup" className={buttonClasses('primary', 'lg', 'mt-8')}>
          Start free
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center md:px-8">
        <Wordmark />
        <nav className="flex flex-wrap items-center gap-6 text-sm text-muted">
          <a href="/login" className="hover:text-ink">
            Log in
          </a>
          <a href="/signup" className="hover:text-ink">
            Sign up
          </a>
          <a href="/marketplace" className="hover:text-ink">
            Marketplace
          </a>
        </nav>
        <p className="font-mono text-xs text-muted">© {new Date().getFullYear()} Shamsu</p>
      </div>
    </footer>
  );
}
