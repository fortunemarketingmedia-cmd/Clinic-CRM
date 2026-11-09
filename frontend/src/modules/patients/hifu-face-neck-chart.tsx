'use client';

import { cn } from '@/lib/utils';

// Clean vector redraw of the clinic's printed HIFU "Face & Neck Patient Record" sheet (4.5mm, 3.0mm and 1.5mm depth rows).
// Each white box on the sheet is an input placed exactly over that box, where the KJ for the zone is written.
export const hifuChart = { src: '/charts/hifu-face-neck-chart.svg', ratio: 1734 / 1728 };

// [box id, left %, top %, width %, height %] measured on the sheet image. Id = depth (d45/d30/d15), side (R/L, C = centre) and number.
export const hifuBoxes: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ['d45-R1', 21.16, 6.08, 3.23, 2.43],
  ['d45-R2', 17.19, 10.82, 3.23, 2.31],
  ['d45-R3', 21.97, 19.21, 3.17, 2.20],
  ['d45-R4', 26.30, 19.27, 3.11, 2.20],
  ['d45-R5', 22.78, 25.17, 3.11, 2.14],
  ['d45-R6', 27.39, 26.16, 3.11, 2.08],
  ['d45-R7', 18.51, 29.51, 3.00, 2.08],
  ['d45-R8', 22.38, 29.51, 3.11, 2.08],
  ['d45-R9', 26.99, 29.51, 3.06, 2.08],
  ['d45-C1', 48.79, 25.46, 2.94, 2.03],
  ['d45-L1', 75.09, 6.02, 3.23, 2.31],
  ['d45-L2', 79.47, 10.47, 3.23, 2.31],
  ['d45-L3', 70.99, 18.87, 3.11, 2.14],
  ['d45-L4', 75.32, 18.63, 3.11, 2.20],
  ['d45-L5', 74.97, 24.48, 3.17, 2.08],
  ['d45-L6', 70.36, 25.58, 3.17, 2.03],
  ['d45-L7', 71.05, 28.88, 3.11, 2.03],
  ['d45-L8', 75.72, 28.70, 3.11, 2.08],
  ['d45-L9', 79.82, 28.53, 3.00, 2.14],
  ['d30-R1', 22.49, 39.35, 3.23, 2.20],
  ['d30-R2', 18.63, 43.75, 3.11, 2.26],
  ['d30-R3', 26.47, 46.12, 3.06, 2.14],
  ['d30-R4', 19.15, 51.68, 3.11, 2.26],
  ['d30-R5', 23.24, 51.68, 3.11, 2.14],
  ['d30-R6', 27.45, 51.56, 3.11, 2.20],
  ['d30-R7', 19.55, 56.37, 3.00, 2.20],
  ['d30-R8', 23.99, 57.41, 3.06, 2.14],
  ['d30-R9', 28.43, 58.28, 3.11, 2.20],
  ['d30-R10', 19.49, 61.69, 3.06, 2.08],
  ['d30-R11', 23.41, 61.69, 3.17, 2.08],
  ['d30-R12', 27.91, 61.69, 3.17, 2.08],
  ['d30-C1', 49.88, 57.23, 3.06, 2.08],
  ['d30-L1', 76.24, 38.25, 3.29, 2.31],
  ['d30-L2', 80.68, 42.53, 3.40, 2.43],
  ['d30-L3', 72.90, 45.20, 3.17, 2.20],
  ['d30-L4', 72.26, 50.87, 3.17, 2.14],
  ['d30-L5', 76.64, 50.75, 3.11, 2.20],
  ['d30-L6', 80.85, 50.64, 3.29, 2.20],
  ['d30-L7', 80.91, 55.38, 3.23, 2.20],
  ['d30-L8', 76.30, 56.60, 3.23, 2.14],
  ['d30-L9', 71.74, 57.64, 3.23, 2.14],
  ['d30-L10', 72.43, 60.88, 3.40, 2.20],
  ['d30-L11', 77.16, 60.88, 3.34, 2.20],
  ['d30-L12', 81.20, 60.88, 3.34, 2.20],
  ['d15-R1', 21.16, 70.08, 3.23, 2.60],
  ['d15-R2', 16.96, 75.23, 3.17, 2.60],
  ['d15-R3', 24.86, 77.95, 3.11, 2.55],
  ['d15-R4', 17.13, 84.43, 3.17, 2.55],
  ['d15-R5', 21.34, 84.49, 3.17, 2.43],
  ['d15-R6', 25.66, 84.55, 3.11, 2.49],
  ['d15-R7', 29.47, 83.51, 3.23, 2.55],
  ['d15-R8', 17.36, 89.93, 3.11, 2.49],
  ['d15-R9', 21.91, 91.15, 3.17, 2.43],
  ['d15-R10', 26.53, 92.19, 3.17, 2.55],
  ['d15-R11', 17.30, 96.06, 3.11, 2.31],
  ['d15-R12', 21.34, 96.06, 3.11, 2.37],
  ['d15-R13', 25.95, 96.06, 3.11, 2.37],
  ['d15-C1', 48.21, 91.67, 3.00, 2.37],
  ['d15-L1', 75.66, 70.54, 3.23, 2.60],
  ['d15-L2', 79.70, 75.64, 3.23, 2.66],
  ['d15-L3', 71.80, 78.36, 3.17, 1.79],
  ['d15-L4', 67.36, 84.61, 2.88, 1.97],
  ['d15-L5', 70.76, 84.78, 3.17, 2.49],
  ['d15-L6', 75.09, 84.78, 3.11, 2.49],
  ['d15-L7', 79.30, 84.84, 3.17, 2.55],
  ['d15-L8', 78.84, 90.28, 3.23, 2.55],
  ['d15-L9', 74.34, 91.49, 3.11, 2.43],
  ['d15-L10', 69.72, 92.48, 3.17, 2.55],
  ['d15-L11', 70.24, 96.35, 3.06, 2.37],
  ['d15-L12', 74.80, 96.30, 3.23, 2.55],
  ['d15-L13', 78.84, 96.41, 3.06, 2.31],
];

const depthLabels: Record<string, string> = { d45: '4.5mm', d30: '3.0mm', d15: '1.5mm' };
const sideLabels: Record<string, string> = { R: 'Right', L: 'Left', C: 'Centre' };
export const describeHifuBox = (id: string) => {
  const [depth, box = ''] = id.split('-');
  return `${depthLabels[depth] ?? depth} depth · ${sideLabels[box[0]] ?? box[0]} box ${box.slice(1)}`;
};

export function HifuFaceNeckChart({ values, onChange, className }: { values: Record<string, string>; onChange?: (id: string, value: string) => void; className?: string }) {
  return <div className={cn('relative w-full select-none [container-type:inline-size]', className)} style={{ aspectRatio: hifuChart.ratio }}>
    <img src={hifuChart.src} alt="HIFU face and neck patient record" draggable={false} className="absolute inset-0 size-full object-contain" />
    {hifuBoxes.map(([id, left, top, width, height]) => {
      const style = { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, fontSize: '1.2cqw' };
      return onChange
        ? <input key={id} value={values[id] ?? ''} onChange={(event) => onChange(id, event.target.value)} inputMode="decimal" maxLength={12} autoComplete="off" aria-label={`KJ for ${describeHifuBox(id)}`} title={describeHifuBox(id)} className="absolute rounded-[3px] border border-[#9e8c91] bg-white p-0 text-center font-semibold leading-none text-[#241417] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" style={style} />
        : <span key={id} title={describeHifuBox(id)} className="absolute grid place-items-center overflow-hidden whitespace-nowrap font-semibold leading-none text-[#241417]" style={style}>{values[id] ?? ''}</span>;
    })}
  </div>;
}
