'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Users, GraduationCap, Activity,
  AlertTriangle, CheckCircle2, Clock, RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { TrendIndicator } from '@/components/ui/trend-indicator';
import { Sparkline } from '@/components/ui/sparkline';
import { useAuth } from '@/contexts/AuthContext';
import { FileText } from 'lucide-react';

type Period = 'today' | 'week' | 'month';

interface SummaryData {
  totalStudents: number;
  activeStudents: number;
  totalStaff: number;
  pendingNotes: number;
  sessionsToday: number;
  scheduledToday: number;
  periodCompleted: number;
  periodInProgress: number;
  periodTotal: number;
  periodTrials: number;
  periodBehaviors: number;
  period: Period;
  trends?: {
    sessionsToday: number | null;
    periodCompleted: number | null;
    periodInProgress: number | null;
    periodTotal: number | null;
    periodTrials: number | null;
    periodBehaviors: number | null;
    newStudents: number | null;
    newStaff: number | null;
  };
  series?: Array<{
    date: string;
    sessions: number;
    completed: number;
    inProgress: number;
    trials: number;
    behaviors: number;
    newStudents: number;
    newStaff: number;
  }>;
}

export function MiniDashboard() {
  const [period, setPeriod] = useState<Period>('today');
  const { user } = useAuth();
  const isTherapist = user?.role === 'therapist';
  const isAdmin = user?.role === 'center_admin';
  const isParent = user?.role === 'parent';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary', period],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/summary?period=${period}`);
      return data.summary as SummaryData;
    },
    refetchInterval: 60000, // auto-refresh every 60s
  });

  const periodLabel = period === 'today' ? "Today's" : period === 'week' ? "This Week's" : "This Month's";

  return (
    <Card className="mb-6 overflow-hidden border-gray-200">
      <div className="p-4">
        {/* Header with period toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100">
              <Calendar className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Activity Overview</h2>
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                  period === p
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Pending Notes — primary card for therapists, also useful for supervisors */}
            {!isAdmin && (
              <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Pending Notes</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <p className="text-lg font-bold text-gray-900">{data.pendingNotes ?? 0}</p>
                  {data.pendingNotes > 0 && <Badge variant="warning" className="text-[10px]">needs writing</Badge>}
                </div>
                <p className="text-[10px] text-gray-400">
                  {data.pendingNotes === 0
                    ? 'All caught up — nice work!'
                    : 'Completed sessions without finalized notes'}
                </p>
              </div>
            )}
            {/* Total Students */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Students</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-lg font-bold text-gray-900">{data.totalStudents}</p>
                {data.trends && <TrendIndicator value={data.trends.newStudents} />}
              </div>
              <Sparkline data={(data.series || []).map((d) => d.newStudents)} color="#2563eb" width={88} height={18} className="mt-1" />
              <p className="text-[10px] text-gray-400">
                {data.activeStudents} active today
              </p>
            </div>

            {/* Staff — admin/supervisor only (therapist & parent don't need it) */}
            {!isTherapist && !isParent && (
              <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50">
                    <Users className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Staff</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <p className="text-lg font-bold text-gray-900">{data.totalStaff}</p>
                  {data.trends && <TrendIndicator value={data.trends.newStaff} />}
                </div>
                <Sparkline data={(data.series || []).map((d) => d.newStaff)} color="#9333ea" width={88} height={18} className="mt-1" />
                <p className="text-[10px] text-gray-400">active personnel</p>
              </div>
            )}

            {/* Sessions Today — run vs scheduled */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sessions</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-lg font-bold text-gray-900">{data.sessionsToday}</p>
                {data.trends && <TrendIndicator value={data.trends.sessionsToday} />}
              </div>
              <Sparkline data={(data.series || []).map((d) => d.sessions)} color="#059669" width={88} height={18} className="mt-1" />
              <p className="text-[10px] text-gray-400">
                {data.sessionsToday} run · {data.scheduledToday || 0} scheduled today
              </p>
            </div>

            {/* Completed / In Progress */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-amber-200 hover:bg-amber-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
                  <Activity className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{periodLabel}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {data.periodCompleted}
                  {data.trends && <TrendIndicator value={data.trends.periodCompleted} compact />}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="h-3 w-3" />
                  {data.periodInProgress}
                </span>
              </div>
              <Sparkline data={(data.series || []).map((d) => d.completed)} color="#d97706" width={88} height={18} className="mt-1" />
              <p className="text-[10px] text-gray-400">{data.periodTotal} total</p>
            </div>

            {/* Trials */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50">
                  <Activity className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Trials</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-lg font-bold text-gray-900">{data.periodTrials}</p>
                {data.trends && <TrendIndicator value={data.trends.periodTrials} />}
              </div>
              <Sparkline data={(data.series || []).map((d) => d.trials)} color="#4f46e5" width={88} height={18} className="mt-1" />
              <p className="text-[10px] text-gray-400">{periodLabel.toLowerCase()} total</p>
            </div>

            {/* Behaviors */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-red-200 hover:bg-red-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Behaviors</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-lg font-bold text-gray-900">{data.periodBehaviors}</p>
                {data.trends && <TrendIndicator value={data.trends.periodBehaviors} invert />}
              </div>
              <Sparkline data={(data.series || []).map((d) => d.behaviors)} color="#ef4444" width={88} height={18} className="mt-1" />
              <p className="text-[10px] text-gray-400">{periodLabel.toLowerCase()} recorded</p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-gray-400">
            Could not load activity data
          </div>
        )}
      </div>
    </Card>
  );
}
