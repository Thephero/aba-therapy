'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const { data: stats } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const [students, sessions] = await Promise.all([
        api.get('/students').catch(() => ({ data: { students: [] } })),
        api.get('/sessions').catch(() => ({ data: { sessions: [] } })),
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
      };
    },
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Track progress, session trends, and program effectiveness</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{stats?.totalSessions || 0}</p>
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
                <p className="mt-1 text-3xl font-bold text-emerald-600">{stats?.completedSessions || 0}</p>
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
                <p className="mt-1 text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
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
