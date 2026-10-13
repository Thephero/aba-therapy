'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Check } from 'lucide-react';

interface AddOnItem {
  key: string;
  label: string;
  price: number;
  recurring: boolean;
  enabled: boolean;
  stripePriceId: string;
}

interface PricingConfig {
  currency: string;
  basePrice: number;
  annualPrice: number | null;
  annualEnabled: boolean;
  includedStudents: number;
  baseStripePriceId: string;
  baseStripePriceIdAnnual: string;
  items: AddOnItem[];
}

const DEFAULTS: PricingConfig = {
  currency: 'USD',
  basePrice: 180,
  annualPrice: null,
  annualEnabled: false,
  includedStudents: 10,
  baseStripePriceId: '',
  baseStripePriceIdAnnual: '',
  items: [
    { key: 'EXTRA_STUDENT', label: 'Additional student (per month)', price: 10, recurring: true, enabled: true, stripePriceId: '' },
    { key: 'REPORT_GENERATION', label: 'Report generation (one-off)', price: 10, recurring: false, enabled: true, stripePriceId: '' },
    { key: 'LLM_ADDON', label: 'LLM assistant add-on (per month)', price: 20, recurring: true, enabled: true, stripePriceId: '' },
  ],
};

export default function PlatformPricingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = !!user && user.role?.toLowerCase() === 'platform_admin';

  const { data, isLoading } = useQuery<{ pricing: PricingConfig; brand?: string }>({
    queryKey: ['platform-pricing'],
    queryFn: async () => {
      const res = await api.get('/platform/pricing');
      return res.data;
    },
  });

  const [form, setForm] = useState<PricingConfig>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.pricing) {
      setForm({ ...DEFAULTS, ...data.pricing });
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutationCustom({
    onSuccess: () => {
      showToast('Pricing saved. New prices are live immediately (Stripe prices sync automatically when keys are set).', 'success');
      queryClient.invalidateQueries({ queryKey: ['platform-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['billing-status'] });
    },
    onError: (err: any) => {
      const details = err?.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        showToast(`Invalid value: ${details[0].path} — ${details[0].message}`, 'error');
      } else {
        showToast(err?.response?.data?.error || 'Could not save pricing', 'error');
      }
    },
  });

  void saveMutation.pending;

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Platform Pricing</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm text-amber-800">
              Only the platform owner (PLATFORM_ADMIN) can edit prices. Sign in with the platform owner account to
              manage the pricing dashboard.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const set = (patch: Partial<PricingConfig>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setItem = (key: string, patch: Partial<AddOnItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Pricing</h1>
          <p className="text-sm text-gray-500">
            WordPress-style pricing dashboard — changes apply everywhere immediately, no redeploy needed.
          </p>
        </div>
        <Button
          disabled={!dirty || saveMutation.pending}
          onClick={() =>
            saveMutation.mutate('/platform/pricing', 'PUT', form)
          }
        >
          {saveMutation.pending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {saveMutation.pending ? 'Saving…' : 'Save pricing'}
        </Button>
      </div>

      {!data && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm text-amber-800">Could not load the current pricing config — showing defaults.</div>
          </CardContent>
        </Card>
      )}

      {/* Base subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base subscription</CardTitle>
          <CardDescription>Monthly price every center pays, including the student count below</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Price / month</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.basePrice}
              onChange={(e) => set({ basePrice: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Included students</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.includedStudents}
              onChange={(e) => set({ includedStudents: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Currency</label>
            <Input
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set({ currency: e.target.value.toUpperCase().slice(0, 3) })}
              placeholder="USD"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.annualEnabled}
                onChange={(e) => set({ annualEnabled: e.target.checked })}
              />
              Annual billing
            </label>
            {form.annualEnabled && (
              <Input
                type="number"
                min={0}
                step={1}
                value={form.annualPrice ?? ''}
                placeholder="Annual price"
                onChange={(e) => set({ annualPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add-ons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add-on items</CardTitle>
          <CardDescription>Sold separately from the base subscription. Disabled items are hidden from centers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.items.map((item) => (
            <div key={item.key} className="grid gap-4 rounded-lg border border-gray-100 p-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">{item.key}</label>
                <Input
                  type="text"
                  value={item.label}
                  onChange={(e) => setItem(item.key, { label: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Price</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={item.price}
                  onChange={(e) => setItem(item.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.recurring}
                    onChange={(e) => setItem(item.key, { recurring: e.target.checked })}
                  />
                  Recurring monthly
                </label>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => setItem(item.key, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="flex items-end justify-end">
                {item.stripePriceId ? (
                  <Badge variant="success">Stripe synced</Badge>
                ) : (
                  <Badge variant="warning">Not on Stripe yet</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        Stripe note: Stripe prices are immutable. Every save that changes a price creates a new Stripe Price object and
        centers are checked out against the new price automatically. Old prices stay in the Stripe dashboard and can be
        deactivated there. If Stripe keys are not set yet, the config still saves — Stripe prices sync the first time
        keys are present.
      </p>
    </div>
  );
}

// Tiny internal mutation helper (keeps this file free of extra deps).
type MutateFn = (url: string, method: 'PUT' | 'POST', body: unknown) => Promise<any>;
function useMutationCustom(opts: {
  onSuccess: (data: any) => void;
  onError: (err: any) => void;
}): { mutate: MutateFn; pending: boolean } {
  const [pending, setPending] = useState(false);
  const mutate: MutateFn = async (url, method, body) => {
    setPending(true);
    try {
      const res = await api.request({ url, method, data: body });
      opts.onSuccess(res.data);
    } catch (err) {
      opts.onError(err);
    } finally {
      setPending(false);
    }
  };
  return { mutate, pending };
}
