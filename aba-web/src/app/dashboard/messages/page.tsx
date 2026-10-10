'use client';

import { MessagingPanel } from '@/components/MessagingPanel';

export default function StaffMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Per-student conversations with parents and the care team.
        </p>
      </div>
      <MessagingPanel />
    </div>
  );
}
