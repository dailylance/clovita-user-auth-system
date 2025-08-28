// Ambient module declarations to satisfy TypeScript before dependencies are installed.
// These will be overridden by actual types after `npm ci`.
declare module 'rate-limit-redis' {
  export class RedisStore {
    constructor(options: Record<string, unknown>);
  }
}

declare module 'ioredis' {
  import { EventEmitter } from 'events';
  class IORedis extends EventEmitter {
    constructor(url?: string, options?: Record<string, unknown>);
    call(command: string, ...args: string[]): Promise<unknown>;
    on(event: 'error', listener: (err: unknown) => void): this;
  }
  export default IORedis;
}
