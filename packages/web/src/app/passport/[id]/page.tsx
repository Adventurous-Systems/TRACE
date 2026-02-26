import { passports, type PassportDetail } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default async function PublicPassportPage({ params }: Props) {
  const passport = await getPassport(params.id);

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

  const anchored = !!passport.blockchainTxHash;
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
          <Badge variant={anchored ? 'success' : 'warning'}>
            {anchored ? '⛓ Blockchain verified' : 'Pending verification'}
          </Badge>
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

            {passport.qrCodeUrl && (
              <img
                src={passport.qrCodeUrl}
                alt="QR code"
                className="w-24 h-24 rounded-lg border"
              />
            )}
          </div>

          {passport.conditionNotes && (
            <p className="mt-4 text-sm text-gray-600 border-t pt-4">{passport.conditionNotes}</p>
          )}
        </div>

        {/* Blockchain verification strip */}
        <div
          className={`rounded-xl border p-4 ${
            anchored ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`text-xl ${anchored ? 'text-green-600' : 'text-yellow-600'}`}>
              {anchored ? '✓' : '⏳'}
            </div>
            <div>
              <p className={`font-medium text-sm ${anchored ? 'text-green-800' : 'text-yellow-800'}`}>
                {anchored ? 'Data integrity verified on VeChainThor' : 'Blockchain anchoring in progress'}
              </p>
              {anchored && passport.blockchainTxHash && (
                <p className="text-xs text-green-700 font-mono mt-1 break-all">
                  TX: {passport.blockchainTxHash}
                </p>
              )}
              {anchored && passport.blockchainAnchoredAt && (
                <p className="text-xs text-green-600 mt-1">
                  Anchored {new Date(passport.blockchainAnchoredAt).toLocaleDateString()}
                </p>
              )}
              {!anchored && (
                <p className="text-xs text-yellow-700 mt-1">
                  This passport will be anchored on VeChainThor within minutes of registration.
                </p>
              )}
            </div>
          </div>
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
