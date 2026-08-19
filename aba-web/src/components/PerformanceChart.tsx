'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, TrendingDown, Minus, 
  CheckCircle2, Activity, BarChart3 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';

interface PerformanceChartProps {
  studentId: string;
}

export function PerformanceChart({ studentId }: PerformanceChartProps) {
  // Fetch sessions data for the last 30 days
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['parent-performance', studentId],
    queryFn: async () => {
      const { data } = await api.get('/sessions');
      return data.sessions || [];
    },
    enabled: !!studentId,
  });

  // Process sessions into daily data for the last 30 days
  const chartData = (() => {
    if (!sessions || sessions.length === 0) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Group sessions by date
    const sessionsByDate: Record<string, { completed: number; trials: number }> = {};
    
    // Initialize all dates in the range
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      sessionsByDate[dateKey] = { completed: 0, trials: 0 };
    }

    // Count sessions per day
    sessions.forEach((session: any) => {
      const sessionDate = session.startedAt || session.scheduledFor;
      if (!sessionDate) return;

      const date = new Date(sessionDate);
      if (date < thirtyDaysAgo) return;

      const dateKey = date.toISOString().split('T')[0];
      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = { completed: 0, trials: 0 };
      }

      if (session.status === 'COMPLETED') {
        sessionsByDate[dateKey].completed += 1;
      }
      
      // Count trials if available
      if (session._count?.trials) {
        sessionsByDate[dateKey].trials += session._count.trials;
      }
    });

    // Convert to array and format for chart
    return Object.entries(sessionsByDate)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        fullDate: date,
        sessions: data.completed,
        trials: data.trials,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  })();

  // Calculate summary stats
  const stats = (() => {
    if (chartData.length === 0) {
      return { totalSessions: 0, totalTrials: 0, avgSessionsPerWeek: 0, trend: 0 };
    }

    const totalSessions = chartData.reduce((sum, d) => sum + d.sessions, 0);
    const totalTrials = chartData.reduce((sum, d) => sum + d.trials, 0);
    const weeks = chartData.length / 7;
    const avgSessionsPerWeek = weeks > 0 ? Math.round(totalSessions / weeks) : 0;

    // Calculate trend (last 7 days vs previous 7 days)
    const last7 = chartData.slice(-7);
    const prev7 = chartData.slice(-14, -7);
    const last7Sessions = last7.reduce((sum, d) => sum + d.sessions, 0);
    const prev7Sessions = prev7.reduce((sum, d) => sum + d.sessions, 0);
    
    let trend = 0;
    if (prev7Sessions > 0) {
      trend = Math.round(((last7Sessions - prev7Sessions) / prev7Sessions) * 100);
    } else if (last7Sessions > 0) {
      trend = 100; // New activity
    }

    return { totalSessions, totalTrials, avgSessionsPerWeek, trend };
  })();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-gray-500">
            <BarChart3 className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">No session data available yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Progress charts will appear once sessions are completed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Progress Overview
          </span>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Sessions: {stats.totalSessions}
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Activity className="h-4 w-4 text-blue-500" />
              Trials: {stats.totalTrials}
            </div>
            <div className="flex items-center gap-1">
              {stats.trend > 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : stats.trend < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <Minus className="h-4 w-4 text-gray-400" />
              )}
              <span className={`font-medium ${
                stats.trend > 0 ? 'text-emerald-600' : 
                stats.trend < 0 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {stats.trend > 0 ? '+' : ''}{stats.trend}%
              </span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="sessions" 
                stroke="#6366f1" 
                fillOpacity={1} 
                fill="url(#colorSessions)"
                strokeWidth={2}
                name="Sessions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-indigo-500" />
            <span>Sessions Completed</span>
          </div>
          <div className="text-gray-400">
            Average: {stats.avgSessionsPerWeek} sessions/week
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
