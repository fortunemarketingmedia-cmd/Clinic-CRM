const DEFAULT_REMINDER_LEAD_MS = 15 * 60_000;

export function defaultReminderAt(dueAt: Date, now = new Date()) {
  return new Date(Math.max(now.getTime(), dueAt.getTime() - DEFAULT_REMINDER_LEAD_MS));
}

export function isReminderDue(reminderAt: Date | null | undefined, dueAt: Date, now = new Date()) {
  return (reminderAt ?? dueAt).getTime() <= now.getTime();
}
