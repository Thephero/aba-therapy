'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, AlertTriangle, ArrowLeft } from 'lucide-react';
import { TrendIndicator } from '@/components/ui/trend-indicator';
import { Sparkline } from '@/components/ui/sparkline';
import Link from 'next/link';

type TrendPeriod = 'today' | 'week' | 'month';

export default function ReportsPage() {
  const [period, setPeriod] = useState<TrendPeriod>('today');

  const { data: stats } = useQuery({
    queryKey: ['reports', period],
    queryFn: async () => {
      const [students, sessions, summary] = await Promise.all([
        api.get('/students').catch(() => ({ data: { students: [] } })),
        api.get('/sessions').catch(() => ({ data: { sessions: [] } })),
        api.get(`/dashboard/summary?period=${period}`).catch(() => ({ data: { summary: { trends: {}, series: [] } } })),
      ]);
      const allSessions = sessions.data.sessions || [];
      const allStudents = students.data.students || [];

      const sessionsByStudent: Record<string, number> = {};
      allSessions.forEach((s: any) => {
        const name = s.student?.name || 'Unknown';
        sessionsByStudent[name] = (sessionsByStudent[name] || 0) + 1;
      });

      return {
        totalSessions: allSessions.length,
        totalStudents: allStudents.length,
        completedSessions: allSessions.filter((s: any) => s.status === 'COMPLETED').length,
        inProgressSessions: allSessions.filter((s: any) => s.status === 'IN_PROGRESS').length,
        cancelledSessions: allSessions.filter((s: any) => s.status === 'CANCELLED').length,
        sessionsByStudent,
        trends: (summary.data.summary as any)?.trends || {},
        series: (summary.data.summary as any)?.series || [],
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Back to Dashboard */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Track progress, session trends, and program effectiveness</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['today', 'week', 'month'] as TrendPeriod[]).map((p) => (
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

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalSessions || 0}</p>
                  <TrendIndicator value={stats?.trends?.periodTotal} />
                </div>
                <div className="mt-2">
                  <Sparkline data={((stats?.series || []) as any[]).map((d) => d.sessions as number)} color="#6366f1" width={120} height={28} />
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <BarChart3 className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-3xl font-bold text-emerald-600">{stats?.completedSessions || 0}</p>
                  <TrendIndicator value={stats?.trends?.periodCompleted} />
                </div>
                <div className="mt-2">
                  <Sparkline data={((stats?.series || []) as any[]).map((d) => d.completed as number)} color="#059669" width={120} height={28} />
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Students</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
                  <TrendIndicator value={stats?.trends?.newStudents} />
                </div>
                <div className="mt-2">
                  <Sparkline data={((stats?.series || []) as any[]).map((d) => d.newStudents as number)} color="#d97706" width={120} height={28} />
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sessions by Student */}
        <Card>
          <CardHeader>
            <CardTitle>Sessions by Student</CardTitle>
            <CardDescription>Total sessions completed per student</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.sessionsByStudent && Object.keys(stats.sessionsByStudent).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.sessionsByStudent)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-32 truncate text-sm font-medium text-gray-700">{name}</span>
                      <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all"
                          style={{
                            width: `${Math.min(100, ((count as number) / Math.max(...Object.values(stats.sessionsByStudent) as number[])) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold text-gray-600">{count as number}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No session data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Session Status Overview</CardTitle>
            <CardDescription>Current distribution of session statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Completed', count: stats?.completedSessions || 0, color: 'bg-emerald-500', badge: 'success' as const },
                { label: 'In Progress', count: stats?.inProgressSessions || 0, color: 'bg-amber-500', badge: 'warning' as const },
                { label: 'Cancelled', count: stats?.cancelledSessions || 0, color: 'bg-red-500', badge: 'danger' as const },
              ].filter(item => item.count > 0).map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="font-medium text-gray-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900">{item.count}</span>
                    <Badge variant={item.badge}>
                      {stats?.totalSessions ? Math.round((item.count / stats.totalSessions) * 100) : 0}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
