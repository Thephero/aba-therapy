'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Calendar, User, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

export default function StudentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user?.role === 'center_admin' || user?.role === 'supervisor';
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', dateOfBirth: '', guardianName: '', guardianEmail: '', guardianPhone: '',
  });
  // Set when the API returns 402 (plan limit / subscription) — the typed
  // form stays intact so the admin can upgrade and simply retry.
  const [limitError, setLimitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['students', search],
    queryFn: async () => {
      const { data } = await api.get('/students', { params: { search: search || undefined } });
      return data.students;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      setLimitError(null);
      const payload: any = { name: form.name };
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.guardianName) payload.guardianName = form.guardianName;
      if (form.guardianEmail) payload.guardianEmail = form.guardianEmail;
      if (form.guardianPhone) payload.guardianPhone = form.guardianPhone;
      await api.post('/students', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowAddModal(false);
      setForm({ name: '', dateOfBirth: '', guardianName: '', guardianEmail: '', guardianPhone: '' });
      showToast('Student added successfully', 'success');
    },
    onError: (err: any) => {
      // At the plan limit / subscription expired? Show the inline upgrade
      // banner instead of a dead-end toast — keep the typed form intact.
      if (err?.response?.status === 402) {
        setLimitError(err.response.data?.error || 'Your plan limit has been reached. Upgrade to add more students.');
      } else {
        showToast(err?.response?.data?.error || 'Failed to add student. Please try again.', 'error');
      }
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
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-500">Manage student profiles and program assignments</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="col-span-full rounded-lg border border-red-200 bg-red-50 py-8 text-center text-sm text-red-700">
            Unable to load students. {error instanceof Error ? error.message : 'Please refresh and try again.'}
          </div>
        ) : data?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            No students found
          </div>
        ) : (
          data?.map((student: any) => (
            <Link key={student.id} href={`/dashboard/students/${student.id}`}>
              <Card className="cursor-pointer transition-all hover:shadow-md hover:border-indigo-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-lg">
                      {student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{student.name}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {student.dateOfBirth ? formatDate(student.dateOfBirth) : '—'}
                        </span>
                        <Badge variant={student.isActive ? 'success' : 'danger'} className="text-[10px] px-1.5">
                          {student.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {/* Assigned supervisors & therapists */}
                      {(student.supervisors?.length > 0 || student.therapists?.length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {student.supervisors?.slice(0, 2).map((s: any) => (
                            <Badge key={s.supervisor.id} variant="success" className="text-[10px]">
                              {s.supervisor.name}
                            </Badge>
                          ))}
                          {student.supervisors?.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{student.supervisors.length - 2}</span>
                          )}
                          {student.therapists?.slice(0, 2).map((t: any) => (
                            <Badge key={t.therapist.id} variant="primary" className="text-[10px]">
                              {t.therapist.name}
                            </Badge>
                          ))}
                          {student.therapists?.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{student.therapists.length - 2}</span>
                          )}
                        </div>
                      )}
                      {student.programs?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {student.programs.slice(0, 3).map((p: any) => (
                            <Badge key={p.id} variant="outline" className="text-[10px]">
                              {p.name}
                            </Badge>
                          ))}
                          {student.programs.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{student.programs.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Add Student Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Student"
        description="Add a new student to the center"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Student's full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
            <Input
              value={form.guardianName}
              onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
              placeholder="Guardian's full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Email</label>
            <Input
              type="email"
              value={form.guardianEmail}
              onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
              placeholder="guardian@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label>
            <Input
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
          {limitError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">You've reached your plan limit</p>
              <p className="mt-1 text-xs text-amber-800">{limitError}</p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href="/dashboard/billing"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Upgrade plan →
                </Link>
                <button
                  type="button"
                  className="text-xs font-medium text-amber-800 underline"
                  onClick={() => addMutation.mutate()}
                >
                  Try again after upgrading
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-amber-700">
                Everything you've typed stays here — upgrade, come back, and add {form.name || 'the student'}.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            {!limitError && addMutation.isError && (
              <p className="mr-auto self-center text-sm text-red-600">
                {(addMutation.error as any)?.response?.data?.error || 'Unable to add student. Check the API connection and try again.'}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
