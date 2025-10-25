import { Request, Response } from 'express';
import { getCacheService } from '../services/CacheService';
import { logger } from '../utils/logger';

export class CacheController {
  
  /**
   * Get cache statistics and health status
   */
  public static async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const cacheService = getCacheService();
      const stats = await cacheService.getStats();

      res.json({
        success: true,
        data: {
          ...stats,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting cache stats', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics'
      });
    }
  }

  /**
   * Check cache health
   */
  public static async getCacheHealth(req: Request, res: Response): Promise<void> {
    try {
      const cacheService = getCacheService();
      const isHealthy = cacheService.isHealthy();

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: {
          healthy: isHealthy,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error checking cache health', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(503).json({
        success: false,
        message: 'Cache health check failed'
      });
    }
  }

  /**
   * Invalidate schedule cache for specific client or RBT
   */
  public static async invalidateScheduleCache(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, rbtId } = req.body;
      const cacheService = getCacheService();

      await cacheService.invalidateScheduleCache(clientId, rbtId);

      logger.info('Schedule cache invalidated via API', { clientId, rbtId });

      res.json({
        success: true,
        message: 'Schedule cache invalidated successfully',
        data: {
          clientId,
          rbtId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error invalidating schedule cache', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate schedule cache'
      });
    }
  }

  /**
   * Invalidate availability cache
   */
  public static async invalidateAvailabilityCache(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, dateTime } = req.body;
      const cacheService = getCacheService();

      const parsedDateTime = dateTime ? new Date(dateTime) : undefined;
      await cacheService.invalidateAvailabilityCache(clientId, parsedDateTime);

      logger.info('Availability cache invalidated via API', { clientId, dateTime });

      res.json({
        success: true,
        message: 'Availability cache invalidated successfully',
        data: {
          clientId,
          dateTime: parsedDateTime,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error invalidating availability cache', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate availability cache'
      });
    }
  }

  /**
   * Flush all cache data (admin only)
   */
  public static async flushAllCache(req: Request, res: Response): Promise<void> {
    try {
      // Check if user has admin role
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required to flush cache'
        });
        return;
      }

      const cacheService = getCacheService();
      await cacheService.flushAll();

      logger.warn('All cache data flushed via API', { 
        userId: (req as any).user?.userId,
        userRole 
      });

      res.json({
        success: true,
        message: 'All cache data flushed successfully',
        data: {
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error flushing cache', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to flush cache'
      });
    }
  }

  /**
   * Get cached schedule data for a client
   */
  public static async getCachedSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate query parameters are required'
        });
        return;
      }

      const cacheService = getCacheService();
      const dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const cachedData = await cacheService.getScheduleData(clientId!, dateRange);

      res.json({
        success: true,
        data: {
          clientId,
          dateRange,
          cached: cachedData !== null,
          scheduleData: cachedData,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting cached schedule', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to get cached schedule data'
      });
    }
  }
}