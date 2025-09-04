import { Router } from 'express';
import { register, login, refresh, logout, verifyEmail, requestPasswordReset, resetPassword, listMySessions, revokeMySession, adminListUserSessions, adminRevokeUserSession } from '../controllers/authController.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { loginLimiter, refreshLimiter, passwordLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import { requireCsrfForRefresh } from '../middleware/csrf.js';

const router = Router();

// Public auth endpoints
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshLimiter, requireCsrfForRefresh, refresh);
router.post('/logout', refreshLimiter, requireCsrfForRefresh, logout);
router.post('/verify-email', passwordLimiter, verifyEmail);
router.post('/password/reset-request', passwordLimiter, requestPasswordReset);
router.post('/password/reset', passwordLimiter, resetPassword);

// Session management
router.get('/sessions/me', jwtAuth, listMySessions);
router.delete('/sessions/me/:id', jwtAuth, revokeMySession);
router.get('/sessions/:userId', jwtAuth, requireRole(['admin']), adminListUserSessions);
router.delete('/sessions/:id', jwtAuth, requireRole(['admin']), adminRevokeUserSession);

export default router;
