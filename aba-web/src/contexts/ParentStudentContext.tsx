'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ParentStudent {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  guardianName?: string | null;
  isActive?: boolean;
  profileImageUrl?: string | null;
}

interface ParentStudentContextValue {
  students: ParentStudent[];
  student: ParentStudent | null;
  studentId: string | null;
  isLoading: boolean;
  selectStudent: (id: string) => void;
}

const ParentStudentContext = createContext<ParentStudentContextValue | null>(null);

export function ParentStudentProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('studentId');
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [selectionReady, setSelectionReady] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['parent-students'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return (data.students || []) as ParentStudent[];
    },
  });

  useEffect(() => {
    if (isLoading) return;
    const validRequestedId = requestedId && students.some((item) => item.id === requestedId) ? requestedId : null;
    const validSelectedId = selectedId && students.some((item) => item.id === selectedId) ? selectedId : null;
    const nextId = validRequestedId || validSelectedId || students[0]?.id || null;
    setSelectedId(nextId);
    setSelectionReady(true);
    if (nextId && nextId !== requestedId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('studentId', nextId);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [isLoading, pathname, requestedId, router, searchParams, selectedId, students]);

  const selectStudent = (id: string) => {
    if (!students.some((item) => item.id === id)) return;
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('studentId', id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const value = useMemo(() => ({
    students,
    student: selectionReady ? students.find((item) => item.id === selectedId) || null : null,
    studentId: selectionReady ? selectedId : null,
    isLoading: isLoading || !selectionReady,
    selectStudent,
  }), [isLoading, selectedId, selectionReady, students]);

  return <ParentStudentContext.Provider value={value}>{children}</ParentStudentContext.Provider>;
}

export function useParentStudent() {
  const context = useContext(ParentStudentContext);
  if (!context) throw new Error('useParentStudent must be used within ParentStudentProvider');
  return context;
}
