'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Printer, GraduationCap, BookOpen } from 'lucide-react';
import { useParentStudent } from '@/contexts/ParentStudentContext';
import { formatDate } from '@/lib/utils';
import { plainStatus } from '@/components/parent/glossary';

interface TargetProgress {
  targetId: string;
  skill: string;
  status: string;
  firstAccuracy: number | null;
  latestAccuracy: number | null;
  totalTrials: number;
  trend: 'improving' | 'steady' | 'dropping' | 'new';
  parentSummary: string;
}

interface ProgramProgress {
  programId: string;
  name: string;
  status: string;
  targets: TargetProgress[];
}

function TrendBadge({ trend }: { trend: TargetProgress['trend'] }) {
  if (trend === 'improving')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <TrendingUp className="h-3.5 w-3.5" /> Improving
      </span>
    );
  if (trend === 'dropping')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <TrendingDown className="h-3.5 w-3.5" /> Needs attention
      </span>
    );
  if (trend === 'steady')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
        <Minus className="h-3.5 w-3.5" /> Steady
      </span>
    );
  return <span className="text-xs text-gray-400">Just started</span>;
}

export default function ParentProgressPage() {
  const { student } = useParentStudent();

  const { data, isLoading } = useQuery({
    queryKey: ['parent-skill-progress', student?.id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${student!.id}/skill-progress`);
      return data;
    },
    enabled: !!student,
  });

  const { data: studentFull } = useQuery({
    queryKey: ['parent-report-student', student?.id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${student!.id}`);
      return data.student;
    },
    enabled: !!student,
  });

  const programs: ProgramProgress[] = data?.programs || [];
  const learnedCount = programs.reduce(
    (sum: number, p) => sum + p.targets.filter((t) => t.status === 'MASTERED').length,
    0
  );

  if (isLoading || !student) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skill progress</h1>
          <p className="mt-1 text-sm text-gray-500">
            How {student.name} is doing on each skill they&apos;re practicing — in plain language.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print / save as PDF
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-sm text-gray-500">No learning programs yet for {student.name}.</p>
        </div>
      ) : (
        <>
          {/* Report header (visible in print) */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold">Progress Report — {studentFull?.name || student.name}</h1>
            <p className="text-sm text-gray-500">Generated {formatDate(new Date())}</p>
          </div>

          {/* Summary strip */}
          <Card className="print:shadow-none">
            <CardContent className="p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{learnedCount}</p>
                <p className="text-xs text-gray-500">Skills learned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {programs.reduce((sum: number, p) => sum + p.targets.length, 0) - learnedCount}
                </p>
                <p className="text-xs text-gray-500">Skills in progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {programs.reduce((sum: number, p) => sum + p.targets.filter((t) => t.trend === 'improving').length, 0)}
                </p>
                <p className="text-xs text-gray-500">Improving this period</p>
              </div>
            </CardContent>
          </Card>

          {/* Per-program progress */}
          {programs.map((program) => (
            <Card key={program.programId} className="print:break-inside-avoid print:shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-gray-400" />
                  {program.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {program.targets.map((target) => (
                    <div
                      key={target.targetId}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{target.skill}</span>
                          <Badge
                            variant={
                              target.status === 'MASTERED' ? 'success'
                                : target.status === 'IN_PROGRESS' ? 'warning' : 'default'
                            }
                            className="text-[10px]"
                          >
                            {plainStatus(target.status)}
                          </Badge>
                        </div>
                        <TrendBadge trend={target.trend} />
                      </div>
                      <div className="mt-2">
                        {/* Simple accuracy bar */}
                        {target.latestAccuracy !== null && (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-full max-w-xs rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  target.latestAccuracy >= 80 ? 'bg-emerald-500'
                                    : target.latestAccuracy >= 50 ? 'bg-blue-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${target.latestAccuracy}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">
                              {target.latestAccuracy}%
                            </span>
                          </div>
                        )}
                        <p className="mt-2 text-sm text-gray-700">{target.parentSummary}</p>
                        {target.totalTrials > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            Based on {target.totalTrials} learning attempts
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {program.targets.length === 0 && (
                    <p className="text-sm text-gray-400">No skills in this program yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
