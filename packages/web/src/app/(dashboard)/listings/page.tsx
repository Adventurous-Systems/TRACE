'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { marketplace, type ListingSummary, ApiError } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  active: 'success',
  reserved: 'warning',
  sold: 'outline',
  expired: 'outline',
  cancelled: 'outline',
};

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function ListingsPage() {
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  function load() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    marketplace
      .hubListings(token)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCancel(id: string) {
    const token = getToken();
    if (!token) return;
    setCancelling(id);
    try {
      await marketplace.cancelListing(id, token);
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to cancel listing');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Listings</h1>
          <Link href="/listings/new">
            <Button className="bg-brand-600 hover:bg-brand-700">+ New listing</Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm">No listings yet.</p>
                <Link href="/listings/new" className="text-brand-600 hover:underline text-sm mt-2 block">
                  List your first material
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((l) => (
                  <li key={l.id} className="flex items-center justify-between px-6 py-4 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{l.passport.productName}</p>
                      <p className="text-xs text-gray-500">
                        {l.passport.categoryL1}
                        {l.passport.categoryL2 ? ` · ${l.passport.categoryL2}` : ''}
                        {l.passport.conditionGrade ? ` · Grade ${l.passport.conditionGrade}` : ''}
                        {' · Listed '}
                        {new Date(l.createdAt).toLocaleDateString()}
                        {l.expiresAt ? ` · Expires ${new Date(l.expiresAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-sm">{formatPrice(l.pricePence)}</span>
                      <Badge variant={STATUS_COLORS[l.status] ?? 'outline'}>{l.status}</Badge>
                      <Link href={`/marketplace/${l.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      {l.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(l.id)}
                          disabled={cancelling === l.id}
                        >
                          {cancelling === l.id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
