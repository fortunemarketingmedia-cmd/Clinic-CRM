import crypto from 'node:crypto';
import type { WhatsAppMessageStatus } from '@prisma/client';

const optOuts = new Set(['STOP', 'UNSUBSCRIBE', 'REMOVE ME', 'DO NOT MESSAGE']);
export const normalizeWhatsAppPhone = (value: string) => value.replace(/\D/g, '').replace(/^0+/, '');
export function isWhatsAppOptOut(value?: string | null) { return optOuts.has((value ?? '').trim().toUpperCase().replace(/[.!]+$/g, '')); }

export function verifyWhatsAppSignature(rawBody: Buffer, signature: string | undefined, appSecret: string) {
  if (!signature?.startsWith('sha256=')) return false;
  const provided = signature.slice(7);
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function isQuietHour(date: Date, startMinutes: number, endMinutes: number, timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const minute = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return startMinutes > endMinutes ? minute >= startMinutes || minute < endMinutes : minute >= startMinutes && minute < endMinutes;
}

export function nextQuietHoursEnd(date: Date, endMinutes: number, timeZone = 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const day = formatter.format(date);
  const offset = timeZone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  let end = new Date(`${day}T${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00${offset}`);
  if (end <= date) end = new Date(end.getTime() + 86_400_000);
  return end;
}

const rank: Record<WhatsAppMessageStatus, number> = { SCHEDULED: 0, QUEUED: 1, SUBMITTED: 2, SENT: 3, DELIVERED: 4, READ: 5, FAILED: 6, CANCELLED: 6, RECEIVED: 6 };
export function canAdvanceMessageStatus(current: WhatsAppMessageStatus, next: WhatsAppMessageStatus) { return current === next || rank[next] >= rank[current]; }

export function renderWhatsAppTemplate(body: string, variables: string[]) { return body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => variables[Number(index) - 1] ?? `{{${index}}}`); }
