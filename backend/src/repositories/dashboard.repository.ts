import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export type DashboardFilters = { branchId?: string; dateFrom?: Date; dateTo?: Date };
const leadSelect = { id: true, name: true, mobile: true, nextFollowupAt: true } as const;
const appointmentSelect = {
  id: true,
  appointmentAt: true,
  status: true,
  resourceType: true,
  roomNumber: true,
  branch: { select: { name: true } },
  lead: { select: { name: true, mobile: true, source: true } },
} as const;

/** Operational projection: no invoice/payment reads and no unused report dimensions. */
export const dashboardRepository = {
  async overview(filters: DashboardFilters) {
    const now = new Date();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const today = new Date(`${day}T00:00:00+05:30`);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const afterTomorrow = new Date(tomorrow.getTime() + 86_400_000);
    const monthStart = new Date(`${day.slice(0, 7)}-01T00:00:00+05:30`);
    const [year, month] = day.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(year, month, 1) - 19_800_000);
    const branch = { branchId: filters.branchId };
    const createdAt =
      filters.dateFrom || filters.dateTo
        ? { gte: filters.dateFrom, lte: filters.dateTo }
        : undefined;
    const branchSql = filters.branchId
      ? Prisma.sql`AND "branchId" = ${filters.branchId}`
      : Prisma.empty;
    const leadDateSql = Prisma.sql`${filters.dateFrom ? Prisma.sql`AND "createdAt" >= ${filters.dateFrom}` : Prisma.empty} ${filters.dateTo ? Prisma.sql`AND "createdAt" <= ${filters.dateTo}` : Prisma.empty}`;
    const appointmentDateSql = Prisma.sql`${filters.dateFrom ? Prisma.sql`AND "appointmentAt" >= ${filters.dateFrom}` : Prisma.empty} ${filters.dateTo ? Prisma.sql`AND "appointmentAt" <= ${filters.dateTo}` : Prisma.empty}`;
    const trendStart = filters.dateFrom ?? new Date(today.getTime() - 29 * 86_400_000);
    const trendEnd = filters.dateTo ?? now;
    const followUpSelect = {
      id: true,
      dueAt: true,
      person: { select: { fullName: true, primaryMobile: true } },
    } as const;
    const [
      leadTotals,
      appointmentTotals,
      patients,
      pendingFollowups,
      todayFollowups,
      todaysFollowups,
      missedFollowups,
      newLeadsNotContacted,
      postponedAppointments,
      notArrivedPatients,
      upcomingAppointments,
      recentPatients,
      byBranch,
      activeLeads,
      trendRows,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number; converted: number }>>(
        Prisma.sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'CONVERTED')::int AS converted FROM "Lead" WHERE "deletedAt" IS NULL ${branchSql} ${leadDateSql}`,
      ),
      prisma.$queryRaw<
        Array<{
          total: number;
          today: number;
          tomorrow: number;
          month: number;
          arrived: number;
          notArrived: number;
          confirmed: number;
          cancelled: number;
        }>
      >(Prisma.sql`
        SELECT count(*) FILTER (WHERE TRUE ${appointmentDateSql})::int AS total,
          count(*) FILTER (WHERE "appointmentAt" >= ${today} AND "appointmentAt" < ${tomorrow})::int AS today,
          count(*) FILTER (WHERE "appointmentAt" >= ${tomorrow} AND "appointmentAt" < ${afterTomorrow})::int AS tomorrow,
          count(*) FILTER (WHERE "appointmentAt" >= ${monthStart} AND "appointmentAt" < ${monthEnd})::int AS month,
          count(*) FILTER (WHERE status = 'CHECKED_IN' AND "appointmentAt" >= ${monthStart} AND "appointmentAt" < ${monthEnd})::int AS arrived,
          count(*) FILTER (WHERE status = 'NO_SHOW' AND "appointmentAt" >= ${monthStart} AND "appointmentAt" < ${monthEnd})::int AS "notArrived",
          count(*) FILTER (WHERE status = 'CONFIRMED' AND "appointmentAt" >= ${monthStart} AND "appointmentAt" < ${monthEnd})::int AS confirmed,
          count(*) FILTER (WHERE status = 'CANCELLED' AND "appointmentAt" >= ${monthStart} AND "appointmentAt" < ${monthEnd})::int AS cancelled
        FROM "Appointment" WHERE "deletedAt" IS NULL ${branchSql}`),
      prisma.patient.count({ where: { ...branch, createdAt } }),
      prisma.followUp.count({
        where: { ...branch, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
      prisma.followUp.count({
        where: {
          ...branch,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          dueAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.followUp.findMany({
        where: {
          ...branch,
          dueAt: { gte: today, lt: tomorrow },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: followUpSelect,
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      prisma.followUp.findMany({
        where: { ...branch, dueAt: { lt: today }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: followUpSelect,
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { ...branch, status: 'NEW', lastContactedAt: null },
        select: leadSelect,
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { ...branch, status: 'RESCHEDULED' },
        select: appointmentSelect,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { ...branch, status: 'NO_SHOW' },
        select: appointmentSelect,
        orderBy: { appointmentAt: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: {
          ...branch,
          appointmentAt: { gte: today },
          status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        },
        select: appointmentSelect,
        orderBy: { appointmentAt: 'asc' },
        take: 10,
      }),
      prisma.patient.findMany({
        where: branch,
        select: {
          id: true,
          patientNo: true,
          fullName: true,
          mobile: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.branch.findMany({
        where: filters.branchId ? { id: filters.branchId } : undefined,
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              leads: { where: { deletedAt: null } },
              appointments: { where: { deletedAt: null } },
              patients: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.lead.groupBy({
        by: ['branchId'],
        where: { ...branch, status: { not: 'CONVERTED' } },
        _count: { id: true },
      }),
      prisma.$queryRaw<Array<{ day: string; kind: string; value: number }>>(Prisma.sql`
        SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, 'leads' AS kind, count(*)::int AS value FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= ${trendStart} AND "createdAt" <= ${trendEnd} ${branchSql} GROUP BY 1
        UNION ALL SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'), 'patients', count(*)::int FROM "Patient" WHERE "deletedAt" IS NULL AND "createdAt" >= ${trendStart} AND "createdAt" <= ${trendEnd} ${branchSql} GROUP BY 1
        UNION ALL SELECT to_char("appointmentAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'), 'appointments', count(*)::int FROM "Appointment" WHERE "deletedAt" IS NULL AND "appointmentAt" >= ${trendStart} AND "appointmentAt" <= ${trendEnd} ${branchSql} GROUP BY 1
        UNION ALL SELECT to_char("dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'), 'followUps', count(*)::int FROM "FollowUp" WHERE "deletedAt" IS NULL AND "dueAt" >= ${trendStart} AND "dueAt" <= ${trendEnd} ${branchSql} GROUP BY 1`),
    ]);
    const values = new Map<string, Record<string, number>>();
    for (const row of trendRows)
      values.set(row.day, { ...values.get(row.day), [row.kind]: row.value });
    const trend = [];
    for (let time = trendStart.getTime(); time <= trendEnd.getTime(); time += 86_400_000) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(time);
      trend.push({
        date,
        leads: 0,
        patients: 0,
        appointments: 0,
        followUps: 0,
        ...values.get(date),
      });
    }
    const intake = leadTotals[0];
    const appt = appointmentTotals[0];
    return {
      totals: {
        leads: intake.total - intake.converted,
        totalLeadIntake: intake.total,
        convertedLeads: intake.converted,
        leadConversion: intake.total ? Math.round((intake.converted / intake.total) * 100) : 0,
        patients,
        appointments: appt.total,
        todayAppointments: appt.today,
        tomorrowAppointments: appt.tomorrow,
        monthAppointments: appt.month,
        arrived: appt.arrived,
        notArrived: appt.notArrived,
        confirmed: appt.confirmed,
        cancelled: appt.cancelled,
        pendingFollowups,
        todayFollowups,
      },
      byBranch: byBranch.map((row) => ({
        ...row,
        activeLeads: activeLeads.find((item) => item.branchId === row.id)?._count.id ?? 0,
      })),
      upcomingAppointments,
      recentPatients,
      analytics: { trend },
      dailyWork: {
        todaysFollowups: todaysFollowups.map((row) => ({
          id: row.id,
          name: row.person.fullName,
          mobile: row.person.primaryMobile,
          nextFollowupAt: row.dueAt,
        })),
        missedFollowups: missedFollowups.map((row) => ({
          id: row.id,
          name: row.person.fullName,
          mobile: row.person.primaryMobile,
          nextFollowupAt: row.dueAt,
        })),
        newLeadsNotContacted,
        postponedAppointments,
        notArrivedPatients,
      },
    };
  },
};
