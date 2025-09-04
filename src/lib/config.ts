import dotenv from 'dotenv';
import { z } from 'zod';
import os from 'os';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  BASIC_AUTH_USERNAME: z.string(),
  BASIC_AUTH_PASSWORD: z.string(),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
  // Scalability & infra toggles
  ENABLE_CLUSTER: z.coerce.boolean().default(true),
  WORKER_COUNT: z.coerce.number().default(os.cpus().length),
  TRUST_PROXY: z.coerce.boolean().default(true),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  // Rate limit store (memory or redis)
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().optional(),
  // DB request logging controls
  LOG_REQUESTS_TO_DB: z.coerce.boolean().default(false),
  LOG_DB_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  LOG_DB_MAX_BODY_LENGTH: z.coerce.number().default(2000),
  // Prisma logging controls
  PRISMA_LOG_QUERIES: z.coerce.boolean().default(false),
  // Cache controls
  ENABLE_CACHE: z.coerce.boolean().default(true),
  CACHE_TTL_SECONDS: z.coerce.number().default(60),
  CACHE_MAX_ITEMS: z.coerce.number().default(10000),
  // Auth lifetimes
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  // Email settings
  ENABLE_EMAIL: z.coerce.boolean().default(false),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const configResult = configSchema.safeParse(process.env);

if (!configResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(configResult.error.format());
  process.exit(1);
}

export const config = configResult.data;
export default config;
