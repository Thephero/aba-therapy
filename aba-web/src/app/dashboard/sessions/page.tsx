'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Search, Play, Calendar, Clock, User, CheckCircle2, Eye, ArrowLeft, Plus } from 'lucide-react';
import { formatDate, formatTime, formatStatus, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

const statusColors: Record<string, 'warning' | 'success' | 'default' | 'danger'> = {
  SCHEDULED: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const SESSION_MODALITIES = [
  { value: 'DTT', label: 'DTT (Discrete Trial Training)' },
  { value: 'NET', label: 'NET (Natural Environment Teaching)' },
  { value: 'GROUP', label: 'Group Skills' },
];

// Multi-select modality picker shared by Start/Schedule modals.
// ABA sessions routinely include several modalities at once (e.g. DTT + NET),
// so this replaces the old forced single-choice dropdown.
function ModalityPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {SESSION_MODALITIES.map((m) => {
        const checked = value.includes(m.value);
        return (
          <label
            key={m.value}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
              checked
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...value, m.value]);
                } else {
                  onChange(value.filter((v) => v !== m.value));
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            <span>{m.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function SessionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdminOrSupervisor = user?.role === 'center_admin' || user?.role === 'supervisor';
  const canStartSession = user?.role === 'center_admin' || user?.role === 'supervisor' || user?.role === 'therapist';
  const isParent = user?.role === 'parent';
  const [search, setSearch] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ studentId: '', sessionType: ['DTT'] as string[], location: '' });
  const [scheduleForm, setScheduleForm] = useState({
    studentId: '', therapistId: '', supervisorId: '',
    sessionType: ['DTT'] as string[], scheduledFor: '', programIds: [] as string[], location: '',
    repeatWeeks: 1,
  });
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', search],
    queryFn: async () => {
      const { data } = await api.get('/sessions', { params: { search: search || undefined } });
      return data.sessions;
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-for-session'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return data.students;
    },
  });

  const { data: therapistsData } = useQuery({
    queryKey: ['therapists-for-schedule'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'THERAPIST' } });
      return data.users;
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: supervisorsData } = useQuery({
    queryKey: ['supervisors-for-schedule'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'SUPERVISOR' } });
      return data.users;
    },
    enabled: user?.role === 'center_admin',
  });

  const { data: programsData } = useQuery({
    queryKey: ['programs-for-schedule'],
    queryFn: async () => {
      const { data } = await api.get('/programs');
      return data.programs;
    },
    enabled: isAdminOrSupervisor,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/sessions/start', sessionForm);
      return data.session;
    },
    onSuccess: (session: any) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setShowStartModal(false);
      setSessionForm({ studentId: '', sessionType: ['DTT'], location: '' });
      showToast('Session started', 'success');
      router.push(`/dashboard/sessions/${session.id}`);
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to start session', 'error');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      await api.post('/sessions/schedule', {
        ...scheduleForm,
        recurrence: scheduleForm.repeatWeeks > 1 ? { weeks: scheduleForm.repeatWeeks } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setShowScheduleModal(false);
      setScheduleForm({ studentId: '', therapistId: '', supervisorId: '', sessionType: ['DTT'], scheduledFor: '', programIds: [], location: '', repeatWeeks: 1 });
      showToast('Session scheduled', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to schedule session', 'error');
    },
  });

  const beginMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.patch(`/sessions/${sessionId}/begin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      showToast('Session started', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to begin session', 'error');
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage therapy sessions</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrSupervisor && (
            <Button variant="outline" onClick={() => setShowScheduleModal(true)}>
              <Calendar className="h-4 w-4" />
              Schedule
            </Button>
          )}
          {canStartSession && (
            <Button onClick={() => setShowStartModal(true)}>
              <Play className="h-4 w-4" />
              Start Session
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 font-medium text-gray-500">Student</th>
                    <th className="pb-3 font-medium text-gray-500">Therapist</th>
                    <th className="pb-3 font-medium text-gray-500">Date / Time</th>
                    <th className="pb-3 font-medium text-gray-500">Supervisor</th>
                    <th className="pb-3 font-medium text-gray-500">Status</th>
                    <th className="pb-3 font-medium text-gray-500">SOAP</th>
                    <th className="pb-3 font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.map((session: any) => {
                    const dateStr = session.scheduledFor
                      ? formatDateTime(session.scheduledFor)
                      : session.startedAt
                        ? formatDate(session.startedAt)
                        : '—';
                    return (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {session.student?.name || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          {session.therapist?.name || '—'}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {dateStr}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {session.supervisor?.name || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusColors[session.status] || 'default'}>
                          {formatStatus(session.status)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {session.soapNote?.isFinalized ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {session.status === 'SCHEDULED' && !isParent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Begin this scheduled session?')) {
                                  beginMutation.mutate(session.id);
                                }
                              }}
                              disabled={beginMutation.isPending}
                            >
                              <Play className="h-3.5 w-3.5" />
                              Begin
                            </Button>
                          )}
                          <Link href={`/dashboard/sessions/${session.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {(!data || data.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        No sessions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Session Modal */}
      <Modal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="Start New Session"
        description="Begin a new therapy session for a student"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
            <select
              value={sessionForm.studentId}
              onChange={(e) => setSessionForm({ ...sessionForm, studentId: e.target.value })}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Select a student...</option>
              {studentsData?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Modalities</label>
            <p className="mb-2 text-xs text-gray-400">Select all that will be worked on — most sessions include several.</p>
            <ModalityPicker
              value={sessionForm.sessionType}
              onChange={(v) => setSessionForm({ ...sessionForm, sessionType: v })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <Input
              value={sessionForm.location}
              onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
              placeholder="e.g., Room 101, Home, etc."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowStartModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={startMutation.isPending}>
              {startMutation.isPending ? 'Starting...' : 'Start Session'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Session Modal */}
      <Modal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Session"
        description="Create a scheduled session with therapist, student, and supervisor"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            scheduleMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
              <select
                value={scheduleForm.studentId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, studentId: e.target.value })}
                required
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">Select a student...</option>
                {studentsData?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Therapist *</label>
              <select
                value={scheduleForm.therapistId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, therapistId: e.target.value })}
                required
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">Select a therapist...</option>
                {therapistsData?.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
              <Input
                type="datetime-local"
                value={scheduleForm.scheduledFor}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledFor: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Modalities</label>
              <ModalityPicker
                value={scheduleForm.sessionType}
                onChange={(v) => setScheduleForm({ ...scheduleForm, sessionType: v })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
            <select
              value={scheduleForm.supervisorId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, supervisorId: e.target.value })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">No supervisor assigned</option>
              {supervisorsData?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Programs</label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
              {programsData?.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={scheduleForm.programIds.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setScheduleForm({ ...scheduleForm, programIds: [...scheduleForm.programIds, p.id] });
                      } else {
                        setScheduleForm({ ...scheduleForm, programIds: scheduleForm.programIds.filter(id => id !== p.id) });
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-gray-700">{p.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{p.student?.name || ''}</span>
                </label>
              ))}
              {(!programsData || programsData.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-2">No programs available</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <Input
              value={scheduleForm.location}
              onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
              placeholder="e.g., Room 101, Home, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repeat weekly</label>
            <select
              value={scheduleForm.repeatWeeks}
              onChange={(e) => setScheduleForm({ ...scheduleForm, repeatWeeks: parseInt(e.target.value) })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value={1}>One-off (this date only)</option>
              {[2, 4, 6, 8, 12, 16, 24].map((w) => (
                <option key={w} value={w}>Every week for {w} weeks ({w} sessions)</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Creates {scheduleForm.repeatWeeks > 1 ? `${scheduleForm.repeatWeeks} weekly sessions at the same day & time` : 'a single session at the chosen day & time'}.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
