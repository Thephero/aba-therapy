'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/users', label: 'Users', icon: Users, roles: ['center_admin'] },
  { href: '/dashboard/students', label: 'Students', icon: GraduationCap, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/programs', label: 'Programs', icon: BookOpen, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, roles: ['center_admin', 'supervisor', 'therapist'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['center_admin', 'supervisor'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [students, users, sessions] = await Promise.all([
        api.get('/students').catch(() => ({ data: { students: [] } })),
        api.get('/users').catch(() => ({ data: { users: [] } })),
        api.get('/sessions').catch(() => ({ data: { sessions: [] } })),
      ]);
      return {
        totalStudents: students.data.students?.length || 0,
        totalStaff: users.data.users?.length || 0,
        activeSessions: sessions.data.sessions?.filter((s: any) => s.status === 'IN_PROGRESS').length || 0,
        completedToday: sessions.data.sessions?.filter((s: any) => s.status === 'COMPLETED').length || 0,
      };
    },
    refetchInterval: 30000,
  });

  if (!user) return null;

  // Backend stores roles in uppercase (e.g. CENTER_ADMIN) — normalize for comparison
  const userRole = user.role.toLowerCase();

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  const statItems = [
    { label: 'Student', value: stats?.totalStudents ?? '—', href: '/dashboard/students', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', roles: ['center_admin', 'supervisor', 'therapist'] },
    { label: 'Staff', value: stats?.totalStaff ?? '—', href: '/dashboard/users', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', roles: ['center_admin'] },
    { label: 'Active Sessions', value: stats?.activeSessions ?? '—', href: '/dashboard/sessions', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', roles: ['center_admin', 'supervisor', 'therapist'] },
    { label: 'Completed Today', value: stats?.completedToday ?? '—', href: '/dashboard/reports', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', roles: ['center_admin', 'supervisor'] },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[var(--sidebar-width)] flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">ABA</span>
        </div>
        <span className="font-semibold text-gray-900">TherapyHub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
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

      {/* Quick stats */}
      <div className="border-t border-gray-200 p-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Quick Stats
        </p>
        <div className="space-y-1.5">
          {statItems.map((item) => {
            const canAccess = item.roles.includes(userRole);
            const inner = (
              <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.bg} transition-transform duration-200 group-hover:scale-110`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-600 group-hover:text-indigo-600">{item.label}</p>
                </div>
                <span className="text-lg font-bold text-gray-900 leading-none">{item.value}</span>
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
