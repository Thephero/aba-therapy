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

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['parent-students'],
    queryFn: async () => {
      const { data } = await api.get('/students');
      return (data.students || []) as ParentStudent[];
    },
  });

  useEffect(() => {
    if (requestedId && students.some((item) => item.id === requestedId)) {
      setSelectedId(requestedId);
    } else if (students.length > 0 && !students.some((item) => item.id === selectedId)) {
      setSelectedId(students[0].id);
    }
  }, [requestedId, selectedId, students]);

  const selectStudent = (id: string) => {
    if (!students.some((item) => item.id === id)) return;
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('studentId', id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const value = useMemo(() => ({
    students,
    student: students.find((item) => item.id === selectedId) || null,
    studentId: selectedId,
    isLoading,
    selectStudent,
  }), [isLoading, selectedId, students]);

  return <ParentStudentContext.Provider value={value}>{children}</ParentStudentContext.Provider>;
}

export function useParentStudent() {
  const context = useContext(ParentStudentContext);
  if (!context) throw new Error('useParentStudent must be used within ParentStudentProvider');
  return context;
}
