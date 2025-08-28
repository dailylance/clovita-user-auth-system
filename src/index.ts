import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { db } from './lib/db';
import config from './lib/config';
import logger from './lib/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLogger, dbLogger } from './middleware/logging';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        username: string;
        role: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Basic middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(dbLogger);

// Routes
app.use('/', routes);

// Error handling
app.use('/*splat', notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`📡 Received ${signal}, starting graceful shutdown...`);
  
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`🚀 Server running at http://${config.HOST}:${config.PORT} in ${config.NODE_ENV} mode`);
  });

  process.on(signal, async () => {
    logger.info('📡 Closing HTTP server...');
    server.close(async () => {
      logger.info('🔌 HTTP server closed');
      
      try {
        await db.disconnect();
        logger.info('👋 Database disconnected');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, '❌ Error during shutdown');
        process.exit(1);
      }
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('⏰ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  });
};

// Initialize server
async function startServer() {
  try {
    await db.connect();
    
    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Server running at http://${config.HOST}:${config.PORT} in ${config.NODE_ENV} mode`);
    });

    // Setup graceful shutdown
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => gracefulShutdown(signal));
    });

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

if (require.main === module) {
  startServer();
}

export default app;
