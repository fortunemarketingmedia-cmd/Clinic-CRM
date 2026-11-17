import { cn } from '@/lib/utils';

/** Smooth cubic path through points (Catmull-Rom converted to Bézier). */
export function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Tiny trend graphic for KPI cards. Renders real series only; nothing is drawn without data. */
export function Sparkline({ values, color = '#176B78', variant = 'line', className }: { values: number[]; color?: string; variant?: 'line' | 'area' | 'bars'; className?: string }) {
  if (values.length < 2 || values.every((value) => value === 0)) {
    return <div className={cn('h-14 w-full', className)} aria-hidden><div className="mt-auto h-px w-full translate-y-12 border-t border-dashed" style={{ borderColor: `${color}55` }} /></div>;
  }
  const width = 160;
  const height = 56;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index): [number, number] => [index * step, height - 6 - (value / max) * (height - 14)]);
  const line = smoothPath(points);
  const last = points[points.length - 1];
  const gradientId = `spark-${color.replace('#', '')}-${variant}`;
  return (
    <div className={cn('relative h-14 w-full', className)} aria-hidden>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {variant === 'bars' ? (
          values.map((value, index) => {
            const barWidth = Math.max(step * 0.55, 1.5);
            const h = Math.max((value / max) * (height - 8), value ? 2 : 0);
            return <rect key={index} x={index * step - barWidth / 2} y={height - h} width={barWidth} height={h} rx={1} fill={color} opacity={index === values.length - 1 ? 1 : 0.55} />;
          })
        ) : (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {variant === 'area' ? <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} /> : null}
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {variant !== 'bars' ? <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${(last[0] / width) * 100}%`, top: `${(last[1] / height) * 100}%`, background: color }} /> : null}
    </div>
  );
}
