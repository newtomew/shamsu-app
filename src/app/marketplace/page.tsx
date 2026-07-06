'use client';

// Marketplace browse (PRD 2.8): filters by category, price range, rating,
// popularity. Never shows the recorded flow or the creator's identity.

import { useEffect, useState } from 'react';

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
  popularity: number;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('popularity');
  const [buyBusy, setBuyBusy] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<{ api_id: string; api_key: string; endpoint: string } | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (minRating) params.set('min_rating', minRating);
    if (sort) params.set('sort', sort);
    const res = await fetch(`/api/marketplace?${params}`);
    const json = await res.json();
    if (json.success) setListings(json.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(apiId: string) {
    setBuyBusy(apiId);
    setBuyError(null);
    setBuyResult(null);
    const res = await fetch(`/api/marketplace/${apiId}/buy`, { method: 'POST' });
    const json = await res.json();
    setBuyBusy(null);
    if (!json.success) {
      setBuyError(json.error);
      return;
    }
    setBuyResult({ api_id: apiId, ...json.data });
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <p>
        <a href="/dashboard">Dashboard</a> · <a href="/purchases">My purchases</a>
      </p>
      <h1>Marketplace</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input placeholder="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input placeholder="min price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ width: 80 }} />
        <input placeholder="max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ width: 80 }} />
        <input placeholder="min rating" value={minRating} onChange={(e) => setMinRating(e.target.value)} style={{ width: 80 }} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="popularity">Sort: popularity</option>
          <option value="rating">Sort: rating</option>
          <option value="price_asc">Sort: price (low to high)</option>
          <option value="price_desc">Sort: price (high to low)</option>
        </select>
        <button onClick={load}>Apply filters</button>
      </div>

      {buyError && <p style={{ color: 'red' }}>{buyError}</p>}
      {buyResult && (
        <div style={{ background: '#fff3cd', color: '#111', padding: 12, marginBottom: 16 }}>
          <strong>Purchased!</strong> Endpoint: <code>{buyResult.endpoint}</code>
          <br />
          API key (shown once — save it now): <code>{buyResult.api_key}</code>
        </div>
      )}

      {!listings && <p>Loading…</p>}
      {listings && listings.length === 0 && <p>No listings match these filters.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {listings?.map((l) => (
          <div key={l.api_id} style={{ border: '1px solid #ccc', padding: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>{l.name}</h3>
            <p style={{ margin: 0 }}>{l.description}</p>
            <p style={{ margin: 0 }}>
              {l.category} · {l.price} BDT ({l.pricing_model})
            </p>
            <p style={{ margin: 0 }}>
              rating {l.rating.toFixed(1)} ({l.review_count} reviews) · {l.popularity} calls
            </p>
            <button onClick={() => buy(l.api_id)} disabled={buyBusy === l.api_id}>
              {buyBusy === l.api_id ? 'Buying…' : 'Buy access'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
