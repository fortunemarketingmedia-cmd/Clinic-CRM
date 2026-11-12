'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp, Task } from '@/types/foundation';

export type ReminderAlert = {
  key: string;
  kind: 'Followup' | 'Task';
  title: string;
  detail: string;
  dueAt: string;
};

export const REMINDER_POPUP_EVENT = 'revive:reminder-popup';

export function showReminderPopup(alert: ReminderAlert) {
  window.dispatchEvent(new CustomEvent<ReminderAlert>(REMINDER_POPUP_EVENT, { detail: alert }));
}

const isOpen = (status: string) => !['COMPLETED', 'CANCELLED'].includes(status);
const isRecent = (createdAt: string | undefined, now: number) => {
  if (!createdAt) return false;
  const age = now - new Date(createdAt).getTime();
  return age >= 0 && age <= 120_000;
};

export function useReminderNotifications() {
  const { session, selectedBranchId } = useSessionStore();

  return useQuery({
    queryKey: ['header-reminders', selectedBranchId, session?.user.id],
    queryFn: async () => {
      const params = new URLSearchParams({ scope: 'ALL' });
      if (selectedBranchId) params.set('branchId', selectedBranchId);
      if (session?.user.role === 'RECEPTIONIST') params.set('assignedUserId', session.user.id);

      const [followUps, tasks] = await Promise.all([
        apiRequest<{ data: FollowUp[] }>(`/follow-ups?${params}`),
        apiRequest<{ data: Task[] }>(`/tasks?${params}`),
      ]);
      const now = Date.now();
      const activeFollowUps = followUps.data.filter((item) => isOpen(item.status));
      const activeTasks = tasks.data.filter((item) => isOpen(item.status));
      const followUpsDueNow = activeFollowUps.filter((item) => new Date(item.dueAt).getTime() <= now);
      const followUpsReminderDue = activeFollowUps.filter((item) => {
        if (!item.reminderAt) return false;
        return new Date(item.reminderAt).getTime() <= now && new Date(item.dueAt).getTime() > now;
      });
      const tasksDue = activeTasks.filter((item) => new Date(item.reminderAt || item.dueAt).getTime() <= now);
      const followUpAlertIds = new Set([...followUpsReminderDue, ...followUpsDueNow].map((item) => item.id));
      const taskDueIds = new Set(tasksDue.map((item) => item.id));
      const alerts: ReminderAlert[] = [
        ...followUpsReminderDue.map((item) => ({
          key: `reminder-followup-${item.id}`, kind: 'Followup' as const, title: `Due soon: ${item.activityType}`,
          detail: `${item.person.fullName} · ${item.notes || 'Scheduled follow-up is approaching'}`, dueAt: item.dueAt,
        })),
        ...followUpsDueNow.map((item) => ({
          key: `due-followup-${item.id}`, kind: 'Followup' as const, title: `Due now: ${item.activityType}`,
          detail: `${item.person.fullName} · ${item.notes || 'Scheduled follow-up is ready'}`, dueAt: item.dueAt,
        })),
        ...tasksDue.map((item) => ({
          key: `due-task-${item.id}`, kind: 'Task' as const, title: item.title,
          detail: item.description || 'Assigned task is ready for action', dueAt: item.dueAt,
        })),
        ...activeFollowUps.filter((item) => !followUpAlertIds.has(item.id) && item.assignedUser.id === session?.user.id && isRecent(item.createdAt, now)).map((item) => ({
          key: `assigned-followup-${item.id}`, kind: 'Followup' as const, title: 'New follow-up scheduled',
          detail: `${item.person.fullName} · ${item.activityType}`, dueAt: item.dueAt,
        })),
        ...activeTasks.filter((item) => !taskDueIds.has(item.id) && item.assignedUser.id === session?.user.id && isRecent(item.createdAt, now)).map((item) => ({
          key: `assigned-task-${item.id}`, kind: 'Task' as const, title: 'New task assigned',
          detail: item.title, dueAt: item.dueAt,
        })),
      ].sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());

      return { count: followUpsReminderDue.length + followUpsDueNow.length + tasksDue.length, alerts };
    },
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
