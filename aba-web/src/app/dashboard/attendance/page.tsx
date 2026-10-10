'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarCheck2, Wallet, User, Info } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { plainStatus } from '@/components/parent/glossary';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'ATTENDING', label: 'Attended', className: 'bg-emerald-600' },
  { value: 'LATE', label: 'Late', className: 'bg-amber-500' },
  { value: 'ABSENT', label: 'Missed', className: 'bg-red-500' },
  { value: 'SICK', label: 'Sent home sick', className: 'bg-orange-500' },
];

const STATUS_STYLES: Record<string, string> = {
  ATTENDING: 'bg-emerald-100 text-emerald-800',
  LATE: 'bg-amber-100 text-amber-800',
  ABSENT: 'bg-red-100 text-red-800',
  SICK: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: students } = useQuery({
    queryKey: ['attendance-students'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return data.students || [];
    },
  });

  const { data: records } = useQuery({
    queryKey: ['attendance', selectedDate],
    queryFn: async () => {
      const { data } = await api.get('/attendance', {
        params: { from: selectedDate, to: `${selectedDate}T23:59:59` },
      });
      return data.records || [];
    },
  });

  const { data: billing } = useQuery({
    queryKey: ['attendance-billing'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/billing-summary');
      return data;
    },
  });

  const markMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      await api.post('/attendance', {
        studentId,
        date: `${selectedDate}T09:00:00.000Z`,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-billing'] });
    },
  });

  const recordFor = (studentId: string) =>
    (records || []).find((r: any) => r.studentId === studentId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Mark who came in today. Attended sessions feed the parent billing summary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Billing summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-400" />
            Parent billing summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(billing?.billing || []).length === 0 ? (
            <p className="text-sm text-gray-400">No students yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 px-4">Attended</th>
                    <th className="pb-2 px-4">Missed</th>
                    <th className="pb-2 px-4 text-right">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {(billing?.billing || []).map((b: any) => (
                    <tr key={b.studentId} className="border-b border-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{b.studentName}</td>
                      <td className="py-2 px-4 text-emerald-700 font-medium">{b.attendedSessions}</td>
                      <td className="py-2 px-4 text-gray-500">{b.missedSessions}</td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900">
                        {b.currency} {b.amountOwed.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!billing?.sessionRate && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Amounts show once <code className="bg-blue-100 rounded px-1">SESSION_RATE_AED</code> is
                set on the server (e.g. 200 = AED 200 per attended session). Session counts work already.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark attendance for the selected date */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-gray-400" />
            {formatDate(`${selectedDate}T00:00:00`)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(students || []).length === 0 ? (
            <p className="text-sm text-gray-400">No active students.</p>
          ) : (
            <div className="space-y-2">
              {(students || []).map((s: any) => {
                const record = recordFor(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      {record && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[record.status] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {plainStatus(record.status)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant={record?.status === opt.value ? 'default' : 'outline'}
                          className={record?.status === opt.value ? opt.className : ''}
                          disabled={markMutation.isPending}
                          onClick={() => markMutation.mutate({ studentId: s.id, status: opt.value })}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
