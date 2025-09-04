import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../lib/db.js';
import config from '../lib/config.js';
import { AppError } from '../middleware/errorHandler.js';
import { comparePassword, hashPassword } from '../middleware/auth.js';
import { sendMail } from '../lib/mailer.js';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const resetRequestSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(20), password: z.string().min(6).max(100) });
const verifyEmailSchema = z.object({ token: z.string().min(20) });

function signAccessToken(userId: string) {
  const payload = { sub: userId, typ: 'access' as const };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL } as SignOptions);
}

function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashOpaqueToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  static async register(input: unknown, requestId?: string) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const { email, username, password } = parsed.data;

    const existing = await db.client.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) throw new AppError('User already exists', 409, 'USER_EXISTS', requestId);

    const passwordHash = await hashPassword(password);
    const user = await db.client.user.create({
      data: { email, username, password: passwordHash },
      select: { id: true, email: true, username: true, role: true, createdAt: true, updatedAt: true, emailVerifiedAt: true },
    });

    // create email verification token (opaque, stored hashed)
    const token = generateOpaqueToken();
    await db.client.token.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFY',
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    // Send verification email if enabled
    try {
      if (config.ENABLE_EMAIL && config.EMAIL_FROM) {
        const verifyLink = `${process.env['APP_BASE_URL'] ?? ''}/verify-email?token=${token}`;
        await sendMail({
          to: user.email,
          subject: 'Verify your Clovita account',
          html: `<p>Hi ${user.username ?? ''},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`,
          text: `Please verify your email: ${verifyLink}`,
        });
      }
    } catch {
      // don't fail registration due to email issues
    }

    const accessToken = signAccessToken(user.id);
    const { refreshToken } = await this.issueRefreshToken(user.id, requestId);
    return { user, accessToken, refreshToken, emailVerificationToken: token };
  }

  static async login(input: unknown, requestId?: string) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const { email, password } = parsed.data;

    const user = await db.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS', requestId);
    const ok = await comparePassword(password, user.password);
    if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS', requestId);

    const accessToken = signAccessToken(user.id);
    const { refreshToken } = await this.issueRefreshToken(user.id, requestId);
    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt, emailVerifiedAt: user.emailVerifiedAt ?? null },
      accessToken,
      refreshToken,
    };
  }

  static async refresh(input: unknown, meta?: { ip?: string; userAgent?: string }, requestId?: string) {
    const parsed = refreshSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const { refreshToken } = parsed.data;
    const tokenHash = hashOpaqueToken(refreshToken);

    const record = await db.client.token.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!record || record.type !== 'REFRESH' || record.revoked || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN', requestId);
    }

    // rotate token
    await db.client.token.update({ where: { id: record.id }, data: { usedAt: new Date(), revoked: true } });
    const newPair = await this.issueRefreshToken(record.userId, requestId, meta);
    const accessToken = signAccessToken(record.userId);
    return { accessToken, refreshToken: newPair.refreshToken };
  }

  static async logout(input: unknown, requestId?: string) {
    const parsed = refreshSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const tokenHash = hashOpaqueToken(parsed.data.refreshToken);
    await db.client.token.updateMany({ where: { tokenHash, type: 'REFRESH', revoked: false }, data: { revoked: true, usedAt: new Date() } });
    return { success: true };
  }

  static async verifyEmail(input: unknown, requestId?: string) {
    const parsed = verifyEmailSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const tokenHash = hashOpaqueToken(parsed.data.token);
    const record = await db.client.token.findUnique({ where: { tokenHash } });
    if (!record || record.type !== 'EMAIL_VERIFY' || record.revoked || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired token', 400, 'INVALID_TOKEN', requestId);
    }
    await db.client.$transaction([
      db.client.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      db.client.token.update({ where: { id: record.id }, data: { usedAt: new Date(), revoked: true } }),
    ]);
    return { verified: true };
  }

  static async requestPasswordReset(input: unknown, requestId?: string) {
    const parsed = resetRequestSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const user = await db.client.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return { sent: true }; // do not reveal
    const token = generateOpaqueToken();
    await db.client.token.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    // Send reset email if enabled (do not reveal user existence by throwing)
    try {
      if (config.ENABLE_EMAIL && config.EMAIL_FROM) {
        const resetLink = `${process.env['APP_BASE_URL'] ?? ''}/reset-password?token=${token}`;
        await sendMail({
          to: user.email,
          subject: 'Reset your Clovita password',
          html: `<p>Hello,</p><p>Reset your password using the link below (valid for 30 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
          text: `Reset your password: ${resetLink}`,
        });
      }
    } catch {
      // ignore mail errors
    }
    return { sent: true, resetToken: token };
  }

  static async resetPassword(input: unknown, requestId?: string) {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    const { token, password } = parsed.data;
    const tokenHash = hashOpaqueToken(token);
    const record = await db.client.token.findUnique({ where: { tokenHash } });
    if (!record || record.type !== 'PASSWORD_RESET' || record.revoked || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired token', 400, 'INVALID_TOKEN', requestId);
    }
    const newHash = await hashPassword(password);
    await db.client.$transaction([
      db.client.user.update({ where: { id: record.userId }, data: { password: newHash } }),
      db.client.token.update({ where: { id: record.id }, data: { usedAt: new Date(), revoked: true } }),
    ]);
    return { reset: true };
  }

  private static async issueRefreshToken(userId: string, _requestId?: string, meta?: { ip?: string; userAgent?: string }) {
    const refreshToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * config.REFRESH_TOKEN_TTL_DAYS);
    await db.client.token.create({
      data: { userId, type: 'REFRESH', tokenHash, expiresAt, ip: meta?.ip ?? null, userAgent: meta?.userAgent ?? null },
    });
    return { refreshToken, expiresAt };
  }
}

export default AuthService;
