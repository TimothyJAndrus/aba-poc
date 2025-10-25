import { Request, Response } from 'express';
import { CacheController } from '../CacheController';
import { getCacheService } from '../../services/CacheService';

// Mock the Cache service
jest.mock('../../services/CacheService', () => ({
  getCacheService: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('CacheController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCacheService: any;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { userId: 'test-user', email: 'test@example.com', role: 'coordinator' }
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    mockCacheService = {
      getStats: jest.fn(),
      isHealthy: jest.fn(),
      invalidateScheduleCache: jest.fn(),
      invalidateAvailabilityCache: jest.fn(),
      flushAll: jest.fn(),
      getScheduleData: jest.fn()
    };

    (getCacheService as jest.Mock).mockReturnValue(mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCacheStats', () => {
    it('should return cache statistics successfully', async () => {
      const mockStats = {
        connected: true,
        dbSize: 100,
        info: { redis_version: '6.0.0' }
      };
      mockCacheService.getStats.mockResolvedValue(mockStats);

      await CacheController.getCacheStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockStats,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle service errors', async () => {
      mockCacheService.getStats.mockRejectedValue(new Error('Stats error'));

      await CacheController.getCacheStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get cache statistics'
      });
    });
  });

  describe('getCacheHealth', () => {
    it('should return healthy status', async () => {
      mockCacheService.isHealthy.mockReturnValue(true);

      await CacheController.getCacheHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthy: true,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should return unhealthy status', async () => {
      mockCacheService.isHealthy.mockReturnValue(false);

      await CacheController.getCacheHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          healthy: false,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle service errors', async () => {
      mockCacheService.isHealthy.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      await CacheController.getCacheHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cache health check failed'
      });
    });
  });

  describe('invalidateScheduleCache', () => {
    it('should invalidate schedule cache successfully', async () => {
      mockRequest.body = {
        clientId: 'client-123',
        rbtId: 'rbt-123'
      };
      mockCacheService.invalidateScheduleCache.mockResolvedValue(undefined);

      await CacheController.invalidateScheduleCache(mockRequest as Request, mockResponse as Response);

      expect(mockCacheService.invalidateScheduleCache).toHaveBeenCalledWith('client-123', 'rbt-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Schedule cache invalidated successfully',
        data: {
          clientId: 'client-123',
          rbtId: 'rbt-123',
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = { clientId: 'client-123' };
      mockCacheService.invalidateScheduleCache.mockRejectedValue(new Error('Invalidation failed'));

      await CacheController.invalidateScheduleCache(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to invalidate schedule cache'
      });
    });
  });

  describe('invalidateAvailabilityCache', () => {
    it('should invalidate availability cache successfully', async () => {
      mockRequest.body = {
        clientId: 'client-123',
        dateTime: '2024-01-01T10:00:00Z'
      };
      mockCacheService.invalidateAvailabilityCache.mockResolvedValue(undefined);

      await CacheController.invalidateAvailabilityCache(mockRequest as Request, mockResponse as Response);

      expect(mockCacheService.invalidateAvailabilityCache).toHaveBeenCalledWith(
        'client-123',
        new Date('2024-01-01T10:00:00Z')
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Availability cache invalidated successfully',
        data: {
          clientId: 'client-123',
          dateTime: new Date('2024-01-01T10:00:00Z'),
          timestamp: expect.any(Date)
        }
      });
    });
  });

  describe('flushAllCache', () => {
    it('should flush all cache for admin user', async () => {
      (mockRequest as any).user = { userId: 'admin-user', email: 'admin@example.com', role: 'admin' };
      mockCacheService.flushAll.mockResolvedValue(undefined);

      await CacheController.flushAllCache(mockRequest as Request, mockResponse as Response);

      expect(mockCacheService.flushAll).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'All cache data flushed successfully',
        data: {
          timestamp: expect.any(Date)
        }
      });
    });

    it('should reject non-admin users', async () => {
      (mockRequest as any).user = { userId: 'regular-user', email: 'user@example.com', role: 'coordinator' };

      await CacheController.flushAllCache(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required to flush cache'
      });
      expect(mockCacheService.flushAll).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      (mockRequest as any).user = { userId: 'admin-user', email: 'admin@example.com', role: 'admin' };
      mockCacheService.flushAll.mockRejectedValue(new Error('Flush failed'));

      await CacheController.flushAllCache(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to flush cache'
      });
    });
  });

  describe('getCachedSchedule', () => {
    it('should get cached schedule successfully', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      };
      const mockScheduleData = { sessions: [] };
      mockCacheService.getScheduleData.mockResolvedValue(mockScheduleData);

      await CacheController.getCachedSchedule(mockRequest as Request, mockResponse as Response);

      expect(mockCacheService.getScheduleData).toHaveBeenCalledWith(
        'client-123',
        {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-07')
        }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          clientId: 'client-123',
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-07')
          },
          cached: true,
          scheduleData: mockScheduleData,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should return cache miss result', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      };
      mockCacheService.getScheduleData.mockResolvedValue(null);

      await CacheController.getCachedSchedule(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          clientId: 'client-123',
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-07')
          },
          cached: false,
          scheduleData: null,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should return error for missing query parameters', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = { startDate: '2024-01-01' }; // Missing endDate

      await CacheController.getCachedSchedule(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'startDate and endDate query parameters are required'
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      };
      mockCacheService.getScheduleData.mockRejectedValue(new Error('Cache error'));

      await CacheController.getCachedSchedule(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get cached schedule data'
      });
    });
  });
});