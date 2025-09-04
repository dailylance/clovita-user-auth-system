import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit, { type Store as RateLimitStore } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser';
import config from './lib/config.js';
import logger from './lib/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { httpLogger, dbLogger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import crypto from 'crypto';
import { db } from './lib/db.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
  username: string | null;
        role: string;
        createdAt: Date;
        updatedAt: Date;
  emailVerifiedAt?: Date | null;
      };
    }
  }
}

const app = express();

// Security best-practice
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN.split(',').map((origin: string) => origin.trim()),
  credentials: true,
}));
app.use(cookieParser());

// Rate limiting (Memory or Redis)
const createRateLimiter = () => {
  try {
    if (config.RATE_LIMIT_STORE === 'redis' && config.REDIS_URL) {
      const redis = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableAutoPipelining: true,
      });
      // Connect asynchronously; if it fails, fallback will be used
      redis.on('error', (err) => logger.warn({ err }, 'Redis error'));
  return rateLimit({
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        max: config.RATE_LIMIT_MAX_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: {
            status: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
          },
        },
  store: new RedisStore({
          // @ts-ignore type mismatch from store interface
          sendCommand: (...args: string[]) => redis.call(...args as [string, ...string[]]) as unknown as Promise<unknown>,
          prefix: 'rate-limit:',
  }) as unknown as RateLimitStore,
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Redis rate limiter; falling back to memory');
  }
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
      },
    },
  });
};
app.use(createRateLimiter());

// Basic middleware
app.use(compression());
app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));
// Issue a CSRF double-submit cookie for browser flows (non-HttpOnly)
app.use((req, res, next) => {
  if (config.ENABLE_REFRESH_COOKIE && config.ENABLE_CSRF_FOR_REFRESH) {
    const name = config.CSRF_COOKIE_NAME;
    if (!req.cookies?.[name]) {
      const token = crypto.randomBytes(16).toString('hex');
      res.cookie(name, token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env['NODE_ENV'] === 'production',
        path: '/',
        domain: config.REFRESH_COOKIE_DOMAIN,
      });
    }
  }
  next();
});

// Custom middleware
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(dbLogger);

// Routes
app.use('/', routes);

// Error handling: catch-all 404 handler placed after routes
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const setupGracefulShutdown = (server: import('http').Server) => {
  const shutdown = async (signal: string) => {
    try {
      logger.info({ signal }, 'Shutting down');
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };
  ['SIGTERM', 'SIGINT'].forEach((sig) => {
    process.on(sig, () => shutdown(sig));
  });
};

// Initialize server
async function startServer() {
  try {
    await db.connect();
  const server = app.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Worker ${process.pid} listening at http://${config.HOST}:${config.PORT} (${config.NODE_ENV})`);
    });
  // Tune HTTP server timeouts for proxies/load balancers
  server.keepAliveTimeout = 65_000; // keep alive a bit over typical LB timeouts
  server.headersTimeout = 67_000;   // slightly above keepAliveTimeout
  server.requestTimeout = 0;        // disable per-request timeout; rely on LB timeouts
    setupGracefulShutdown(server);

    // Housekeeping: purge expired/revoked tokens periodically
    const interval = setInterval(async () => {
      try {
        const threshold = new Date(Date.now() - config.TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await db.client.token.deleteMany({ where: { OR: [ { expiresAt: { lt: new Date() } }, { revoked: true, usedAt: { lt: threshold } } ] } });
      } catch (err) {
        logger.warn({ err }, 'token cleanup failed');
      }
    }, config.CLEANUP_INTERVAL_MS);
    process.on('exit', () => clearInterval(interval));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception occurred');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection occurred');
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  // For clustering, prefer PM2 exec_mode=cluster or container orchestration
  startServer();
}

export default app;
