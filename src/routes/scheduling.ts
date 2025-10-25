import { Router } from 'express';
import { SchedulingController } from '../controllers/SchedulingController';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Initialize repositories
const sessionRepository = new SessionRepository();
const teamRepository = new TeamRepository();
const rbtRepository = new RBTRepository();
const clientRepository = new ClientRepository();

// Initialize controller
const schedulingController = new SchedulingController(
  sessionRepository,
  teamRepository,
  rbtRepository,
  clientRepository
);

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route POST /api/schedule/session
 * @desc Schedule a single therapy session
 * @access Private
 */
router.post('/session', (req, res) => {
  schedulingController.scheduleSession(req, res);
});

/**
 * @route POST /api/schedule/bulk
 * @desc Schedule multiple sessions across a date range
 * @access Private
 */
router.post('/bulk', (req, res) => {
  schedulingController.bulkScheduleSessions(req, res);
});

/**
 * @route GET /api/schedule/alternatives
 * @desc Find alternative time slots for scheduling
 * @access Private
 * @query clientId - Client ID (required)
 * @query preferredDate - Preferred date in ISO format (required)
 * @query daysToSearch - Number of days to search ahead (optional, default: 7)
 */
router.get('/alternatives', (req, res) => {
  schedulingController.findAlternatives(req, res);
});

/**
 * @route PUT /api/schedule/session/:sessionId/reschedule
 * @desc Reschedule an existing session
 * @access Private
 */
router.put('/session/:sessionId/reschedule', (req, res) => {
  schedulingController.rescheduleSession(req, res);
});

/**
 * @route GET /api/schedule/conflicts
 * @desc Check for scheduling conflicts in a date range
 * @access Private
 * @query startDate - Start date in ISO format (required)
 * @query endDate - End date in ISO format (required)
 * @query rbtId - RBT ID to filter by (optional)
 * @query clientId - Client ID to filter by (optional)
 */
router.get('/conflicts', (req, res) => {
  schedulingController.checkConflicts(req, res);
});

/**
 * @route POST /api/schedule/generate
 * @desc Generate optimized schedules for multiple clients
 * @access Private
 */
router.post('/generate', (req, res) => {
  schedulingController.generateSchedule(req, res);
});

export default router;