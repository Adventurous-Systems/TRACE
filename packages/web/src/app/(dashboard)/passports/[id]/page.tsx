'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { passports, type PassportDetail } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function PassportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [passport, setPassport] = useState<PassportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    passports
      .get(id, token ?? undefined)
      .then(setPassport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading…</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !passport) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-gray-500">{error ?? 'Passport not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const anchored = !!passport.blockchainTxHash;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{passport.productName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {passport.categoryL1}
              {passport.categoryL2 ? ` · ${passport.categoryL2}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={anchored ? 'success' : 'outline'}>
              {anchored ? 'Anchored ✓' : 'Pending anchor'}
            </Badge>
            <Link href={`/passport/${id}`} target="_blank">
              <Button variant="outline" size="sm">
                Public view ↗
              </Button>
            </Link>
          </div>
        </div>

        {/* QR code */}
        {passport.qrCodeUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <img
                src={passport.qrCodeUrl}
                alt="Passport QR code"
                className="w-32 h-32 border rounded-lg"
              />
              <div className="text-sm text-gray-500">
                <p>Scan to view the public passport page.</p>
                <a
                  href={passport.qrCodeUrl}
                  download={`passport-${passport.id}.png`}
                  className="text-brand-600 hover:underline mt-1 block"
                >
                  Download QR
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blockchain status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blockchain anchoring</CardTitle>
          </CardHeader>
          <CardContent>
            {anchored ? (
              <dl className="text-sm space-y-2">
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Status</dt>
                  <dd className="text-green-600 font-medium">Anchored on VeChainThor</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">TX hash</dt>
                  <dd className="font-mono text-xs break-all">{passport.blockchainTxHash}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Anchored at</dt>
                  <dd>{passport.blockchainAnchoredAt ? new Date(passport.blockchainAnchoredAt).toLocaleString() : '—'}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Data hash</dt>
                  <dd className="font-mono text-xs break-all">{passport.blockchainPassportHash}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">
                Anchoring in progress — this typically completes within a few minutes.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Passport data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Material data</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="text-sm divide-y">
              {[
                ['Status', passport.status],
                ['Condition grade', passport.conditionGrade ?? '—'],
                ['Condition notes', passport.conditionNotes ?? '—'],
                ['Manufacturer', passport.manufacturerName ?? '—'],
                ['Country of origin', passport.countryOfOrigin ?? '—'],
                ['Deconstruction method', passport.deconstructionMethod ?? '—'],
                ['Reclaimed by', passport.reclaimedBy ?? '—'],
                ['Remaining life', passport.remainingLifeEstimate ? `${passport.remainingLifeEstimate} years` : '—'],
                ['Embodied carbon', passport.embodiedCarbon ? `${passport.embodiedCarbon} kgCO₂e` : '—'],
                ['Carbon savings vs new', passport.carbonSavingsVsNew ? `${passport.carbonSavingsVsNew} kgCO₂e` : '—'],
                ['GWP total', passport.gwpTotal ? `${passport.gwpTotal} kgCO₂e` : '—'],
                ['Recycled content', passport.recycledContent ? `${passport.recycledContent}%` : '—'],
                ['CE marking', passport.ceMarking ? 'Yes' : 'No'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
