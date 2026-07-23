import type {
  AutomationExecutionStatus,
  AutomationTrigger,
  DurableJobType,
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/db.js';

const connectionInclude = {
  branch: true,
  _count: {
    select: {
      fieldMappings: true,
      events: true,
      syncRuns: true,
      campaigns: true,
      conversionEvents: true,
    },
  },
};
export const integrationRepository = {
  listConnections(filters: {
    provider?: IntegrationProvider;
    branchId?: string;
    status?: IntegrationStatus;
  }) {
    return prisma.integrationConnection.findMany({
      where: filters,
      include: connectionInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  findConnection(id: string) {
    return prisma.integrationConnection.findUnique({
      where: { id },
      include: { branch: true, fieldMappings: true },
    });
  },
  createConnection(data: Prisma.IntegrationConnectionUncheckedCreateInput) {
    return prisma.integrationConnection.create({ data, include: connectionInclude });
  },
  updateConnection(id: string, data: Prisma.IntegrationConnectionUncheckedUpdateInput) {
    return prisma.integrationConnection.update({ where: { id }, data, include: connectionInclude });
  },
  listActiveConnections(provider?: IntegrationProvider) {
    return prisma.integrationConnection.findMany({
      where: { provider, status: { in: ['CONNECTED', 'DEGRADED'] } },
      include: { fieldMappings: true },
    });
  },
  upsertMapping(data: Prisma.IntegrationFieldMappingUncheckedCreateInput) {
    return prisma.integrationFieldMapping.upsert({
      where: {
        connectionId_externalFormId: {
          connectionId: data.connectionId,
          externalFormId: data.externalFormId,
        },
      },
      create: data,
      update: {
        externalFormName: data.externalFormName,
        branchId: data.branchId,
        ownerId: data.ownerId,
        mapping: data.mapping,
        defaults: data.defaults,
        active: data.active,
      },
    });
  },
  listMappings(connectionId?: string) {
    return prisma.integrationFieldMapping.findMany({
      where: { connectionId },
      include: { connection: { select: { id: true, name: true, provider: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },
  findMapping(connectionId: string, externalFormId: string) {
    return prisma.integrationFieldMapping.findUnique({
      where: { connectionId_externalFormId: { connectionId, externalFormId } },
    });
  },
  findEventByHash(eventHash: string) {
    return prisma.integrationEvent.findUnique({ where: { eventHash } });
  },
  createEvent(data: Prisma.IntegrationEventUncheckedCreateInput) {
    return prisma.integrationEvent.create({ data });
  },
  findEvent(id: string) {
    return prisma.integrationEvent.findUnique({ where: { id }, include: { connection: true } });
  },
  updateEvent(id: string, data: Prisma.IntegrationEventUpdateInput) {
    return prisma.integrationEvent.update({ where: { id }, data });
  },
  listEvents(connectionId?: string) {
    return prisma.integrationEvent.findMany({
      where: { connectionId },
      include: { connection: { select: { id: true, name: true, provider: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 300,
    });
  },
  createSyncRun(data: Prisma.IntegrationSyncRunUncheckedCreateInput) {
    return prisma.integrationSyncRun.create({ data });
  },
  findSyncRun(id: string) {
    return prisma.integrationSyncRun.findUnique({ where: { id }, include: { connection: { include: { fieldMappings: true } } } });
  },
  updateSyncRun(id: string, data: Prisma.IntegrationSyncRunUpdateInput) {
    return prisma.integrationSyncRun.update({ where: { id }, data });
  },
  listSyncRuns(connectionId?: string) {
    return prisma.integrationSyncRun.findMany({
      where: { connectionId },
      include: { connection: { select: { id: true, name: true, provider: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },
  findAdLead(platform: 'META' | 'GOOGLE', externalLeadId: string) {
    return prisma.adLead.findFirst({ where: { platform, externalLeadId } });
  },
  createAttribution(data: Prisma.AttributionTouchUncheckedCreateInput) {
    return prisma.attributionTouch.create({ data });
  },
  listAttribution(leadId?: string) {
    return prisma.attributionTouch.findMany({
      where: { leadId },
      include: { campaign: true },
      orderBy: { occurredAt: 'asc' },
    });
  },
  upsertCampaign(data: Prisma.MarketingCampaignUncheckedCreateInput) {
    return data.connectionId && data.externalCampaignId
      ? prisma.marketingCampaign.upsert({
          where: {
            connectionId_externalCampaignId: {
              connectionId: data.connectionId,
              externalCampaignId: data.externalCampaignId,
            },
          },
          create: data,
          update: {
            name: data.name,
            objective: data.objective,
            status: data.status,
            branchId: data.branchId,
            budget: data.budget,
            startDate: data.startDate,
            endDate: data.endDate,
          },
        })
      : prisma.marketingCampaign.create({ data });
  },
  listCampaigns(filters: { branchId?: string; platform?: 'META' | 'GOOGLE' }) {
    return prisma.marketingCampaign.findMany({
      where: filters,
      include: {
        branch: true,
        connection: { select: { id: true, name: true, status: true } },
        dailyPerformance: { orderBy: { date: 'desc' }, take: 90 },
        _count: { select: { attributionTouches: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },
  findCampaign(id: string) {
    return prisma.marketingCampaign.findUnique({
      where: { id },
      include: { dailyPerformance: true },
    });
  },
  async upsertPerformance(data: Prisma.AdPerformanceDailyUncheckedCreateInput) {
    const existing = await prisma.adPerformanceDaily.findFirst({
      where: {
        campaignId: data.campaignId,
        date: data.date as Date,
        externalAdSetId: data.externalAdSetId ?? null,
        externalAdId: data.externalAdId ?? null,
        device: data.device ?? null,
        network: data.network ?? null,
      },
    });
    const update = {
      spend: data.spend,
      impressions: data.impressions,
      reach: data.reach,
      clicks: data.clicks,
      landingPageViews: data.landingPageViews,
      platformConversions: data.platformConversions,
      leads: data.leads,
      rawMetrics: data.rawMetrics,
    };
    return existing
      ? prisma.adPerformanceDaily.update({ where: { id: existing.id }, data: update })
      : prisma.adPerformanceDaily.create({ data });
  },
  createConversion(data: Prisma.ConversionEventUncheckedCreateInput) {
    return prisma.conversionEvent.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      create: data,
      update: {},
    });
  },
  findConversion(id: string) {
    return prisma.conversionEvent.findUnique({
      where: { id },
      include: { connection: true, person: true, lead: true },
    });
  },
  updateConversion(id: string, data: Prisma.ConversionEventUpdateInput) {
    return prisma.conversionEvent.update({ where: { id }, data });
  },
  listConversions(connectionId?: string) {
    return prisma.conversionEvent.findMany({
      where: { connectionId },
      include: { connection: { select: { id: true, name: true, provider: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  },
  listAutomations(branchId?: string, trigger?: AutomationTrigger) {
    return prisma.automationDefinition.findMany({
      where: { trigger, OR: branchId ? [{ branchId }, { branchId: null }] : undefined },
      include: {
        branch: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },
  findAutomation(id: string) {
    return prisma.automationDefinition.findUnique({
      where: { id },
      include: { executions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  },
  createAutomation(data: Prisma.AutomationDefinitionUncheckedCreateInput) {
    return prisma.automationDefinition.create({ data });
  },
  updateAutomation(id: string, data: Prisma.AutomationDefinitionUpdateInput) {
    return prisma.automationDefinition.update({ where: { id }, data });
  },
  findActiveAutomations(trigger: AutomationTrigger, branchId?: string) {
    return prisma.automationDefinition.findMany({
      where: {
        trigger,
        active: true,
        OR: branchId ? [{ branchId }, { branchId: null }] : [{ branchId: null }],
      },
    });
  },
  createExecution(data: Prisma.AutomationExecutionUncheckedCreateInput) {
    return prisma.automationExecution.create({ data });
  },
  findExecution(id: string) {
    return prisma.automationExecution.findUnique({
      where: { id },
      include: { automation: true, lead: { include: { person: true } } },
    });
  },
  updateExecution(id: string, data: Prisma.AutomationExecutionUpdateInput) {
    return prisma.automationExecution.update({ where: { id }, data });
  },
  listExecutions(filters: { automationId?: string; status?: AutomationExecutionStatus }) {
    return prisma.automationExecution.findMany({
      where: filters,
      include: {
        automation: { select: { id: true, name: true, trigger: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  },
  createJob(data: Prisma.DurableJobUncheckedCreateInput) {
    return prisma.durableJob.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      create: data,
      update: {},
    });
  },
  async claimJob(workerId: string, types: DurableJobType[]) {
    return prisma.$transaction(
      async (tx) => {
        const job = await tx.durableJob.findFirst({
          where: {
            type: { in: types },
            status: { in: ['QUEUED', 'RETRY'] },
            runAt: { lte: new Date() },
            OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: new Date() } }],
          },
          orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
        });
        if (!job) return null;
        const claim = await tx.durableJob.updateMany({
          where: { id: job.id, status: { in: ['QUEUED', 'RETRY'] } },
          data: {
            status: 'RUNNING',
            lockedBy: workerId,
            lockedAt: new Date(),
            lockExpiresAt: new Date(Date.now() + 60_000),
            attempts: { increment: 1 },
          },
        });
        return claim.count ? tx.durableJob.findUnique({ where: { id: job.id } }) : null;
      },
      { isolationLevel: 'Serializable' },
    );
  },
  completeJob(id: string) {
    return prisma.durableJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
  },
  retryJob(id: string, error: string, dead: boolean) {
    return prisma.durableJob.update({
      where: { id },
      data: {
        status: dead ? 'DEAD' : 'RETRY',
        lastError: error,
        runAt: new Date(Date.now() + 60_000),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
  },
  createLoginEvent(data: Prisma.LoginEventUncheckedCreateInput) {
    return prisma.loginEvent.create({ data });
  },
  listLoginEvents(userId?: string) {
    return prisma.loginEvent.findMany({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  },
  createExportLog(data: Prisma.ExportLogUncheckedCreateInput) {
    return prisma.exportLog.create({ data });
  },
  updateExportLog(id: string, data: Prisma.ExportLogUpdateInput) {
    return prisma.exportLog.update({ where: { id }, data });
  },
  listExportLogs(userId?: string) {
    return prisma.exportLog.findMany({
      where: { userId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  },
};
