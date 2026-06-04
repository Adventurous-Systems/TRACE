import { passports, type PassportCertificate, type PassportDetail } from '@/lib/api-client';
import { Leaf, Clock, Recycle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CertificatePanel from '@/components/passport/CertificatePanel';
import ProvenanceTimeline from '@/components/passport/ProvenanceTimeline';
import Link from 'next/link';

interface Props {
  params: { id: string };
}

async function getPassport(id: string): Promise<PassportDetail | null> {
  try {
    return await passports.verify(id);
  } catch {
    return null;
  }
}

async function getCertificate(id: string): Promise<PassportCertificate | null> {
  try {
    return await passports.certificate(id);
  } catch {
    return null;
  }
}

export default async function PublicPassportPage({ params }: Props) {
  const [passport, certificate] = await Promise.all([
    getPassport(params.id),
    getCertificate(params.id),
  ]);

  if (!passport) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold mb-2">Passport not found</h1>
          <p className="text-gray-500 text-sm">
            This material passport does not exist or has been removed.
          </p>
          <Link href="/" className="text-brand-600 hover:underline text-sm mt-4 block">
            ← Back to TRACE
          </Link>
        </div>
      </div>
    );
  }

  const trustStatus = certificate?.status ?? (passport.blockchainTxHash ? 'verified' : 'pending');
  const trust = trustStatus === 'verified'
    ? { variant: 'success' as const, label: 'Blockchain verified' }
    : trustStatus === 'simulated'
      ? { variant: 'success' as const, label: 'Trust layer prepared' }
      : trustStatus === 'failed'
        ? { variant: 'destructive' as const, label: 'Verification failed' }
        : { variant: 'warning' as const, label: 'Pending verification' };
  const conditionLabel =
    passport.conditionGrade === 'A'
      ? 'Excellent'
      : passport.conditionGrade === 'B'
        ? 'Good'
        : passport.conditionGrade === 'C'
          ? 'Fair'
          : passport.conditionGrade === 'D'
            ? 'Poor'
            : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="font-semibold text-sm">TRACE</span>
          </Link>
          <Badge variant={trust.variant}>{trust.label}</Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-gray-500 mb-1">
                {passport.categoryL1}
                {passport.categoryL2 ? ` › ${passport.categoryL2}` : ''}
              </div>
              <h1 className="text-2xl font-bold">{passport.productName}</h1>
              {passport.conditionGrade && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                    {passport.conditionGrade}
                  </span>
                  <span className="text-sm text-gray-600">
                    Grade {passport.conditionGrade} — {conditionLabel}
                  </span>
                </div>
              )}
            </div>

            {passport.conditionPhotos?.[0] ? (
              <img
                src={passport.conditionPhotos[0]}
                alt={passport.productName}
                className="w-28 h-28 rounded-lg border object-cover"
              />
            ) : passport.qrCodeUrl ? (
              <img src={passport.qrCodeUrl} alt="QR code" className="w-24 h-24 rounded-lg border object-contain p-1" />
            ) : null}
          </div>

          {passport.conditionNotes && (
            <p className="mt-4 text-sm text-gray-600 border-t pt-4">{passport.conditionNotes}</p>
          )}
        </div>

        {/* Impact stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {passport.carbonSavingsVsNew && (
            <div className="rounded-xl border bg-green-50 p-4">
              <Leaf className="h-5 w-5 text-green-600" />
              <p className="mt-2 text-2xl font-bold text-green-700">{passport.carbonSavingsVsNew}</p>
              <p className="text-xs text-gray-500">kgCO₂e saved vs new</p>
            </div>
          )}
          {passport.conditionGrade && (
            <div className="rounded-xl border p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                {passport.conditionGrade}
              </span>
              <p className="mt-2 text-2xl font-bold">{conditionLabel ?? '—'}</p>
              <p className="text-xs text-gray-500">Condition grade {passport.conditionGrade}</p>
            </div>
          )}
          {passport.remainingLifeEstimate != null && (
            <div className="rounded-xl border p-4">
              <Clock className="h-5 w-5 text-gray-500" />
              <p className="mt-2 text-2xl font-bold">~{passport.remainingLifeEstimate}<span className="text-base font-medium text-gray-500"> yrs</span></p>
              <p className="text-xs text-gray-500">Estimated remaining life</p>
            </div>
          )}
          {passport.recycledContent && (
            <div className="rounded-xl border p-4">
              <Recycle className="h-5 w-5 text-gray-500" />
              <p className="mt-2 text-2xl font-bold">{passport.recycledContent}%</p>
              <p className="text-xs text-gray-500">Recycled content</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <CertificatePanel passportId={passport.id} initialCertificate={certificate} />
          <ProvenanceTimeline passport={passport} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="text-sm space-y-2">
                {[
                  ['Manufacturer', passport.manufacturerName],
                  ['Country of origin', passport.countryOfOrigin],
                  ['Serial number', passport.serialNumber],
                  ['GTIN', passport.gtin],
                  ['Production date', passport.productionDate ? new Date(passport.productionDate).toLocaleDateString() : null],
                  ['CE marking', passport.ceMarking ? 'Yes' : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Circular economy data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Circular economy</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="text-sm space-y-2">
                {[
                  ['Deconstruction method', passport.deconstructionMethod],
                  ['Deconstruction date', passport.deconstructionDate ? new Date(passport.deconstructionDate).toLocaleDateString() : null],
                  ['Reclaimed by', passport.reclaimedBy],
                  ['Previous building', passport.previousBuildingId],
                  ['Remaining life', passport.remainingLifeEstimate ? `~${passport.remainingLifeEstimate} years` : null],
                  ['Handling requirements', passport.handlingRequirements],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
                {!passport.deconstructionMethod && !passport.reclaimedBy && (
                  <p className="text-gray-400 text-xs">No circular data recorded</p>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Environmental */}
          {(passport.gwpTotal || passport.embodiedCarbon || passport.carbonSavingsVsNew || passport.recycledContent) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Environmental performance</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="text-sm space-y-2">
                  {[
                    ['GWP total', passport.gwpTotal ? `${passport.gwpTotal} kgCO₂e` : null],
                    ['Embodied carbon', passport.embodiedCarbon ? `${passport.embodiedCarbon} kgCO₂e` : null],
                    ['Carbon savings vs new', passport.carbonSavingsVsNew ? `${passport.carbonSavingsVsNew} kgCO₂e` : null],
                    ['Recycled content', passport.recycledContent ? `${passport.recycledContent}%` : null],
                    ['EPD reference', passport.epdReference],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Hazardous substances */}
          {passport.hazardousSubstances?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-orange-700">
                  ⚠ Hazardous substances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  {passport.hazardousSubstances.map((h, i) => (
                    <li key={i} className="border rounded-md px-3 py-2">
                      <p className="font-medium">{h.name}</p>
                      {h.casNumber && <p className="text-gray-500 text-xs">CAS: {h.casNumber}</p>}
                      {h.hazardClass && <p className="text-gray-500 text-xs">Class: {h.hazardClass}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4 pb-8">
          Passport ID: {passport.id}
          {' · '}
          Registered {new Date(passport.createdAt).toLocaleDateString()}
          {' · '}
          <Link href="https://trace.construction" className="hover:underline">
            TRACE Platform
          </Link>
        </div>
      </main>
    </div>
  );
}
