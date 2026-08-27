'use client';

import { ParentStudentProvider } from '@/contexts/ParentStudentContext';
import { ParentStudentSelector } from '@/components/ParentStudentSelector';

export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentStudentProvider>
      <div className="mb-6">
        <ParentStudentSelector />
      </div>
      {children}
    </ParentStudentProvider>
  );
}
