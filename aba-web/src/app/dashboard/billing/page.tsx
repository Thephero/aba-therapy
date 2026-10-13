'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CreditCard, ExternalLink, Check, AlertTriangle } from 'lucide-react';

interface PricingItem {
  key: string;
  label: string;
  price: number;
  recurring: boolean;
  enabled: boolean;
  stripePriceId: string;
}

interface BillingData {
  configured: boolean;
  subscription: {
    plan: string;
    status: string;
    effectiveStatus: string;
    billingCycle: string | null;
    studentLimit: number;
    includedStudents: number;
    extraStudents: number;
    activeStudents: number;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    daysLeft: number | null;
    amount: number;
    currency: string;
  } | null;
  pricing?: {
    currency: string;
    basePrice: number;
    annualPrice: number | null;
    annualEnabled: boolean;
    includedStudents: number;
    items: PricingItem[];
  };
}

const STATUS_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'primary' }> = {
  TRIALING: { label: 'Free trial', variant: 'primary' },
  ACTIVE: { label: 'Active', variant: 'success' },
  PAST_DUE: { label: 'Payment issue', variant: 'warning' },
  CANCELED: { label: 'Canceled', variant: 'danger' },
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [extraSeats, setExtraSeats] = useState(1);

  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const res = await api.get('/billing/status');
      return res.data;
    },
  });

  // Show feedback after returning from Stripe Checkout.
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      showToast('Purchase complete! It may take a few seconds to reflect here.', 'success');
    } else if (checkout === 'cancelled') {
      showToast('Checkout was cancelled — no changes were made.', 'info');
    }
    if (checkout) router.replace('/dashboard/billing');
  }, [searchParams, router, showToast]);

  const checkoutMutation = useMutation({
    mutationFn: async (body: { itemKey: string; quantity?: number; cycle?: string }) => {
      const res = await api.post('/billing/checkout-session', body);
      return res.data.url as string;
    },
    onMutate: (body) => setBusyItem(body.itemKey),
    onSuccess: (url) => {
      window.location.href = url; // Stripe-hosted checkout
    },
    onError: (err: any, body) => {
      showToast(err?.response?.data?.error || 'Could not start checkout', 'error');
      setBusyItem(null);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/billing/portal-session');
      return res.data.url as string;
    },
    onSuccess: (url) => {
      window.location.href = url; // Stripe-hosted customer portal
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Could not open billing portal', 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const sub = data?.subscription;
  const pricing = data?.pricing;
  const currency = pricing?.currency || sub?.currency || 'USD';
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;
  const statusBadge = sub ? STATUS_BADGES[sub.status] || STATUS_BADGES.ACTIVE : null;
  const baseCurrent = sub && ['ACTIVE', 'TRIALING'].includes(sub.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-sm text-gray-500">Manage your center's plan, seats, and add-ons.</p>
        </div>
        {sub && sub.status === 'ACTIVE' && (
          <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
            <ExternalLink className="h-4 w-4" />
            Manage billing
          </Button>
        )}
      </div>

      {!data?.configured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm text-amber-800">
              Payments are not configured on the server yet (missing Stripe keys). You can browse the plans below, but
              checkout is disabled until your administrator completes the Stripe setup.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current status card */}
      {sub && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Current plan</CardTitle>
              <CardDescription>
                {sub.plan === 'TRIAL' ? 'Free trial' : sub.plan === 'BASE' ? 'Base subscription' : sub.plan}
                {sub.billingCycle ? ` · billed ${sub.billingCycle.toLowerCase()}` : ''}
              </CardDescription>
            </div>
            {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Students</div>
              <div className="text-lg font-semibold text-gray-900">
                {sub.activeStudents} <span className="text-sm font-normal text-gray-500">/ {sub.studentLimit} allowed</span>
              </div>
              <div className="text-xs text-gray-400">
                {sub.includedStudents ?? (pricing?.includedStudents ?? 0)} included
                {sub.extraStudents ? ` + ${sub.extraStudents} extra seats` : ''}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                {sub.status === 'TRIALING' ? 'Trial ends' : 'Renews'}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {sub.status === 'TRIALING' && sub.daysLeft != null
                  ? `in ${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'}`
                  : sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Price</div>
              <div className="text-lg font-semibold text-gray-900">
                {sub.status === 'TRIALING' || sub.amount === 0
                  ? 'Free'
                  : `${fmt(sub.amount)} / ${sub.billingCycle === 'ANNUAL' ? 'yr' : 'mo'}`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial banner */}
      {sub?.status === 'TRIALING' && sub.daysLeft != null && (
        <Card className={sub.daysLeft <= 3 ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-indigo-50'}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${sub.daysLeft <= 3 ? 'text-red-500' : 'text-indigo-500'}`} />
              <div className="text-sm">
                <div className={`font-medium ${sub.daysLeft <= 3 ? 'text-red-800' : 'text-indigo-900'}`}>
                  {sub.daysLeft === 0
                    ? 'Your trial ends today'
                    : `${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'} left in your free trial`}
                </div>
                <div className={sub.daysLeft <= 3 ? 'text-red-700' : 'text-indigo-700'}>
                  Subscribe below to keep adding students — your data stays safe.
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
              View plans
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div id="plans" className="space-y-4">
        {/* Cycle toggle (only when annual is enabled) */}
        {pricing?.annualEnabled && pricing.annualPrice != null && (
          <div className="flex items-center justify-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${cycle === 'MONTHLY' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setCycle('MONTHLY')}
              >
                Monthly
              </button>
              <button
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${cycle === 'ANNUAL' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setCycle('ANNUAL')}
              >
                Annual
              </button>
            </div>
          </div>
        )}

        {/* Base subscription card */}
        {pricing && (
          <Card className={baseCurrent ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Base subscription</CardTitle>
                {baseCurrent && <Badge variant="primary">Current</Badge>}
              </div>
              <CardDescription>Everything you need to run your center</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold text-gray-900">
                  {fmt(cycle === 'ANNUAL' && pricing.annualPrice != null ? pricing.annualPrice : pricing.basePrice)}
                </span>
                <span className="text-sm text-gray-500"> / {cycle === 'ANNUAL' ? 'year' : 'month'}</span>
                <div className="mt-1 text-sm text-gray-600">
                  Includes {pricing.includedStudents} active student{pricing.includedStudents === 1 ? '' : 's'}
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Unlimited staff accounts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Assessments, sessions & reporting tools
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Add more students any time (below)
                </li>
              </ul>
              {baseCurrent && sub?.plan === 'BASE' ? (
                <Button variant="outline" className="w-full" onClick={() => portalMutation.mutate()} disabled={!data?.configured || portalMutation.isPending}>
                  Manage in portal
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={baseCurrent ? 'outline' : 'default'}
                  disabled={!data?.configured || busyItem !== null}
                  onClick={() => checkoutMutation.mutate({ itemKey: 'BASE_SUBSCRIPTION', cycle })}
                >
                  <CreditCard className="h-4 w-4" />
                  {busyItem === 'BASE_SUBSCRIPTION' ? 'Redirecting…' : sub?.plan === 'TRIAL' ? 'Subscribe' : 'Switch to this plan'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add-on cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {(pricing?.items || []).filter((item) => item.enabled).map((item) => {
            const isSeats = item.key === 'EXTRA_STUDENT';
            const isCurrent =
              sub &&
              ['ACTIVE'].includes(sub.status) &&
              sub.plan === 'BASE' &&
              isSeats &&
              (sub.extraStudents || 0) > 0;
            return (
              <Card key={item.key} className={isCurrent ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{item.label}</CardTitle>
                    <Badge variant={item.recurring ? 'primary' : 'success'}>
                      {item.recurring ? 'per month' : 'one-time'}
                    </Badge>
                  </div>
                  {isSeats && (sub?.extraStudents ?? 0) > 0 && (
                    <CardDescription>Currently: {sub!.extraStudents} extra seat(s)</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{fmt(item.price)}</span>
                    {isSeats && <span className="text-sm text-gray-500"> per student / month</span>}
                  </div>
                  {isSeats && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Seats</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={extraSeats}
                        onChange={(e) => setExtraSeats(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                        className="h-9 w-20 rounded-md border border-gray-200 px-2 text-sm"
                      />
                      <span className="text-xs text-gray-400">
                        = {fmt(item.price * extraSeats)}
                        {item.recurring ? '/mo' : ''}
                      </span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={!data?.configured || busyItem !== null}
                    onClick={() => checkoutMutation.mutate({ itemKey: item.key, quantity: isSeats ? extraSeats : 1, cycle })}
                  >
                    <CreditCard className="h-4 w-4" />
                    {busyItem === item.key ? 'Redirecting…' : isSeats ? 'Add seats' : 'Purchase'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        Payments are processed securely by Stripe. Cancel or change anytime — access continues until the end of the
        billing period.
      </p>
    </div>
  );
}
