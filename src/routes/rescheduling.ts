import { Router } from 'express';
import { ReschedulingController } from '../controllers/ReschedulingController';
import { SessionCancellationService } from '../services/SessionCancellationService';
import { RBTUnavailabilityService } from '../services/RBTUnavailabilityService';
import { ReschedulingOptimizationService } from '../services/ReschedulingOptimizationService';
import { SessionSchedulingService } from '../services/SessionSchedulingService';
import { ContinuityPreferenceService } from '../services/ContinuityPreferenceService';
import { SchedulingConstraintService } from '../services/SchedulingConstraintService';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { ScheduleEventRepository } from '../database/repositories/ScheduleEventRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Initialize repositories
const sessionRepository = new SessionRepository();
const scheduleEventRepository = new ScheduleEventRepository();
const teamRepository = new TeamRepository();
const rbtRepository = new RBTRepository();
const clientRepository = new ClientRepository();
const userRepository = new UserRepository();

// Initialize services
const constraintService = new SchedulingConstraintService();

const continuityService = new ContinuityPreferenceService();

const schedulingService = new SessionSchedulingService(
  constraintService,
  continuityService,
  sessionRepository,
  teamRepository,
  rbtRepository,
  clientRepository
);

const cancellationService = new SessionCancellationService(
  sessionRepository,
  scheduleEventRepository,
  teamRepository,
  rbtRepository,
  schedulingService,
  continuityService
);

const unavailabilityService = new RBTUnavailabilityService(
  sessionRepository,
  scheduleEventRepository,
  teamRepository,
  rbtRepository,
  schedulingService,
  continuityService,
  cancellationService
);

const optimizationService = new ReschedulingOptimizationService(
  sessionRepository,
  teamRepository,
  rbtRepository,
  continuityService,
  constraintService
);

// Initialize controller
const reschedulingController = new ReschedulingController(
  cancellationService,
  unavailabilityService,
  optimizationService,
  schedulingService
);

// Session cancellation routes
router.post('/cancel-session/:sessionId', authMiddleware.authenticate, reschedulingController.cancelSession);
router.post('/bulk-cancel', authMiddleware.authenticate, reschedulingController.bulkCancelSessions);

// RBT unavailability routes
router.post('/rbt-unavailable/:rbtId', authMiddleware.authenticate, reschedulingController.reportRBTUnavailability);

// Rescheduling optimization routes
router.post('/optimize/:sessionId', authMiddleware.authenticate, reschedulingController.findReschedulingOptions);
router.post('/execute/:sessionId', authMiddleware.authenticate, reschedulingController.executeRescheduling);
router.get('/impact/:sessionId', authMiddleware.authenticate, reschedulingController.analyzeReschedulingImpact);

// Statistics and reporting routes
router.get('/stats/cancellations', authMiddleware.authenticate, reschedulingController.getCancellationStats);
router.get('/stats/unavailability', authMiddleware.authenticate, reschedulingController.getUnavailabilityStats);

export default router;