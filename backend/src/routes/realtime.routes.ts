import { Router } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { realtimeService } from '../services/realtime.service.js';

export const realtimeRoutes = Router();

realtimeRoutes.get('/events', (req, res) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) {
    res.status(401).end();
    return;
  }
  let expiresAt = Date.now() + 15 * 60 * 1000;
  try {
    const payload = verifyAccessToken(token);
    if (payload.role === 'DEVELOPER') {
      res.status(401).end();
      return;
    }
    if (payload.exp) expiresAt = payload.exp * 1000;
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
  const expiry = setTimeout(() => res.end(), Math.max(1, expiresAt - Date.now()));

  req.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unsubscribe();
  });
});
