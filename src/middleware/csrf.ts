import type { Request, Response, NextFunction } from 'express';
import config from '../lib/config.js';

// Enforce CSRF only when using cookie-based refresh tokens.
export function requireCsrfForRefresh(req: Request, res: Response, next: NextFunction) {
  if (!config.ENABLE_REFRESH_COOKIE || !config.ENABLE_CSRF_FOR_REFRESH) return next();

  // If the client provided a refreshToken in body, skip CSRF (non-cookie flow)
  const hasBodyToken = Boolean((req.body && typeof req.body === 'object' && 'refreshToken' in req.body));
  if (hasBodyToken) return next();

  const headerName = config.CSRF_HEADER_NAME;
  const cookieName = config.CSRF_COOKIE_NAME;
  const tokenHeader = req.header(headerName) || '';
  const tokenCookie = req.cookies?.[cookieName] || '';
  if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
    res.status(403).json({ success: false, error: { status: 403, code: 'CSRF_INVALID', message: 'Invalid CSRF token' }, requestId: req.requestId });
    return;
  }
  next();
}
