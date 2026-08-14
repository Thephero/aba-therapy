'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  /** Percentage change vs previous period, or null/undefined when no baseline exists */
  value?: number | null;
  /** When true, a downward move is considered "good" (e.g. fewer behavior incidents) */
  invert?: boolean;
  /** Smaller size for tight inline spots */
  compact?: boolean;
  className?: string;
}

export function TrendIndicator({ value, invert = false, compact = false, className }: TrendIndicatorProps) {
  if (value === null || value === undefined) return null;

  const iconSize = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const base = compact
    ? 'gap-0.5 px-1 py-px text-[9px] leading-tight'
    : 'gap-0.5 px-1.5 py-0.5 text-[10px]';

  if (value === 0) {
    return (
      <span
        title="No change vs previous period"
        className={cn(
          'inline-flex items-center rounded-full bg-gray-100 font-semibold text-gray-500',
          base,
          className
        )}
      >
        <Minus className={iconSize} />
        0%
      </span>
    );
  }

  const isUp = value > 0;
  // For invert metrics (behaviors), down is good → green; up is bad → red
  const isGood = invert ? !isUp : isUp;

  return (
    <span
      title={`${Math.abs(value)}% ${isUp ? 'more' : 'less'} than previous period`}
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
        base,
        className
      )}
    >
      {isUp ? <TrendingUp className={iconSize} /> : <TrendingDown className={iconSize} />}
      {Math.abs(value)}%
    </span>
  );
}
