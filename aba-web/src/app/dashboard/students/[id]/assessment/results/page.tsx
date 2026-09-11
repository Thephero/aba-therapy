'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, AlertTriangle, TrendingDown, Minus, Target,
  Check, X, Pencil, FileText, Download, Info,
} from 'lucide-react';
import Link from 'next/link';

const VB_MAPP_ATTEMPT_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

interface EvaluationResponse {
  assessment: {
    id: string;
    studentId: string;
    assessor: { id: string; name: string };
    assessmentType: 'VB_MAPP_GRID' | 'ABLLS_GRID';
    attemptNumber: number;
    status: string;
    createdAt: string;
    scores: Array<{ itemCode: string; domainCode: string; level: number; score: number; notes?: string }>;
  };
  evaluation: {
    totalScore: number;
    totalMax: number;
    percentage: number;
    domainTotals: Array<{ code: string; name: string; level: number; total: number; max: number; percentage: number }>;
    levelTotals: Array<{ level: number; ageRangeMonths: string; total: number; max: number; percentage: number }>;
    flags: Array<{ type: string; itemCode?: string; message: string }>;
    changeVsPrevious: number | null;
    deficits: Array<{ itemCode: string; domainCode: string; score: number; maxScore: number; message: string }>;
    deficitCount: number;
    masteredCount: number;
    suggestedGoals: Array<{
      targetId: string; goalTitle: string; category: string;
      operationalDefinition: string; measurementType: string; masteryCriteria: string; reason: string;
    }>;
  };
  savedGoals: Array<{
    id: string; targetId: string; title: string; category: string; status: string;
    operationalDefinition: string; measurementType: string; masteryCriteria: string;
  }>;
}

export default function AssessmentResultsPage() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('assessmentId') as string;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdminOrSupervisor = user?.role === 'center_admin' || user?.role === 'supervisor';

  const [showReportModal, setShowReportModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', operationalDefinition: '', masteryCriteria: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: async () => {
      const { data } = await api.get(`/assessments/${assessmentId}`);
      return data as EvaluationResponse;
    },
    enabled: !!assessmentId,
  });

  const goalMutation = useMutation({
    mutationFn: async (payload: { targetId: string; action: 'ACCEPT' | 'MODIFY' | 'REJECT'; title?: string; operationalDefinition?: string; masteryCriteria?: string }) => {
      await api.post('/assessments/goals', { assessmentId, ...payload });
    },
    onSuccess: (_res, payload) => {
      queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
      setEditingGoal(null);
      showToast(
        payload.action === 'ACCEPT' ? 'Goal accepted' : payload.action === 'REJECT' ? 'Goal rejected' : 'Goal updated',
        'success'
      );
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to save goal', 'error'),
  });

  const { data: reportData } = useQuery({
    queryKey: ['assessment-report', assessmentId],
    queryFn: async () => {
      const { data } = await api.post(`/assessments/${assessmentId}/report`);
      return data.report as { reportText: string };
    },
    enabled: showReportModal && !!assessmentId,
  });

  // Group domain totals by level for the master grid
  const levels = useMemo(() => {
    if (!data) return [];
    const byLevel = new Map<number, typeof data.evaluation.domainTotals>();
    for (const d of data.evaluation.domainTotals) {
      const list = byLevel.get(d.level) || [];
      list.push(d);
      byLevel.set(d.level, list);
    }
    return Array.from(byLevel.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  if (!isAdminOrSupervisor) {
    return <div className="py-12 text-center text-gray-500">Only supervisors and center admins can view assessments.</div>;
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const { assessment, evaluation, savedGoals } = data;
  const isVbmapp = assessment.assessmentType === 'VB_MAPP_GRID';
  const attemptColor = isVbmapp ? VB_MAPP_ATTEMPT_COLORS[(assessment.attemptNumber - 1) % 4] : '#6366f1';

  const downloadCsv = () => {
    const rows = [['ItemCode', 'Domain', 'Level', 'Score']];
    for (const s of assessment.scores) rows.push([s.itemCode, s.domainCode, String(s.level), String(s.score)]);
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${assessment.attemptNumber}-${new Date(assessment.createdAt).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/students/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Student
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            {isVbmapp ? 'VB-MAPP Grid' : 'ABLLS-R Grid'} Results
            <Badge variant={assessment.status === 'COMPLETED' ? 'success' : 'warning'}>{assessment.status}</Badge>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isVbmapp ? `Attempt ${assessment.attemptNumber}` : 'Domain profile'} · Assessed by {assessment.assessor.name} ·{' '}
            {new Date(assessment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => setShowReportModal(true)}>
            <FileText className="h-4 w-4" />
            Report
          </Button>
        </div>
      </div>

      {/* Evaluation dashboard summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Score</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {evaluation.totalScore} <span className="text-sm font-normal text-gray-400">/ {evaluation.totalMax}</span>
            </p>
            {evaluation.changeVsPrevious !== null && (
              <p className={`mt-1 text-xs font-medium ${evaluation.changeVsPrevious > 0 ? 'text-green-600' : evaluation.changeVsPrevious < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {evaluation.changeVsPrevious > 0 ? '▲' : evaluation.changeVsPrevious < 0 ? '▼' : '—'} {Math.abs(evaluation.changeVsPrevious)}% vs previous attempt
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Percentage</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{evaluation.percentage}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mastered Items</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{evaluation.masteredCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Deficit Items</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{evaluation.deficitCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Flags */}
      {evaluation.flags.length > 0 && (
        <div className="space-y-2">
          {evaluation.flags.map((f, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                f.type === 'REGRESSION'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : f.type === 'LACK_OF_PROGRESS'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
              }`}
            >
              {f.type === 'REGRESSION' ? (
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
              ) : f.type === 'LACK_OF_PROGRESS' ? (
                <Minus className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <span className="font-semibold">[{f.type.replace(/_/g, ' ')}]</span> {f.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Master grid visualizer: stacked domain blocks per level */}
      <Card>
        <CardHeader>
          <CardTitle>Master Grid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {levels.map(([level, domains]) => (
            <div key={level}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {level > 0 ? `Level ${level}` : 'All Domains'}
                </h3>
                {level > 0 && (
                  <span className="text-xs text-gray-400">
                    ({data.evaluation.levelTotals.find((l) => l.level === level)?.ageRangeMonths} months)
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {data.evaluation.levelTotals.find((l) => (level > 0 ? l.level === level : true))?.percentage}%
                </span>
              </div>
              <div className="space-y-2">
                {domains.map((d) => (
                  <div key={`${level}-${d.code}`} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 truncate text-xs font-medium text-gray-600" title={d.name}>
                      {d.name}
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {Array.from({ length: 5 }, (_, i) => i + 1).map((i) => {
                        const scoreEntry = assessment.scores.find(
                          (s) => s.domainCode === d.code && s.level === d.level && s.itemCode.endsWith(`_${i}`)
                        );
                        const score = scoreEntry?.score ?? null;
                        return (
                          <div
                            key={i}
                            title={`Item ${i} · Score: ${score ?? 'not scored'}`}
                            className="relative h-6 w-6 overflow-hidden rounded border border-gray-200 bg-gray-50"
                          >
                            {score !== null && score > 0 && (
                              <div
                                className="absolute bottom-0 left-0 w-full"
                                style={{
                                  height: score >= (isVbmapp ? 1 : 4) ? '100%' : '50%',
                                  backgroundColor: attemptColor,
                                  opacity: 0.85,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="w-24 shrink-0 text-right text-xs text-gray-500">
                      {d.total}/{d.max} ({d.percentage}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {isVbmapp ? (
              VB_MAPP_ATTEMPT_COLORS.map((c, i) => (
                <span key={c} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} /> Assessment {i + 1}
                </span>
              ))
            ) : (
              <span>Filled blocks = scored items · block fill height reflects score proportion</span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-white" /> Not scored / 0
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Deficit list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Deficit Items ({evaluation.deficits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.deficits.map((d) => (
                  <tr key={d.itemCode} className="border-b border-gray-50">
                    <td className="py-1.5 pr-4 font-mono text-xs">{d.itemCode}</td>
                    <td className="py-1.5 pr-4 text-gray-600">{d.domainCode}</td>
                    <td className="py-1.5 pr-4">
                      {d.score} / {d.maxScore}
                    </td>
                    <td className="py-1.5">
                      <Badge variant={d.score === 0 ? 'danger' : 'warning'} className="text-[10px]">
                        {d.score === 0 ? 'DEFICIT' : 'EMERGING'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Goal suggestion panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-500" />
            Suggested Goals ({evaluation.suggestedGoals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evaluation.suggestedGoals.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No goal suggestions — all domains at max score.</p>
          )}
          {evaluation.suggestedGoals.map((g) => {
            const saved = savedGoals.find((sg) => sg.targetId === g.targetId);
            return (
              <div key={g.targetId} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{g.goalTitle}</span>
                      <Badge variant="outline" className="text-[10px]">{g.targetId}</Badge>
                      {saved && (
                        <Badge
                          variant={saved.status === 'ACCEPTED' ? 'success' : saved.status === 'REJECTED' ? 'danger' : 'warning'}
                          className="text-[10px]"
                        >
                          {saved.status}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{g.category} · {g.reason}</p>
                    <p className="mt-2 text-sm text-gray-600">{g.operationalDefinition}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      <span className="font-medium">Measurement:</span> {g.measurementType} · <span className="font-medium">Mastery:</span> {g.masteryCriteria}
                    </p>
                    {editingGoal === g.targetId && (
                      <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                        <input
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          placeholder="Goal title"
                        />
                        <textarea
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          rows={2}
                          value={editForm.operationalDefinition}
                          onChange={(e) => setEditForm({ ...editForm, operationalDefinition: e.target.value })}
                          placeholder="Operational definition"
                        />
                        <input
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={editForm.masteryCriteria}
                          onChange={(e) => setEditForm({ ...editForm, masteryCriteria: e.target.value })}
                          placeholder="Mastery criteria"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {editingGoal === g.targetId ? (
                      <Button
                        size="sm"
                        disabled={goalMutation.isPending}
                        onClick={() =>
                          goalMutation.mutate({
                            targetId: g.targetId,
                            action: 'MODIFY',
                            title: editForm.title,
                            operationalDefinition: editForm.operationalDefinition,
                            masteryCriteria: editForm.masteryCriteria,
                          })
                        }
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={goalMutation.isPending}
                          onClick={() => {
                            setEditForm({ title: g.goalTitle, operationalDefinition: g.operationalDefinition, masteryCriteria: g.masteryCriteria });
                            setEditingGoal(g.targetId);
                          }}
                          title="Modify"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" disabled={goalMutation.isPending} onClick={() => goalMutation.mutate({ targetId: g.targetId, action: 'ACCEPT' })}>
                          <Check className="h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-400 hover:text-red-600"
                          disabled={goalMutation.isPending}
                          onClick={() => goalMutation.mutate({ targetId: g.targetId, action: 'REJECT' })}
                          title="Reject"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Report modal */}
      <Modal open={showReportModal} onClose={() => setShowReportModal(false)} title="Clinical Report (SOAP draft)" size="lg">
        {reportData ? (
          <div className="space-y-3">
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
              {reportData.reportText}
            </pre>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-gray-400">
                <Info className="h-3.5 w-3.5" />
                BCBA review and sign-off required before use.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(reportData.reportText);
                  showToast('Report copied to clipboard', 'success');
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        )}
      </Modal>
    </div>
  );
}
