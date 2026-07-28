import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly client?: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');
    const connectTimeout = Number(
      configService.get<string>('REDIS_CONNECT_TIMEOUT_MS') ?? 500,
    );

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout,
        commandTimeout: connectTimeout,
      });
      this.client.on('error', () => undefined);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(await this.isAvailable())) return null;

    try {
      const value = await this.client!.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!(await this.isAvailable())) return;

    try {
      await this.client!.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Redis is an optional performance layer; MySQL requests still succeed.
    }
  }

  async del(key: string): Promise<void> {
    if (!(await this.isAvailable())) return;

    try {
      await this.client!.del(key);
    } catch {
      // Redis is an optional performance layer; cache invalidation is retried on the next mutation.
    }
  }

  async onModuleDestroy() {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit().catch(() => undefined);
    }
  }

  private async isAvailable(): Promise<boolean> {
    if (!this.client) return false;

    try {
      if (this.client.status === 'wait') await this.client.connect();
      return this.client.status === 'ready';
    } catch {
      return false;
    }
  }
}
