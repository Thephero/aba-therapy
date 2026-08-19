'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { MiniDashboard } from '@/components/MiniDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isParent = user?.role === 'parent';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Redirect parents to their specific dashboard
    if (!loading && user && isParent && window.location.pathname === '/dashboard') {
      router.push('/dashboard/parent');
    }
  }, [user, loading, router, isParent]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-[var(--sidebar-width)] flex-1 p-8">
        {/* Welcome banner – top left above everything */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.name?.split(' ')[0]}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {user?.centerName} &middot;{' '}
              <span className="capitalize font-medium text-indigo-600">
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
          {(user?.role === 'therapist' || user?.role === 'supervisor') && (
            <Link href="/dashboard/sessions">
              <Button className="gap-2">
                <Play className="h-4 w-4" />
                Run a Session
              </Button>
            </Link>
          )}
        </div>

        {!isParent && <MiniDashboard />}
        {children}
      </main>
    </div>
  );
}
