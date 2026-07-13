import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.post('/login', (req, res, next) => {
  authController.login(req, res).catch(next);
});

authRoutes.post('/refresh', (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

authRoutes.post('/logout', (req, res, next) => {
  authController.logout(req, res).catch(next);
});

authRoutes.post('/logout-all', requireAuth, (req, res, next) => {
  authController.logoutAll(req, res).catch(next);
});

authRoutes.get('/me', requireAuth, (req, res, next) => {
  authController.me(req, res).catch(next);
});
