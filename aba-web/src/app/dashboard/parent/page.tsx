'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Clock, User, Activity, BookOpen, 
  CheckCircle2, GraduationCap 
} from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { PerformanceChart } from '@/components/PerformanceChart';
import { useParentStudent } from '@/contexts/ParentStudentContext';

export default function ParentDashboard() {
  const { user } = useAuth();

  const { student, isLoading: studentLoading } = useParentStudent();

  // Fetch recent sessions for the child
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['parent-sessions', student?.id],
    queryFn: async () => {
      const { data } = await api.get('/sessions', { params: { studentId: student!.id } });
      return data.sessions || [];
    },
    enabled: !!student,
  });

  // Fetch programs for the child
  const { data: programs } = useQuery({
    queryKey: ['parent-programs', student?.id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${student!.id}`);
      return data.student?.programs || [];
    },
    enabled: !!student,
  });

  // Split sessions into past and upcoming
  const now = new Date();
  const pastSessions = sessions?.filter((s: any) => 
    s.status === 'COMPLETED' || 
    (s.startedAt && new Date(s.startedAt) < now)
  ) || [];
  
  const upcomingSessions = sessions?.filter((s: any) => 
    s.status === 'SCHEDULED' || 
    (s.scheduledFor && new Date(s.scheduledFor) >= now)
  ) || [];

  // Recent completed sessions (last 5)
  const recentCompleted = pastSessions
    .filter((s: any) => s.status === 'COMPLETED')
    .slice(0, 5);

  // Next 3 upcoming sessions
  const nextUpcoming = upcomingSessions
    .filter((s: any) => s.status === 'SCHEDULED')
    .sort((a: any, b: any) => {
      const aDate = a.scheduledFor ? new Date(a.scheduledFor) : new Date();
      const bDate = b.scheduledFor ? new Date(b.scheduledFor) : new Date();
      return aDate.getTime() - bDate.getTime();
    })
    .slice(0, 3);

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
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p className="mt-1 text-indigo-100">
          Here's what's happening with {student.name}
        </p>
      </div>

      {/* Child's profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {student.profileImageUrl ? (
              <img src={student.profileImageUrl} alt={`${student.name} profile`} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-2xl font-bold text-white">
                {student.name?.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                {student.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Born {formatDate(student.dateOfBirth)}
                  </span>
                )}
                <Badge variant={student.isActive ? 'success' : 'danger'}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {student.guardianName && (
                <p className="mt-2 text-sm text-gray-500">
                  Guardian: {student.guardianName}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pastSessions.length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{upcomingSessions.length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{programs?.length || 0}</p>
                <p className="text-xs text-gray-500">Active Programs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <CheckCircle2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {recentCompleted.length > 0 ? 'Yes' : 'No'}
                </p>
                <p className="text-xs text-gray-500">Recent Activity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance chart */}
      <PerformanceChart studentId={student.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                Upcoming Sessions
              </span>
              <Link 
                href="/dashboard/parent/calendar" 
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View Calendar →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextUpcoming.length > 0 ? (
              <div className="space-y-3">
                {nextUpcoming.map((session: any) => (
                  <div 
                    key={session.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {session.scheduledFor 
                          ? new Date(session.scheduledFor).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Date TBD'
                        }
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.scheduledFor 
                            ? new Date(session.scheduledFor).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Time TBD'
                          }
                        </span>
                        {session.therapist && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {session.therapist.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Scheduled</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No upcoming sessions scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-gray-400" />
                Recent Sessions
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
            {recentCompleted.length > 0 ? (
              <div className="space-y-3">
                {recentCompleted.map((session: any) => (
                  <Link 
                    key={session.id}
                    href={`/dashboard/sessions/${session.id}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {session.startedAt 
                          ? new Date(session.startedAt).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Date unknown'
                        }
                      </p>
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
                      </div>
                    </div>
                    <Badge variant="success" className="text-[10px]">Completed</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <Activity className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No completed sessions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Programs overview */}
      {programs && programs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gray-400" />
              Learning Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((program: any) => (
                <div 
                  key={program.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{program.name}</h3>
                    <Badge variant={program.status === 'active' ? 'success' : 'warning'}>
                      {program.status || 'Active'}
                    </Badge>
                  </div>
                  {program.description && (
                    <p className="mt-2 text-sm text-gray-500">{program.description}</p>
                  )}
                  {program.targets?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Skills Being Taught
                      </p>
                      <div className="space-y-1">
                        {program.targets.slice(0, 3).map((target: any) => (
                          <div 
                            key={target.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-700">{target.skill}</span>
                            <Badge 
                              variant={
                                target.status === 'MASTERED' ? 'success' : 
                                target.status === 'IN_PROGRESS' ? 'warning' : 'default'
                              }
                              className="text-[10px]"
                            >
                              {target.status?.replace('_', ' ') || 'Pending'}
                            </Badge>
                          </div>
                        ))}
                        {program.targets.length > 3 && (
                          <p className="text-xs text-gray-400">
                            +{program.targets.length - 3} more skills
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
