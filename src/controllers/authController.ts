import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthService } from '../services/authService.js';
import { db } from '../lib/db.js';
import { asyncHandler as ah } from '../middleware/errorHandler.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken, emailVerificationToken } = await AuthService.register(req.body, req.requestId);
  res.status(201).json({ success: true, data: { user, accessToken, refreshToken, emailVerificationToken }, requestId: req.requestId });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body, req.requestId);
  res.status(200).json({ success: true, data: result, requestId: req.requestId });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const meta: { ip?: string; userAgent?: string } = {};
  if (req.ip) meta.ip = req.ip;
  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && ua) meta.userAgent = ua;
  const result = await AuthService.refresh(req.body, meta, req.requestId);
  res.status(200).json({ success: true, data: result, requestId: req.requestId });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await AuthService.logout(req.body, req.requestId);
  res.status(200).json({ success: true, data: { loggedOut: true }, requestId: req.requestId });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.verifyEmail(req.body, req.requestId);
  res.status(200).json({ success: true, data: result, requestId: req.requestId });
});

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.requestPasswordReset(req.body, req.requestId);
  res.status(200).json({ success: true, data: result, requestId: req.requestId });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.resetPassword(req.body, req.requestId);
  res.status(200).json({ success: true, data: result, requestId: req.requestId });
});

export default { register, login, refresh, logout, verifyEmail, requestPasswordReset, resetPassword };

// Session management (refresh token records)
export const listMySessions = ah(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const tokens = await db.client.token.findMany({ where: { userId, type: 'REFRESH', revoked: false }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ success: true, data: { sessions: tokens.map(t => ({ id: t.id, createdAt: t.createdAt, expiresAt: t.expiresAt, ip: t.ip, userAgent: t.userAgent })) }, requestId: req.requestId });
});

export const revokeMySession = ah(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ success: false, error: { status: 400, code: 'BAD_REQUEST', message: 'id required', requestId: req.requestId }, requestId: req.requestId });
    return;
  }
  await db.client.token.updateMany({ where: { id, userId, type: 'REFRESH', revoked: false }, data: { revoked: true, usedAt: new Date() } });
  res.json({ success: true, data: { revoked: true }, requestId: req.requestId });
});

export const adminListUserSessions = ah(async (req: Request, res: Response) => {
  const userId = req.params['userId'];
  if (!userId) {
    res.status(400).json({ success: false, error: { status: 400, code: 'BAD_REQUEST', message: 'userId required', requestId: req.requestId }, requestId: req.requestId });
    return;
  }
  const tokens = await db.client.token.findMany({ where: { userId, type: 'REFRESH', revoked: false }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ success: true, data: { sessions: tokens.map(t => ({ id: t.id, createdAt: t.createdAt, expiresAt: t.expiresAt, ip: t.ip, userAgent: t.userAgent })) }, requestId: req.requestId });
});

export const adminRevokeUserSession = ah(async (req: Request, res: Response) => {
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ success: false, error: { status: 400, code: 'BAD_REQUEST', message: 'id required', requestId: req.requestId }, requestId: req.requestId });
    return;
  }
  await db.client.token.update({ where: { id }, data: { revoked: true, usedAt: new Date() } });
  res.json({ success: true, data: { revoked: true }, requestId: req.requestId });
});
