'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Play, Save, Send, RotateCcw } from 'lucide-react';
import Link from 'next/link';

type GridsResponse = {
  grids: {
    VB_MAPP_GRID: {
      label: string;
      scoringScale: number[];
      colorLegendByAssessment?: string[];
      levels: Array<{
        level: number;
        ageRangeMonths: string;
        maxScorePerDomain: number;
        domains: Array<{ code: string; name: string; totalItems: number }>;
      }>;
      maxScorePerItem: number;
      totalItems: number;
    };
    ABLLS_GRID: {
      label: string;
      scoringScale: number[];
      domainsAtoZ: Array<{ code: string; name: string; totalItems: number }>;
      maxScorePerItem: number;
      totalItems: number;
    };
  };
};

const VB_MAPP_ATTEMPT_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

export default function AssessmentWizardPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdminOrSupervisor = user?.role === 'center_admin' || user?.role === 'supervisor';

  // Step 1: setup; Step 2: ready-to-start gate; Step 3: score entry
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [assessmentType, setAssessmentType] = useState<'VB_MAPP_GRID' | 'ABLLS_GRID'>('VB_MAPP_GRID');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [activeLevel, setActiveLevel] = useState(1);
  const [scores, setScores] = useState<Record<string, { score: number; domainCode: string; level: number; notes?: string }>>({});

  const { data: student } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${id}`);
      return data.student;
    },
  });

  const { data: gridsData } = useQuery({
    queryKey: ['assessment-grids'],
    queryFn: async () => {
      const { data } = await api.get('/assessments/grids');
      return data as GridsResponse;
    },
  });

  const grid = gridsData?.grids ? gridsData.grids[assessmentType] : undefined;

  const itemKey = (domainCode: string, level: number, i: number) =>
    assessmentType === 'VB_MAPP_GRID' ? `${domainCode}_L${level}_${i}` : `${domainCode}_${i}`;

  const domainsForActiveView = useMemo<any[]>((() => {
    if (!grid) return [];
    if (assessmentType === 'VB_MAPP_GRID' && 'levels' in grid) {
      const lvl = (grid as any).levels.find((l: any) => l.level === activeLevel);
      return lvl ? lvl.domains.map((d: any) => ({ ...d, level: lvl.level })) : [];
    }
    return ((grid as any).domainsAtoZ || []).map((d: any) => ({ ...d, level: 0 }));
  }), [grid, assessmentType, activeLevel]);

  const setScore = (domainCode: string, level: number, i: number, value: number) => {
    const key = itemKey(domainCode, level, i);
    setScores((prev) => ({ ...prev, [key]: { score: value, domainCode, level } }));
  };

  const clearAll = () => setScores({});

  const scoredCount = Object.keys(scores).length;
  const totalItemCount = grid ? grid.totalItems : 0;

  const buildPayload = (status: 'DRAFT' | 'COMPLETED') => ({
    studentId: id,
    assessmentType,
    attemptNumber,
    status,
    scores: Object.entries(scores).map(([key, v]) => ({
      itemCode: key,
      domainCode: v.domainCode,
      level: v.level,
      score: v.score,
    })),
  });

  const submitMutation = useMutation({
    mutationFn: async (status: 'DRAFT' | 'COMPLETED') => {
      const { data } = await api.post('/assessments', buildPayload(status));
      return data.assessment;
    },
    onSuccess: (assessment: any, status) => {
      queryClient.invalidateQueries({ queryKey: ['assessments', id] });
      showToast(status === 'DRAFT' ? 'Draft saved' : 'Assessment submitted', 'success');
      router.push(`/dashboard/students/${id}/assessment/results?assessmentId=${assessment.id}`);
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to save assessment', 'error'),
  });

  if (!isAdminOrSupervisor) {
    return (
      <div className="py-12 text-center text-gray-500">
        Only supervisors and center admins can run assessments.
      </div>
    );
  }

  const scale = grid?.scoringScale || (assessmentType === 'VB_MAPP_GRID' ? [0, 0.5, 1] : [0, 1, 2, 3, 4]);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/students/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Student
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clinical Assessment</h1>
        <p className="mt-1 text-sm text-gray-500">
          {student ? `${student.name} — ` : ''}score-entry, evaluation &amp; goal suggestion engine
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {[
          { n: 1, label: 'Setup' },
          { n: 2, label: 'Ready to Start' },
          { n: 3, label: 'Score Entry' },
        ].map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            {idx > 0 && <div className="h-px w-6 bg-gray-300" />}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                step >= s.n ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span>{s.n}.</span> {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Setup ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Assessment Type *</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAssessmentType('VB_MAPP_GRID')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    assessmentType === 'VB_MAPP_GRID'
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">VB-MAPP Grid</p>
                  <p className="mt-1 text-xs text-gray-500">Levels 1–3 · 0 / 0.5 / 1 scoring · 5 items per domain · attempts 1–4</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentType('ABLLS_GRID')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    assessmentType === 'ABLLS_GRID'
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">ABLLS-R Grid</p>
                  <p className="mt-1 text-xs text-gray-500">Domains A–Y · 0–4 scoring per task · 5 tracked tasks per domain</p>
                </button>
              </div>
            </div>

            {assessmentType === 'VB_MAPP_GRID' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Attempt Number (1–4) *</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAttemptNumber(n)}
                      className={`h-10 w-12 rounded-lg border text-sm font-medium transition-colors ${
                        attemptNumber === n
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                      style={attemptNumber === n ? { boxShadow: `inset 0 -3px 0 ${VB_MAPP_ATTEMPT_COLORS[n - 1]}` } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  {VB_MAPP_ATTEMPT_COLORS.map((c, i) => (
                    <span key={c} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} /> Assessment {i + 1}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Ready-to-start gate (push Start when ready) ── */}
      {step === 2 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
              <Play className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ready to begin scoring</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {assessmentType === 'VB_MAPP_GRID' ? 'VB-MAPP Grid' : 'ABLLS-R Grid'}
                {assessmentType === 'VB_MAPP_GRID' ? ` · Attempt ${attemptNumber}` : ''}
                {student ? ` for ${student.name}` : ''}. Conduct the assessment with the learner first — then push
                Start when you're ready to enter scores.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Score entry grid ── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Score Entry — {assessmentType === 'VB_MAPP_GRID' ? `VB-MAPP Level ${activeLevel}` : 'ABLLS Domains'}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {scoredCount} of {totalItemCount} items scored
                </span>
              </span>
              {assessmentType === 'VB_MAPP_GRID' && (
                <div className="flex gap-1">
                  {[1, 2, 3].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setActiveLevel(lvl)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Level {lvl}
                    </button>
                  ))}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {domainsForActiveView.map((domain) => (
                <div key={domain.code} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{domain.name}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{domain.code}</Badge>
                    </div>
                    <span className="text-[11px] text-gray-400">{domain.totalItems} items</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: domain.totalItems }, (_, idx) => idx + 1).map((i) => {
                      const key = itemKey(domain.code, domain.level, i);
                      const current = scores[key]?.score;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="w-8 text-right text-xs text-gray-500">#{i}</span>
                          <div className="flex overflow-hidden rounded-lg border border-gray-200">
                            {scale.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setScore(domain.code, domain.level, i, v)}
                                className={`h-8 w-9 text-xs font-medium transition-colors ${
                                  current === v
                                    ? v === 0
                                      ? 'bg-gray-700 text-white'
                                      : 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                                title={assessmentType === 'ABLLS_GRID' ? `Score ${v}` : v === 0.5 ? 'Half credit' : v === 1 ? 'Full credit' : 'No credit'}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button variant="ghost" onClick={clearAll} disabled={scoredCount === 0}>
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={submitMutation.isPending || scoredCount === 0} onClick={() => submitMutation.mutate('DRAFT')}>
                  <Save className="h-4 w-4" />
                  {submitMutation.isPending ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button disabled={submitMutation.isPending || scoredCount === 0} onClick={() => submitMutation.mutate('COMPLETED')}>
                  <Send className="h-4 w-4" />
                  Submit Assessment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
