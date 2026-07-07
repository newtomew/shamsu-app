'use client';

// Marketplace listing detail (PRD 2.5/2.8): name, description, rating,
// pricing, optional docs/example shape, rate limits, and a prominent buy
// button. After purchase: the buyer's own endpoint + key + a Test panel —
// the recorded flow is never exposed here or anywhere buyer-facing.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, PlayCircle, ShieldCheck, Store, Zap } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Input } from '@/components/ui/Input';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { KeyReveal } from '@/components/ui/KeyReveal';
import { Skeleton } from '@/components/ui/Skeleton';

interface Listing {
  api_id: string;
  name: string;
  description: string;
  price: number;
  pricing_model: string;
  category: string | null;
  rating: number;
  review_count: number;
  documentation: string | null;
  example_request: unknown;
  example_response: unknown;
  rate_limit_per_sec: number;
  max_concurrent: number;
  popularity: number;
  has_purchased: boolean;
}
interface SchemaVariable {
  name: string;
  example?: string;
}
interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: string;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const apiId = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<{ endpoint: string; api_key: string } | null>(null);

  const [variables, setVariables] = useState<SchemaVariable[]>([]);
  const [simpleValues, setSimpleValues] = useState<Record<string, string>>({});
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/${apiId}`);
        const json = await res.json();
        if (!json.success) {
          setLoadError(json.error || 'This listing is not available.');
          return;
        }
        setListing(json.data);
      } catch {
        setLoadError('Could not reach the server. Check your connection and try again.');
      }
    })();
  }, [apiId]);

  async function buy() {
    setBuying(true);
    setBuyError(null);
    const res = await fetch(`/api/marketplace/${apiId}/buy`, { method: 'POST' });
    const json = await res.json();
    setBuying(false);
    if (!json.success) {
      setBuyError(json.error);
      return;
    }
    setPurchased(json.data);

    // Safe variable names (never the recorded flow) so the Test panel below
    // can build an input form — see /api/purchases/:apiId's `variables`.
    const detailRes = await fetch(`/api/purchases/${apiId}`);
    const detailJson = await detailRes.json();
    if (detailJson.success) {
      const vars: SchemaVariable[] = detailJson.data.variables || [];
      setVariables(vars);
      setSimpleValues(Object.fromEntries(vars.map((v) => [v.name, v.example || ''])));
    }
  }

  async function runTest() {
    if (!purchased) return;
    setTestBusy(true);
    setTestResult(null);
    const res = await fetch(purchased.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchased.api_key}` },
      body: JSON.stringify(simpleValues),
    });
    const json = await res.json();
    setTestBusy(false);
    setTestResult(json);
  }

  if (loadError) {
    return (
      <AppShell active="marketplace" eyebrow="MARKETPLACE" title="Not available">
        <Card className="p-6 text-sm text-danger">{loadError}</Card>
      </AppShell>
    );
  }

  if (!listing) {
    return (
      <AppShell active="marketplace" eyebrow="MARKETPLACE" title="Loading…">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 w-full lg:col-span-2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="marketplace" eyebrow="MARKETPLACE" title={listing.name}>
      <a href="/marketplace" className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Marketplace
      </a>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              {listing.category && <Badge variant="neutral">{listing.category}</Badge>}
              <Rating value={listing.rating} count={listing.review_count} />
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{listing.name}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink">{listing.description}</p>
            <div className="mt-4 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              {listing.popularity} calls served
            </div>
          </Card>

          {listing.documentation && (
            <Card className="p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Documentation</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{listing.documentation}</p>
            </Card>
          )}

          {(listing.example_request != null || listing.example_response != null) && (
            <Card className="p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Example</p>
              <div className="mt-3 space-y-3">
                {listing.example_request != null && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted">Request</p>
                    <CodeBlock code={JSON.stringify(listing.example_request, null, 2)} />
                  </div>
                )}
                {listing.example_response != null && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted">Response</p>
                    <CodeBlock code={JSON.stringify(listing.example_response, null, 2)} />
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Limits</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="neutral">{listing.rate_limit_per_sec} calls/sec</Badge>
              <Badge variant="neutral">{listing.max_concurrent} concurrent</Badge>
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-border bg-page p-4">
            <ShieldCheck className="h-4 w-4 flex-none text-muted" aria-hidden />
            <p className="text-xs text-muted">
              You get endpoint-only access — the recorded flow behind this API is never shared with buyers.
            </p>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Price</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              {listing.price.toFixed(2)} <span className="text-lg font-medium text-muted">BDT</span>
            </p>
            <p className="text-sm text-muted">{listing.pricing_model === 'per_call' ? 'per call' : 'per month'}</p>

            {listing.has_purchased && !purchased ? (
              <div className="mt-4 rounded-lg bg-success-light p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  You already own this
                </p>
                <a href={`/purchases/${listing.api_id}`} className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-hover">
                  Manage in My purchases →
                </a>
              </div>
            ) : !purchased ? (
              <>
                <Button size="lg" className="mt-4 w-full" loading={buying} onClick={buy}>
                  {buying ? 'Getting access…' : `Get API — ${listing.price.toFixed(2)} BDT`}
                </Button>
                {buyError && <p className="mt-2 text-xs text-danger">{buyError}</p>}
                <p className="mt-3 text-xs text-muted">
                  {listing.pricing_model === 'per_call'
                    ? 'Free to unlock — you only pay per call you make.'
                    : 'Charged from your credit balance now.'}
                </p>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-success-light p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  You&apos;re in!
                </p>
              </div>
            )}
          </Card>

          {purchased && (
            <>
              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Your endpoint</p>
                <div className="mt-2">
                  <CodeBlock code={purchased.endpoint} />
                </div>
                <p className="mb-1.5 mt-4 font-mono text-xs uppercase tracking-widest text-muted">Your API key (shown once)</p>
                <KeyReveal value={purchased.api_key} className="w-full" />
              </Card>

              <Card className="p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Test</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink">Try it now</h2>
                {variables.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">This API takes no variables.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {variables.map((v) => (
                      <Input
                        key={v.name}
                        label={v.name}
                        value={simpleValues[v.name] ?? ''}
                        onChange={(e) => setSimpleValues((s) => ({ ...s, [v.name]: e.target.value }))}
                      />
                    ))}
                  </div>
                )}
                <Button className="mt-4 w-full" loading={testBusy} onClick={runTest}>
                  {!testBusy && <PlayCircle className="h-4 w-4" aria-hidden />}
                  {testBusy ? 'Calling…' : 'Run'}
                </Button>
                {testResult && (
                  <div className="mt-3">
                    <p className={`mb-1.5 text-xs font-medium ${testResult.success ? 'text-success' : 'text-danger'}`}>
                      {testResult.success ? 'Success' : `Error: ${testResult.error}`}
                    </p>
                    <CodeBlock code={JSON.stringify(testResult.success ? testResult.data : testResult, null, 2)} />
                  </div>
                )}
              </Card>
            </>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Store className="h-3.5 w-3.5" aria-hidden />
            Manage all your purchases anytime from My purchases.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
