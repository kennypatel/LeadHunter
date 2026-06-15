import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler, notFound } from './middleware/error';

import authRoutes from './routes/auth';
import leadRoutes from './routes/leads';
import companyRoutes from './routes/companies';
import messageRoutes from './routes/messages';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import salesRoutes from './routes/sales';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.webOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Global, generous rate limit; tighter limits live on sensitive routes.
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

  // Health & system status.
  app.get('/api/health', async (_req, res) => {
    let db = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    res.json({
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      env: env.nodeEnv,
      providers: { ai: env.ai.provider, email: env.email.provider, sms: env.sms.provider },
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/sales', salesRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
