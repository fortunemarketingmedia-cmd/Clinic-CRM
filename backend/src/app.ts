import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { rateLimit } from './middleware/rate-limit.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { adLeadRoutes } from './routes/ad-lead.routes.js';
import { appointmentRoutes } from './routes/appointment.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { billingRoutes } from './routes/billing.routes.js';
import { branchRoutes } from './routes/branch.routes.js';
import { leadRoutes } from './routes/lead.routes.js';
import { leadScoringRoutes } from './routes/lead-scoring.routes.js';
import { followUpRoutes } from './routes/follow-up.routes.js';
import { frontDeskRoutes } from './routes/front-desk.routes.js';
import { personRoutes } from './routes/person.routes.js';
import { patientRoutes } from './routes/patient.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { taskRoutes } from './routes/task.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { waitlistRoutes } from './routes/waitlist.routes.js';
import { patient360Routes } from './routes/patient-360.routes.js';
import { consentRoutes, fileRoutes, formRoutes } from './routes/forms.routes.js';
import { requestContext } from './middleware/request-context.js';
import { integrationRoutes } from './routes/integration.routes.js';
import { automationRoutes } from './routes/automation.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { securityRoutes } from './routes/security.routes.js';
import { prisma } from './config/db.js';
import { HttpError } from './utils/http-error.js';

export const app = express();

app.use(requestContext);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buffer) => {
      (req as express.Request).rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240, keyPrefix: 'api' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'revive-crm-backend' });
});
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'revive-crm-backend',
      database: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'unavailable',
      service: 'revive-crm-backend',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    keyPrefix: 'login',
    key: (req) =>
      `${req.ip ?? 'unknown'}:${String(req.body?.email ?? '')
        .trim()
        .toLowerCase()}`,
  }),
);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/lead-scoring-rules', leadScoringRoutes);
app.use('/api/people', personRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/front-desk', frontDeskRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinical', patient360Routes);
app.use('/api/forms', formRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ad-leads', adLeadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/security', securityRoutes);

app.use((req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.path} was not found`));
});

app.use(errorHandler);
