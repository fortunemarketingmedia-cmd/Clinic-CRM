'use client';

import { useId, useState } from 'react';
import { smoothPath } from '@/components/ui/sparkline';

export type TrendSeries = { key: string; label: string; color: string };

/** Large smooth line chart with a soft area under the first series, dashed grid and a hover read-out. */
export function TrendChart({ data, series }: { data: Array<{ label: string } & Record<string, number | string>>; series: TrendSeries[] }) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 760;
  const height = 300;
  const left = 36;
  const right = 12;
  const top = 16;
  const bottom = 30;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const peak = Math.max(...data.flatMap((row) => series.map((entry) => Number(row[entry.key] ?? 0))), 0);
  const niceMax = Math.max(4, Math.ceil(peak / 4) * 4);
  const x = (index: number) => left + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value: number) => top + plotH - (value / niceMax) * plotH;
  const interval = Math.max(1, Math.ceil(data.length / 7));
  const hoverRow = hover === null ? null : data[hover];

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={`Trend of ${series.map((entry) => entry.label).join(', ')}`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[300px] w-full"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = ((event.clientX - rect.left) / rect.width) * width;
          const index = Math.round(((ratio - left) / plotW) * (data.length - 1));
          setHover(Math.min(Math.max(index, 0), data.length - 1));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((step) => {
          const value = (niceMax / 4) * step;
          return (
            <g key={step}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#DCE8E8" strokeDasharray="3 5" />
              <text x={left - 8} y={y(value) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(value)}</text>
            </g>
          );
        })}
        {series.map((entry, seriesIndex) => {
          const points = data.map((row, index): [number, number] => [x(index), y(Number(row[entry.key] ?? 0))]);
          const path = smoothPath(points);
          return (
            <g key={entry.key}>
              {seriesIndex === 0 && points.length > 1 ? <path d={`${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradient})`} /> : null}
              <path d={path} fill="none" stroke={entry.color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {data.map((row, index) => (index % interval === 0 || index === data.length - 1 ? <text key={row.label} x={x(index)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{row.label}</text> : null))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke="#176B78" strokeDasharray="3 4" opacity={0.5} />
            {series.map((entry) => <circle key={entry.key} cx={x(hover)} cy={y(Number(data[hover][entry.key] ?? 0))} r={4} fill="#fff" stroke={entry.color} strokeWidth={2.25} />)}
          </g>
        ) : null}
      </svg>
      {hoverRow && hover !== null ? (
        <div className="pointer-events-none absolute top-2 z-10 rounded-xl bg-foreground px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${Math.min(Math.max((x(hover) / width) * 100, 12), 82)}%`, transform: 'translateX(-50%)' }}>
          <div className="mb-1 font-medium">{hoverRow.label}</div>
          {series.map((entry) => <div key={entry.key} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: entry.color }} />{entry.label}<b className="ml-auto pl-3 tabular-nums">{Number(hoverRow[entry.key] ?? 0)}</b></div>)}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((entry) => <span key={entry.key} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: entry.color }} />{entry.label}</span>)}
      </div>
    </div>
  );
}
