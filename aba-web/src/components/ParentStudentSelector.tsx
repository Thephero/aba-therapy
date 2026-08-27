'use client';

import { useParentStudent } from '@/contexts/ParentStudentContext';

export function ParentStudentSelector() {
  const { students, student, studentId, isLoading, selectStudent } = useParentStudent();

  if (isLoading || students.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <label htmlFor="parent-student-selector" className="text-sm font-medium text-indigo-900">
        Viewing child
      </label>
      <select
        id="parent-student-selector"
        value={studentId || student?.id || ''}
        onChange={(event) => selectStudent(event.target.value)}
        className="min-w-[220px] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <span className="text-xs text-indigo-700">Progress, sessions, and calendar are filtered to this child.</span>
    </div>
  );
}
