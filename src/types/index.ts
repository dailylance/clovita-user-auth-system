import { Request } from 'express';

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId: string;
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerifiedAt?: Date | null;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  role?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshInput { refreshToken: string }

export interface AuthenticatedRequest extends Request {
  user?: User;
  requestId: string;
}

export interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
  userId?: string | undefined;
  statusCode?: number | undefined;
  responseTime?: number | undefined;
  requestBody?: unknown;
  responseBody?: unknown;
  headers?: Record<string, string> | undefined;
  query?: Record<string, unknown> | undefined;
  params?: Record<string, unknown> | undefined;
  error?: string | undefined;
}
