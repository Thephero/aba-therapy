'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { TrendIndicator } from '@/components/ui/trend-indicator';
import { Sparkline } from '@/components/ui/sparkline';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  BarChart3,
  Calendar,
  LogOut,
  Activity,
  ChevronDown,
  CreditCard,
  MessagesSquare,
  CalendarCheck2,
  Wallet,
  FolderOpen,
  Eye,
  TrendingUp,
  ListChecks,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/parent', label: 'My Dashboard', icon: LayoutDashboard, roles: ['parent'] },
  { href: '/dashboard/users', label: 'Users', icon: Users, roles: ['center_admin'] },
  { href: '/dashboard/messages', label: 'Messages', icon: MessagesSquare, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/attendance', label: 'Attendance', icon: CalendarCheck2, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/parent/messages', label: 'Messages', icon: MessagesSquare, roles: ['parent'] },
  { href: '/dashboard/parent/billing', label: 'Sessions & Payments', icon: Wallet, roles: ['parent'] },
  { href: '/dashboard/documents', label: 'Documents', icon: FolderOpen, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/parent/documents', label: 'Documents', icon: FolderOpen, roles: ['parent'] },
  { href: '/dashboard/students', label: 'Students', icon: GraduationCap, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/parent/student', label: 'My Child', icon: GraduationCap, roles: ['parent'] },
  { href: '/dashboard/programs', label: 'Programs', icon: BookOpen, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/my-day', label: 'My Day', icon: ListChecks, roles: ['therapist', 'supervisor', 'center_admin'] },
  { href: '/dashboard/parent/student', label: 'Session History', icon: ClipboardList, roles: ['parent'] },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/parent/calendar', label: 'Calendar', icon: Calendar, roles: ['parent'] },
  { href: '/dashboard/parent/progress', label: 'Skill Progress', icon: TrendingUp, roles: ['parent'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['center_admin', 'supervisor'] },
  { href: '/dashboard/lookout', label: 'Lookout', icon: Eye, roles: ['supervisor'] },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, roles: ['center_admin'] },
];

type TrendPeriod = 'today' | 'week' | 'month';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [statsOpen, setStatsOpen] = useState(false); // start minimised
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('today');

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', trendPeriod],
    queryFn: async () => {
      const [users, sessions, summary] = await Promise.all([
        api.get('/users').catch(() => ({ data: { users: [] } })),
        api.get('/sessions').catch(() => ({ data: { sessions: [] } })),
        api.get(`/dashboard/summary?period=${trendPeriod}`),
      ]);
      return {
        totalStudents: summary.data.summary?.totalStudents ?? 0,
        totalStaff: users.data.users?.length || 0,
        activeSessions: sessions.data.sessions?.filter((s: any) => s.status === 'IN_PROGRESS').length || 0,
        completedToday: sessions.data.sessions?.filter((s: any) => s.status === 'COMPLETED').length || 0,
        trends: (summary.data.summary as any)?.trends || {},
        series: (summary.data.summary as any)?.series || [],
      };
    },
    refetchInterval: 30000,
  });

  if (!user) return null;

  // Backend stores roles in uppercase (e.g. CENTER_ADMIN) — normalize for comparison
  const userRole = user.role.toLowerCase();

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  const series = (stats?.series || []) as any[];

  // Parents get a simplified stat rail: just their child's sessions + pending notes.
  const statItems = userRole === 'parent'
    ? [
        { label: 'My Child', value: stats?.totalStudents ?? '—', trend: null, spark: [], href: '/dashboard/parent/student', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', sparkColor: '#2563eb', roles: ['parent'] },
        { label: 'Sessions', value: stats?.activeSessions ?? '—', trend: null, spark: series.map((d) => d.sessions as number), href: '/dashboard/parent/student', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', sparkColor: '#059669', roles: ['parent'] },
      ]
    : [
        { label: 'Student', value: stats?.totalStudents ?? '—', trend: stats?.trends?.newStudents, spark: series.map((d) => d.newStudents as number), href: '/dashboard/students', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', sparkColor: '#2563eb', roles: ['center_admin', 'supervisor', 'therapist'] },
        { label: 'Staff', value: stats?.totalStaff ?? '—', trend: stats?.trends?.newStaff, spark: series.map((d) => d.newStaff as number), href: '/dashboard/users', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', sparkColor: '#9333ea', roles: ['center_admin'] },
        { label: 'Active Sessions', value: stats?.activeSessions ?? '—', trend: stats?.trends?.periodInProgress, spark: series.map((d) => d.inProgress as number), href: '/dashboard/sessions', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', sparkColor: '#059669', roles: ['center_admin', 'supervisor', 'therapist'] },
        { label: 'Completed Today', value: stats?.completedToday ?? '—', trend: stats?.trends?.periodCompleted, spark: series.map((d) => d.completed as number), href: '/dashboard/reports', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', sparkColor: '#d97706', roles: ['center_admin', 'supervisor'] },
      ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[var(--sidebar-width)] flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">AZM</span>
        </div>
        <span className="font-semibold text-gray-900">AZM Therapy</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href === '/dashboard/parent' && pathname === '/dashboard/parent') ||
            (item.href !== '/dashboard' && item.href !== '/dashboard/parent' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-indigo-600' : 'text-gray-400')} />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick stats — collapsible */}
      <div className="border-t border-gray-200 p-4">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <button
            onClick={() => setStatsOpen((open) => !open)}
            className="flex items-center gap-1 text-left transition-colors hover:opacity-80"
            aria-expanded={statsOpen}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Quick Stats
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
                statsOpen ? 'rotate-180' : 'rotate-0'
              )}
            />
          </button>
          <div className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            {(['today', 'week', 'month'] as TrendPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setTrendPeriod(p)}
                title={`Trend vs previous ${p === 'today' ? 'day' : p}`}
                className={cn(
                  'px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded transition-all duration-200',
                  trendPeriod === p
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {p === 'today' ? 'D' : p === 'week' ? 'W' : 'M'}
              </button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            'grid transition-all duration-200 ease-in-out',
            statsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1.5 pt-1">
              {statItems.map((item) => {
                const canAccess = item.roles.includes(userRole);
                const inner = (
                  <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.bg} transition-transform duration-200 group-hover:scale-110`}>
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-600 group-hover:text-indigo-600">{item.label}</p>
                      <div className="mt-0.5 flex items-end gap-1">
                        <Sparkline data={item.spark} color={item.sparkColor} width={56} height={16} className="shrink-0" />
                      </div>
                    </div>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="text-base font-bold text-gray-900 leading-none">{item.value}</span>
                      <TrendIndicator value={item.trend} compact />
                    </span>
                  </div>
                );
                return canAccess ? (
                  <Link key={item.label} href={item.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={item.label}>{inner}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* User info & logout */}
      <div className="border-t border-gray-200 p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
