'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, Clock, User, ArrowLeft, 
  CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useParentStudent } from '@/contexts/ParentStudentContext';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const statusDotColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Upcoming',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function ParentCalendarPage() {
  const { user } = useAuth();
  const { studentId } = useParentStudent();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for the visible month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const endPad = 6 - lastDay.getDay();

  const startDate = new Date(year, month, 1 - startPad);
  const endDate = new Date(year, month + 1, 0 + endPad + 1);

  // Fetch sessions for the visible date range
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['parent-calendar-sessions', studentId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data } = await api.get('/sessions/calendar', {
        params: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          studentId,
        },
      });
      return data.sessions as any[];
    },
  });

  // Group sessions by date key (YYYY-MM-DD)
  const sessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!sessions) return map;
    for (const session of sessions) {
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
  }, [sessions]);

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
    setSelectedDate(null);
  };

  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // Get sessions for selected date
  const selectedSessions = selectedDate ? sessionsByDate[selectedDate] || [] : [];

  // Split sessions into upcoming and past
  const now = new Date();
  const upcomingSessions = sessions
    ?.filter((s: any) => s.status === 'SCHEDULED')
    .sort((a: any, b: any) => {
      const aDate = a.scheduledFor ? new Date(a.scheduledFor) : new Date();
      const bDate = b.scheduledFor ? new Date(b.scheduledFor) : new Date();
      return aDate.getTime() - bDate.getTime();
    }) || [];

  const pastSessions = sessions
    ?.filter((s: any) => s.status === 'COMPLETED')
    .sort((a: any, b: any) => {
      const aDate = a.startedAt ? new Date(a.startedAt) : new Date();
      const bDate = b.startedAt ? new Date(b.startedAt) : new Date();
      return bDate.getTime() - aDate.getTime();
    }) || [];

  return (
    <div className="space-y-6">
      {/* Back to Dashboard */}
      <Link
        href="/dashboard/parent"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your child's therapy sessions
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Calendar */}
        <div className="lg:col-span-2 space-y-4">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span className="h-4 w-4">←</span>
              </button>
              <button
                onClick={() => navigate(1)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span className="h-4 w-4">→</span>
              </button>
              <button
                onClick={goToday}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <CalendarIcon className="h-4 w-4" />
                Today
              </button>
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
              <div className="grid grid-cols-7">
                {gridDays.map((day, idx) => {
                  const dateStr = day.date.toISOString().split('T')[0];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const hasSessions = day.sessions.length > 0;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative min-h-[100px] border-b border-r border-gray-100 p-1.5 text-left transition-all hover:bg-gray-50 ${
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                      } ${isToday ? 'ring-2 ring-indigo-400 ring-inset z-10' : ''} ${
                        isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300 ring-inset' : ''
                      }`}
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
                        {day.sessions.slice(0, 2).map((session: any) => (
                          <div
                            key={session.id}
                            className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              statusColors[session.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColors[session.status] || 'bg-gray-400'}`} />
                            <span className="truncate">
                              {session.scheduledFor 
                                ? new Date(session.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                : session.startedAt
                                  ? new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                  : ''
                              }
                            </span>
                          </div>
                        ))}
                        {day.sessions.length > 2 && (
                          <div className="text-[10px] text-gray-400 text-center font-medium">
                            +{day.sessions.length - 2} more
                          </div>
                        )}
                      </div>

                      {/* Today indicator */}
                      {isToday && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                          <span className="text-[9px] font-medium text-indigo-600">Today</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Selected Date Details */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedSessions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedSessions.map((session: any) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          session.status === 'COMPLETED' ? 'bg-emerald-100' :
                          session.status === 'SCHEDULED' ? 'bg-blue-100' :
                          session.status === 'IN_PROGRESS' ? 'bg-amber-100' :
                          'bg-gray-100'
                        }`}>
                          {session.status === 'COMPLETED' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : session.status === 'SCHEDULED' ? (
                            <CalendarIcon className="h-5 w-5 text-blue-600" />
                          ) : session.status === 'IN_PROGRESS' ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {session.student?.name || 'Session'}
                            </p>
                            <Badge variant="default" className={`text-[10px] ${statusColors[session.status] || ''}`}>
                              {statusLabels[session.status] || session.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.scheduledFor 
                                ? new Date(session.scheduledFor).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : session.startedAt
                                  ? new Date(session.startedAt).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : 'Time TBD'
                              }
                            </span>
                            {session.therapist && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {session.therapist.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-gray-500">
                    <CalendarIcon className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm">No sessions on this day</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Upcoming & Past Sessions */}
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                Upcoming Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.slice(0, 5).map((session: any) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-blue-100 bg-blue-50 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {session.scheduledFor
                            ? new Date(session.scheduledFor).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Date TBD'
                          }
                        </p>
                        <Badge variant="default" className="text-[10px] bg-blue-100 text-blue-700">
                          Upcoming
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.scheduledFor
                            ? new Date(session.scheduledFor).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Time TBD'
                          }
                        </span>
                        {session.therapist && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {session.therapist.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {upcomingSessions.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">
                      +{upcomingSessions.length - 5} more upcoming sessions
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-gray-500">
                  <CalendarIcon className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No upcoming sessions</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Completed Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pastSessions.length > 0 ? (
                <div className="space-y-3">
                  {pastSessions.slice(0, 5).map((session: any) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {session.startedAt
                            ? new Date(session.startedAt).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Date unknown'
                          }
                        </p>
                        <Badge variant="success" className="text-[10px]">
                          Completed
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {session.therapist && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {session.therapist.name}
                          </span>
                        )}
                        {session._count?.trials > 0 && (
                          <span>{session._count.trials} trials</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-gray-500">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No completed sessions yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(statusLabels).filter(([key]) => key !== 'IN_PROGRESS').map(([status, label]) => (
                  <div key={status} className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${statusDotColors[status]}`} />
                    <span className="text-sm text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
