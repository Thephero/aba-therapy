'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessagesSquare, Send, ArrowLeft, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Messaging UI (thread per student) ───────────────────────────────────
// Parents get this at /dashboard/parent/messages; staff get the panel
// embedded in student pages and /dashboard/messages.

function roleLabel(role: string): string {
  switch (role) {
    case 'CENTER_ADMIN': return 'Center Admin';
    case 'SUPERVISOR': return 'Supervisor';
    case 'THERAPIST': return 'Therapist';
    case 'PARENT': return 'Parent';
    default: return role;
  }
}

export function MessagingPanel({ compact }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const { data } = await api.get('/messages/threads');
      return data.threads || [];
    },
    refetchInterval: 15000,
  });

  const { data: thread } = useQuery({
    queryKey: ['message-thread', activeStudentId],
    queryFn: async () => {
      const { data } = await api.get(`/messages/${activeStudentId}`);
      return data;
    },
    enabled: !!activeStudentId,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await api.post(`/messages/${studentId}`, { content: draft });
      setDraft('');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-thread', activeStudentId] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });

  if (threadsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // ── Thread view ──
  if (activeStudentId && thread) {
    const totalUnread = (threads || []).reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0);
    return (
      <Card className={cn('flex flex-col', compact ? 'h-[70vh]' : 'h-[calc(100vh-19rem)] min-h-[500px]')}>
        <div className="flex items-center gap-3 border-b border-gray-200 p-4">
          <button
            onClick={() => setActiveStudentId(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All conversations
          </button>
          <div className="flex-1" />
          {totalUnread > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {totalUnread} unread
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {thread.messages.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No messages yet — say hello!
            </p>
          )}
          {thread.messages.map((m: any) => (
            <div key={m.id} className={cn('flex', m.isMine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                  m.isMine
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                )}
              >
                {!m.isMine && (
                  <p className="mb-0.5 text-xs font-semibold text-indigo-200">
                    {m.senderName}
                    <span className="ml-1 font-normal text-indigo-200/70">
                      · {roleLabel(m.senderRole)}
                    </span>
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p
                  className={cn(
                    'mt-1 text-[10px]',
                    m.isMine ? 'text-indigo-200' : 'text-gray-400'
                  )}
                >
                  {new Date(m.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2 border-t border-gray-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sendMutation.mutate(activeStudentId);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    );
  }

  // ── Thread list ──
  return (
    <Card>
      <CardContent className="p-0">
        {(threads || []).length === 0 ? (
          <div className="py-12 text-center">
            <MessagesSquare className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Messages about your child will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(threads || []).map((t: any) => (
              <button
                key={t.studentId}
                onClick={() => setActiveStudentId(t.studentId)}
                className={cn(
                  'flex w-full items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors',
                  t.unreadCount > 0 && 'bg-indigo-50/50'
                )}
              >
                {t.profileImageUrl ? (
                  <img src={t.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white">
                    {t.studentName?.charAt(0) || <GraduationCap className="h-4 w-4" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{t.studentName}</p>
                    {t.unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {t.lastMessage
                      ? `${t.lastMessage.isMine ? 'You: ' : ''}${t.lastMessage.content}`
                      : 'No messages yet'}
                  </p>
                </div>
                {t.lastMessage && (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {new Date(t.lastMessage.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
