'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  accessRequests,
  type AccessRequestOrganisation,
  type AccessRequestReview,
} from '@/lib/api-client';
import { getToken, getUser } from '@/lib/auth';

type StatusFilter = 'pending' | 'approved' | 'rejected';

interface ReviewDraft {
  role: 'hub_staff' | 'hub_admin';
  organisationId: string;
  reviewNotes: string;
}

const FILTERS: StatusFilter[] = ['pending', 'approved', 'rejected'];

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function formatDate(value: string | null) {
  if (!value) return 'Not reviewed yet';
  return new Date(value).toLocaleString();
}

export default function AdminAccessRequestsPage() {
  const user = getUser();
  const token = getToken();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [requests, setRequests] = useState<AccessRequestReview[]>([]);
  const [organisations, setOrganisations] = useState<AccessRequestOrganisation[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'platform_admin') {
      return;
    }

    if (!token) {
      setError('Missing session token. Please sign in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      accessRequests.list(token, statusFilter),
      accessRequests.organisations(token),
    ])
      .then(([requestData, organisationData]) => {
        if (cancelled) return;
        setRequests(requestData);
        setOrganisations(organisationData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load access requests');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, token, user]);

  useEffect(() => {
    if (requests.length === 0 || organisations.length === 0) {
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      let changed = false;

      for (const request of requests) {
        if (next[request.id]) continue;
        next[request.id] = {
          role: request.requestedRole,
          organisationId:
            request.targetOrganisationId ??
            organisations.find((org) => org.name === request.organisationName)?.id ??
            organisations[0]!.id,
          reviewNotes: request.reviewNotes ?? '',
        };
        changed = true;
      }

      return changed ? next : current;
    });
  }, [organisations, requests]);

  const requestCountLabel = useMemo(() => {
    if (loading) return 'Loading requests...';
    return `${requests.length} ${statusFilter} request${requests.length === 1 ? '' : 's'}`;
  }, [loading, requests.length, statusFilter]);

  function updateDraft(id: string, updates: Partial<ReviewDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        role: current[id]?.role ?? 'hub_staff',
        organisationId: current[id]?.organisationId ?? organisations[0]?.id ?? '',
        reviewNotes: current[id]?.reviewNotes ?? '',
        ...updates,
      },
    }));
  }

  async function refreshCurrentFilter() {
    if (!token) return;
    const requestData = await accessRequests.list(token, statusFilter);
    setRequests(requestData);
  }

  async function handleApprove(requestId: string) {
    if (!token) return;
    const draft = drafts[requestId];
    if (!draft?.organisationId) {
      setError('Choose an organisation before approving the request.');
      return;
    }

    setBusyId(requestId);
    setError(null);
    try {
      await accessRequests.approve(
        requestId,
        {
          role: draft.role,
          organisationId: draft.organisationId,
          reviewNotes: draft.reviewNotes,
        },
        token,
      );
      await refreshCurrentFilter();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requestId: string) {
    if (!token) return;
    const draft = drafts[requestId];

    setBusyId(requestId);
    setError(null);
    try {
      await accessRequests.reject(
        requestId,
        {
          reviewNotes: draft?.reviewNotes,
        },
        token,
      );
      await refreshCurrentFilter();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!user || user.role !== 'platform_admin') {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access requests</CardTitle>
            <CardDescription>
              This page is only available to platform administrators.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Access requests</h1>
            <p className="text-sm text-gray-500">
              Review beta tester and seller access requests without leaving the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? 'default' : 'outline'}
                className={statusFilter === filter ? 'bg-brand-600 hover:bg-brand-700' : ''}
                onClick={() => setStatusFilter(filter)}
              >
                {formatRole(filter)}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Queue overview</CardTitle>
            <CardDescription>{requestCountLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            {loading ? (
              <div className="text-sm text-gray-400">Loading access requests...</div>
            ) : requests.length === 0 ? (
              <div className="text-sm text-gray-500">
                No {statusFilter} access requests right now.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const draft = drafts[request.id];
                  const isBusy = busyId === request.id;

                  return (
                    <div key={request.id} className="rounded-lg border bg-white p-4 space-y-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {request.user?.name || 'Unknown user'}{' '}
                            <span className="font-normal text-gray-500">
                              ({request.user?.email || request.userId})
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Requested {formatRole(request.requestedRole)} access for{' '}
                            <span className="font-medium">
                              {request.organisationName || 'unspecified organisation'}
                            </span>
                          </p>
                          {request.notes && (
                            <p className="text-sm text-gray-500">{request.notes}</p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          <p>Status: <span className="font-medium text-gray-800">{request.status}</span></p>
                          <p>Submitted: {formatDate(request.createdAt)}</p>
                          <p>Reviewed: {formatDate(request.reviewedAt)}</p>
                        </div>
                      </div>

                      {request.status === 'pending' ? (
                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`${request.id}-role`}>Approve as</Label>
                            <select
                              id={`${request.id}-role`}
                              value={draft?.role ?? request.requestedRole}
                              onChange={(event) =>
                                updateDraft(request.id, {
                                  role: event.target.value as 'hub_staff' | 'hub_admin',
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="hub_staff">Hub staff</option>
                              <option value="hub_admin">Hub admin</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`${request.id}-organisation`}>Organisation</Label>
                            <select
                              id={`${request.id}-organisation`}
                              value={draft?.organisationId ?? ''}
                              onChange={(event) =>
                                updateDraft(request.id, { organisationId: event.target.value })
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {organisations.map((organisation) => (
                                <option key={organisation.id} value={organisation.id}>
                                  {organisation.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1 lg:col-span-3">
                            <Label htmlFor={`${request.id}-notes`}>Review notes</Label>
                            <textarea
                              id={`${request.id}-notes`}
                              rows={3}
                              value={draft?.reviewNotes ?? ''}
                              onChange={(event) =>
                                updateDraft(request.id, { reviewNotes: event.target.value })
                              }
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Optional internal note for the user or reviewer"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 lg:col-span-3">
                            <Button
                              className="bg-brand-600 hover:bg-brand-700"
                              disabled={isBusy}
                              onClick={() => handleApprove(request.id)}
                            >
                              {isBusy ? 'Saving...' : 'Approve'}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleReject(request.id)}
                            >
                              {isBusy ? 'Saving...' : 'Reject'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          {request.status === 'approved' ? (
                            <>
                              Approved as {request.user?.role ? formatRole(request.user.role) : 'updated user'} for{' '}
                              {request.targetOrganisation?.name || 'the selected organisation'}.
                            </>
                          ) : (
                            <>This request was rejected.</>
                          )}
                          {request.reviewNotes && (
                            <span className="block mt-1 text-gray-500">{request.reviewNotes}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
