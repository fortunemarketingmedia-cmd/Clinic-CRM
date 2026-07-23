import bcrypt from 'bcrypt';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { HttpError } from '../utils/http-error.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../utils/integration-crypto.js';
import { generateRecoveryCodes, generateTotpSecret, verifyTotp } from '../utils/totp.js';
import type { AuditContext } from './audit.service.js';
import { auditService } from './audit.service.js';

type Actor = { id: string; role: Role };
const key = () =>
  env.INTEGRATION_ENCRYPTION_KEY ?? `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`;
function requireAdmin(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new HttpError(403, 'Administrator access is required');
}

export const securityService = {
  async beginMfa(actor: Actor, audit: AuditContext) {
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) throw new HttpError(404, 'User not found');
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        mfaEnabled: false,
        mfaSecretCiphertext: encryptIntegrationSecret(secret, key()),
        mfaRecoveryCodes: Prisma.DbNull,
        mfaVerifiedAt: null,
      },
    });
    await auditService.record(audit, {
      action: 'MFA_SETUP_STARTED',
      entity: 'User',
      entityId: actor.id,
    });
    const label = encodeURIComponent(`${env.MFA_ISSUER}:${user.email}`);
    return {
      secret,
      otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(env.MFA_ISSUER)}&algorithm=SHA1&digits=6&period=30`,
    };
  },
  async confirmMfa(code: string, actor: Actor, audit: AuditContext) {
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.mfaSecretCiphertext) throw new HttpError(409, 'Start MFA setup first');
    const secret = decryptIntegrationSecret(user.mfaSecretCiphertext, key());
    if (!verifyTotp(secret, code)) throw new HttpError(400, 'Invalid MFA code');
    const recoveryCodes = generateRecoveryCodes();
    const hashes = await Promise.all(recoveryCodes.map((value) => bcrypt.hash(value, 10)));
    await prisma.user.update({
      where: { id: actor.id },
      data: { mfaEnabled: true, mfaRecoveryCodes: hashes, mfaVerifiedAt: new Date() },
    });
    await refreshTokenRepository.revokeAllForUser(actor.id);
    await auditService.record(audit, { action: 'MFA_ENABLED', entity: 'User', entityId: actor.id });
    return { enabled: true, recoveryCodes };
  },
  async disableMfa(
    input: { password: string; code?: string; recoveryCode?: string },
    actor: Actor,
    audit: AuditContext,
  ) {
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
      throw new HttpError(401, 'Invalid password');
    if (!user.mfaEnabled || !user.mfaSecretCiphertext)
      throw new HttpError(409, 'MFA is not enabled');
    let valid = input.code
      ? verifyTotp(decryptIntegrationSecret(user.mfaSecretCiphertext, key()), input.code)
      : false;
    if (!valid && input.recoveryCode && Array.isArray(user.mfaRecoveryCodes))
      for (const hash of user.mfaRecoveryCodes)
        if (
          typeof hash === 'string' &&
          (await bcrypt.compare(input.recoveryCode.toUpperCase(), hash))
        ) {
          valid = true;
          break;
        }
    if (!valid) throw new HttpError(401, 'Invalid MFA code');
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        mfaEnabled: false,
        mfaSecretCiphertext: null,
        mfaRecoveryCodes: Prisma.DbNull,
        mfaVerifiedAt: null,
      },
    });
    await refreshTokenRepository.revokeAllForUser(actor.id);
    await auditService.record(audit, {
      action: 'MFA_DISABLED',
      entity: 'User',
      entityId: actor.id,
    });
  },
  sessions(actor: Actor) {
    return refreshTokenRepository.listForUser(actor.id);
  },
  async revokeSession(id: string, actor: Actor, audit: AuditContext) {
    const result = await refreshTokenRepository.revokeById(actor.id, id);
    if (!result.count) throw new HttpError(404, 'Session not found');
    await auditService.record(audit, {
      action: 'SESSION_REVOKED',
      entity: 'RefreshToken',
      entityId: id,
    });
  },
  loginEvents(actor: Actor) {
    return integrationRepository.listLoginEvents(actor.role === 'ADMIN' ? undefined : actor.id);
  },
  exportLogs(actor: Actor) {
    return integrationRepository.listExportLogs(actor.role === 'ADMIN' ? undefined : actor.id);
  },
  async logExport(
    input: {
      resourceType: string;
      format: string;
      branchId?: string;
      filters?: Record<string, unknown>;
      rowCount?: number;
      status: 'REQUESTED' | 'COMPLETED' | 'FAILED';
      purpose: string;
      failureReason?: string;
    },
    actor: Actor,
    audit: AuditContext,
  ) {
    const row = await integrationRepository.createExportLog({
      userId: actor.id,
      branchId: input.branchId,
      resourceType: input.resourceType,
      format: input.format,
      filters: input.filters as Prisma.InputJsonValue,
      rowCount: input.rowCount,
      status: input.status,
      purpose: input.purpose,
      failureReason: input.failureReason,
      ipAddress: audit.ipAddress,
      correlationId: audit.correlationId,
      completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
    });
    await auditService.record(audit, {
      action: 'DATA_EXPORTED',
      entity: 'ExportLog',
      entityId: row.id,
      newValue: {
        resourceType: input.resourceType,
        rowCount: input.rowCount,
        purpose: input.purpose,
      },
    });
    return row;
  },
  governance() {
    return {
      accessModel: ['ADMIN', 'RECEPTIONIST'],
      patientPortalEnabled: false,
      sensitiveData: {
        encryptionAtRest: true,
        encryptedIntegrationSecrets: true,
        auditTrail: true,
        exportLogging: true,
      },
      retention: {
        auditLogs:
          'Retain according to clinic policy and applicable Indian healthcare/privacy obligations',
        loginEvents: 'Minimum 365 days recommended',
        integrationPayloads: 'Minimise and redact; no clinical data sent to ad platforms',
        backups: 'Encrypted, access-controlled, restore-tested',
      },
      consent: { adConversionsRequireConsent: true, medicalDataInAdPlatforms: false },
    };
  },
  async health(actor: Actor) {
    requireAdmin(actor);
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const [jobs, degradedIntegrations, failedLogins] = await Promise.all([
      prisma.durableJob.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.integrationConnection.count({
        where: { status: { in: ['DEGRADED', 'ERROR', 'TOKEN_EXPIRED'] } },
      }),
      prisma.loginEvent.count({
        where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
      }),
    ]);
    return {
      status: degradedIntegrations ? 'degraded' : 'ok',
      database: { ok: true, latencyMs: Date.now() - started },
      jobs: Object.fromEntries(jobs.map((row) => [row.status, row._count.id])),
      degradedIntegrations,
      failedLoginsLast24Hours: failedLogins,
      checkedAt: new Date(),
    };
  },
  async recordBackup(
    input: {
      backupReference: string;
      environment: string;
      status: string;
      checksum?: string;
      restoreStartedAt?: Date;
      restoreCompletedAt?: Date;
      evidence?: Record<string, unknown>;
      failureReason?: string;
    },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const row = await prisma.backupVerification.create({
      data: { ...input, evidence: input.evidence as Prisma.InputJsonValue, verifiedBy: actor.id },
    });
    await auditService.record(audit, {
      action: 'BACKUP_VERIFICATION_RECORDED',
      entity: 'BackupVerification',
      entityId: row.id,
    });
    return row;
  },
  async backupHistory(actor: Actor) {
    requireAdmin(actor);
    return prisma.backupVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  },
};
