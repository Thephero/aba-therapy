'use client';

import { useId } from 'react';

interface SparklineProps {
  /** Values to plot (e.g. last 7 days) */
  data: number[];
  /** Hex color for the line + gradient, e.g. '#6366f1' */
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color = '#6366f1', width = 64, height = 18, className }: SparklineProps) {
  const gradId = useId().replace(/:/g, '');
  if (!data || data.length === 0) return null;

  const pad = 2;
  // Flat data (all zeros or all equal) renders a straight line centered vertically
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  const midY = height / 2;
  const step = width / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => {
    const x = (i * step).toFixed(2);
    const y =
      range === 0
        ? midY.toFixed(2)
        : (height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(2);
    return `${x},${y}`;
  });

  const line = points.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
