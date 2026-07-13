import { prisma } from '../config/db.js';
import { appointmentRepository } from './appointment.repository.js';

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
    await appointmentRepository.markPastConfirmedAsNotArrived();

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = endOfDay(tomorrow);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const createdAtFilter = filters.dateFrom || filters.dateTo ? { gte: filters.dateFrom, lte: filters.dateTo } : undefined;
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
      prisma.lead.count({ where: { ...branchFilter, createdAt: createdAtFilter, status: { not: 'CONVERTED' } } }),
      prisma.lead.count({ where: { ...branchFilter, createdAt: createdAtFilter } }),
      prisma.lead.count({ where: { ...branchFilter, createdAt: createdAtFilter, status: 'CONVERTED' } }),
      prisma.patient.count({ where: { ...branchFilter, createdAt: createdAtFilter } }),
      prisma.appointment.count({ where: { ...branchFilter, appointmentAt: createdAtFilter } }),
      prisma.appointment.count({ where: { ...branchFilter, appointmentAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, appointmentAt: { gte: tomorrow, lte: tomorrowEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, appointmentAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, status: 'ARRIVED', appointmentAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, status: 'NOT_ARRIVED', appointmentAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, status: 'CANCELLED', appointmentAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.appointment.count({ where: { ...branchFilter, status: 'CONFIRMED', appointmentAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.invoice.aggregate({ where: { ...branchFilter, invoiceDate: createdAtFilter }, _sum: { totalAmount: true, paidAmount: true } }),
      prisma.invoice.aggregate({ where: { ...branchFilter, invoiceDate: { gte: todayStart, lte: todayEnd } }, _sum: { totalAmount: true, paidAmount: true } }),
      prisma.invoice.aggregate({ where: { ...branchFilter, invoiceDate: { gte: monthStart, lte: monthEnd } }, _sum: { totalAmount: true, paidAmount: true } }),
      prisma.session.count({ where: { followupDate: { gte: new Date() } } }),
      prisma.lead.findMany({
        where: { nextFollowupAt: { gte: todayStart, lte: todayEnd }, status: { notIn: ['CONVERTED', 'CANCELLED'] } },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { nextFollowupAt: 'asc' },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { nextFollowupAt: { lt: todayStart }, status: { notIn: ['CONVERTED', 'CANCELLED'] } },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { nextFollowupAt: 'asc' },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { status: 'NEW', lastContactedAt: null },
        include: { branch: true, adLeads: true, patient: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { status: 'POSTPONED' },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { status: 'NOT_ARRIVED' },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'desc' },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: { status: { in: ['DRAFT', 'PARTIAL'] } },
        include: { branch: true, patient: true, payments: true },
        orderBy: { invoiceDate: 'desc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { appointmentAt: { gte: todayStart }, status: { notIn: ['CANCELLED', 'CONVERTED'] } },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { status: { notIn: ['CANCELLED', 'CONVERTED'] } },
        include: { branch: true, lead: { include: { patient: true } } },
        orderBy: { appointmentAt: 'desc' },
        take: 10,
      }),
      prisma.patient.findMany({
        include: { branch: true, lead: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const [byBranch, activeLeadsByBranch] = await Promise.all([prisma.branch.findMany({
      include: {
        _count: {
          select: { leads: true, appointments: true, patients: true, invoices: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.lead.groupBy({
      by: ['branchId'],
      where: { status: { not: 'CONVERTED' } },
      _count: { id: true },
    })]);

    const activeLeadCountByBranch = new Map(activeLeadsByBranch.map((item) => [item.branchId, item._count.id]));

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
        leadConversion: totalLeadIntake > 0 ? Math.round((convertedLeads / totalLeadIntake) * 100) : 0,
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
    };
  },
};
