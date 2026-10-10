'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Clock, MapPin, User, Play, FileText, AlertCircle, CalendarDays, ListChecks,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function MyDayPage() {
  const { user } = useAuth();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['my-day'],
    queryFn: async () => {
      const { data } = await api.get('/sessions/calendar', {
        params: {
          start: todayStart.toISOString(),
          end: todayEnd.toISOString(),
        },
      });
      return data.sessions || [];
    },
    refetchInterval: 30000,
  });

  // Sort upcoming-first: scheduled then in-progress on top.
  const order: Record<string, number> = { IN_PROGRESS: 0, SCHEDULED: 1, COMPLETED: 2, CANCELLED: 3 };
  const sorted = [...(sessions || [])].sort(
    (a: any, b: any) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
      new Date(a.startedAt || a.scheduledFor || 0).getTime() -
        new Date(b.startedAt || b.scheduledFor || 0).getTime()
  );

  const pendingNotes = sorted.filter(
    (s: any) => s.status === 'COMPLETED' && (!s.soapNote || !s.soapNote.isFinalized)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Day</h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <CalendarDays className="h-8 w-8 text-indigo-200" />
      </div>

      {/* Wrap-up nudge */}
      {pendingNotes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                {pendingNotes.length} session note{pendingNotes.length > 1 ? 's' : ''} to finish today
              </p>
              <p className="text-xs text-amber-700">
                Auto-SOAP will have it drafted in 2 minutes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <CalendarDays className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-sm text-gray-500">No sessions today</p>
          <Link href="/dashboard/calendar" className="mt-2 inline-block text-sm text-indigo-600">
            View full calendar →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s: any) => {
            const time = s.startedAt || s.scheduledFor;
            const isNext = s.status === 'SCHEDULED' && !sorted.some(
              (x: any, i: number) => i < sorted.indexOf(s) && x.status === 'SCHEDULED'
            );
            return (
              <Link key={s.id} href={`/dashboard/sessions/${s.id}`} className="block">
                <Card
                  className={`transition-shadow ${isNext ? 'border-indigo-300 shadow-md' : ''} ${s.status === 'COMPLETED' ? 'opacity-75' : ''}`}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {time
                          ? new Date(time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : '—'}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          s.status === 'IN_PROGRESS' ? 'bg-emerald-100 text-emerald-700'
                            : s.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700'
                            : s.status === 'COMPLETED' ? 'bg-gray-100 text-gray-600'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {s.status === 'IN_PROGRESS' ? 'Running' : s.status === 'SCHEDULED' ? 'Booked' : s.status === 'COMPLETED' ? 'Done' : 'Cancelled'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {s.student?.name || 'Student'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {s.location}
                          </span>
                        )}
                        {s.therapist && s.therapist.id !== user?.id && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {s.therapist.name}
                          </span>
                        )}
                        {s.status === 'COMPLETED' && (!s.soapNote || !s.soapNote.isFinalized) && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <FileText className="h-3 w-3" />
                            Note pending
                          </span>
                        )}
                      </div>
                    </div>
                    {s.status === 'SCHEDULED' && (
                      <Button size="sm" className="shrink-0">
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Begin
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
