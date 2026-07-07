'use client';

// Marketplace browse (PRD 2.8): filters by category, price range, rating,
// popularity, plus a search box and a featured/most-used row. Never shows
// the recorded flow or the creator's identity — see lib/marketplace.ts.

import { useEffect, useMemo, useState } from 'react';
import { Flame, Store, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

interface Listing {
  api_id: string;
  name: string;
  description: string;
  price: number;
  pricing_model: string;
  category: string | null;
  rating: number;
  review_count: number;
  popularity: number;
}

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '4', label: '4+ stars' },
  { value: '3', label: '3+ stars' },
  { value: '2', label: '2+ stars' },
  { value: '1', label: '1+ stars' },
];
const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function MarketplacePage() {
  // Unfiltered — feeds the featured row and the category filter's options.
  const [allListings, setAllListings] = useState<Listing[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('popularity');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/marketplace?sort=popularity');
        const json = await res.json();
        if (json.success) setAllListings(json.data);
      } catch {
        // the filtered fetch below surfaces the real error state; this one
        // only feeds the featured row / category options, so fail quietly
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (category) params.set('category', category);
          if (minPrice) params.set('min_price', minPrice);
          if (maxPrice) params.set('max_price', maxPrice);
          if (minRating) params.set('min_rating', minRating);
          params.set('sort', sort);
          const res = await fetch(`/api/marketplace?${params}`);
          const json = await res.json();
          if (json.success) {
            setListings(json.data);
            setLoadError(null);
          } else {
            setLoadError(json.error || 'Could not load the marketplace right now.');
          }
        } catch {
          setLoadError('Could not reach the server. Check your connection and try again.');
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [search, category, minPrice, maxPrice, minRating, sort]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of allListings || []) if (l.category) set.add(l.category);
    return Array.from(set).sort();
  }, [allListings]);

  const featured = useMemo(() => (allListings || []).slice(0, 3), [allListings]);
  const loading = listings === null;

  return (
    <AppShell
      active="marketplace"
      eyebrow="STORE"
      title={
        <>
          Browse <span className="text-accent">APIs</span>
        </>
      }
    >
      {featured.length > 0 && (
        <section className="mb-8">
          <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
            <Flame className="h-3.5 w-3.5 text-accent" aria-hidden />
            Most used
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featured.map((l) => (
              <ListingCard key={l.api_id} listing={l} featured />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input label="Search" placeholder="Search APIs…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Min price" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-24" />
        <Input label="Max price" placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-24" />
        <Select label="Rating" value={minRating} onChange={(e) => setMinRating(e.target.value)} className="w-32">
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="w-44">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </section>

      {loadError && (
        <Card className="flex items-center gap-3 p-6 text-danger">
          <Store className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      )}
      {!loadError && loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      )}
      {!loadError && !loading && listings!.length === 0 && (
        <EmptyState
          icon={<Store className="h-5 w-5" aria-hidden />}
          title="No APIs match these filters"
          description="Try widening your search or clearing a filter."
        />
      )}
      {!loadError && !loading && listings!.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings!.map((l) => (
            <ListingCard key={l.api_id} listing={l} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ListingCard({ listing, featured }: { listing: Listing; featured?: boolean }) {
  return (
    <a href={`/marketplace/${listing.api_id}`} className="block">
      <Card clickable className={cn('h-full p-5', featured && 'border-accent/30')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink">{listing.name}</h3>
          {listing.category && <Badge variant="neutral">{listing.category}</Badge>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{listing.description}</p>
        <p className="mt-2 text-xs text-muted">Sold by a Shamsu creator</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Rating value={listing.rating} count={listing.review_count} />
          <span className="whitespace-nowrap font-display text-sm font-bold text-ink">
            {listing.price.toFixed(2)} BDT
            <span className="font-sans text-xs font-normal text-muted"> /{listing.pricing_model === 'per_call' ? 'call' : 'mo'}</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted">
          <TrendingUp className="h-3 w-3" aria-hidden />
          {listing.popularity} calls
        </div>
      </Card>
    </a>
  );
}
