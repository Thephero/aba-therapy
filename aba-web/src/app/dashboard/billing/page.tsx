'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CreditCard, ExternalLink, Check, AlertTriangle } from 'lucide-react';

interface BillingData {
  configured: boolean;
  subscription: {
    plan: string;
    status: string;
    effectiveStatus: string;
    billingCycle: string | null;
    studentLimit: number;
    activeStudents: number;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    daysLeft: number | null;
    amount: number;
    currency: string;
  } | null;
  plans: { id: string; studentLimit: number }[];
}

const PLAN_DETAILS: Record<string, { name: string; monthly: number; annual: number; blurb: string }> = {
  BASIC: { name: 'Basic', monthly: 199, annual: 1990, blurb: 'For small centers getting started' },
  PRO: { name: 'Pro', monthly: 449, annual: 4490, blurb: 'For growing centers with multiple teams' },
  ENTERPRISE: { name: 'Enterprise', monthly: 899, annual: 8990, blurb: 'For large centers and multi-branch groups' },
};

const STATUS_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'primary' }> = {
  TRIALING: { label: 'Free trial', variant: 'primary' },
  ACTIVE: { label: 'Active', variant: 'success' },
  PAST_DUE: { label: 'Payment issue', variant: 'warning' },
  CANCELED: { label: 'Canceled', variant: 'danger' },
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

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
      showToast('Subscription activated! It may take a few seconds to reflect here.', 'success');
    } else if (checkout === 'cancelled') {
      showToast('Checkout was cancelled — no changes were made.', 'info');
    }
    if (checkout) router.replace('/dashboard/billing');
  }, [searchParams, router, showToast]);

  const refreshAfterCheckout = () => {
    // Stripe Checkout redirects away and back; re-fetch status on return.
    queryClient.invalidateQueries({ queryKey: ['billing-status'] });
  };
  void refreshAfterCheckout;

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await api.post('/billing/checkout-session', { plan, cycle });
      return res.data.url as string;
    },
    onMutate: (plan) => setBusyPlan(plan),
    onSuccess: (url) => {
      window.location.href = url; // Stripe-hosted checkout
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Could not start checkout', 'error');
      setBusyPlan(null);
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
  const statusBadge = sub ? STATUS_BADGES[sub.status] || STATUS_BADGES.ACTIVE : null;
  const isCurrentPlan = (planId: string) =>
    sub && ['ACTIVE', 'TRIALING'].includes(sub.status) && sub.plan === planId;

  return (      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-sm text-gray-500">Manage your center's plan, payment method, and invoices.</p>
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
              Payments are not configured on the server yet (missing Stripe keys). You can browse plans, but checkout is
              disabled until your administrator adds the Stripe environment variables.
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
                {sub.plan === 'TRIAL' ? '14-day free trial' : PLAN_DETAILS[sub.plan]?.name || sub.plan}
                {sub.billingCycle ? ` · billed ${sub.billingCycle.toLowerCase()}` : ''}
              </CardDescription>
            </div>
            {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Students</div>
              <div className="text-lg font-semibold text-gray-900">
                {sub.activeStudents} <span className="text-sm font-normal text-gray-500">/ {sub.studentLimit} included</span>
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
                  : `AED ${sub.amount.toLocaleString()} / ${sub.billingCycle === 'ANNUAL' ? 'yr' : 'mo'}`}
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
                  Choose a plan below to keep adding students — your data stays safe.
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
              Choose a plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cycle toggle */}
      <div className="flex items-center justify-center gap-2" id="plans">
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
            Annual <span className="ml-1 text-xs opacity-90">· 2 months free</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.plans || []).map((plan) => {
          const details = PLAN_DETAILS[plan.id];
          const price = cycle === 'ANNUAL' ? details.annual : details.monthly;
          const current = isCurrentPlan(plan.id);
          const isActivePlan = sub && ['ACTIVE'].includes(sub.status) && sub.plan === plan.id;
          return (
            <Card key={plan.id} className={current ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{details.name}</CardTitle>
                  {current && <Badge variant="primary">Current</Badge>}
                </div>
                <CardDescription>{details.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold text-gray-900">AED {price.toLocaleString()}</span>
                  <span className="text-sm text-gray-500"> / {cycle === 'ANNUAL' ? 'year' : 'month'}</span>
                  {cycle === 'ANNUAL' && (
                    <div className="mt-0.5 text-xs text-emerald-600">
                      ≈ AED {Math.round(details.annual / 12).toLocaleString()}/mo — 2 months free
                    </div>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Up to {plan.studentLimit} active students
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Unlimited staff accounts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Assessments, sessions & reports
                  </li>
                </ul>
                {isActivePlan ? (
                  <Button variant="outline" className="w-full" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
                    Manage in portal
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={current ? 'outline' : 'default'}
                    disabled={!data?.configured || busyPlan !== null}
                    onClick={() => checkoutMutation.mutate(plan.id)}
                  >
                    <CreditCard className="h-4 w-4" />
                    {busyPlan === plan.id ? 'Redirecting…' : sub?.plan && sub.plan !== 'TRIAL' ? 'Switch to this plan' : 'Subscribe'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        Payments are processed securely by Stripe. Cancel or change your plan anytime — access continues until the end
        of the billing period.
      </p>
    </div>
  );
}
