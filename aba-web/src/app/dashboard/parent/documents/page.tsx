'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, FileText, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useParentStudent } from '@/contexts/ParentStudentContext';

export default function ParentDocumentsPage() {
  const { student } = useParentStudent();
  const [error, setError] = useState('');

  const { data: docs, isLoading } = useQuery({
    queryKey: ['parent-documents', student?.id],
    queryFn: async () => {
      const params = student?.id ? { studentId: student.id } : {};
      const { data } = await api.get('/documents', { params });
      return data.documents || [];
    },
    enabled: !!student,
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
        setError('This document is not available in-app — ask the center to share it with you.');
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

  const TYPE_LABELS: Record<string, string> = {
    progress_report: 'Progress report',
    medical_report: 'Medical report',
    invoice: 'Invoice',
    letter: 'Letter',
    consent: 'Consent form',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reports, letters and invoices from the center — all in one place.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-gray-400" />
            {student ? `${student.name}'s documents` : 'Documents'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : (docs || []).length === 0 ? (
            <div className="py-10 text-center">
              <FolderOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No documents yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Reports and letters the center shares with you will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(docs || []).map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                    <FileText className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{d.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {TYPE_LABELS[d.fileType] || d.fileType}
                      {' · '}
                      {formatDate(d.createdAt)}
                      {d.notes && <span className="text-gray-400"> — {d.notes}</span>}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d.id, d.fileName)}>
                    <Download className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
