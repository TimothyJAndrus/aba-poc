import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly defaultTTL = 3600; // 1 hour default TTL

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      ...(config.redis.password && { password: config.redis.password }),
      database: config.redis.db,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client connected and ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis client error', { error: error.message });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis client connection ended');
    });
  }

  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      logger.error('Failed to disconnect from Redis', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private generateKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || 'aba_scheduling';
    return `${keyPrefix}:${key}`;
  }

  // Basic cache operations
  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping cache get');
        return null;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const value = await this.client.get(cacheKey);
      
      if (value) {
        logger.debug('Cache hit', { key: cacheKey });
        return JSON.parse(value);
      }
      
      logger.debug('Cache miss', { key: cacheKey });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  public async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping cache set');
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      await this.client.setEx(cacheKey, ttl, JSON.stringify(value));
      logger.debug('Cache set', { key: cacheKey, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  public async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping cache delete');
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.del(cacheKey);
      logger.debug('Cache delete', { key: cacheKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  // Schedule-specific cache operations
  public async getScheduleData(clientId: string, dateRange: { start: Date; end: Date }): Promise<any | null> {
    const key = `schedule:client:${clientId}:${dateRange.start.toISOString().split('T')[0]}:${dateRange.end.toISOString().split('T')[0]}`;
    return this.get(key, { prefix: 'schedule', ttl: 1800 }); // 30 minutes TTL for schedule data
  }

  public async setScheduleData(clientId: string, dateRange: { start: Date; end: Date }, data: any): Promise<boolean> {
    const key = `schedule:client:${clientId}:${dateRange.start.toISOString().split('T')[0]}:${dateRange.end.toISOString().split('T')[0]}`;
    return this.set(key, data, { prefix: 'schedule', ttl: 1800 });
  }

  public async getRBTSchedule(rbtId: string, date: Date): Promise<any | null> {
    const key = `rbt:${rbtId}:${date.toISOString().split('T')[0]}`;
    return this.get(key, { prefix: 'schedule', ttl: 1800 });
  }

  public async setRBTSchedule(rbtId: string, date: Date, data: any): Promise<boolean> {
    const key = `rbt:${rbtId}:${date.toISOString().split('T')[0]}`;
    return this.set(key, data, { prefix: 'schedule', ttl: 1800 });
  }

  public async getAvailableRBTs(clientId: string, dateTime: Date): Promise<string[] | null> {
    const key = `available_rbts:client:${clientId}:${dateTime.toISOString()}`;
    return this.get(key, { prefix: 'scheduling', ttl: 300 }); // 5 minutes TTL for availability
  }

  public async setAvailableRBTs(clientId: string, dateTime: Date, rbtIds: string[]): Promise<boolean> {
    const key = `available_rbts:client:${clientId}:${dateTime.toISOString()}`;
    return this.set(key, rbtIds, { prefix: 'scheduling', ttl: 300 });
  }

  // Cache invalidation methods
  public async invalidateScheduleCache(clientId?: string, rbtId?: string): Promise<void> {
    try {
      const patterns: string[] = [];
      
      if (clientId) {
        patterns.push(`schedule:schedule:client:${clientId}:*`);
      }
      
      if (rbtId) {
        patterns.push(`schedule:rbt:${rbtId}:*`);
      }
      
      // If no specific IDs provided, invalidate all schedule cache
      if (!clientId && !rbtId) {
        patterns.push('schedule:*');
      }

      for (const pattern of patterns) {
        await this.deleteByPattern(pattern);
      }

      logger.info('Schedule cache invalidated', { clientId, rbtId, patterns });
    } catch (error) {
      logger.error('Error invalidating schedule cache', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public async invalidateAvailabilityCache(clientId?: string, dateTime?: Date): Promise<void> {
    try {
      let pattern = 'scheduling:available_rbts:*';
      
      if (clientId && dateTime) {
        pattern = `scheduling:available_rbts:client:${clientId}:${dateTime.toISOString()}`;
      } else if (clientId) {
        pattern = `scheduling:available_rbts:client:${clientId}:*`;
      }

      await this.deleteByPattern(pattern);
      logger.info('Availability cache invalidated', { clientId, dateTime, pattern });
    } catch (error) {
      logger.error('Error invalidating availability cache', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async deleteByPattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug('Deleted keys by pattern', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Error deleting keys by pattern', { pattern, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Utility methods
  public async flushAll(): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }
      
      await this.client.flushAll();
      logger.info('All cache data flushed');
    } catch (error) {
      logger.error('Error flushing cache', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public async getStats(): Promise<any> {
    try {
      if (!this.isConnected) {
        return { connected: false };
      }

      const info = await this.client.info();
      const dbSize = await this.client.dbSize();
      
      return {
        connected: this.isConnected,
        dbSize,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting cache stats', { error: errorMessage });
      return { connected: false, error: errorMessage };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
};

export const initializeCacheService = async (): Promise<CacheService> => {
  const service = getCacheService();
  await service.connect();
  return service;
};