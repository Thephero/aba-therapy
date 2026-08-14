'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Target, User, Pencil, ArrowLeft, Settings2, Save } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';

const DOMAINS = [
  'Communication', 'Social', 'Daily Living', 'Motor', 'Academic', 'Play & Leisure', 'Self-Management', 'Other',
];

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  IN_PROGRESS: 'default',
  MASTERED: 'success',
  ON_HOLD: 'warning',
};

export default function ProgramsPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const preselectedStudentId = searchParams?.get('studentId') || '';

  // ── Manage program (targets) modal state ──
  const [manageProgram, setManageProgram] = useState<any>(null);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [targetForm, setTargetForm] = useState({
    domain: DOMAINS[0],
    skill: '',
    promptHierarchy: '',
    masteryPercentage: '80',
    masteryConsecutive: '3',
    status: 'IN_PROGRESS',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['programs', search],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (preselectedStudentId) params.studentId = preselectedStudentId;
      const { data } = await api.get('/programs', { params });
      return data.programs;
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-for-program'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return data.students;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post('/programs', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setShowAddModal(false);
      setForm({ studentId: '', name: '', description: '' });
      showToast('Program created', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to create program', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/programs/${editingProgram.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setShowEditModal(false);
      setEditingProgram(null);
      showToast('Program updated', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to update program', 'error'),
  });

  const openEdit = (program: any) => {
    setEditingProgram(program);
    setEditForm({ name: program.name, description: program.description || '' });
    setShowEditModal(true);
  };

  // ── Target CRUD ──────────────────────────────────────────────────────────
  const refreshManage = () => {
    queryClient.invalidateQueries({ queryKey: ['program', manageProgram?.id] });
    queryClient.invalidateQueries({ queryKey: ['programs'] });
  };

  const saveTargetMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingTarget) {
        await api.patch(`/programs/${manageProgram.id}/targets/${editingTarget.id}`, body);
      } else {
        await api.post(`/programs/${manageProgram.id}/targets`, body);
      }
    },
    onSuccess: () => {
      refreshManage();
      setShowTargetForm(false);
      setEditingTarget(null);
      setTargetForm({ domain: DOMAINS[0], skill: '', promptHierarchy: '', masteryPercentage: '80', masteryConsecutive: '3', status: 'IN_PROGRESS', notes: '' });
      showToast(editingTarget ? 'Target updated' : 'Target added', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to save target', 'error'),
  });

  const { data: manageData } = useQuery({
    queryKey: ['program', manageProgram?.id],
    queryFn: async () => {
      const { data } = await api.get(`/programs/${manageProgram.id}`);
      return data.program;
    },
    enabled: !!manageProgram,
  });

  const openManage = (program: any) => {
    setManageProgram(program);
    setShowTargetForm(false);
    setEditingTarget(null);
  };

  const openNewTarget = () => {
    setEditingTarget(null);
    setTargetForm({ domain: DOMAINS[0], skill: '', promptHierarchy: '', masteryPercentage: '80', masteryConsecutive: '3', status: 'IN_PROGRESS', notes: '' });
    setShowTargetForm(true);
  };

  const openEditTarget = (target: any) => {
    setEditingTarget(target);
    let parsed: string[] = [];
    try { parsed = JSON.parse(target.promptHierarchy || '[]'); } catch { parsed = []; }
    setTargetForm({
      domain: target.domain,
      skill: target.skill,
      promptHierarchy: parsed.join(', '),
      masteryPercentage: String(target.masteryPercentage ?? 80),
      masteryConsecutive: String(target.masteryConsecutive ?? 3),
      status: target.status || 'IN_PROGRESS',
      notes: target.notes || '',
    });
    setShowTargetForm(true);
  };

  const submitTarget = () => {
    const promptLevels = targetForm.promptHierarchy.split(',').map((s) => s.trim()).filter(Boolean);
    saveTargetMutation.mutate({
      domain: targetForm.domain,
      skill: targetForm.skill,
      promptHierarchy: promptLevels,
      masteryPercentage: parseFloat(targetForm.masteryPercentage) || 80,
      masteryConsecutive: parseInt(targetForm.masteryConsecutive) || 3,
      status: targetForm.status,
      notes: targetForm.notes || undefined,
    });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Skill Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {preselectedStudentId
              ? 'Programs for the selected student'
              : 'Create and manage skill acquisition programs'}
          </p>
        </div>
        <Button onClick={() => {
          setForm({ ...form, studentId: preselectedStudentId || form.studentId });
          setShowAddModal(true);
        }}>
          <Plus className="h-4 w-4" />
          New Program
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Programs</CardTitle>
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
                    <th className="pb-3 font-medium text-gray-500">Program Name</th>
                    <th className="pb-3 font-medium text-gray-500">Student</th>
                    <th className="pb-3 font-medium text-gray-500">Status</th>
                    <th className="pb-3 font-medium text-gray-500">Targets</th>
                    <th className="pb-3 font-medium text-gray-500">Created</th>
                    <th className="pb-3 font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.map((program: any) => (
                    <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-900">{program.name}</span>
                        {program.description && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{program.description}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="h-3.5 w-3.5" />
                          {program.student?.name || '—'}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusColors[program.status] || 'default'}>
                          {program.status || 'IN_PROGRESS'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-600">{program.targets?.length || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {formatDate(program.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openManage(program)}>
                            <Settings2 className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(program)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data || data.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No programs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Program Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New Program"
        description="Add a skill acquisition program for a student"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
            <select
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g., Expressive Labeling, Fine Motor Skills"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Brief description of the program goals..."
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Creating...' : 'Create Program'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Program Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Program"
        description={editingProgram?.name || ''}
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Name *</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
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

      {/* Manage Program Modal (targets) */}
      <Modal
        open={!!manageProgram}
        onClose={() => setManageProgram(null)}
        title={manageProgram?.name || 'Program'}
        description={`${manageData?.student?.name || ''} · ${manageData?.description || 'Manage targets for this program'}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Targets ({manageData?.targets?.length || 0})
              </h3>
              <p className="text-xs text-gray-500">Each target is a specific skill worked on within this program</p>
            </div>
            <Button size="sm" onClick={openNewTarget}>
              <Plus className="h-3.5 w-3.5" />
              Add Target
            </Button>
          </div>

          {manageData?.targets?.length > 0 ? (
            <div className="space-y-2">
              {manageData.targets.map((target: any) => (
                <div key={target.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{target.domain}</Badge>
                        <span className="font-medium text-gray-900">{target.skill}</span>
                        <Badge variant={statusColors[target.status] || 'default'} className="text-[10px]">
                          {target.status || 'IN_PROGRESS'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Mastery: {target.masteryPercentage}% × {target.masteryConsecutive} consecutive
                        {(() => {
                          try {
                            const levels = JSON.parse(target.promptHierarchy || '[]');
                            return levels.length > 0 ? ` · Prompts: ${levels.join(', ')}` : '';
                          } catch { return ''; }
                        })()}
                      </p>
                      {target.notes && <p className="mt-1 text-xs text-gray-400">{target.notes}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditTarget(target)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              No targets yet — add one to define what skills are worked on.
            </div>
          )}
        </div>
      </Modal>

      {/* Add/Edit Target Modal */}
      <Modal
        open={showTargetForm}
        onClose={() => setShowTargetForm(false)}
        title={editingTarget ? 'Edit Target' : 'Add Target'}
        description={`${manageProgram?.name || ''} — ${editingTarget ? 'Update the target details' : 'Define a new skill to work on'}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain *</label>
              <select
                value={targetForm.domain}
                onChange={(e) => setTargetForm({ ...targetForm, domain: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={targetForm.status}
                onChange={(e) => setTargetForm({ ...targetForm, status: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="IN_PROGRESS">In Progress</option>
                <option value="MASTERED">Mastered</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill / Target Name *</label>
            <Input
              value={targetForm.skill}
              onChange={(e) => setTargetForm({ ...targetForm, skill: e.target.value })}
              placeholder="e.g., Labels 10 common objects, Requests preferred items..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Hierarchy <span className="text-gray-400 font-normal">(comma-separated, most-to-least)</span>
            </label>
            <Input
              value={targetForm.promptHierarchy}
              onChange={(e) => setTargetForm({ ...targetForm, promptHierarchy: e.target.value })}
              placeholder="e.g., Full Physical, Partial Physical, Model, Verbal, Gestural, Independent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mastery %</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={targetForm.masteryPercentage}
                onChange={(e) => setTargetForm({ ...targetForm, masteryPercentage: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consecutive sessions</label>
              <Input
                type="number"
                min={1}
                value={targetForm.masteryConsecutive}
                onChange={(e) => setTargetForm({ ...targetForm, masteryConsecutive: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={targetForm.notes}
              onChange={(e) => setTargetForm({ ...targetForm, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes on teaching strategy..."
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTargetForm(false)}>Cancel</Button>
            <Button
              onClick={submitTarget}
              disabled={saveTargetMutation.isPending || !targetForm.skill.trim()}
            >
              <Save className="h-4 w-4" />
              {saveTargetMutation.isPending ? 'Saving...' : editingTarget ? 'Save Changes' : 'Add Target'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
