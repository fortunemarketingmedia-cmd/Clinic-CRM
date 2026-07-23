import type { LeadScoreCategory, ScoreRuleOperator } from '@prisma/client';

export type ScoringRule = { name: string; field: string; operator: ScoreRuleOperator; value: string | null; points: number };
type ScoringValue = string | number | boolean | Date | null | undefined;
export type ScoringFacts = Record<string, ScoringValue>;

function matches(rule: ScoringRule, actual: ScoringValue) {
  if (rule.operator === 'EXISTS') return actual !== null && actual !== undefined && actual !== '';
  if (actual === null || actual === undefined) return false;
  if (rule.operator === 'EQUALS') return (rule.value ?? '').split(',').map((value) => value.trim().toLowerCase()).includes(String(actual).toLowerCase());
  if (rule.operator === 'CONTAINS') return String(actual).toLowerCase().includes((rule.value ?? '').toLowerCase());
  const actualNumber = actual instanceof Date ? actual.getTime() : Number(actual);
  const expectedNumber = Number(rule.value);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
  return rule.operator === 'GREATER_THAN' ? actualNumber > expectedNumber : actualNumber < expectedNumber;
}

export function scoreLead(rules: ScoringRule[], facts: ScoringFacts) {
  const reasons = rules.filter((rule) => matches(rule, facts[rule.field])).map((rule) => ({ rule: rule.name, points: rule.points }));
  const score = reasons.reduce((total, reason) => total + reason.points, 0);
  const category: LeadScoreCategory = facts.status === 'DISQUALIFIED' || score < 0 ? 'UNQUALIFIED' : score >= 60 ? 'HOT' : score >= 30 ? 'WARM' : 'COLD';
  return { score, category, reasons };
}
