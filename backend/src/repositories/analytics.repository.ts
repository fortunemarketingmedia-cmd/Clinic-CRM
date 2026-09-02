import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export const analyticsRepository = {
  async overview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date } = {}) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = endOfDay(tomorrow);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const createdAtFilter =
      filters.dateFrom || filters.dateTo
        ? { gte: filters.dateFrom, lte: filters.dateTo }
        : undefined;
    const branchFilter = filters.branchId ? { branchId: filters.branchId } : {};

    const [
      leads,
      totalLeadIntake,
      convertedLeads,
      patients,
      appointments,
      todayAppointments,
      tomorrowAppointments,
      monthAppointments,
      arrived,
      notArrived,
      cancelled,
      confirmed,
      invoices,
      todayInvoices,
      monthInvoices,
      pendingFollowups,
      todaysFollowups,
      missedFollowups,
      newLeadsNotContacted,
      postponedAppointments,
      notArrivedPatients,
      pendingPaymentInvoices,
      futureAppointments,
      recentAppointments,
      recentPatients,
    ] = await Promise.all([
      prisma.lead.count({
        where: { ...branchFilter, createdAt: createdAtFilter, status: { not: 'CONVERTED' } },
      }),
      prisma.lead.count({ where: { ...branchFilter, createdAt: createdAtFilter } }),
      prisma.lead.count({
        where: { ...branchFilter, createdAt: createdAtFilter, status: 'CONVERTED' },
      }),
      prisma.patient.count({ where: { ...branchFilter, createdAt: createdAtFilter } }),
      prisma.appointment.count({ where: { ...branchFilter, appointmentAt: createdAtFilter } }),
      prisma.appointment.count({
        where: { ...branchFilter, appointmentAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.appointment.count({
        where: { ...branchFilter, appointmentAt: { gte: tomorrow, lte: tomorrowEnd } },
      }),
      prisma.appointment.count({
        where: { ...branchFilter, appointmentAt: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.appointment.count({
        where: {
          ...branchFilter,
          status: 'CHECKED_IN',
          appointmentAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          ...branchFilter,
          status: 'NO_SHOW',
          appointmentAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          ...branchFilter,
          status: 'CANCELLED',
          appointmentAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          ...branchFilter,
          status: 'CONFIRMED',
          appointmentAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.invoice.aggregate({
        where: { ...branchFilter, invoiceDate: createdAtFilter },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { ...branchFilter, invoiceDate: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { ...branchFilter, invoiceDate: { gte: monthStart, lte: monthEnd } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.session.count({ where: { patient: branchFilter, followupDate: { gte: new Date() } } }),
      prisma.lead.findMany({
        where: {
          ...branchFilter,
          nextFollowupAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CONVERTED', 'CANCELLED'] },
        },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { nextFollowupAt: 'asc' },
        take: 10,
      }),
      prisma.lead.findMany({
        where: {
          ...branchFilter,
          nextFollowupAt: { lt: todayStart },
          status: { notIn: ['CONVERTED', 'CANCELLED'] },
        },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { nextFollowupAt: 'asc' },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { ...branchFilter, status: 'NEW', lastContactedAt: null },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { ...branchFilter, status: 'RESCHEDULED' },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { ...branchFilter, status: 'NO_SHOW' },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'desc' },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: { ...branchFilter, status: { in: ['DRAFT', 'PARTIAL'] } },
        include: { branch: true, patient: true, payments: true },
        orderBy: { invoiceDate: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: {
          ...branchFilter,
          appointmentAt: { gte: todayStart },
          status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { ...branchFilter, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'desc' },
        take: 10,
      }),
      prisma.patient.findMany({
        where: branchFilter,
        include: { branch: true, lead: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const [byBranch, activeLeadsByBranch] = await Promise.all([
      prisma.branch.findMany({
        where: filters.branchId ? { id: filters.branchId } : undefined,
        include: {
          _count: {
            select: { leads: true, appointments: true, patients: true, invoices: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.lead.groupBy({
        by: ['branchId'],
        where: { ...branchFilter, status: { not: 'CONVERTED' } },
        _count: { id: true },
      }),
    ]);

    const trendStart = filters.dateFrom ?? startOfDay(new Date(now.getTime() - 29 * 86_400_000));
    const trendEnd = filters.dateTo ?? now;
    const branchSql = filters.branchId
      ? Prisma.sql`AND "branchId" = ${filters.branchId}`
      : Prisma.empty;
    const [
      leadByStatus,
      leadBySource,
      leadByScore,
      leadByPriority,
      patientByStatus,
      appointmentByStatus,
      followUpByStatus,
      followUpByChannel,
      followUpByActivity,
      openFollowUps,
      overdueFollowUps,
      invoiceByStatus,
      invoiceSummary,
      gstInvoiceSummary,
      nonGstInvoiceSummary,
      paymentByMode,
      paymentSummary,
      trendRows,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ['status'],
        where: { ...branchFilter, createdAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...branchFilter, createdAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['scoreCategory'],
        where: { ...branchFilter, createdAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['priority'],
        where: { ...branchFilter, createdAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.patient.groupBy({
        by: ['status'],
        where: { ...branchFilter, createdAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { ...branchFilter, appointmentAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.followUp.groupBy({
        by: ['status'],
        where: { ...branchFilter, dueAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.followUp.groupBy({
        by: ['channel'],
        where: { ...branchFilter, dueAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.followUp.groupBy({
        by: ['activityType'],
        where: { ...branchFilter, dueAt: createdAtFilter },
        _count: { id: true },
      }),
      prisma.followUp.count({
        where: {
          ...branchFilter,
          dueAt: createdAtFilter,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.followUp.count({
        where: {
          ...branchFilter,
          dueAt: { ...(createdAtFilter ?? {}), lt: now },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { ...branchFilter, invoiceDate: createdAtFilter },
        _count: { id: true },
        _sum: { totalAmount: true, paidAmount: true, outstandingAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...branchFilter,
          invoiceDate: createdAtFilter,
          status: { not: 'CANCELLED' },
        },
        _sum: { subtotal: true, discount: true, taxAmount: true, totalAmount: true, paidAmount: true, outstandingAmount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { ...branchFilter, invoiceDate: createdAtFilter, status: { not: 'CANCELLED' }, taxAmount: { gt: 0 } },
        _sum: { totalAmount: true, taxAmount: true, paidAmount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { ...branchFilter, invoiceDate: createdAtFilter, status: { not: 'CANCELLED' }, taxAmount: 0 },
        _sum: { totalAmount: true, paidAmount: true },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['mode'],
        where: {
          ...branchFilter,
          paidAt: createdAtFilter,
          status: 'COMPLETED',
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          ...branchFilter,
          paidAt: createdAtFilter,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.$queryRaw<Array<{ day: string; kind: string; value: number }>>(Prisma.sql`
        SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'leads' AS kind, COUNT(*)::double precision AS value
        FROM "Lead"
        WHERE "createdAt" >= ${trendStart} AND "createdAt" <= ${trendEnd} ${branchSql}
        GROUP BY 1
        UNION ALL
        SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'patients' AS kind, COUNT(*)::double precision AS value
        FROM "Patient"
        WHERE "createdAt" >= ${trendStart} AND "createdAt" <= ${trendEnd} ${branchSql}
        GROUP BY 1
        UNION ALL
        SELECT to_char(("appointmentAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'appointments' AS kind, COUNT(*)::double precision AS value
        FROM "Appointment"
        WHERE "appointmentAt" >= ${trendStart} AND "appointmentAt" <= ${trendEnd} ${branchSql}
        GROUP BY 1
        UNION ALL
        SELECT to_char(("dueAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'followUps' AS kind, COUNT(*)::double precision AS value
        FROM "FollowUp"
        WHERE "dueAt" >= ${trendStart} AND "dueAt" <= ${trendEnd} ${branchSql}
        GROUP BY 1
        UNION ALL
        SELECT to_char(("invoiceDate" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'billed' AS kind, COALESCE(SUM("totalAmount"), 0)::double precision AS value
        FROM "Invoice"
        WHERE "invoiceDate" >= ${trendStart} AND "invoiceDate" <= ${trendEnd}
          AND "status" <> 'CANCELLED' ${branchSql}
        GROUP BY 1
        UNION ALL
        SELECT to_char(("paidAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
               'collected' AS kind, COALESCE(SUM("amount"), 0)::double precision AS value
        FROM "Payment"
        WHERE "paidAt" >= ${trendStart} AND "paidAt" <= ${trendEnd}
          AND "status" = 'COMPLETED' ${branchSql}
        GROUP BY 1
        ORDER BY 1, 2
      `),
    ]);

    const trendByDay = new Map<string, Record<string, number>>();
    for (const row of trendRows) {
      trendByDay.set(row.day, {
        ...(trendByDay.get(row.day) ?? {}),
        [row.kind]: Number(row.value),
      });
    }
    const trend = [];
    for (
      let cursor = startOfDay(trendStart);
      cursor <= trendEnd;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
      }).format(cursor);
      trend.push({
        date: day,
        leads: 0,
        patients: 0,
        appointments: 0,
        followUps: 0,
        billed: 0,
        collected: 0,
        ...(trendByDay.get(day) ?? {}),
      });
    }

    const activeLeadCountByBranch = new Map(
      activeLeadsByBranch.map((item) => [item.branchId, item._count.id]),
    );

    return {
      totals: {
        leads,
        patients,
        appointments,
        todayAppointments,
        tomorrowAppointments,
        monthAppointments,
        arrived,
        notArrived,
        cancelled,
        confirmed,
        revenue: invoices._sum.totalAmount ?? 0,
        collected: invoices._sum.paidAmount ?? 0,
        todayRevenue: todayInvoices._sum.totalAmount ?? 0,
        monthlyRevenue: monthInvoices._sum.totalAmount ?? 0,
        pendingFollowups,
        totalLeadIntake,
        convertedLeads,
        leadConversion:
          totalLeadIntake > 0 ? Math.round((convertedLeads / totalLeadIntake) * 100) : 0,
      },
      byBranch: byBranch.map((branch) => ({
        ...branch,
        activeLeads: activeLeadCountByBranch.get(branch.id) ?? 0,
      })),
      upcomingAppointments: futureAppointments.length ? futureAppointments : recentAppointments,
      recentPatients,
      dailyWork: {
        todaysFollowups,
        missedFollowups,
        newLeadsNotContacted,
        postponedAppointments,
        notArrivedPatients,
        pendingPaymentInvoices,
      },
      analytics: {
        range: { from: trendStart, to: trendEnd },
        trend,
        leads: {
          byStatus: leadByStatus.map((row) => ({ name: row.status, count: row._count.id })),
          bySource: leadBySource.map((row) => ({ name: row.source, count: row._count.id })),
          byScore: leadByScore.map((row) => ({
            name: row.scoreCategory,
            count: row._count.id,
          })),
          byPriority: leadByPriority.map((row) => ({
            name: row.priority,
            count: row._count.id,
          })),
        },
        patients: {
          total: patients,
          active: patientByStatus.find((row) => row.status === 'ACTIVE')?._count.id ?? 0,
          byStatus: patientByStatus.map((row) => ({
            name: row.status,
            count: row._count.id,
          })),
        },
        appointments: {
          byStatus: appointmentByStatus.map((row) => ({
            name: row.status,
            count: row._count.id,
          })),
        },
        followUps: {
          total: followUpByStatus.reduce((sum, row) => sum + row._count.id, 0),
          open: openFollowUps,
          overdue: overdueFollowUps,
          completed: followUpByStatus.find((row) => row.status === 'COMPLETED')?._count.id ?? 0,
          byStatus: followUpByStatus.map((row) => ({
            name: row.status,
            count: row._count.id,
          })),
          byChannel: followUpByChannel.map((row) => ({
            name: row.channel,
            count: row._count.id,
          })),
          byActivity: followUpByActivity.map((row) => ({
            name: row.activityType,
            count: row._count.id,
          })),
        },
        financial: {
          invoices: invoiceSummary._count.id,
          subtotal: Number(invoiceSummary._sum.subtotal ?? 0),
          discounts: Number(invoiceSummary._sum.discount ?? 0),
          taxCollected: Number(invoiceSummary._sum.taxAmount ?? 0),
          billed: Number(invoiceSummary._sum.totalAmount ?? 0),
          collected: Number(paymentSummary._sum.amount ?? 0),
          outstanding: Number(invoiceSummary._sum.outstandingAmount ?? 0),
          collectionRate: Number(invoiceSummary._sum.totalAmount ?? 0)
            ? Math.round(
                (Number(paymentSummary._sum.amount ?? 0) /
                  Number(invoiceSummary._sum.totalAmount ?? 0)) *
                  1000,
              ) / 10
            : 0,
          byStatus: invoiceByStatus.map((row) => ({
            name: row.status,
            count: row._count.id,
            amount: Number(row._sum.totalAmount ?? 0),
          })),
          byMode: paymentByMode.map((row) => ({
            name: row.mode,
            count: row._count.id,
            amount: Number(row._sum.amount ?? 0),
          })),
          gst: {
            invoices: gstInvoiceSummary._count.id,
            billed: Number(gstInvoiceSummary._sum.totalAmount ?? 0),
            tax: Number(gstInvoiceSummary._sum.taxAmount ?? 0),
            collected: Number(gstInvoiceSummary._sum.paidAmount ?? 0),
          },
          nonGst: {
            invoices: nonGstInvoiceSummary._count.id,
            billed: Number(nonGstInvoiceSummary._sum.totalAmount ?? 0),
            collected: Number(nonGstInvoiceSummary._sum.paidAmount ?? 0),
          },
        },
      },
    };
  },
};
