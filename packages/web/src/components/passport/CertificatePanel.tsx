'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { passports, type PassportCertificate } from '@/lib/api-client';

function shortHash(value: string | null) {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function explorerHref(txHash: string) {
  const base = process.env.NEXT_PUBLIC_VECHAIN_EXPLORER_URL?.trim().replace(/\/$/, '');
  return base ? `${base}/transactions/${txHash}` : `/explorer/tx/${txHash}`;
}

function statusBadge(status: PassportCertificate['status']) {
  if (status === 'verified') return <Badge variant="success">Blockchain verified</Badge>;
  if (status === 'simulated') return <Badge variant="success">Trust layer prepared</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Verification failed</Badge>;
  return <Badge variant="warning">Pending verification</Badge>;
}

export default function CertificatePanel({
  passportId,
  initialCertificate,
  pollPending = true,
}: {
  passportId: string;
  initialCertificate?: PassportCertificate | null;
  pollPending?: boolean;
}) {
  const [certificate, setCertificate] = useState<PassportCertificate | null>(
    initialCertificate ?? null,
  );
  const [loading, setLoading] = useState(!initialCertificate);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await passports.certificate(passportId);
        if (!cancelled) setCertificate(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    if (!pollPending) return () => { cancelled = true; };

    const interval = window.setInterval(() => {
      if (
        certificate?.status === 'verified' ||
        certificate?.status === 'failed' ||
        certificate?.status === 'simulated'
      ) {
        window.clearInterval(interval);
        return;
      }
      load();
    }, 3500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [passportId, pollPending, certificate?.status]);

  const rows = useMemo(() => {
    if (!certificate) return [];
    return [
      ['Certificate hash', certificate.certificateHash],
      ['Certificate ID', certificate.txHash],
      ['Registered on', certificate.registeredAt ? new Date(certificate.registeredAt).toLocaleString() : null],
      ['Verification block', certificate.blockNumber ? `#${certificate.blockNumber}` : null],
      ['Hub identity', certificate.hub?.address ?? null],
    ].filter(([, value]) => value);
  }, [certificate]);

  if (loading && !certificate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blockchain Certificate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 rounded-md bg-gray-100 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const status = certificate?.status ?? 'pending';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Blockchain Certificate</CardTitle>
        {statusBadge(status)}
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'pending' && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse mr-2" />
            Digital fingerprint is being registered on VeChainThor.
          </div>
        )}

        {status === 'failed' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {certificate?.failureReason ?? 'The latest verification attempt failed.'}
          </div>
        )}

        {status === 'verified' && certificate?.hub && (
          <p className="text-sm text-gray-600">
            Digital fingerprint registered on VeChainThor by{' '}
            <span className="font-medium text-gray-900">{certificate.hub.name}</span>.
          </p>
        )}

        {status === 'simulated' && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Tamper-evident fingerprint generated for this passport. VeChain anchoring is
            simulated for the showcase.
          </div>
        )}

        <dl className="text-sm space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4">
              <dt className="text-gray-500 w-36 shrink-0">{label}</dt>
              <dd className="font-mono text-xs break-all">{label === 'Registered on' || label === 'Verification block' ? value : shortHash(String(value))}</dd>
            </div>
          ))}
        </dl>

        {certificate?.txHash && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={explorerHref(certificate.txHash)} target="_blank" rel="noreferrer">
                View certificate
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(certificate.txHash!)}
            >
              Copy ID
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
