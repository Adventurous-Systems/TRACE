'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { marketplace, type ListingSummary } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CONDITION_COLORS: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  A: 'success',
  B: 'success',
  C: 'warning',
  D: 'outline',
};

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function MarketplacePage() {
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [categoryL1, setCategoryL1] = useState('');
  const [conditionGrade, setConditionGrade] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) params.set('q', q);
    if (categoryL1) params.set('categoryL1', categoryL1);
    if (conditionGrade) params.set('conditionGrade', conditionGrade);

    marketplace
      .search(params)
      .then((res) => {
        setItems(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, categoryL1, conditionGrade]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="font-semibold text-sm">TRACE Marketplace</span>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Material Marketplace</h1>
          <p className="text-gray-500 mt-1">
            Browse verified reclaimed construction materials from Scottish reuse hubs.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search materials..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-64"
          />
          <select
            value={categoryL1}
            onChange={(e) => { setCategoryL1(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All categories</option>
            {[
              'Structural Steel',
              'Structural Timber',
              'Masonry',
              'Roofing',
              'Cladding & Facades',
              'Insulation',
              'Doors & Windows',
              'Flooring',
              'MEP Components',
              'Fixings & Fittings',
            ].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={conditionGrade}
            onChange={(e) => { setConditionGrade(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Any condition</option>
            {['A', 'B', 'C', 'D'].map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>

        {/* Listings grid */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">No listings match your search.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">{total} listing{total !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((listing) => (
                <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4 space-y-3">
                      {listing.passport.qrCodeUrl && (
                        <div className="aspect-square bg-gray-100 rounded-md overflow-hidden">
                          <img
                            src={listing.passport.qrCodeUrl}
                            alt="QR"
                            className="w-full h-full object-contain p-2 opacity-40"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm leading-tight">
                          {listing.passport.productName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {listing.passport.categoryL1}
                          {listing.passport.categoryL2 ? ` · ${listing.passport.categoryL2}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-brand-700">
                          {formatPrice(listing.pricePence)}
                        </span>
                        {listing.passport.conditionGrade && (
                          <Badge variant={CONDITION_COLORS[listing.passport.conditionGrade] ?? 'outline'}>
                            Grade {listing.passport.conditionGrade}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {listing.organisation.name}
                        {listing.passport.carbonSavingsVsNew && (
                          <span className="text-green-600 ml-1">
                            · {listing.passport.carbonSavingsVsNew} kgCO₂e saved
                          </span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
