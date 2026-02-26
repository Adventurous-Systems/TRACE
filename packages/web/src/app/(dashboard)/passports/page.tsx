'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { passports, type PassportSummary } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  draft: 'outline',
  active: 'success',
  listed: 'default',
  reserved: 'warning',
  sold: 'outline',
  installed: 'success',
  decommissioned: 'outline',
};

export default function PassportsPage() {
  const [items, setItems] = useState<PassportSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    passports
      .list(params, token)
      .then((res) => {
        setItems(res.data);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, status]);

  const totalPages = Math.ceil(total / 20);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Passports</h1>
          <Link href="/passports/new">
            <Button className="bg-brand-600 hover:bg-brand-700">+ Register material</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-64"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All statuses</option>
            {['draft', 'active', 'listed', 'reserved', 'sold', 'installed', 'decommissioned'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm">No passports found.</p>
                <Link href="/passports/new" className="text-brand-600 hover:underline text-sm mt-2 block">
                  Register your first material
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/passports/${p.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{p.productName}</p>
                        <p className="text-xs text-gray-500">
                          {p.categoryL1}
                          {p.categoryL2 ? ` · ${p.categoryL2}` : ''}
                          {p.conditionGrade ? ` · Grade ${p.conditionGrade}` : ''}
                          {' · '}
                          {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {p.blockchainTxHash && (
                          <span className="text-xs text-green-600" title="Anchored on VeChainThor">⛓</span>
                        )}
                        <Badge variant={STATUS_COLORS[p.status] ?? 'outline'}>
                          {p.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{total} passports total</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 flex items-center px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
