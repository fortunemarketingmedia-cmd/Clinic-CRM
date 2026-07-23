import type { Prisma, ScoreRuleOperator } from '@prisma/client';
import { prisma } from '../config/db.js';

export const leadScoringRepository = {
  listRules(branchId?: string) {
    return prisma.leadScoringRule.findMany({
      where: { active: true, OR: branchId ? [{ branchId }, { branchId: null }] : undefined },
      orderBy: { createdAt: 'asc' },
    });
  },
  listAllRules() {
    return prisma.leadScoringRule.findMany({
      include: { branch: true },
      orderBy: { createdAt: 'asc' },
    });
  },
  findRule(id: string) {
    return prisma.leadScoringRule.findUnique({ where: { id } });
  },
  createRule(data: {
    name: string;
    description?: string;
    branchId?: string;
    field: string;
    operator: ScoreRuleOperator;
    value?: string;
    points: number;
    active: boolean;
  }) {
    return prisma.leadScoringRule.create({ data });
  },
  updateRule(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      branchId: string | null;
      field: string;
      operator: ScoreRuleOperator;
      value: string | null;
      points: number;
      active: boolean;
    }>,
  ) {
    return prisma.leadScoringRule.update({ where: { id }, data });
  },
  findLead(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: { appointments: true, person: { include: { _count: { select: { leads: true } } } } },
    });
  },
  listLeadIds(branchId?: string) {
    return prisma.lead.findMany({
      where: { branchId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
  },
  async saveScore(
    leadId: string,
    previousScore: number,
    result: {
      score: number;
      category: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
      reasons: Array<{ rule: string; points: number }>;
    },
  ) {
    return prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { leadScore: result.score, scoreCategory: result.category },
      }),
      prisma.leadScoreHistory.create({
        data: {
          leadId,
          previousScore,
          newScore: result.score,
          category: result.category,
          reasons: result.reasons as Prisma.InputJsonValue,
        },
      }),
    ]);
  },
  history(leadId: string) {
    return prisma.leadScoreHistory.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' } });
  },
};
