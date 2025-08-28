import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { db } from '../lib/db';
import logger from '../lib/logger';
import { RequestLogData } from '../types';

const pinoHttpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  customProps: (req) => ({
    requestId: (req as any).requestId,
    userId: (req as any).user?.id,
  }),
});

export const httpLogger = pinoHttpLogger;

export const dbLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  
  const originalSend = res.send;
  let responseBody: unknown;
  
  res.send = function(body: unknown) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    
    const logData: RequestLogData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('user-agent') || undefined,
      ip: req.ip || req.socket.remoteAddress || undefined,
      userId: req.user?.id || undefined,
      statusCode: res.statusCode,
      responseTime,
      requestBody: req.body,
      responseBody: responseBody && typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
    };

    try {
      await db.client.requestLog.create({
        data: {
          requestId: logData.requestId,
          method: logData.method,
          url: logData.url,
          userAgent: logData.userAgent || null,
          ip: logData.ip || null,
          userId: logData.userId || null,
          statusCode: logData.statusCode || null,
          responseTime: logData.responseTime || null,
          requestBody: logData.requestBody as any,
          responseBody: logData.responseBody as any,
          headers: logData.headers as any,
          query: logData.query as any,
          params: logData.params as any,
        },
      });
    } catch (error) {
      logger.error({ error, requestId: req.requestId }, 'Failed to log request to database');
    }
  });

  next();
};
