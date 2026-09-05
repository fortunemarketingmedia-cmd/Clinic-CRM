import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultReminderAt, isReminderDue } from './work-reminder.js';

test('work reminders default to fifteen minutes before the due time', () => {
  const now = new Date('2026-09-05T09:00:00.000Z');
  const dueAt = new Date('2026-09-05T10:00:00.000Z');
  assert.equal(defaultReminderAt(dueAt, now).toISOString(), '2026-09-05T09:45:00.000Z');
});

test('overdue work alerts immediately instead of receiving a reminder in the past', () => {
  const now = new Date('2026-09-05T10:00:00.000Z');
  const dueAt = new Date('2026-09-05T09:30:00.000Z');
  assert.equal(defaultReminderAt(dueAt, now).toISOString(), now.toISOString());
  assert.equal(isReminderDue(undefined, dueAt, now), true);
});
