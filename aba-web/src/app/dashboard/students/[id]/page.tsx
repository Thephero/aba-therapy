'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Calendar, Mail, Phone, User, BookOpen, AlertTriangle, Save, Archive, Users, Plus, X, Activity, Timer, Pencil,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function StudentDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdminOrSupervisor = user?.role === 'center_admin' || user?.role === 'supervisor';

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignSupervisorModal, setShowAssignSupervisorModal] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [showAssignTherapistModal, setShowAssignTherapistModal] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [editForm, setEditForm] = useState({
    name: '', dateOfBirth: '', guardianName: '', guardianEmail: '', guardianPhone: '',
  });

  // ── Parent account ──
  const [showParentModal, setShowParentModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState('');

  const { data: parentsList } = useQuery({
    queryKey: ['parents-for-link'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'PARENT' } });
      return data.users;
    },
    enabled: isAdminOrSupervisor,
  });

  // ── Behavior plans ──
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    dataType: 'FREQUENCY',
    antecedents: '',
    behaviors: '',
    consequences: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${id}`);
      return data.student;
    },
  });

  const { data: supervisorsList } = useQuery({
    queryKey: ['supervisors-for-assignment'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'SUPERVISOR' } });
      return data.users;
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: therapistsList } = useQuery({
    queryKey: ['therapists-for-student'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'THERAPIST' } });
      return data.users;
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: behaviorPlans } = useQuery({
    queryKey: ['behavior-plans', id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${id}/behavior-plans`);
      return data.plans;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: typeof editForm) => {
      const payload: any = { name: formData.name };
      if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
      if (formData.guardianName) payload.guardianName = formData.guardianName;
      if (formData.guardianEmail) payload.guardianEmail = formData.guardianEmail;
      if (formData.guardianPhone) payload.guardianPhone = formData.guardianPhone;
      await api.patch(`/students/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowEditModal(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      router.push('/dashboard/students');
    },
  });

  const assignSupervisorMutation = useMutation({
    mutationFn: async (supervisorId: string) => {
      await api.post(`/students/${id}/supervisors`, { supervisorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAssignSupervisorModal(false);
      setSelectedSupervisorId('');
      showToast('Supervisor assigned to student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to assign supervisor', 'error');
    },
  });

  const removeSupervisorMutation = useMutation({
    mutationFn: async (supervisorId: string) => {
      await api.delete(`/students/${id}/supervisors/${supervisorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Supervisor removed from student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to remove supervisor', 'error');
    },
  });

  const assignTherapistMutation = useMutation({
    mutationFn: async (therapistId: string) => {
      await api.post(`/students/${id}/therapists`, { therapistId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAssignTherapistModal(false);
      setSelectedTherapistId('');
      showToast('Therapist assigned to student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to assign therapist', 'error');
    },
  });

  const removeTherapistMutation = useMutation({
    mutationFn: async (therapistId: string) => {
      await api.delete(`/students/${id}/therapists/${therapistId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Therapist removed from student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to remove therapist', 'error');
    },
  });

  const linkParentMutation = useMutation({
    mutationFn: async (parentId: string) => {
      await api.patch(`/students/${id}`, { parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowParentModal(false);
      setSelectedParentId('');
      showToast('Parent account linked to student', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to link parent', 'error'),
  });

  const unlinkParentMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/students/${id}`, { parentId: '' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      showToast('Parent account unlinked', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to unlink parent', 'error'),
  });

  const savePlanMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingPlan) {
        await api.patch(`/behavior-plans/${editingPlan.id}`, body);
      } else {
        await api.post(`/students/${id}/behavior-plans`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavior-plans', id] });
      setShowPlanModal(false);
      setEditingPlan(null);
      showToast(editingPlan ? 'Behavior plan updated' : 'Behavior plan created', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to save behavior plan', 'error'),
  });

  const deactivatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.delete(`/behavior-plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavior-plans', id] });
      showToast('Behavior plan deactivated', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to deactivate plan', 'error'),
  });

  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', dataType: 'FREQUENCY', antecedents: '', behaviors: '', consequences: '' });
    setShowPlanModal(true);
  };

  const openEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      dataType: plan.dataType || 'FREQUENCY',
      antecedents: (plan.abcOptions?.antecedents || []).join(', '),
      behaviors: (plan.abcOptions?.behaviors || []).join(', '),
      consequences: (plan.abcOptions?.consequences || []).join(', '),
    });
    setShowPlanModal(true);
  };

  const submitPlan = () => {
    savePlanMutation.mutate({
      name: planForm.name,
      dataType: planForm.dataType,
      abcOptions: {
        antecedents: planForm.antecedents.split(',').map((s) => s.trim()).filter(Boolean),
        behaviors: planForm.behaviors.split(',').map((s) => s.trim()).filter(Boolean),
        consequences: planForm.consequences.split(',').map((s) => s.trim()).filter(Boolean),
      },
    });
  };

  const openEdit = () => {
    if (!data) return;
    setEditForm({
      name: data.name || '',
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
      guardianName: data.guardianName || '',
      guardianEmail: data.guardianEmail || '',
      guardianPhone: data.guardianPhone || '',
    });
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-gray-500">
        Student not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/students"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-2xl font-bold text-white">
            {data.name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <Badge variant={data.isActive ? 'success' : 'danger'}>
                {data.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {data.dateOfBirth && (
                <span className="text-sm text-gray-500">
                  <Calendar className="inline h-3.5 w-3.5 mr-1" />
                  Born {formatDate(data.dateOfBirth)}
                </span>
              )}
            </div>
          </div>
        </div>
        {isAdminOrSupervisor && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Save className="h-4 w-4" />
              Edit
            </Button>
            {data.isActive && (
              <Button
                variant="destructive"
                onClick={() => { if (confirm('Archive this student? This action cannot be undone.')) archiveMutation.mutate(); }}
                disabled={archiveMutation.isPending}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Guardian Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                Guardian Information
              </span>
              {isAdminOrSupervisor && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowParentModal(true)}>
                  <Plus className="h-3 w-3" />
                  {data.parent ? 'Change Parent Account' : 'Link Parent Account'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Linked parent account (for login access) */}
            {data.parent ? (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <p className="text-xs font-medium text-indigo-700">Parent login account</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{data.parent.name}</p>
                <p className="text-xs text-gray-500">{data.parent.email}</p>
                {isAdminOrSupervisor && (
                  <button
                    onClick={() => { if (confirm('Unlink this parent account? The parent will lose access to this child.')) unlinkParentMutation.mutate(); }}
                    className="mt-2 text-xs text-indigo-600 hover:text-red-600"
                  >
                    Unlink account
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No parent login account linked</p>
            )}

            {data.guardianName ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4 text-gray-400" />
                  {data.guardianName}
                </div>
                {data.guardianEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {data.guardianEmail}
                  </div>
                )}
                {data.guardianPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {data.guardianPhone}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No guardian contact recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Supervisors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                Supervisors
              </span>
              {isAdminOrSupervisor && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowAssignSupervisorModal(true)}>
                  <Plus className="h-3 w-3" /> Assign
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.supervisors?.length > 0 ? (
              <div className="space-y-2">
                {data.supervisors.map((s: any) => (
                  <div key={s.supervisor.id} className="flex items-center justify-between gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {s.supervisor.name.charAt(0)}
                      </div>
                      {s.supervisor.name}
                    </div>
                    {isAdminOrSupervisor && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove supervisor ${s.supervisor.name} from this student?`)) {
                            removeSupervisorMutation.mutate(s.supervisor.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No supervisors assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Therapists */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                Therapists
              </span>
              {isAdminOrSupervisor && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowAssignTherapistModal(true)}>
                  <Plus className="h-3 w-3" /> Assign
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.therapists?.length > 0 ? (
              <div className="space-y-2">
                {data.therapists.map((t: any) => (
                  <div key={t.therapist.id} className="flex items-center justify-between gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                        {t.therapist.name.charAt(0)}
                      </div>
                      {t.therapist.name}
                    </div>
                    {isAdminOrSupervisor && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove therapist ${t.therapist.name} from this student?`)) {
                            removeTherapistMutation.mutate(t.therapist.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No therapists assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Program stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-gray-400" />
                Programs
              </span>
              {isAdminOrSupervisor && (
                <Link href={`/dashboard/programs?studentId=${id}`}>
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs">
                    <Plus className="h-3 w-3" /> New
                  </Button>
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{data.programs?.length || 0}</p>
            <p className="mt-1 text-sm text-gray-500">Active programs</p>
            {data.programs?.length > 0 && (
              <Link
                href={`/dashboard/programs?studentId=${id}`}
                className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all programs →
              </Link>
            )}
            {data.programs?.length === 0 && (
              <Link
                href={`/dashboard/programs?studentId=${id}`}
                className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Create first program →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Programs list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gray-400" />
              Programs & Targets
            </span>
            {isAdminOrSupervisor && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 h-7 text-xs"
                  onClick={() => setShowAssignSupervisorModal(true)}
                >
                  <Users className="h-3 w-3" /> Supervisor
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 h-7 text-xs"
                  onClick={() => setShowAssignTherapistModal(true)}
                >
                  <User className="h-3 w-3" /> Therapist
                </Button>
                <Link href={`/dashboard/programs?studentId=${id}`}>
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs">
                    <Plus className="h-3 w-3" /> New Program
                  </Button>
                </Link>
              </div>
            )}
          </CardTitle>
        </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.programs?.length > 0 ? data.programs.map((program: any) => (
                <div key={program.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{program.name}</h3>
                      {program.description && (
                        <p className="mt-0.5 text-sm text-gray-500">{program.description}</p>
                      )}
                    </div>
                    <Badge variant={program.status === 'active' ? 'success' : 'warning'}>
                      {program.status || 'Active'}
                    </Badge>
                  </div>
                  {program.targets?.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {program.targets.map((target: any) => (
                        <div key={target.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                          <span className="text-gray-700">
                            <span className="font-medium">{target.domain}</span> — {target.skill}
                          </span>
                          <Badge variant={target.status === 'MASTERED' ? 'success' : target.status === 'IN_PROGRESS' ? 'warning' : 'default'}>
                            {target.status?.replace('_', ' ') || 'Pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  No programs created yet. Create one using the "New Program" button above.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Student" size="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(editForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
              placeholder="Student's full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <Input
              type="date"
              value={editForm.dateOfBirth}
              onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
            <Input
              value={editForm.guardianName}
              onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
              placeholder="Guardian's full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Email</label>
            <Input
              type="email"
              value={editForm.guardianEmail}
              onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
              placeholder="guardian@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label>
            <Input
              value={editForm.guardianPhone}
              onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Behavior Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-400" />
              Behavior Plans
            </span>
            {isAdminOrSupervisor && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={openNewPlan}>
                <Plus className="h-3 w-3" /> New Plan
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">
            Define how each challenging behavior is measured (frequency vs. duration) and which ABC options
            the therapist can pick from during sessions.
          </p>
          {behaviorPlans?.length > 0 ? (
            <div className="space-y-3">
              {behaviorPlans.map((plan: any) => (
                <div key={plan.id} className={`rounded-lg border p-4 ${plan.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{plan.name}</span>
                      <Badge variant={plan.dataType === 'FREQUENCY' ? 'warning' : 'primary'} className="text-[10px]">
                        {plan.dataType === 'FREQUENCY' ? 'Frequency (count)' : 'Duration (timer)'}
                      </Badge>
                      {!plan.isActive && <Badge variant="default" className="text-[10px]">Inactive</Badge>}
                    </div>
                    {isAdminOrSupervisor && plan.isActive && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => openEditPlan(plan)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 h-7 text-xs text-gray-400 hover:text-red-500"
                          onClick={() => { if (confirm(`Deactivate behavior plan "${plan.name}"?`)) deactivatePlanMutation.mutate(plan.id); }}
                        >
                          <X className="h-3 w-3" /> Deactivate
                        </Button>
                      </div>
                    )}
                  </div>
                  {(plan.abcOptions?.antecedents?.length > 0 || plan.abcOptions?.behaviors?.length > 0 || plan.abcOptions?.consequences?.length > 0) ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-gray-500">
                      {plan.abcOptions.antecedents?.length > 0 && (
                        <div><span className="font-medium text-gray-600">Antecedents:</span> {plan.abcOptions.antecedents.join(', ')}</div>
                      )}
                      {plan.abcOptions.behaviors?.length > 0 && (
                        <div><span className="font-medium text-gray-600">Behaviors:</span> {plan.abcOptions.behaviors.join(', ')}</div>
                      )}
                      {plan.abcOptions.consequences?.length > 0 && (
                        <div><span className="font-medium text-gray-600">Consequences:</span> {plan.abcOptions.consequences.join(', ')}</div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">No custom ABC options — defaults will be offered during recording.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">
              No behavior plans yet — add one to control how challenging behaviors are measured.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Supervisor Modal */}
      <Modal
        open={showAssignSupervisorModal}
        onClose={() => setShowAssignSupervisorModal(false)}
        title="Assign Supervisor"
        description="Assign a supervisor to this student"
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedSupervisorId) {
              assignSupervisorMutation.mutate(selectedSupervisorId);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Supervisor *</label>
            <select
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Choose a supervisor...</option>
              {supervisorsList?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAssignSupervisorModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignSupervisorMutation.isPending || !selectedSupervisorId}>
              {assignSupervisorMutation.isPending ? 'Assigning...' : 'Assign Supervisor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Link Parent Account Modal */}
      <Modal
        open={showParentModal}
        onClose={() => setShowParentModal(false)}
        title="Link Parent Account"
        description="Give a parent login access to this child's progress. The parent account must already exist (created by an admin in Users)."
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedParentId) linkParentMutation.mutate(selectedParentId);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account *</label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Choose a parent...</option>
              {parentsList?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
              ))}
            </select>
            {(!parentsList || parentsList.length === 0) && (
              <p className="mt-1 text-xs text-amber-600">
                No parent accounts exist yet — create one in Users first (role: Parent).
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowParentModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={linkParentMutation.isPending || !selectedParentId}>
              {linkParentMutation.isPending ? 'Linking...' : 'Link Parent'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Behavior Plan Modal */}
      <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title={editingPlan ? 'Edit Behavior Plan' : 'New Behavior Plan'}
        description={editingPlan ? `Update "${editingPlan.name}"` : 'Define how a challenging behavior is measured during sessions'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Behavior Name *</label>
            <Input
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              placeholder="e.g., Aggression, Elopement, Hand Flapping"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanForm({ ...planForm, dataType: 'FREQUENCY' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  planForm.dataType === 'FREQUENCY'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Activity className="h-4 w-4" /> Frequency (count)
              </button>
              <button
                type="button"
                onClick={() => setPlanForm({ ...planForm, dataType: 'DURATION' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  planForm.dataType === 'DURATION'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Timer className="h-4 w-4" /> Duration (built-in timer)
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Antecedent options <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                value={planForm.antecedents}
                onChange={(e) => setPlanForm({ ...planForm, antecedents: e.target.value })}
                rows={3}
                placeholder="e.g., Task demand, Attention removed, Transition, Denied access"
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Behavior options <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                value={planForm.behaviors}
                onChange={(e) => setPlanForm({ ...planForm, behaviors: e.target.value })}
                rows={3}
                placeholder="e.g., Screaming, Hitting, Biting, Elopement"
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consequence options <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                value={planForm.consequences}
                onChange={(e) => setPlanForm({ ...planForm, consequences: e.target.value })}
                rows={3}
                placeholder="e.g., Attention given, Demand removed, Redirected, Ignored"
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowPlanModal(false)}>Cancel</Button>
            <Button onClick={submitPlan} disabled={savePlanMutation.isPending || !planForm.name.trim()}>
              <Save className="h-4 w-4" />
              {savePlanMutation.isPending ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Therapist Modal */}
      <Modal
        open={showAssignTherapistModal}
        onClose={() => setShowAssignTherapistModal(false)}
        title="Assign Therapist"
        description="Assign a therapist to this student"
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedTherapistId) {
              assignTherapistMutation.mutate(selectedTherapistId);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Therapist *</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Choose a therapist...</option>
              {therapistsList?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAssignTherapistModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignTherapistMutation.isPending || !selectedTherapistId}>
              {assignTherapistMutation.isPending ? 'Assigning...' : 'Assign Therapist'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
