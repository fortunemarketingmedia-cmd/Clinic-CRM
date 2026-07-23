'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function SignaturePad({ onChange, disabled = false }: { onChange: (dataUrl: string) => void; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const ink = useRef(false); const [, setHasInk] = useState(false);
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth; const height = 140; canvas.width = width * ratio; canvas.height = height * ratio; canvas.getContext('2d')?.scale(ratio, ratio); }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { if (disabled) return; drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const context = event.currentTarget.getContext('2d'); const p = point(event); context?.beginPath(); context?.moveTo(p.x, p.y); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const context = event.currentTarget.getContext('2d'); const p = point(event); if (context) { context.strokeStyle = '#241417'; context.lineWidth = 2; context.lineCap = 'round'; context.lineTo(p.x, p.y); context.stroke(); ink.current = true; setHasInk(true); } };
  const end = () => { drawing.current = false; const canvas = canvasRef.current; if (canvas && ink.current) onChange(canvas.toDataURL('image/png')); };
  const clear = () => { if (disabled) return; const canvas = canvasRef.current; if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); ink.current = false; setHasInk(false); onChange(''); };
  return <div><canvas ref={canvasRef} className={`h-[140px] w-full touch-none rounded-md border bg-white ${disabled ? 'cursor-not-allowed opacity-60' : ''}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{disabled ? 'Read-only signature' : 'Sign inside the box'}</span><Button type="button" variant="ghost" className="h-7 px-2 text-xs" disabled={disabled} onClick={clear}>Clear</Button></div></div>;
}
