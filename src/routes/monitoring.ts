import { Router } from 'express';
import { MonitoringController } from '../controllers/MonitoringController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const monitoringController = new MonitoringController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/monitoring/health
 * @desc Get system health status
 * @access Private (admins, coordinators)
 */
router.get('/health', monitoringController.getHealthStatus);

/**
 * @route GET /api/monitoring/metrics/system
 * @desc Get system-level metrics
 * @access Private (admins)
 */
router.get('/metrics/system', monitoringController.getSystemMetrics);

/**
 * @route GET /api/monitoring/metrics/application
 * @desc Get application-specific metrics
 * @access Private (admins, coordinators)
 */
router.get('/metrics/application', monitoringController.getApplicationMetrics);

/**
 * @route GET /api/monitoring/alerts/active
 * @desc Get active alerts
 * @access Private (admins, coordinators)
 */
router.get('/alerts/active', monitoringController.getActiveAlerts);

/**
 * @route GET /api/monitoring/alerts/all
 * @desc Get all alerts with pagination
 * @access Private (admins)
 */
router.get('/alerts/all', monitoringController.getAllAlerts);

/**
 * @route POST /api/monitoring/alerts/thresholds
 * @desc Add custom alert threshold
 * @access Private (admins)
 */
router.post('/alerts/thresholds', monitoringController.addAlertThreshold);

/**
 * @route DELETE /api/monitoring/alerts/thresholds/:metric
 * @desc Remove alert threshold
 * @access Private (admins)
 */
router.delete('/alerts/thresholds/:metric', monitoringController.removeAlertThreshold);

/**
 * @route GET /api/monitoring/dashboard
 * @desc Get comprehensive monitoring dashboard data
 * @access Private (admins, coordinators)
 */
router.get('/dashboard', monitoringController.getDashboardData);

export default router;