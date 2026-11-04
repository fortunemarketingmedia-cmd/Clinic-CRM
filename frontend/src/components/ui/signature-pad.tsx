'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const padHeight = 140;

export function SignaturePad({ onChange, disabled = false, disabledLabel = 'Read-only signature' }: { onChange: (dataUrl: string) => void; disabled?: boolean; disabledLabel?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const ink = useRef(false); const [, setHasInk] = useState(false);

  // Size the drawing surface to the box on screen, and again whenever the box changes size (tablet rotation, window
  // resize, sidebar toggle). Without this the ink lands away from the finger after a resize. Existing ink is kept.
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth;
      if (!width || canvas.width === Math.round(width * ratio)) return;
      const previous = ink.current ? document.createElement('canvas') : null;
      if (previous) { previous.width = canvas.width; previous.height = canvas.height; previous.getContext('2d')?.drawImage(canvas, 0, 0); }
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(padHeight * ratio);
      const context = canvas.getContext('2d'); if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (previous && previous.width) context.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, width, (previous.height / previous.width) * width);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { if (disabled) return; event.preventDefault(); drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const context = event.currentTarget.getContext('2d'); const p = point(event); context?.beginPath(); context?.moveTo(p.x, p.y); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const context = event.currentTarget.getContext('2d'); const p = point(event); if (context) { context.strokeStyle = '#241417'; context.lineWidth = 2; context.lineCap = 'round'; context.lineJoin = 'round'; context.lineTo(p.x, p.y); context.stroke(); ink.current = true; setHasInk(true); } };
  const end = () => { if (!drawing.current) return; drawing.current = false; const canvas = canvasRef.current; if (canvas && ink.current) onChange(canvas.toDataURL('image/png')); };
  const clear = () => { if (disabled) return; const canvas = canvasRef.current; if (canvas) { const context = canvas.getContext('2d'); context?.save(); context?.setTransform(1, 0, 0, 1, 0, 0); context?.clearRect(0, 0, canvas.width, canvas.height); context?.restore(); } ink.current = false; setHasInk(false); onChange(''); };
  return <div><canvas ref={canvasRef} aria-label={disabled ? disabledLabel : 'Signature box: sign with a finger, stylus or mouse'} role="img" className={`h-[140px] w-full touch-none select-none rounded-md border bg-white ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} /><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{disabled ? disabledLabel : 'Sign inside the box'}</span><Button type="button" variant="ghost" className="h-7 px-2 text-xs" disabled={disabled} onClick={clear}>Clear</Button></div></div>;
}
