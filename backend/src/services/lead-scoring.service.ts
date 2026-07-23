import { leadScoringRepository } from '../repositories/lead-scoring.repository.js';
import { HttpError } from '../utils/http-error.js';
import { scoreLead } from './lead-scoring-policy.js';

export const leadScoringService = {
  listRules: leadScoringRepository.listAllRules,
  async createRule(input: Parameters<typeof leadScoringRepository.createRule>[0]) {
    const rule = await leadScoringRepository.createRule(input);
    await this.recalculateAll(input.branchId);
    return rule;
  },
  async updateRule(id: string, input: Parameters<typeof leadScoringRepository.updateRule>[1]) {
    const existing = await leadScoringRepository.findRule(id);
    if (!existing) throw new HttpError(404, 'Scoring rule not found');
    const rule = await leadScoringRepository.updateRule(id, input);
    await this.recalculateAll(
      existing.branchId && rule.branchId && existing.branchId === rule.branchId
        ? rule.branchId
        : undefined,
    );
    return rule;
  },
  history: leadScoringRepository.history,
  async recalculate(leadId: string) {
    const lead = await leadScoringRepository.findLead(leadId);
    if (!lead) throw new HttpError(404, 'Lead not found');
    const rules = await leadScoringRepository.listRules(lead.branchId);
    const daysInactive = Math.floor((Date.now() - lead.updatedAt.getTime()) / 86_400_000);
    const result = scoreLead(rules, {
      source: lead.source,
      priority: lead.priority,
      interestedTreatment: lead.interestedTreatment,
      lastContactedAt: lead.lastContactedAt,
      appointmentCount: lead.appointments.length,
      personLeadCount: lead.person?._count.leads ?? 1,
      daysInactive,
      status: lead.status,
    });
    if (result.score !== lead.leadScore || result.category !== lead.scoreCategory)
      await leadScoringRepository.saveScore(lead.id, lead.leadScore, result);
    return result;
  },
  async recalculateAll(branchId?: string) {
    const leads = await leadScoringRepository.listLeadIds(branchId);
    const batchSize = 20;
    for (let index = 0; index < leads.length; index += batchSize) {
      await Promise.all(
        leads.slice(index, index + batchSize).map((lead) => this.recalculate(lead.id)),
      );
    }
    return { recalculated: leads.length };
  },
};
