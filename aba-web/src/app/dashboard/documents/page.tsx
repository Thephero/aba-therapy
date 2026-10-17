'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, Upload, FileText, Trash2, GraduationCap } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const FILE_TYPES = [
  { value: 'progress_report', label: 'Progress report' },
  { value: 'medical_report', label: 'Medical report' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'letter', label: 'Letter' },
  { value: 'consent', label: 'Consent form' },
  { value: 'other', label: 'Other' },
];

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedType, setSelectedType] = useState('progress_report');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = user?.role !== 'parent';

  const { data: students } = useQuery({
    queryKey: ['documents-students'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return data.students || [];
    },
  });

  const { data: docs } = useQuery({
    queryKey: ['documents', selectedStudent],
    queryFn: async () => {
      const params = selectedStudent ? { studentId: selectedStudent } : {};
      const { data } = await api.get('/documents', { params });
      return data.documents || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await api.post('/documents', {
        studentId: selectedStudent,
        fileName: file.name,
        fileType: selectedType,
        mimeType: file.type,
        contentBase64,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  async function handleDownload(id: string, fileName: string) {
    try {
      const { data } = await api.get(`/documents/${id}`);
      if (data.url) {
        // Stored in object storage — fetch via the signed URL.
        const res = await fetch(data.url);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (!data.contentBase64) {
        setError('This file was too large to store in-app and was shared outside the app.');
        return;
      }
      const byteChars = atob(data.contentBase64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Download failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reports, letters, invoices and consent forms — stored with each child.
        </p>
      </div>

      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-gray-400" />
              Upload a document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Choose student…</option>
                {(students || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {FILE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Input
                placeholder="Optional note (e.g. 'for school')"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setError('');
                    if (!selectedStudent) {
                      setError('Choose a student first.');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setError('File is too large (max 5 MB).');
                      return;
                    }
                    uploadMutation.mutate(file);
                  }
                  e.target.value = '';
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending || !selectedStudent}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? 'Uploading…' : 'Choose file (max 5 MB)'}
              </Button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-gray-400" />
            All documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(docs || []).length === 0 ? (
            <div className="py-10 text-center">
              <FolderOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No documents yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(docs || []).map((d: any) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                    <FileText className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{d.fileName}</p>
                    <p className="text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" /> {d.studentName}
                      </span>
                      {' · '}
                      {FILE_TYPES.find((t) => t.value === d.fileType)?.label || d.fileType}
                      {' · '}
                      {d.uploadedByName} · {formatDate(d.createdAt)}
                      {d.notes && <span className="text-gray-400"> — {d.notes}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {d.fileSize != null && (
                      <span className="text-xs text-gray-400 self-center mr-2">
                        {(d.fileSize / 1024).toFixed(0)} KB
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleDownload(d.id, d.fileName)}>
                      Open
                    </Button>
                    {canUpload && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
