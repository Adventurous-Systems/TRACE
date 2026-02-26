'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { passports, type PassportSummary } from '@/lib/api-client';
import { getToken, getUser } from '@/lib/auth';

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  draft: 'outline',
  active: 'success',
  listed: 'default',
  reserved: 'warning',
  sold: 'outline',
  installed: 'success',
  decommissioned: 'outline',
};

export default function DashboardPage() {
  const [items, setItems] = useState<PassportSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    passports
      .list(new URLSearchParams({ limit: '5' }), token)
      .then((res) => {
        setItems(res.data);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-500 text-sm">
              {user?.email} · {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
          <Link href="/passports/new">
            <Button className="bg-brand-600 hover:bg-brand-700">
              + Register material
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total passports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{loading ? '—' : total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {loading ? '—' : items.filter((p) => p.status === 'active').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Anchored on-chain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {loading ? '—' : items.filter((p) => p.blockchainTxHash).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent passports</CardTitle>
            <Link href="/passports" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No passports yet.{' '}
                <Link href="/passports/new" className="text-brand-600 hover:underline">
                  Register one
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
                      <div>
                        <p className="font-medium text-sm">{p.productName}</p>
                        <p className="text-xs text-gray-500">
                          {p.categoryL1}
                          {p.categoryL2 ? ` · ${p.categoryL2}` : ''}
                          {p.conditionGrade ? ` · Grade ${p.conditionGrade}` : ''}
                        </p>
                      </div>
                      <Badge variant={STATUS_COLORS[p.status] ?? 'outline'}>
                        {p.status}
                      </Badge>
                    </Link>
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
