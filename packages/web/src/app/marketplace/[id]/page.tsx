'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { marketplace, type ListingSummary, ApiError } from '@/lib/api-client';
import { getToken, getUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<ListingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerLoading, setOfferLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    marketplace
      .getListing(params.id)
      .then(setListing)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleMakeOffer() {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      router.push('/login');
      return;
    }

    setOfferLoading(true);
    setError('');
    try {
      const offerPayload: { listingId: string; notes?: string } = { listingId: params.id };
      if (notes) offerPayload.notes = notes;
      await marketplace.makeOffer(offerPayload, token);
      setSuccess('Offer placed! The seller will be notified. Check your Orders for updates.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to place offer');
    } finally {
      setOfferLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Listing not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/marketplace" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            ← Marketplace
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{listing.passport.productName}</h1>
              <p className="text-gray-500">
                {listing.passport.categoryL1}
                {listing.passport.categoryL2 ? ` · ${listing.passport.categoryL2}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {listing.passport.conditionGrade && (
                <Badge className="text-base px-3 py-1">
                  Grade {listing.passport.conditionGrade}
                </Badge>
              )}
              <Badge variant="outline">{listing.status}</Badge>
            </div>

            {listing.passport.conditionNotes && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-1">Condition notes</p>
                  <p className="text-sm text-gray-600">{listing.passport.conditionNotes}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Material details</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-gray-500">Category</dt>
                  <dd>{listing.passport.categoryL1}</dd>
                  {listing.passport.categoryL2 && (
                    <>
                      <dt className="text-gray-500">Subcategory</dt>
                      <dd>{listing.passport.categoryL2}</dd>
                    </>
                  )}
                  {listing.passport.carbonSavingsVsNew && (
                    <>
                      <dt className="text-gray-500">Carbon savings</dt>
                      <dd className="text-green-600">{listing.passport.carbonSavingsVsNew} kgCO₂e</dd>
                    </>
                  )}
                  <dt className="text-gray-500">Quantity</dt>
                  <dd>{listing.quantity}</dd>
                  <dt className="text-gray-500">Currency</dt>
                  <dd>{listing.currency}</dd>
                  <dt className="text-gray-500">Supplier hub</dt>
                  <dd>{listing.organisation.name}</dd>
                </dl>
              </CardContent>
            </Card>

            {/* Passport link */}
            <Link
              href={`/passport/${listing.passportId}`}
              className="text-sm text-brand-600 hover:underline"
            >
              View full material passport →
            </Link>
          </div>

          {/* Purchase panel */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <p className="text-3xl font-bold text-brand-700">
                    {formatPrice(listing.pricePence)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">GBP · price includes VAT if applicable</p>
                </div>

                {listing.status === 'active' ? (
                  <>
                    {success ? (
                      <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
                        {success}
                      </p>
                    ) : (
                      <>
                        <textarea
                          placeholder="Add a note to the seller (optional)"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                        {error && (
                          <p className="text-xs text-red-600">{error}</p>
                        )}
                        <Button
                          className="w-full bg-brand-600 hover:bg-brand-700"
                          onClick={handleMakeOffer}
                          disabled={offerLoading}
                        >
                          {offerLoading ? 'Placing offer…' : 'Make offer at asking price'}
                        </Button>
                        <p className="text-xs text-gray-400 text-center">
                          You will receive confirmation from the hub.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center">
                    This listing is {listing.status}.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shipping options */}
            {listing.shippingOptions.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium">Shipping / collection</p>
                  {listing.shippingOptions.map((opt, i) => (
                    <div key={i} className="text-sm text-gray-600">
                      <span className="capitalize font-medium">{opt.method}</span>
                      {opt.deliveryCostPence !== undefined && (
                        <span> · {opt.deliveryCostPence === 0 ? 'Free' : formatPrice(opt.deliveryCostPence)}</span>
                      )}
                      {opt.deliveryRadiusMiles && (
                        <span> within {opt.deliveryRadiusMiles} miles</span>
                      )}
                      {opt.notes && <span> — {opt.notes}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
