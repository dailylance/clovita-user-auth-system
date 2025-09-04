import { Router } from 'express';
import { register, login, refresh, logout, verifyEmail, requestPasswordReset, resetPassword, listMySessions, revokeMySession, adminListUserSessions, adminRevokeUserSession } from '../controllers/authController.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/password/reset-request', requestPasswordReset);
router.post('/password/reset', resetPassword);

// Session management
router.get('/sessions/me', jwtAuth, listMySessions);
router.delete('/sessions/me/:id', jwtAuth, revokeMySession);
router.get('/sessions/:userId', jwtAuth, requireRole(['admin']), adminListUserSessions);
router.delete('/sessions/:id', jwtAuth, requireRole(['admin']), adminRevokeUserSession);

export default router;
