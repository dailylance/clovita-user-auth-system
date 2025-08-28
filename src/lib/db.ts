import { PrismaClient } from '@prisma/client';
import logger from './logger';

class Database {
  private static instance: Database;
  public client: PrismaClient;

  private constructor() {
    this.client = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Type assertion for Prisma event types
    (this.client as any).$on('query', (e: any) => {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Database query');
    });

    (this.client as any).$on('error', (e: any) => {
      logger.error({ target: e.target }, 'Database error');
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.$connect();
      logger.info('✅ Database connected');
    } catch (error) {
      logger.error({ error }, '❌ Database connection failed');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.$disconnect();
      logger.info('👋 Database disconnected');
    } catch (error) {
      logger.error({ error }, '❌ Database disconnection failed');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

const db = Database.getInstance();
export { db };
export default Database;
