import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController';
import { CalendarIntegrationService } from '../services/CalendarIntegrationService';
import { SessionRepository } from '../database/repositories/ScheduleEventRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Initialize repositories and services
const sessionRepository = new SessionRepository();
const userRepository = new UserRepository();
const clientRepository = new ClientRepository();
const rbtRepository = new RBTRepository();

// Calendar configuration from environment variables
const calendarConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
  }
};

const calendarService = new CalendarIntegrationService(calendarConfig);
const calendarController = new CalendarController(
  calendarService,
  sessionRepository,
  userRepository,
  clientRepository,
  rbtRepository
);

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/calendar/sessions/:sessionId/events
 * @desc Create calendar event for a session
 * @access Private (coordinators, admins)
 */
router.post('/sessions/:sessionId/events', calendarController.createSessionEvent);

/**
 * @route PUT /api/calendar/sessions/:sessionId/events
 * @desc Update calendar event for a session
 * @access Private (coordinators, admins)
 */
router.put('/sessions/:sessionId/events', calendarController.updateSessionEvent);

/**
 * @route DELETE /api/calendar/events
 * @desc Cancel calendar event
 * @access Private (coordinators, admins)
 */
router.delete('/events', calendarController.cancelSessionEvent);

/**
 * @route GET /api/calendar/sessions/:sessionId/ical
 * @desc Download iCal file for a session
 * @access Private (all authenticated users)
 */
router.get('/sessions/:sessionId/ical', calendarController.downloadICalFile);

/**
 * @route GET /api/calendar/sessions/:sessionId/status
 * @desc Get calendar integration status for a session
 * @access Private (all authenticated users)
 */
router.get('/sessions/:sessionId/status', calendarController.getCalendarStatus);

export default router;