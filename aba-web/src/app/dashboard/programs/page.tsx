'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Target, User, Pencil, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function ProgramsPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const queryClient = useQueryClient();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const preselectedStudentId = searchParams?.get('studentId') || '';

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
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/programs/${editingProgram.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setShowEditModal(false);
      setEditingProgram(null);
    },
  });

  const openEdit = (program: any) => {
    setEditingProgram(program);
    setEditForm({ name: program.name, description: program.description || '' });
    setShowEditModal(true);
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
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="h-3.5 w-3.5" />
                          {program.student?.name || '—'}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={program.status === 'active' ? 'success' : 'warning'}>
                          {program.status || 'Active'}
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
                        <Button variant="ghost" size="sm" onClick={() => openEdit(program)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
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
    </div>
  );
}
