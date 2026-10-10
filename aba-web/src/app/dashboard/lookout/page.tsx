'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  AlertTriangle, PenLine, ChevronRight, ClipboardCheck, Activity,
} from 'lucide-react';

export default function LookoutPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'risk' | 'cosign'>('risk');

  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-overview'],
    queryFn: async () => {
      const { data } = await api.get('/supervisor/overview');
      return data;
    },
    refetchInterval: 60000,
  });

  const signMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/sessions/${sessionId}/soap/cosign`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supervisor-overview'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const students = data?.students || [];
  const cosignQueue = data?.cosignQueue || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lookout</h1>
        <p className="mt-1 text-sm text-gray-500">
          Who needs attention this week — stalling targets, accuracy drops, overdue notes.
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.totals?.atRisk ?? 0}</p>
              <p className="text-xs text-gray-500">Students needing attention</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <PenLine className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.totals?.pendingCosign ?? 0}</p>
              <p className="text-xs text-gray-500">Notes awaiting signature</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'risk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('risk')}
        >
          At-risk students
        </Button>
        <Button
          variant={tab === 'cosign' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('cosign')}
        >
          Co-sign queue {cosignQueue.length > 0 && `(${cosignQueue.length})`}
        </Button>
      </div>

      {tab === 'risk' ? (
        <Card>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No students on your caseload</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {students.map((s: any) => (
                  <Link
                    key={s.studentId}
                    href={`/dashboard/students?studentId=${s.studentId}`}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${s.riskScore > 0 ? '' : 'opacity-70'}`}
                  >
                    <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      s.riskScore >= 3 ? 'bg-red-100 text-red-700'
                        : s.riskScore > 0 ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {s.riskScore}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{s.studentName}</p>
                        {s.thisWeekAccuracy != null && (
                          <span className="text-xs text-gray-400">
                            accuracy {s.thisWeekAccuracy}%
                            {s.lastWeekAccuracy != null && ` (last week ${s.lastWeekAccuracy}%)`}
                          </span>
                        )}
                        {s.pendingCosign > 0 && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {s.pendingCosign} note{s.pendingCosign > 1 ? 's' : ''} to review
                          </span>
                        )}
                      </div>
                      {s.signals.length > 0 ? (
                        <ul className="mt-0.5 space-y-0.5">
                          {s.signals.slice(0, 3).map((sig: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600">⚠ {sig}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-0.5 text-xs text-emerald-600">All clear this week</p>
                      )}
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 text-gray-300" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {cosignQueue.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardCheck className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                <p className="text-sm text-gray-500">Queue clear — nothing awaiting signature</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {cosignQueue.map((n: any) => (
                  <div key={n.sessionId} className="flex items-center gap-3 px-4 py-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      n.stale ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <PenLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/sessions/${n.sessionId}`}
                          className="text-sm font-semibold text-gray-900 hover:text-indigo-600"
                        >
                          {n.studentName} · session note
                        </Link>
                        {n.stale && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            {n.ageDays}d old
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {n.therapistName} · {n.trials} trials ·{' '}
                        {n.endedAt ? new Date(n.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={signMutation.isPending}
                      onClick={() => signMutation.mutate(n.sessionId)}
                    >
                      Sign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
