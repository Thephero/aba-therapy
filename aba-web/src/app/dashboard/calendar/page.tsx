'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  Clock, User, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

const statusDotColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for the visible month (extend to full weeks)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const endPad = 6 - lastDay.getDay();
  const totalDays = lastDay.getDate();

  const startDate = new Date(year, month, 1 - startPad);
  const endDate = new Date(year, month + 1, 0 + endPad + 1); // exclusive end

  // Fetch sessions for the visible date range
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-sessions', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data } = await api.get('/sessions/calendar', {
        params: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });
      return data.sessions as any[];
    },
  });

  // Group sessions by date key (YYYY-MM-DD)
  const sessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!data) return map;
    for (const session of data) {
      const dateKey = session.scheduledFor
        ? session.scheduledFor.split('T')[0]
        : session.startedAt
          ? session.startedAt.split('T')[0]
          : null;
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(session);
      }
    }
    return map;
  }, [data]);

  // Build the grid
  const gridDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean; sessions: any[] }[] = [];
    const d = new Date(startDate);
    while (d < endDate) {
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: new Date(d),
        isCurrentMonth: d.getMonth() === month,
        sessions: sessionsByDate[dateStr] || [],
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [startDate, endDate, month, sessionsByDate]);

  const todayStr = new Date().toISOString().split('T')[0];

  const navigate = (delta: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // Stats for the selected month
  const monthStats = useMemo(() => {
    if (!data) return { total: 0, scheduled: 0, inProgress: 0, completed: 0 };
    const sessions = data.filter((s: any) => {
      const d = s.scheduledFor || s.startedAt;
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === month && dt.getFullYear() === year;
    });
    return {
      total: sessions.length,
      scheduled: sessions.filter((s: any) => s.status === 'SCHEDULED').length,
      inProgress: sessions.filter((s: any) => s.status === 'IN_PROGRESS').length,
      completed: sessions.filter((s: any) => s.status === 'COMPLETED').length,
    };
  }, [data, month, year]);

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage scheduled sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/sessions">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Clock className="h-4 w-4" />
              List View
            </Button>
          </Link>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: monthStats.total, color: 'text-gray-900' },
          { label: 'Scheduled', value: monthStats.scheduled, color: 'text-blue-600' },
          { label: 'In Progress', value: monthStats.inProgress, color: 'text-amber-600' },
          { label: 'Completed', value: monthStats.completed, color: 'text-emerald-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)} className="gap-1">
            Next
            <span className="h-4 w-4 flex items-center justify-center text-sm leading-none">→</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="gap-1">
            <CalendarIcon className="h-4 w-4" />
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_NAMES.map((name) => (
            <div key={name} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
              {name}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-7" style={{ minHeight: 600 }}>
            {gridDays.map((day, idx) => {
              const dateStr = day.date.toISOString().split('T')[0];
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className={`relative min-h-[120px] border-b border-r border-gray-100 p-1.5 transition-colors ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                  } ${isToday ? 'ring-2 ring-indigo-400 ring-inset z-10' : ''}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-center mb-1">
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                        isToday
                          ? 'bg-indigo-600 text-white'
                          : day.isCurrentMonth
                            ? 'text-gray-700'
                            : 'text-gray-400'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>

                  {/* Session indicators */}
                  <div className="space-y-0.5">
                    {day.sessions.slice(0, 3).map((session: any) => (
                      <Link
                        key={session.id}
                        href={`/dashboard/sessions/${session.id}`}
                        className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium border transition-opacity hover:opacity-80 ${
                          statusColors[session.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColors[session.status] || 'bg-gray-400'}`} />
                          <span className="truncate">{session.student?.name || '?'}</span>
                        </div>
                      </Link>
                    ))}
                    {day.sessions.length > 3 && (
                      <div className="text-[10px] text-gray-400 text-center font-medium">
                        +{day.sessions.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upcoming Sessions List */}
      {data && data.filter((s: any) => s.status === 'SCHEDULED').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              Upcoming Scheduled Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data
                .filter((s: any) => s.status === 'SCHEDULED')
                .sort((a: any, b: any) => {
                  const aDate = a.scheduledFor ? new Date(a.scheduledFor) : new Date();
                  const bDate = b.scheduledFor ? new Date(b.scheduledFor) : new Date();
                  return aDate.getTime() - bDate.getTime();
                })
                .slice(0, 10)
                .map((session: any) => (
                  <Link
                    key={session.id}
                    href={`/dashboard/sessions/${session.id}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <CalendarIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session.student?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {session.therapist?.name || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.scheduledFor
                            ? new Date(session.scheduledFor).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Scheduled</Badge>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
