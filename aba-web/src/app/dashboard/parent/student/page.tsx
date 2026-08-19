'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Clock, User, Activity, BookOpen, 
  CheckCircle2, ArrowLeft, GraduationCap, Mail, Phone, Users 
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { PerformanceChart } from '@/components/PerformanceChart';

export default function ParentStudentPage() {
  const { user } = useAuth();

  // Fetch the parent's linked child
  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['parent-student-detail'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      // Parent should only see their linked child
      const child = data.students?.[0];
      if (!child) return null;
      
      // Fetch full details
      const { data: fullData } = await api.get(`/students/${child.id}`);
      return fullData.student;
    },
  });

  // Fetch recent sessions for the child
  const { data: sessions } = useQuery({
    queryKey: ['parent-student-sessions', student?.id],
    queryFn: async () => {
      const { data } = await api.get('/sessions');
      return data.sessions || [];
    },
    enabled: !!student,
  });

  // Calculate stats
  const stats = (() => {
    if (!sessions) return { totalSessions: 0, completedSessions: 0, upcomingSessions: 0 };
    
    const completed = sessions.filter((s: any) => s.status === 'COMPLETED');
    const upcoming = sessions.filter((s: any) => s.status === 'SCHEDULED');
    
    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      upcomingSessions: upcoming.length,
    };
  })();

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="py-12 text-center">
        <GraduationCap className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-medium text-gray-900">No Child Linked</h2>
        <p className="mt-2 text-sm text-gray-500">
          Your account is not yet linked to a child. Please contact the center administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/parent"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-2xl font-bold text-white">
          {student.name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <Badge variant={student.isActive ? 'success' : 'danger'}>
              {student.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {student.dateOfBirth && (
              <span className="text-sm text-gray-500">
                <Calendar className="inline h-3.5 w-3.5 mr-1" />
                Born {formatDate(student.dateOfBirth)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.completedSessions}</p>
                <p className="text-xs text-gray-500">Sessions Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Calendar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.upcomingSessions}</p>
                <p className="text-xs text-gray-500">Upcoming Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{student.programs?.length || 0}</p>
                <p className="text-xs text-gray-500">Active Programs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance chart */}
      <PerformanceChart studentId={student.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Guardian Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              Guardian Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {student.guardianName ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4 text-gray-400" />
                  {student.guardianName}
                </div>
                {student.guardianEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {student.guardianEmail}
                  </div>
                )}
                {student.guardianPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {student.guardianPhone}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No guardian contact recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Assigned Staff */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              Care Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Supervisors */}
              {student.supervisors?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Supervisors
                  </p>
                  <div className="space-y-2">
                    {student.supervisors.map((s: any) => (
                      <div key={s.supervisor.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {s.supervisor.name.charAt(0)}
                        </div>
                        {s.supervisor.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Therapists */}
              {student.therapists?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Therapists
                  </p>
                  <div className="space-y-2">
                    {student.therapists.map((t: any) => (
                      <div key={t.therapist.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                          {t.therapist.name.charAt(0)}
                        </div>
                        {t.therapist.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!student.supervisors?.length && !student.therapists?.length) && (
                <p className="text-sm text-gray-400">No staff assigned yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs & Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-gray-400" />
            Learning Programs & Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          {student.programs?.length > 0 ? (
            <div className="space-y-6">
              {student.programs.map((program: any) => (
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
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Skills Being Taught
                      </p>
                      <div className="space-y-2">
                        {program.targets.map((target: any) => (
                          <div 
                            key={target.id}
                            className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
                          >
                            <div>
                              <span className="text-sm font-medium text-gray-700">
                                {target.skill}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({target.domain})
                              </span>
                            </div>
                            <Badge 
                              variant={
                                target.status === 'MASTERED' ? 'success' : 
                                target.status === 'IN_PROGRESS' ? 'warning' : 'default'
                              }
                            >
                              {target.status?.replace('_', ' ') || 'Pending'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <BookOpen className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">No programs assigned yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-400" />
              Recent Session History
            </span>
            <Link 
              href="/dashboard/sessions" 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View All →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.slice(0, 10).map((session: any) => (
                <Link
                  key={session.id}
                  href={`/dashboard/sessions/${session.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    session.status === 'COMPLETED' ? 'bg-emerald-100' :
                    session.status === 'IN_PROGRESS' ? 'bg-amber-100' :
                    session.status === 'SCHEDULED' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    {session.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : session.status === 'IN_PROGRESS' ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : session.status === 'SCHEDULED' ? (
                      <Calendar className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Activity className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {session.startedAt || session.scheduledFor
                          ? new Date(session.startedAt || session.scheduledFor).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Date unknown'
                        }
                      </p>
                      <Badge variant={
                        session.status === 'COMPLETED' ? 'success' :
                        session.status === 'IN_PROGRESS' ? 'warning' :
                        session.status === 'SCHEDULED' ? 'default' :
                        'danger'
                      } className="text-[10px]">
                        {session.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {session.therapist && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {session.therapist.name}
                        </span>
                      )}
                      {session._count?.trials > 0 && (
                        <span>{session._count.trials} trials</span>
                      )}
                      {session._count?.behaviorRecords > 0 && (
                        <span>{session._count.behaviorRecords} behaviors recorded</span>
                      )}
                    </div>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <Activity className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">No sessions recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


