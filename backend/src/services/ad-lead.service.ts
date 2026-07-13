import type { AdPlatform, Prisma, Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { adLeadRepository } from '../repositories/ad-lead.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/http-error.js';

async function ensureBranchExists(branchId?: string) {
  if (!branchId) return;
  const branch = await branchRepository.exists(branchId);
  if (!branch) throw new HttpError(404, 'Branch not found');
}

function requireBranchForReceptionist(role: Role, branchId?: string) {
  if (role === RoleEnum.RECEPTIONIST && !branchId) {
    throw new HttpError(400, 'Receptionist requests must include a branchId');
  }
}

export const adLeadService = {
  async listAdLeads(filters: { platform?: AdPlatform; branchId?: string; search?: string; role: Role }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    const [leads, stats] = await Promise.all([adLeadRepository.list(filters), adLeadRepository.stats({ branchId: filters.branchId })]);
    return { leads, stats };
  },

  async createAdLead(input: {
    platform: AdPlatform;
    externalLeadId?: string;
    name: string;
    mobile: string;
    email?: string;
    campaignId?: string;
    campaignName?: string;
    adSetId?: string;
    adSetName?: string;
    adId?: string;
    adName?: string;
    formId?: string;
    formName?: string;
    branchId?: string;
    rawPayload?: unknown;
  }) {
    let branchId = input.branchId;

    if (branchId) {
      await ensureBranchExists(branchId);
    } else {
      branchId = (await branchRepository.first())?.id;
    }

    const admin = await userRepository.firstActiveAdmin();
    const existingLead = await leadRepository.findOpenByMobile(input.mobile);
    const crmLead =
      existingLead ??
      (admin && branchId
        ? await leadRepository.create({
            name: input.name,
            mobile: input.mobile,
            address: input.email ? `Email: ${input.email}` : undefined,
            source: input.platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'META_ADS',
            branchId,
            createdById: admin.id,
            appointmentType: 'CLINIC_VISIT',
            qrToken: leadRepository.createQrToken(),
          })
        : null);

    return adLeadRepository.create({
      ...input,
      branchId,
      leadId: crmLead?.id,
      rawPayload: (input.rawPayload ?? input) as Prisma.InputJsonValue,
    });
  },

  async convertToLead(id: string, input: { branchId: string; appointmentAt?: Date }) {
    const adLead = await adLeadRepository.findById(id);
    if (!adLead) throw new HttpError(404, 'Ad lead not found');
    await ensureBranchExists(input.branchId);

    const admin = await userRepository.firstActiveAdmin();
    if (!admin) throw new HttpError(409, 'No active admin found for ad lead conversion');

    const lead = await leadRepository.create({
      name: adLead.name,
      mobile: adLead.mobile,
      address: adLead.email ? `Email: ${adLead.email}` : undefined,
      source: adLead.platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'META_ADS',
      branchId: input.branchId,
      createdById: admin.id,
      appointmentType: 'CLINIC_VISIT',
      appointmentAt: input.appointmentAt,
      qrToken: leadRepository.createQrToken(),
    });

    return adLeadRepository.linkLead(id, lead.id);
  },
};
