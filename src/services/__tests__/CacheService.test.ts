import { CacheService, getCacheService, initializeCacheService } from '../CacheService';
import { createClient } from 'redis';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  flushAll: jest.fn(),
  info: jest.fn(),
  dbSize: jest.fn(),
  on: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = getCacheService();
  });

  describe('Service Initialization', () => {
    it('should create Redis client with correct configuration', () => {
      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: expect.any(String),
          port: expect.any(Number)
        },
        password: undefined,
        database: expect.any(Number)
      });
    });

    it('should initialize cache service successfully', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      
      const service = await initializeCacheService();
      
      expect(service).toBeInstanceOf(CacheService);
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);
      
      await expect(initializeCacheService()).rejects.toThrow('Connection failed');
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      // Mock connected state
      (cacheService as any).isConnected = true;
    });

    it('should get cached value successfully', async () => {
      const testData = { test: 'data' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
      
      const result = await cacheService.get('test-key');
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('aba_scheduling:test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await cacheService.get('missing-key');
      
      expect(result).toBeNull();
    });

    it('should set cache value with TTL', async () => {
      const testData = { test: 'data' };
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      const result = await cacheService.set('test-key', testData, { ttl: 300 });
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'aba_scheduling:test-key',
        300,
        JSON.stringify(testData)
      );
      expect(result).toBe(true);
    });

    it('should delete cache entry', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      
      const result = await cacheService.delete('test-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('aba_scheduling:test-key');
      expect(result).toBe(true);
    });

    it('should check if key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      
      const result = await cacheService.exists('test-key');
      
      expect(mockRedisClient.exists).toHaveBeenCalledWith('aba_scheduling:test-key');
      expect(result).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
    });
  });

  describe('Schedule-Specific Cache Operations', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    it('should cache and retrieve schedule data', async () => {
      const clientId = 'client-123';
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07')
      };
      const scheduleData = { sessions: [] };

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(scheduleData));

      // Set schedule data
      const setResult = await cacheService.setScheduleData(clientId, dateRange, scheduleData);
      expect(setResult).toBe(true);

      // Get schedule data
      const getResult = await cacheService.getScheduleData(clientId, dateRange);
      expect(getResult).toEqual(scheduleData);

      const expectedKey = 'schedule:schedule:client:client-123:2024-01-01:2024-01-07';
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(expectedKey, 1800, JSON.stringify(scheduleData));
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should cache and retrieve RBT schedule', async () => {
      const rbtId = 'rbt-123';
      const date = new Date('2024-01-01');
      const scheduleData = { availability: [] };

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(scheduleData));

      await cacheService.setRBTSchedule(rbtId, date, scheduleData);
      const result = await cacheService.getRBTSchedule(rbtId, date);

      expect(result).toEqual(scheduleData);
      const expectedKey = 'schedule:rbt:rbt-123:2024-01-01';
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(expectedKey, 1800, JSON.stringify(scheduleData));
    });

    it('should cache and retrieve available RBTs', async () => {
      const clientId = 'client-123';
      const dateTime = new Date('2024-01-01T10:00:00Z');
      const rbtIds = ['rbt-1', 'rbt-2'];

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(rbtIds));

      await cacheService.setAvailableRBTs(clientId, dateTime, rbtIds);
      const result = await cacheService.getAvailableRBTs(clientId, dateTime);

      expect(result).toEqual(rbtIds);
      const expectedKey = 'scheduling:available_rbts:client:client-123:2024-01-01T10:00:00.000Z';
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(expectedKey, 300, JSON.stringify(rbtIds));
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    it('should invalidate schedule cache for specific client', async () => {
      const clientId = 'client-123';
      mockRedisClient.keys.mockResolvedValue(['schedule:schedule:client:client-123:key1', 'schedule:schedule:client:client-123:key2']);
      mockRedisClient.del.mockResolvedValue(2);

      await cacheService.invalidateScheduleCache(clientId);

      expect(mockRedisClient.keys).toHaveBeenCalledWith('schedule:schedule:client:client-123:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(['schedule:schedule:client:client-123:key1', 'schedule:schedule:client:client-123:key2']);
    });

    it('should invalidate availability cache', async () => {
      const clientId = 'client-123';
      const dateTime = new Date('2024-01-01T10:00:00Z');
      mockRedisClient.keys.mockResolvedValue(['scheduling:available_rbts:client:client-123:2024-01-01T10:00:00.000Z']);
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.invalidateAvailabilityCache(clientId, dateTime);

      expect(mockRedisClient.keys).toHaveBeenCalledWith('scheduling:available_rbts:client:client-123:2024-01-01T10:00:00.000Z');
      expect(mockRedisClient.del).toHaveBeenCalledWith(['scheduling:available_rbts:client:client-123:2024-01-01T10:00:00.000Z']);
    });

    it('should flush all cache data', async () => {
      mockRedisClient.flushAll.mockResolvedValue('OK');

      await cacheService.flushAll();

      expect(mockRedisClient.flushAll).toHaveBeenCalled();
    });
  });

  describe('Health and Statistics', () => {
    it('should return health status', () => {
      (cacheService as any).isConnected = true;
      expect(cacheService.isHealthy()).toBe(true);

      (cacheService as any).isConnected = false;
      expect(cacheService.isHealthy()).toBe(false);
    });

    it('should get cache statistics', async () => {
      (cacheService as any).isConnected = true;
      mockRedisClient.info.mockResolvedValue('redis_version:6.0.0\r\nused_memory:1024');
      mockRedisClient.dbSize.mockResolvedValue(100);

      const stats = await cacheService.getStats();

      expect(stats).toEqual({
        connected: true,
        dbSize: 100,
        info: {
          redis_version: '6.0.0',
          used_memory: '1024'
        }
      });
    });

    it('should handle disconnected state in stats', async () => {
      (cacheService as any).isConnected = false;

      const stats = await cacheService.getStats();

      expect(stats).toEqual({ connected: false });
    });
  });

  describe('Disconnected State Handling', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = false;
    });

    it('should skip operations when disconnected', async () => {
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();

      const setResult = await cacheService.set('test-key', 'value');
      expect(setResult).toBe(false);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();

      const deleteResult = await cacheService.delete('test-key');
      expect(deleteResult).toBe(false);
      expect(mockRedisClient.del).not.toHaveBeenCalled();

      const existsResult = await cacheService.exists('test-key');
      expect(existsResult).toBe(false);
      expect(mockRedisClient.exists).not.toHaveBeenCalled();
    });
  });
});