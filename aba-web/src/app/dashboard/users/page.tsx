'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Mail, Pencil, Trash2, ArrowLeft, Users, GraduationCap, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';

const ROLES = [
  { value: 'CENTER_ADMIN', label: 'Center Admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'THERAPIST', label: 'Therapist' },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTherapistAssignModal, setShowTherapistAssignModal] = useState(false);
  const [assigningUser, setAssigningUser] = useState<any>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'THERAPIST' });
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', isActive: true });
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // ─── Supervisors/Therapists for assignment ───
  const [assignSupervisorId, setAssignSupervisorId] = useState('');
  const [selectedTherapistIds, setSelectedTherapistIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { search: search || undefined } });
      return data.users;
    },
  });

  // ─── Student Assignment ───
  const { data: assignmentData, isLoading: loadingAssignments } = useQuery({
    queryKey: ['user-assignments', assigningUser?.id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${assigningUser.id}/assignments`);
      return data;
    },
    enabled: !!assigningUser,
  });

  const assignMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      await api.post(`/users/${assigningUser.id}/students`, { studentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments', assigningUser?.id] });
      setShowAssignModal(false);
      setAssigningUser(null);
      setSelectedStudentIds([]);
      setStudentSearch('');
      showToast('Student assignments updated', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to update assignments', 'error');
    },
  });

  // ─── Supervisor → Therapist Assignment ───
  const { data: therapistAssignData, isLoading: loadingTherapistAssign } = useQuery({
    queryKey: ['supervisor-therapist-assign', assignSupervisorId],
    queryFn: async () => {
      const { data } = await api.get(`/supervisors/therapists`);
      return data;
    },
    enabled: showTherapistAssignModal,
  });

  const supervisorTherapistMutation = useMutation({
    mutationFn: async ({ supervisorId, therapistIds }: { supervisorId: string; therapistIds: string[] }) => {
      // Get current assignments to compute diff
      const current = therapistAssignData?.assignments?.filter(
        (a: any) => a.supervisor?.id === supervisorId
      ) || [];
      const currentIds = current.map((a: any) => a.therapist.id);
      const toAdd = therapistIds.filter((id: string) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id: string) => !therapistIds.includes(id));

      // Remove unselected
      for (const therapistId of toRemove) {
        await api.delete(`/supervisors/${supervisorId}/therapists/${therapistId}`);
      }
      // Add newly selected
      for (const therapistId of toAdd) {
        await api.post(`/supervisors/${supervisorId}/therapists`, { therapistId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowTherapistAssignModal(false);
      setAssignSupervisorId('');
      setSelectedTherapistIds([]);
      showToast('Therapist assignments updated', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to update therapist assignments', 'error');
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users', addForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddModal(false);
      setAddForm({ name: '', email: '', password: '', role: 'THERAPIST' });
      showToast('User created', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to create user', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/users/${editingUser.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEditModal(false);
      setEditingUser(null);
      showToast('User updated', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to update user', 'error');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('User deactivated', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to deactivate user', 'error');
    },
  });

  const openEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive });
    setShowEditModal(true);
  };

  const openAssign = (user: any) => {
    setAssigningUser(user);
    setSelectedStudentIds([]);
    setStudentSearch('');
    setShowAssignModal(true);
  };

  const openTherapistAssign = (supervisor: any) => {
    setAssignSupervisorId(supervisor.id);
    setSelectedTherapistIds([]);
    setShowTherapistAssignModal(true);
  };

  // Sync selected IDs when assignment data loads
  useEffect(() => {
    if (assignmentData?.assignedStudentIds) {
      setSelectedStudentIds(assignmentData.assignedStudentIds);
    }
  }, [assignmentData]);

  // Sync therapist selections when therapist assignment data loads
  useEffect(() => {
    if (therapistAssignData?.assignments && assignSupervisorId) {
      const currentIds = therapistAssignData.assignments
        .filter((a: any) => a.supervisor?.id === assignSupervisorId)
        .map((a: any) => a.therapist.id);
      setSelectedTherapistIds(currentIds);
    }
  }, [therapistAssignData, assignSupervisorId]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleTherapist = (therapistId: string) => {
    setSelectedTherapistIds(prev =>
      prev.includes(therapistId)
        ? prev.filter(id => id !== therapistId)
        : [...prev, therapistId]
    );
  };

  const isStaff = (role: string) => role === 'SUPERVISOR' || role === 'THERAPIST';

  // Filter students by search
  const filteredStudents = assignmentData?.allStudents?.filter((s: any) =>
    !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase())
  ) || [];

  // Get all therapists for the therapist assignment modal
  const allTherapists = data?.filter((u: any) => u.role === 'THERAPIST' && u.isActive) || [];

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
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage center staff, supervisors, therapists, and their assignments
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
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
                    <th className="pb-3 font-medium text-gray-500">Name</th>
                    <th className="pb-3 font-medium text-gray-500">Email</th>
                    <th className="pb-3 font-medium text-gray-500">Role</th>
                    <th className="pb-3 font-medium text-gray-500">Students</th>
                    <th className="pb-3 font-medium text-gray-500">Therapists</th>
                    <th className="pb-3 font-medium text-gray-500">Status</th>
                    <th className="pb-3 font-medium text-gray-500">Joined</th>
                    <th className="pb-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                            {user.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="h-3.5 w-3.5" />
                          {user.email}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.role === 'CENTER_ADMIN' ? 'primary' : user.role === 'SUPERVISOR' ? 'success' : 'default'}>
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {isStaff(user.role) ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-900">{user.studentCount ?? 0}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {user.role === 'SUPERVISOR' ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-900">{user.therapistCount ?? 0}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.isActive ? 'success' : 'danger'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {isStaff(user.role) && user.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                              onClick={() => openAssign(user)}
                            >
                              <GraduationCap className="h-3.5 w-3.5" />
                              Students
                            </Button>
                          )}
                          {user.role === 'SUPERVISOR' && user.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                              onClick={() => openTherapistAssign(user)}
                            >
                              <Users className="h-3.5 w-3.5" />
                              Therapists
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {user.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`Deactivate ${user.name}? They will lose access to the platform.`)) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                              disabled={deactivateMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data || data.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New User"
        description="Create a new staff account"
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
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              required
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              required
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              required
              placeholder="Min. 6 characters"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Creating...' : 'Add User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        description={editingUser?.name || ''}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Active (can access the platform)</span>
            </label>
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

      {/* ─── Assign Students Modal (with search) ─── */}
      <Modal
        open={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setAssigningUser(null);
          setSelectedStudentIds([]);
          setStudentSearch('');
        }}
        title={`Assign Students to ${assigningUser?.name || 'Staff'}`}
        description={`Select which students this ${assigningUser?.role?.replace('_', ' ')?.toLowerCase() || 'staff member'} should be assigned to`}
        size="lg"
      >
        {loadingAssignments ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search students by name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span className="text-sm text-indigo-700">
                  <strong>{selectedStudentIds.length}</strong> of{' '}
                  <strong>{assignmentData?.allStudents?.length || 0}</strong> students selected
                  {studentSearch && filteredStudents.length < (assignmentData?.allStudents?.length || 0) && (
                    <span className="text-indigo-400"> (showing {filteredStudents.length})</span>
                  )}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setSelectedStudentIds(assignmentData?.allStudents?.map((s: any) => s.id) || [])}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setSelectedStudentIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Student Grid */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  {studentSearch ? 'No students match your search' : 'No students available. Create students first.'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredStudents.map((student: any) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 hover:bg-indigo-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isSelected
                            ? 'bg-indigo-200 text-indigo-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {student.name.charAt(0)}
                        </div>
                        <span className={`text-sm font-medium ${
                          isSelected ? 'text-indigo-900' : 'text-gray-700'
                        }`}>
                          {student.name}
                        </span>
                        {isSelected && (
                          <Badge variant="primary" className="ml-auto text-[10px]">Assigned</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                Click a student to toggle assignment. Changes are applied when you save.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigningUser(null);
                    setSelectedStudentIds([]);
                    setStudentSearch('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => assignMutation.mutate(selectedStudentIds)}
                  disabled={assignMutation.isPending}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  {assignMutation.isPending ? 'Saving...' : 'Save Assignments'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Assign Therapists to Supervisor Modal ─── */}
      <Modal
        open={showTherapistAssignModal}
        onClose={() => {
          setShowTherapistAssignModal(false);
          setAssignSupervisorId('');
          setSelectedTherapistIds([]);
        }}
        title={`Assign Therapists to Supervisor`}
        description={`Select which therapists should report to this supervisor`}
        size="lg"
      >
        {loadingTherapistAssign ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between rounded-lg bg-purple-50 border border-purple-100 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-700">
                  <strong>{selectedTherapistIds.length}</strong> of{' '}
                  <strong>{allTherapists.length}</strong> therapists assigned
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setSelectedTherapistIds(allTherapists.map((t: any) => t.id))}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setSelectedTherapistIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Therapist Grid */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
              {allTherapists.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  No therapists available. Create therapist users first.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {allTherapists.map((therapist: any) => {
                    const isSelected = selectedTherapistIds.includes(therapist.id);
                    return (
                      <button
                        key={therapist.id}
                        type="button"
                        onClick={() => toggleTherapist(therapist.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-purple-50 hover:bg-purple-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected
                            ? 'border-purple-600 bg-purple-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isSelected
                            ? 'bg-purple-200 text-purple-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {therapist.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${
                            isSelected ? 'text-purple-900' : 'text-gray-700'
                          }`}>
                            {therapist.name}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">{therapist.email}</span>
                        </div>
                        {isSelected && (
                          <Badge variant="primary" className="text-[10px]">Assigned</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                Click a therapist to toggle assignment. Changes are applied individually when you save.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTherapistAssignModal(false);
                    setAssignSupervisorId('');
                    setSelectedTherapistIds([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => supervisorTherapistMutation.mutate({
                    supervisorId: assignSupervisorId,
                    therapistIds: selectedTherapistIds,
                  })}
                  disabled={supervisorTherapistMutation.isPending}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  {supervisorTherapistMutation.isPending ? 'Saving...' : 'Save Assignments'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
