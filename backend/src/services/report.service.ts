import type { Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

type Filters = {
  branchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  campaignId?: string;
  role: Role;
};
function scope(filters: Filters, dateField: string) {
  if (filters.role === 'RECEPTIONIST' && !filters.branchId)
    throw new HttpError(400, 'Receptionist reports require a branchId');
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { [dateField]: { gte: filters.dateFrom, lte: filters.dateTo } }
      : {}),
  };
}
const rate = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

export const reportService = {
  async dashboard(filters: Filters) {
    const leadWhere = scope(filters, 'createdAt');
    const appointmentWhere = scope(filters, 'appointmentAt');
    const [
      leads,
      qualified,
      converted,
      appointments,
      confirmed,
      arrived,
      completed,
      noShows,
      openTasks,
      overdueTasks,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { ...leadWhere, status: 'CONVERTED' } }),
      prisma.appointment.count({ where: appointmentWhere }),
      prisma.appointment.count({ where: { ...appointmentWhere, status: 'CONFIRMED' } }),
      prisma.appointment.count({
        where: {
          ...appointmentWhere,
          status: {
            in: ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'COMPLETED'],
          },
        },
      }),
      prisma.appointment.count({ where: { ...appointmentWhere, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { ...appointmentWhere, status: 'NO_SHOW' } }),
      prisma.task.count({
        where: { ...(filters.branchId ? { branchId: filters.branchId } : {}), status: 'OPEN' },
      }),
      prisma.task.count({
        where: {
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          status: 'OPEN',
          dueAt: { lt: new Date() },
        },
      }),
    ]);
    return {
      access: filters.role === 'ADMIN' ? 'ADMIN' : 'RECEPTIONIST',
      totals: {
        leads,
        qualified,
        converted,
        appointments,
        confirmed,
        arrived,
        completed,
        noShows,
        openTasks,
        overdueTasks,
      },
      rates: {
        qualification: rate(qualified, leads),
        leadConversion: rate(converted, leads),
        arrival: rate(arrived, appointments),
        completion: rate(completed, appointments),
        noShow: rate(noShows, appointments),
      },
    };
  },
  async crm(filters: Filters) {
    const where = scope(filters, 'createdAt');
    const [byStage, bySource, byOwner, total, converted, overdueFollowUps] = await Promise.all([
      prisma.lead.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['source'], where, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['ownerId'], where, _count: { id: true } }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'CONVERTED' } }),
      prisma.lead.count({
        where: {
          ...where,
          nextActionDueAt: { lt: new Date() },
          status: { notIn: ['CONVERTED', 'LOST', 'DISQUALIFIED'] },
        },
      }),
    ]);
    const ownerIds = byOwner.flatMap((row) => (row.ownerId ? [row.ownerId] : []));
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true },
    });
    const names = new Map(owners.map((owner) => [owner.id, owner.name]));
    return {
      total,
      converted,
      conversionRate: rate(converted, total),
      overdueFollowUps,
      byStage: byStage.map((row) => ({ name: row.status, count: row._count.id })),
      bySource: bySource.map((row) => ({ name: row.source, count: row._count.id })),
      byOwner: byOwner.map((row) => ({
        name: row.ownerId ? (names.get(row.ownerId) ?? 'Unknown') : 'Unassigned',
        count: row._count.id,
      })),
    };
  },
  async appointments(filters: Filters) {
    const where = scope(filters, 'appointmentAt');
    const [byStatus, byBranch, total, completed, cancelled, noShows] = await Promise.all([
      prisma.appointment.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.appointment.groupBy({ by: ['branchId'], where, _count: { id: true } }),
      prisma.appointment.count({ where }),
      prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { ...where, status: 'NO_SHOW' } }),
    ]);
    return {
      total,
      completed,
      cancelled,
      noShows,
      completionRate: rate(completed, total),
      noShowRate: rate(noShows, total),
      byStatus: byStatus.map((row) => ({ name: row.status, count: row._count.id })),
      byBranch,
    };
  },
  async clinical(filters: Filters) {
    const appointmentScope = scope(filters, 'appointmentAt');
    const encounterWhere = {
      ...(filters.branchId ? { patient: { branchId: filters.branchId } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? { createdAt: { gte: filters.dateFrom, lte: filters.dateTo } }
        : {}),
    };
    const procedureWhere = {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? { performedAt: { gte: filters.dateFrom, lte: filters.dateTo } }
        : {}),
    };
    const [consultations, procedures, plans, prescriptions] = await Promise.all([
      prisma.clinicalEncounter.count({ where: encounterWhere }),
      prisma.procedureSession.count({ where: procedureWhere }),
      prisma.treatmentPlan.count({ where: encounterWhere }),
      prisma.prescription.count({ where: encounterWhere }),
    ]);
    const completedAppointments = await prisma.appointment.count({
      where: { ...appointmentScope, status: 'COMPLETED' },
    });
    return {
      consultations,
      procedures,
      treatmentPlans: plans,
      prescriptions,
      completedAppointments,
      consultationToPlanRate: rate(plans, consultations),
    };
  },
  async marketing(filters: Filters) {
    if (filters.role === 'RECEPTIONIST' && !filters.branchId)
      throw new HttpError(400, 'Receptionist reports require a branchId');
    const performanceWhere = {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? { date: { gte: filters.dateFrom, lte: filters.dateTo } }
        : {}),
    };
    const [performance, campaigns, attributed, appointments, arrived, converted] =
      await Promise.all([
        prisma.adPerformanceDaily.aggregate({
          where: performanceWhere,
          _sum: {
            spend: true,
            impressions: true,
            reach: true,
            clicks: true,
            landingPageViews: true,
            leads: true,
          },
        }),
        prisma.marketingCampaign.findMany({
          where: {
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            ...(filters.campaignId ? { id: filters.campaignId } : {}),
          },
          include: {
            dailyPerformance: { where: performanceWhere },
            _count: { select: { attributionTouches: true } },
          },
        }),
        prisma.attributionTouch.count({
          where: {
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
          },
        }),
        prisma.appointment.count({
          where: {
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            lead: {
              attributionTouches: {
                some: filters.campaignId ? { campaignId: filters.campaignId } : {},
              },
            },
          },
        }),
        prisma.appointment.count({
          where: {
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            status: {
              in: [
                'CHECKED_IN',
                'WAITING',
                'IN_CONSULTATION',
                'TREATMENT_IN_PROGRESS',
                'COMPLETED',
              ],
            },
            lead: {
              attributionTouches: {
                some: filters.campaignId ? { campaignId: filters.campaignId } : {},
              },
            },
          },
        }),
        prisma.lead.count({
          where: {
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            status: 'CONVERTED',
            attributionTouches: {
              some: filters.campaignId ? { campaignId: filters.campaignId } : {},
            },
          },
        }),
      ]);
    const spend = Number(performance._sum.spend ?? 0);
    const leads = performance._sum.leads ?? attributed;
    return {
      totals: {
        spend,
        impressions: performance._sum.impressions ?? 0,
        reach: performance._sum.reach ?? 0,
        clicks: performance._sum.clicks ?? 0,
        landingPageViews: performance._sum.landingPageViews ?? 0,
        leads,
        attributed,
        appointments,
        arrived,
        converted,
      },
      efficiency: {
        costPerLead: leads ? Math.round((spend / leads) * 100) / 100 : 0,
        costPerAppointment: appointments ? Math.round((spend / appointments) * 100) / 100 : 0,
        costPerArrival: arrived ? Math.round((spend / arrived) * 100) / 100 : 0,
        costPerConversion: converted ? Math.round((spend / converted) * 100) / 100 : 0,
      },
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        attributedLeads: campaign._count.attributionTouches,
        spend: campaign.dailyPerformance.reduce((sum, row) => sum + Number(row.spend), 0),
        clicks: campaign.dailyPerformance.reduce((sum, row) => sum + row.clicks, 0),
      })),
    };
  },
};
