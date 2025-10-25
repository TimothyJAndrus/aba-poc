import { Router } from 'express';
import { CacheController } from '../controllers/CacheController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All cache routes require authentication
router.use(authenticateToken);

// Get cache statistics
router.get('/stats', CacheController.getCacheStats);

// Check cache health
router.get('/health', CacheController.getCacheHealth);

// Get cached schedule data for a client
router.get('/schedule/:clientId', CacheController.getCachedSchedule);

// Invalidate schedule cache
router.post('/invalidate/schedule', CacheController.invalidateScheduleCache);

// Invalidate availability cache
router.post('/invalidate/availability', CacheController.invalidateAvailabilityCache);

// Flush all cache (admin only)
router.delete('/flush-all', CacheController.flushAllCache);

export default router;