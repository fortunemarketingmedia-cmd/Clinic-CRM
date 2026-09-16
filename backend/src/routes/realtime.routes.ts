import { Router } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { realtimeService } from '../services/realtime.service.js';

export const realtimeRoutes = Router();

realtimeRoutes.get('/events', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (!token) {
    res.status(401).end();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    if (payload.role === 'DEVELOPER') {
      res.status(401).end();
      return;
    }
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');

  const unsubscribe = realtimeService.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});
