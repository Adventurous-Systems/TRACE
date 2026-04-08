'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { accessRequests } from '@/lib/api-client';
import { clearSession, getToken, getUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AccessRequestSchema = z.object({
  requestedRole: z.enum(['hub_staff', 'hub_admin']),
  organisationName: z.string().min(1, 'Organisation or hub name is required'),
  notes: z.string().max(1000, 'Please keep notes under 1000 characters').optional(),
});

type AccessRequestForm = z.infer<typeof AccessRequestSchema>;

export default function AccessRequestPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<{
    status: string;
    requestedRole: string;
    organisationName: string | null;
    reviewNotes: string | null;
  } | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const user = getUser();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessRequestForm>({
    resolver: zodResolver(AccessRequestSchema),
    defaultValues: {
      requestedRole: 'hub_staff',
      organisationName: '',
      notes: '',
    },
  });

  useEffect(() => {
    const token = getToken();
    const currentUser = getUser();

    if (!token || !currentUser) {
      router.replace('/login');
      return;
    }

    if (currentUser.role !== 'buyer') {
      router.replace('/dashboard');
      return;
    }

    accessRequests
      .mine(token)
      .then((requests) => {
        if (requests.length > 0) {
          const latest = requests[0]!;
          setExistingRequest({
            status: latest.status,
            requestedRole: latest.requestedRole,
            organisationName: latest.organisationName,
            reviewNotes: latest.reviewNotes,
          });
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoadingRequest(false));
  }, [router]);

  async function onSubmit(data: AccessRequestForm) {
    setServerError(null);
    setSuccessMessage(null);
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const created = await accessRequests.submit(data, token);
      setExistingRequest({
        status: created.status,
        requestedRole: created.requestedRole,
        organisationName: created.organisationName,
        reviewNotes: created.reviewNotes,
      });
      setSuccessMessage(
        'Request submitted. Once approved, sign out and sign back in to refresh your access.',
      );
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Request submission failed');
    }
  }

  function handleSignOut() {
    clearSession();
    router.push('/login');
  }

  if (!user || user.role !== 'buyer') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/marketplace" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="font-semibold text-sm">TRACE</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Request seller access</h1>
          <p className="text-gray-500 mt-1">
            Ask for beta access to list materials and manage a hub organisation.
          </p>
        </div>

        {loadingRequest ? (
          <Card>
            <CardContent className="py-8 text-sm text-gray-400">Loading request status…</CardContent>
          </Card>
        ) : existingRequest ? (
          <Card>
            <CardHeader>
              <CardTitle>Current request</CardTitle>
              <CardDescription>Your latest access request status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Status:</span> {existingRequest.status}
              </p>
              <p>
                <span className="font-medium">Requested access:</span>{' '}
                {existingRequest.requestedRole.replace('_', ' ')}
              </p>
              {existingRequest.organisationName && (
                <p>
                  <span className="font-medium">Organisation:</span>{' '}
                  {existingRequest.organisationName}
                </p>
              )}
              {existingRequest.reviewNotes && (
                <p>
                  <span className="font-medium">Review notes:</span>{' '}
                  {existingRequest.reviewNotes}
                </p>
              )}
              {existingRequest.status === 'approved' && (
                <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">
                  Access approved. Sign out and sign back in to refresh your permissions.
                </div>
              )}
              {existingRequest.status === 'pending' && (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-700">
                  Your request is pending review.
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Submit request</CardTitle>
              <CardDescription>
                Your account will stay as a buyer until an internal admin approves this request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="requestedRole">Requested access level</Label>
                  <select
                    id="requestedRole"
                    {...register('requestedRole')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="hub_staff">Hub staff</option>
                    <option value="hub_admin">Hub admin</option>
                  </select>
                  {errors.requestedRole && (
                    <p className="text-sm text-red-500">{errors.requestedRole.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="organisationName">Organisation or hub name</Label>
                  <Input
                    id="organisationName"
                    type="text"
                    placeholder="Stirling Reuse Hub"
                    {...register('organisationName')}
                  />
                  {errors.organisationName && (
                    <p className="text-sm text-red-500">{errors.organisationName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Reason or beta context</Label>
                  <textarea
                    id="notes"
                    rows={4}
                    placeholder="Tell us why you need access and what you want to test."
                    {...register('notes')}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {errors.notes && (
                    <p className="text-sm text-red-500">{errors.notes.message}</p>
                  )}
                </div>
                {serverError && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {serverError}
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting request…' : 'Submit request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
