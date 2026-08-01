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

type Period = 'today' | 'week' | 'month';

interface SummaryData {
  totalStudents: number;
  activeStudents: number;
  totalStaff: number;
  sessionsToday: number;
  periodCompleted: number;
  periodInProgress: number;
  periodTotal: number;
  periodTrials: number;
  periodBehaviors: number;
  period: Period;
}

export function MiniDashboard() {
  const [period, setPeriod] = useState<Period>('today');

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
            {/* Total Students */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Students</span>
              </div>
              <p className="mt-1.5 text-lg font-bold text-gray-900">{data.totalStudents}</p>
              <p className="text-[10px] text-gray-400">
                {data.activeStudents} active today
              </p>
            </div>

            {/* Staff */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50">
                  <Users className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Staff</span>
              </div>
              <p className="mt-1.5 text-lg font-bold text-gray-900">{data.totalStaff}</p>
              <p className="text-[10px] text-gray-400">active personnel</p>
            </div>

            {/* Sessions Today */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sessions</span>
              </div>
              <p className="mt-1.5 text-lg font-bold text-gray-900">{data.sessionsToday}</p>
              <p className="text-[10px] text-gray-400">today</p>
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
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="h-3 w-3" />
                  {data.periodInProgress}
                </span>
              </div>
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
              <p className="mt-1.5 text-lg font-bold text-gray-900">{data.periodTrials}</p>
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
              <p className="mt-1.5 text-lg font-bold text-gray-900">{data.periodBehaviors}</p>
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
