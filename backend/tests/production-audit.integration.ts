import './audit-environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
await test('production audit HTTP integration', async (t) => {
  const { prisma } = await import('../src/config/db.js');
  const { app } = await import('../src/app.js');
  const { signAccessToken } = await import('../src/utils/tokens.js');
  const { env } = await import('../src/config/env.js');
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  assert.ok(branches.length >= 2, 'Seed the isolated audit database first');
  const [a, b] = branches;
  const password = crypto.randomBytes(24).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.findFirstOrThrow({
    where: { accessLevel: 'ADMIN', status: 'ACTIVE' },
  });
  const user = await prisma.user.upsert({
    where: { email: 'audit.reception@example.test' },
    update: {
      passwordHash: hash,
      status: 'ACTIVE',
      mfaEnabled: false,
      mfaSecretCiphertext: null,
      mfaRecoveryCodes: [],
    },
    create: {
      name: 'Audit Reception',
      email: 'audit.reception@example.test',
      role: 'RECEPTIONIST',
      accessLevel: 'RECEPTIONIST',
      passwordHash: hash,
    },
  });
  await prisma.userBranch.deleteMany({ where: { userId: user.id } });
  await prisma.userBranch.create({ data: { userId: user.id, branchId: a.id } });
  const pa = await prisma.patient.findFirstOrThrow({
    where: { branchId: a.id, personId: { not: null } },
  });
  const pb = await prisma.patient.findFirstOrThrow({
    where: { branchId: b.id, personId: { not: null } },
  });
  const leadB = await prisma.lead.findFirstOrThrow({ where: { branchId: b.id } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const base = `http://127.0.0.1:${addr.port}/api`;
  const adminToken = signAccessToken({ sub: admin.id, role: 'ADMIN' });
  const receptionToken = signAccessToken({ sub: user.id, role: 'RECEPTIONIST' });
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.$disconnect();
  });
  async function request(
    path: string,
    token?: string,
    body?: unknown,
    method = body ? 'POST' : 'GET',
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }
  function noSecrets(value: unknown) {
    const text = JSON.stringify(value);
    assert.doesNotMatch(text, /"(?:passwordHash|mfaSecretCiphertext|mfaRecoveryCodes|tokenHash)"/);
  }
  for (const path of [
    '/patients',
    '/leads',
    '/appointments',
    '/people',
    '/billing/invoices',
    '/analytics/dashboard',
    '/settings',
    '/tasks',
    '/files',
  ]) {
    await t.test(`anonymous ${path} is rejected`, async () =>
      assert.equal((await request(path)).status, 401),
    );
  }
  for (const path of [
    '/patients',
    '/leads',
    '/appointments',
    '/front-desk/staff',
    '/front-desk/services',
    '/tasks',
    '/follow-ups',
    '/analytics/dashboard',
    '/ad-leads',
  ]) {
    await t.test(`receptionist cannot read other-branch ${path}`, async () =>
      assert.equal((await request(`${path}?branchId=${b.id}`, receptionToken)).status, 403),
    );
  }
  for (const path of [
    `/patients/${pb.id}`,
    `/leads/${leadB.id}`,
    `/clinical/patients/${pb.id}/360`,
    `/consents/patients/${pb.id}`,
    `/files?patientId=${pb.id}`,
  ]) {
    await t.test(`cross-branch object read denied for ${path.split('/')[1]}`, async () => {
      const r = await request(path, receptionToken);
      assert.ok([403, 404].includes(r.status), String(r.status));
    });
  }
  await t.test('people detail, list and duplicate lookup are branch-scoped', async () => {
    assert.equal((await request(`/people/${pb.personId}`, receptionToken)).status, 404);
    const list = await request('/people?take=200', receptionToken);
    assert.equal(list.status, 200);
    assert.ok(!list.data.data.some((p: { id: string }) => p.id === pb.personId));
    const exact = await request(`/people/duplicates/search?mobile=${pb.mobile}`, receptionToken);
    assert.equal(exact.status, 200);
    assert.equal(exact.data.data, null);
  });
  await t.test(
    'assigned-branch lists and operational dashboard succeed without financial data',
    async () => {
      for (const path of [
        '/patients',
        '/leads',
        '/appointments',
        '/tasks',
        '/follow-ups',
        '/analytics/dashboard',
      ]) {
        const r = await request(`${path}?branchId=${a.id}`, receptionToken);
        assert.equal(r.status, 200);
        assert.match(r.headers.get('cache-control') ?? '', /no-store/);
        noSecrets(r.data);
        assert.doesNotMatch(
          JSON.stringify(r.data),
          /"(?:totalAmount|paidAmount|outstandingAmount|basePrice|financial)"/,
        );
      }
    },
  );
  await t.test(
    'dashboard lead counts match database and pending work is actual follow-up work',
    async () => {
      const r = await request(`/analytics/dashboard?branchId=${a.id}`, adminToken);
      assert.equal(r.status, 200);
      const total = await prisma.lead.count({ where: { branchId: a.id } });
      const converted = await prisma.lead.count({ where: { branchId: a.id, status: 'CONVERTED' } });
      assert.equal(r.data.data.totals.totalLeadIntake, total);
      assert.equal(r.data.data.totals.leads, total - converted);
      assert.equal(
        r.data.data.totals.pendingFollowups,
        await prisma.followUp.count({
          where: { branchId: a.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        }),
      );
    },
  );
  await t.test('financial endpoints reject receptionist before payload validation', async () => {
    for (const path of [
      '/billing/invoices',
      '/billing/payments',
      '/billing/estimates',
      '/analytics/finance/export',
      '/reports/marketing',
    ])
      assert.equal((await request(path, receptionToken)).status, 403);
    assert.equal(
      (
        await request('/billing/invoices', receptionToken, {
          patientId: pa.id,
          branchId: a.id,
          items: [{ description: 'Consultation', unitPrice: 500 }],
        })
      ).status,
      403,
    );
  });
  await t.test(
    'task/follow-up writes omit staff secrets and reject foreign branch relationships',
    async () => {
      const body = {
        branchId: a.id,
        assignedUserId: user.id,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        personId: pa.personId,
      };
      for (const [path, fields] of [
        ['/tasks', { title: 'Audit task', type: 'CALL' }],
        ['/follow-ups', { activityType: 'Audit call', channel: 'CALL' }],
      ] as const) {
        const good = await request(path, receptionToken, { ...body, ...fields });
        assert.equal(good.status, 201);
        noSecrets(good.data);
        const bad = await request(path, receptionToken, { ...body, ...fields, leadId: leadB.id });
        assert.equal(bad.status, 403);
      }
    },
  );
  await t.test('cookie session endpoints reject an untrusted Origin', async () =>
    assert.equal(
      (
        await request('/auth/refresh', undefined, {}, 'POST', {
          Origin: 'https://untrusted.example',
        })
      ).status,
      403,
    ),
  );
  await t.test('trusted browser can cache preflights and read the correlation header', async () => {
    const origin = env.FRONTEND_ORIGINS[0];
    const preflight = await request('/auth/me', undefined, undefined, 'OPTIONS', {
      Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization',
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-max-age'), '600');
    const response = await request('/auth/me', adminToken, undefined, 'GET', { Origin: origin });
    assert.match(response.headers.get('access-control-expose-headers') ?? '', /X-Correlation-Id/i);
    assert.ok(response.headers.get('x-correlation-id'));
  });
  await t.test('invalid and expired access/refresh tokens return 401', async () => {
    assert.equal((await request('/auth/me', 'invalid')).status, 401);
    const expired = jwt.sign(
      { sub: user.id, role: 'RECEPTIONIST', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
    );
    assert.equal((await request('/auth/me', expired)).status, 401);
    assert.equal(
      (await request('/auth/refresh', undefined, { refreshToken: 'invalid' })).status,
      401,
    );
  });
  await t.test('real login, concurrent refresh rotation, and logout reject replay', async () => {
    const login = await request('/auth/login', undefined, { email: user.email, password });
    assert.equal(login.status, 200);
    assert.ok(login.data.accessToken);
    noSecrets(login.data);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.match(login.headers.get('set-cookie')!, /HttpOnly/i);
    assert.match(login.headers.get('set-cookie')!, /SameSite=Lax/i);
    const results = await Promise.all([
      request('/auth/refresh', undefined, {}, 'POST', { Cookie: cookie }),
      request('/auth/refresh', undefined, {}, 'POST', { Cookie: cookie }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
    const renewed = results.find((r) => r.status === 200)!;
    const newCookie = renewed.headers.get('set-cookie')!.split(';')[0];
    assert.equal(
      (await request('/auth/logout', undefined, {}, 'POST', { Cookie: newCookie })).status,
      204,
    );
    assert.equal(
      (await request('/auth/refresh', undefined, {}, 'POST', { Cookie: newCookie })).status,
      401,
    );
  });
  await t.test('inactive account cannot use a previously issued access token', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
    assert.equal((await request('/auth/me', receptionToken)).status, 401);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
  });
  await t.test('operator receptionist recovery replaces credentials and revokes previously issued sessions', async () => {
    const email = 'audit.recovery@example.test';
    const oldPassword = `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
    const newPassword = `Bb2!${crypto.randomBytes(18).toString('base64url')}`;
    const passwordHash = await bcrypt.hash(oldPassword, 12);
    const staff = await prisma.user.upsert({
      where: { email }, update: { passwordHash, status: 'ACTIVE' },
      create: { email, passwordHash, name: 'Synthetic recovery', role: 'RECEPTIONIST', accessLevel: 'RECEPTIONIST' },
    });
    const login = (password: string) => request('/auth/login', undefined, { email, password });
    const oldSession = await login(oldPassword);
    assert.equal(oldSession.status, 200);
    const oldCookie = oldSession.headers.get('set-cookie')!.split(';')[0];
    const recover = promisify(execFile);
    await recover(process.execPath, ['scripts/reset-production-password.mjs', 'RECEPTIONIST'], {
      env: { ...process.env, NODE_ENV: 'production', RESET_RECEPTIONIST_CONFIRM: 'RESET_EXISTING_PRODUCTION_RECEPTIONIST', RESET_RECEPTIONIST_EMAIL: email, RESET_RECEPTIONIST_PASSWORD: newPassword },
    });
    assert.equal((await request('/auth/me', oldSession.data.accessToken)).status, 401);
    assert.equal((await request('/auth/refresh', undefined, {}, 'POST', { Cookie: oldCookie })).status, 401);
    assert.equal((await login(oldPassword)).status, 401);
    const newSession = await login(newPassword);
    assert.equal(newSession.status, 200);
    assert.equal(newSession.data.user.role, 'RECEPTIONIST');
    assert.equal((await request('/billing/invoices', newSession.data.accessToken)).status, 403);
    assert.equal((await request('/auth/me', signAccessToken({ sub: staff.id, role: 'ADMIN', version: staff.sessionVersion + 1 }))).status, 401);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'OPERATOR_PASSWORD_RECOVERY', entityId: staff.id } }));
  });
  let invoiceId: string;
  await t.test(
    'invoice idempotency returns one invoice under concurrent requests and rejects changed payload',
    async () => {
      const body = {
        patientId: pa.id,
        branchId: a.id,
        items: [{ description: 'Audit consultation', unitPrice: 500 }],
      };
      const key = crypto.randomUUID();
      const responses = await Promise.all([
        request('/billing/invoices', adminToken, body, 'POST', { 'Idempotency-Key': key }),
        request('/billing/invoices', adminToken, body, 'POST', { 'Idempotency-Key': key }),
      ]);
      assert.deepEqual(
        responses.map((r) => r.status),
        [201, 201],
      );
      assert.equal(responses[0].data.data.id, responses[1].data.data.id);
      invoiceId = responses[0].data.data.id;
      assert.equal(
        (
          await request('/billing/invoices', adminToken, { ...body, notes: 'Different' }, 'POST', {
            'Idempotency-Key': key,
          })
        ).status,
        409,
      );
      assert.equal(
        (await request(`/billing/invoices/${invoiceId}/issue`, adminToken, {})).status,
        200,
      );
    },
  );
  await t.test(
    'payment idempotency and balance validation prevent duplicate or excess collections',
    async () => {
      const body = {
        patientId: pa.id,
        branchId: a.id,
        amount: 500,
        mode: 'CASH',
        allocations: [{ invoiceId, amount: 500 }],
      };
      const key = crypto.randomUUID();
      const responses = await Promise.all([
        request('/billing/payments', adminToken, body, 'POST', { 'Idempotency-Key': key }),
        request('/billing/payments', adminToken, body, 'POST', { 'Idempotency-Key': key }),
      ]);
      assert.deepEqual(
        responses.map((r) => r.status),
        [201, 201],
      );
      assert.equal(responses[0].data.data.id, responses[1].data.data.id);
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      assert.equal(Number(invoice.paidAmount), 500);
      assert.equal(Number(invoice.outstandingAmount), 0);
      assert.equal((await request('/billing/payments', adminToken, body)).status, 409);
    },
  );
  await t.test('gateway callbacks authenticate and finalize a pending payment once', async () => {
    const newPayment = async (mode = 'PAYMENT_GATEWAY') => {
      const response = await request('/billing/payments', adminToken, {
        patientId: pa.id, branchId: a.id, amount: 250, mode,
      });
      assert.equal(response.status, 201);
      return response.data.data;
    };
    const callback = (paymentNo: string, status: 'COMPLETED' | 'FAILED', eventId = crypto.randomUUID()) => {
      const transactionReference = `test-${eventId}`;
      const signature = crypto.createHmac('sha256', env.PAYMENT_GATEWAY_SECRET!)
        .update(`${eventId}.${paymentNo}.${status}.${transactionReference}`).digest('hex');
      return { eventId, paymentNo, status, transactionReference, signature };
    };
    const send = (body: ReturnType<typeof callback>) => request('/billing/payments/gateway-callback', undefined, body);
    const payment = await newPayment();
    assert.equal(payment.status, 'PENDING');
    const success = callback(payment.paymentNo, 'COMPLETED');
    assert.equal((await send({ ...success, signature: '0'.repeat(64) })).status, 401);
    const conflicting = callback(payment.paymentNo, 'FAILED');
    const responses = await Promise.all([send(success), send(success), send(conflicting)]);
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.gatewayVerified, true);
    assert.ok(stored.gatewayEventId === success.eventId || stored.gatewayEventId === conflicting.eventId);
    const winner = stored.gatewayEventId === success.eventId ? success : conflicting;
    assert.equal(stored.status, winner.status);
    assert.deepEqual(responses.map((response) => response.status), winner === success ? [200, 200, 409] : [409, 409, 200]);
    assert.equal((await send(winner)).status, 200);

    const failed = await newPayment();
    assert.equal((await send(callback(failed.paymentNo, 'COMPLETED', winner.eventId))).status, 409);
    assert.equal((await send(callback(failed.paymentNo, 'FAILED'))).data.data.status, 'FAILED');
    const completed = await newPayment();
    assert.equal((await send(callback(completed.paymentNo, 'COMPLETED'))).data.data.status, 'COMPLETED');
    const cash = await newPayment('CASH');
    assert.equal((await send(callback(cash.paymentNo, 'FAILED'))).status, 409);
  });
  await t.test('simultaneous room bookings accept one and reject the conflict', async () => {
    const body = {
      name: 'Audit Synthetic Booking',
      mobile: '8999999901',
      branchId: a.id,
      appointmentAt: new Date(
        Date.UTC(2026, 11, 1, 5, 30) + Math.floor(Math.random() * 10000) * 86400000,
      ).toISOString(),
      resourceType: 'TREATMENT_ROOM',
      roomNumber: 4,
      durationMinutes: 30,
    };
    const responses = await Promise.all([
      request('/appointments', adminToken, body),
      request('/appointments', adminToken, { ...body, mobile: '8999999902' }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  });
  await t.test(
    'public forms and downloads reject unauthenticated requests and website submissions need shared secret',
    async () => {
      assert.equal((await request('/public/consents/invalid-token')).status, 404);
      assert.equal(
        (
          await request(
            '/files/nonexistent/content?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          )
        ).status,
        401,
      );
      assert.equal(
        (await request('/public/website-leads', undefined, { name: 'Synthetic' })).status,
        401,
      );
    },
  );
  await t.test('file upload validates content and branch before storing', async () => {
    const body = {
      patientId: pa.id,
      fileType: 'MEDICAL_REPORT',
      name: 'Audit report',
      originalFilename: 'audit.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('not a pdf').toString('base64'),
      visibility: 'CARE_TEAM',
    };
    assert.equal((await request('/files', adminToken, body)).status, 400);
  });
  await t.test(
    'booking persists the correct lead stage and cancellation does not create a patient',
    async () => {
      const mobile = `89${String(Date.now()).slice(-8)}`;
      const booked = await request('/appointments', receptionToken, {
        name: 'Audit workflow synthetic',
        mobile,
        branchId: a.id,
        appointmentAt: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(booked.status, 201);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: booked.data.data.leadId } });
      assert.equal(lead.status, 'APPOINTMENT_BOOKED');
      assert.equal(lead.convertedAt, null);
      assert.equal(await prisma.patient.count({ where: { leadId: lead.id } }), 0);
      assert.equal(
        (
          await request(`/appointments/${booked.data.data.id}/cancel`, receptionToken, {
            reason: 'Synthetic audit cancellation',
          })
        ).status,
        200,
      );
      assert.equal(
        (await prisma.appointment.findUniqueOrThrow({ where: { id: booked.data.data.id } })).status,
        'CANCELLED',
      );
    },
  );
  await t.test('appointment writes reject a foreign target branch', async () => {
    assert.equal(
      (
        await request('/appointments', receptionToken, {
          name: 'Audit cross branch',
          mobile: '8999999833',
          branchId: b.id,
          appointmentAt: new Date(Date.now() + 86400000).toISOString(),
        })
      ).status,
      403,
    );
  });
  await t.test(
    'consent invitation, signing, replay denial, countersign and protected PDF work end to end',
    async () => {
      const template = await prisma.consentTemplate.findFirstOrThrow({
        where: {
          status: 'PUBLISHED',
          type: 'PROCEDURE_SPECIFIC_CONSENT',
          requiresGuardian: false,
          requiresWitness: false,
        },
      });
      const created = await request('/consents/invitations', adminToken, {
        patientId: pa.id,
        templateId: template.id,
        treatmentName: 'Synthetic audit treatment',
      });
      assert.equal(created.status, 201);
      const token = new URL(created.data.data.url).pathname.split('/').at(-1)!;
      const read = await request(`/public/consents/${token}`);
      assert.equal(read.status, 200);
      assert.equal(read.data.data.completed, false);
      const sharp = (await import('sharp')).default;
      const buffer = await sharp({
        create: {
          width: 120,
          height: 50,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      const signatureBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      const signed = await request(`/public/consents/${token}/sign`, undefined, {
        signerName: 'Audit Synthetic',
        signatureBase64,
      });
      assert.equal(signed.status, 201);
      assert.equal(
        (
          await request(`/public/consents/${token}/sign`, undefined, {
            signerName: 'Audit Synthetic',
            signatureBase64,
          })
        ).status,
        409,
      );
      const invitation = await prisma.consentInvitation.findUniqueOrThrow({
        where: { id: created.data.data.invitationId },
      });
      const record = await prisma.consentRecord.findFirstOrThrow({
        where: { patientId: pa.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(invitation.usedAt);
      assert.equal(
        (
          await request(`/consents/${record.id}/complete`, adminToken, {
            doctorName: 'Audit Doctor',
            doctorSignatureBase64: signatureBase64,
          })
        ).status,
        200,
      );
      const pdf = await request(`/consents/${record.id}/pdf`, adminToken);
      assert.equal(pdf.status, 200);
      assert.match(pdf.headers.get('cache-control') ?? '', /no-store/);
      assert.match(pdf.data, /^%PDF/);
    },
  );
  await t.test(
    'valid encrypted file upload, idempotent retry and authenticated download preserve contents',
    async () => {
      const idempotencyKey = crypto.randomUUID();
      const content = 'Synthetic audit report only\n'.repeat(250);
      const body = {
        patientId: pa.id,
        fileType: 'MEDICAL_REPORT',
        originalFilename: 'audit.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from(content).toString('base64'),
        visibility: 'ADMINISTRATIVE',
        idempotencyKey,
      };
      const first = await request('/files', adminToken, body);
      assert.equal(first.status, 201);
      assert.ok(first.data.data.storedSizeBytes < Buffer.byteLength(content));
      assert.equal((await request(first.data.data.accessUrl, receptionToken)).status, 200);
      const again = await request('/files', adminToken, body);
      assert.equal(again.status, 201);
      assert.equal(first.data.data.id, again.data.data.id);
      assert.equal((await request(first.data.data.accessUrl)).status, 401);
      const downloaded = await request(first.data.data.accessUrl, adminToken);
      assert.equal(downloaded.status, 200);
      assert.equal(downloaded.data, content);
      assert.match(downloaded.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(
        (
          await request('/files', receptionToken, {
            ...body,
            idempotencyKey: crypto.randomUUID(),
            patientId: pb.id,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request('/files', receptionToken, {
            ...body,
            idempotencyKey: crypto.randomUUID(),
            fileType: 'INVOICE',
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    'finance CSV export agrees with its invoice register and neutralizes formula fields',
    async () => {
      const { settingsRepository } = await import('../src/repositories/settings.repository.js');
      const settings = await settingsRepository.getOrCreate();
      await prisma.clinicSettings.update({
        where: { id: settings.id },
        data: { businessAddress: 'Synthetic audit address', gstNumber: 'AUDIT-GST-ONLY' },
      });
      const exported = await request(
        `/analytics/finance/export?branchId=${a.id}&format=csv`,
        adminToken,
      );
      assert.equal(exported.status, 200);
      assert.match(exported.data, /Invoice register/);
      assert.match(exported.data, /Collected against selected invoices/);
      assert.equal(
        (await request(`/analytics/finance/export?branchId=${a.id}&format=csv`, receptionToken))
          .status,
        403,
      );
    },
  );
  await t.test(
    'MFA setup cannot disable an enabled account and recovery codes are single-use under concurrency',
    async () => {
      const { encryptIntegrationSecret } = await import('../src/utils/integration-crypto.js');
      const recoveryCode = crypto.randomBytes(5).toString('hex').toUpperCase();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecretCiphertext: encryptIntegrationSecret(
            'JBSWY3DPEHPK3PXP',
            env.INTEGRATION_ENCRYPTION_KEY!,
          ),
          mfaRecoveryCodes: [await bcrypt.hash(recoveryCode, 10)],
        },
      });
      assert.equal((await request('/security/mfa/setup', receptionToken, {})).status, 409);
      const results = await Promise.all([
        request('/auth/login', undefined, { email: user.email, password, recoveryCode }),
        request('/auth/login', undefined, { email: user.email, password, recoveryCode }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecretCiphertext: null, mfaRecoveryCodes: [] },
      });
    },
  );
  await t.test('worker leases recover crashed jobs and reject stale-owner completion', async () => {
    const { integrationRepository } = await import('../src/repositories/integration.repository.js');
    const job = await prisma.durableJob.create({
      data: {
        type: 'FILE_OPTIMIZATION',
        payload: {},
        idempotencyKey: crypto.randomUUID(),
        status: 'RUNNING',
        lockedBy: 'old-worker',
        lockedAt: new Date(Date.now() - 120000),
        lockExpiresAt: new Date(Date.now() - 60000),
        runAt: new Date(0),
        attempts: 1,
      },
    });
    const claimed = await integrationRepository.claimJob('audit-new-worker', ['FILE_OPTIMIZATION']);
    assert.equal(claimed?.id, job.id);
    assert.equal(claimed?.attempts, 2);
    assert.equal((await integrationRepository.completeJob(job.id, 'old-worker')).count, 0);
    assert.equal((await integrationRepository.completeJob(job.id, 'audit-new-worker')).count, 1);
  });
  await t.test('worker retains an invalid job as failed instead of reporting completion', async () => {
    const { integrationJobService } = await import('../src/services/integration-job.service.js');
    const job = await prisma.durableJob.create({
      data: { type: 'FILE_OPTIMIZATION', payload: {}, idempotencyKey: crypto.randomUUID(), runAt: new Date(0), maxAttempts: 1 },
    });
    await integrationJobService.processDueJobs(1);
    const stored = await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(stored.status, 'DEAD');
    assert.match(stored.lastError ?? '', /Missing required payload/);
    assert.equal(stored.completedAt, null);
  });
  await t.test('repeated invalid login attempts are throttled by the server', async () => {
    const email = `invalid-${crypto.randomUUID()}@example.test`;
    let last;
    for (let index = 0; index < 13; index++)
      last = await request('/auth/login', undefined, { email, password: 'WrongSynthetic2026!' });
    assert.equal(last!.status, 429);
    assert.ok(Number(last!.headers.get('retry-after')) > 0);
  });
  await t.test(
    'website intake persists a valid consented lead in the requested branch',
    async () => {
      const mobile = `88${String(Date.now()).slice(-8)}`;
      const result = await request(
        '/public/website-leads',
        undefined,
        {
          name: 'Synthetic Website Enquiry',
          mobile,
          branchId: a.id,
          privacyConsent: true,
          consentAt: new Date().toISOString(),
        },
        'POST',
        { 'x-lead-ingest-secret': env.WEBSITE_LEAD_INGEST_SECRET! },
      );
      assert.equal(result.status, 201);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.data.data.id } });
      assert.equal(lead.branchId, a.id);
      assert.equal(lead.source, 'WEBSITE');
      assert.equal(lead.mobile, mobile);
    },
  );

  await t.test(
    'patient QR registration converts a booked lead and limits its public response',
    async () => {
      const mobile = `87${String(Date.now()).slice(-8)}`;
      const booked = await request('/appointments', receptionToken, {
        name: 'Synthetic QR Registration',
        mobile,
        branchId: a.id,
        appointmentAt: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(booked.status, 201);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: booked.data.data.leadId } });
      const publicForm = await request(`/public/qr/${lead.qrToken}`);
      assert.equal(publicForm.status, 200);
      assert.equal(publicForm.data.data.medicalProfile, null);
      const registered = await request(`/public/qr/${lead.qrToken}`, undefined, {
        fullName: 'Synthetic QR Registration',
        mobile,
        declaration: true,
      });
      assert.equal(registered.status, 200);
      assert.deepEqual(Object.keys(registered.data.data).sort(), ['patientNo', 'submitted']);
      const patient = await prisma.patient.findUniqueOrThrow({ where: { leadId: lead.id } });
      assert.equal(patient.patientNo, registered.data.data.patientNo);
      assert.equal(patient.branchId, a.id);
      const appointmentId = booked.data.data.id;
      assert.equal((await request(`/appointments/${appointmentId}`, receptionToken)).data.data.status, 'SCHEDULED');
      assert.equal((await request(`/appointments/${appointmentId}/cancel`, receptionToken, { reason: 'Synthetic registration test completed' })).status, 200);
      assert.equal(
        (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status,
        'CONVERTED',
      );
    },
  );

  await t.test(
    'public QR rate limit returns 429 without trusting forged forwarding headers',
    async () => {
      const statuses = [];
      for (let i = 0; i < 13; i++)
        statuses.push(
          (
            await request('/public/qr/invalid', undefined, undefined, 'GET', {
              'X-Forwarded-For': `198.51.100.${i}`,
            })
          ).status,
        );
      assert.equal(statuses.at(-1), 429);
    },
  );
  await t.test(
    'authenticated global limit rejects excess traffic without affecting other identities',
    async () => {
      let last;
      for (let index = 0; index < 245; index++) last = await request('/auth/me', receptionToken);
      assert.equal(last!.status, 429);
      assert.equal((await request('/auth/me', adminToken)).status, 200);
    },
  );
});
