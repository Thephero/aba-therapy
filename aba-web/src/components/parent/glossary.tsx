'use client';

import { HelpCircle } from 'lucide-react';

// ─── Parent-friendly glossary ────────────────────────────────────────────
// ABA jargon translated into plain language for the parent portal.

export const GLOSSARY: Record<string, { plain: string; detail: string }> = {
  DTT: {
    plain: 'Structured teaching practice',
    detail:
      'Short, repeated learning attempts where your child is asked to respond, and we record whether they got it right or needed help.',
  },
  NET: {
    plain: 'Learning through play',
    detail:
      'Teaching that happens naturally during play or everyday routines, not at a table.',
  },
  Mand: {
    plain: 'A request',
    detail:
      'When your child asks for something they want — with words, sounds, gestures, or a picture. We track how often they ask on their own vs. with help.',
  },
  'SOAP note': {
    plain: 'Session summary',
    detail:
      'A short written summary the therapist completes after each session: what happened, how your child responded, and what comes next.',
  },
  'Prompt level': {
    plain: 'How much help was needed',
    detail:
      'Skills often need help at first (physical guidance), then less (a gesture or a verbal hint), until your child succeeds on their own.',
  },
  Trial: {
    plain: 'A learning attempt',
    detail:
      'One chance to practice a skill — e.g. "touch the red card" — and whether your child got it right.',
  },
  Target: {
    plain: 'A specific skill being practiced',
    detail:
      'One small, measurable skill inside a learning program, like "identifies red" or "asks for water".',
  },
  Program: {
    plain: 'A learning goal area',
    detail:
      'A group of related skills your child is working on, like colors, requesting, or self-care.',
  },
  ABC: {
    plain: 'What happened before, during, and after',
    detail:
      'We note what happened just before a behavior, what the behavior was, and what followed — to understand what triggers it.',
  },
  Frequency: {
    plain: 'How many times',
    detail: 'We count how many times a behavior happened during the session.',
  },
  Duration: {
    plain: 'How long it lasted',
    detail: 'We time how long a behavior went on during the session.',
  },
  CoSign: {
    plain: 'Supervisor checked',
    detail:
      'A senior clinician (BCBA supervisor) has reviewed and approved this session summary for accuracy.',
  },
};

export function Term({ term, fallback }: { term: string; fallback?: string }) {
  const entry = GLOSSARY[term];
  const label = fallback ?? term;
  if (!entry) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1 group relative">
      {label}
      <span className="relative inline-flex cursor-help">
        <HelpCircle className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <span className="font-semibold">{entry.plain}</span>
          <br />
          {entry.detail}
        </span>
      </span>
    </span>
  );
}

// ─── Plain-language status maps ──────────────────────────────────────────

export const PLAIN_STATUS: Record<string, string> = {
  SCHEDULED: 'Booked',
  IN_PROGRESS: 'Happening now',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
  IN_PROGRESS_T: 'Being learned',
  MASTERED: 'Learned!',
  ON_HOLD: 'Paused',
  ATTENDING: 'Attended',
  ABSENT: 'Missed',
  LATE: 'Arrived late',
  SICK: 'Sent home sick',
  OTHER: 'Other',
};

export function plainStatus(status?: string): string {
  if (!status) return '—';
  return PLAIN_STATUS[status] || status.replace(/_/g, ' ').toLowerCase();
}
