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
import { patientRoutes } from './routes/patient.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'revive-crm-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ad-leads', adLeadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use(errorHandler);
