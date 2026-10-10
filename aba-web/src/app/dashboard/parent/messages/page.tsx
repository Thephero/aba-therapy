'use client';

import { MessagingPanel } from '@/components/MessagingPanel';

export default function ParentMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Talk to your child&apos;s care team — questions about sessions, scheduling, or progress.
        </p>
      </div>
      <MessagingPanel />
    </div>
  );
}
