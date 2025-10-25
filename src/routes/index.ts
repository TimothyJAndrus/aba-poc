import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import teamRoutes from './teams';
import schedulingRoutes from './scheduling';
import reschedulingRoutes from './rescheduling';
import notificationRoutes from './notificationRoutes';
import websocketRoutes from './websocket';
import cacheRoutes from './cache';
import calendarRoutes from './calendar';
import monitoringRoutes from './monitoring';

const router = Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount route modules
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/teams`, teamRoutes);
router.use(`${API_VERSION}/schedule`, schedulingRoutes);
router.use(`${API_VERSION}/reschedule`, reschedulingRoutes);
router.use(`${API_VERSION}/notifications`, notificationRoutes);
router.use(`${API_VERSION}/websocket`, websocketRoutes);
router.use(`${API_VERSION}/cache`, cacheRoutes);
router.use(`${API_VERSION}/calendar`, calendarRoutes);
router.use(`${API_VERSION}/monitoring`, monitoringRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ABA Scheduling System API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation endpoint
router.get(`${API_VERSION}`, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ABA Scheduling System API v1',
    endpoints: {
      auth: {
        login: 'POST /api/v1/auth/login',
        register: 'POST /api/v1/auth/register',
        refresh: 'POST /api/v1/auth/refresh',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        verify: 'POST /api/v1/auth/verify',
        logout: 'POST /api/v1/auth/logout'
      },
      users: {
        getCurrentUser: 'GET /api/v1/users/me',
        updateCurrentUser: 'PUT /api/v1/users/me',
        getUsers: 'GET /api/v1/users',
        createUser: 'POST /api/v1/users',
        getUserById: 'GET /api/v1/users/:id',
        updateUser: 'PUT /api/v1/users/:id',
        deactivateUser: 'DELETE /api/v1/users/:id',
        reactivateUser: 'POST /api/v1/users/:id/reactivate',
        getUsersByRole: 'GET /api/v1/users/role/:role'
      },
      teams: {
        createTeam: 'POST /api/v1/teams',
        getTeam: 'GET /api/v1/teams/:teamId',
        updateTeam: 'PUT /api/v1/teams/:teamId',
        addRBTToTeam: 'POST /api/v1/teams/:teamId/rbts',
        removeRBTFromTeam: 'DELETE /api/v1/teams/:teamId/rbts/:rbtId',
        changePrimaryRBT: 'PUT /api/v1/teams/:teamId/primary-rbt',
        endTeam: 'PUT /api/v1/teams/:teamId/end',
        getClientTeamHistory: 'GET /api/v1/teams/client/:clientId/history',
        getRBTTeams: 'GET /api/v1/teams/rbt/:rbtId',
        getTeamsByPrimaryRBT: 'GET /api/v1/teams/primary-rbt/:rbtId',
        getAvailableRBTs: 'GET /api/v1/teams/available-rbts',
        getTeamsNeedingRBTs: 'GET /api/v1/teams/needing-rbts'
      },
      scheduling: {
        scheduleSession: 'POST /api/v1/schedule/session',
        bulkSchedule: 'POST /api/v1/schedule/bulk',
        findAlternatives: 'GET /api/v1/schedule/alternatives',
        rescheduleSession: 'PUT /api/v1/schedule/session/:sessionId/reschedule',
        checkConflicts: 'GET /api/v1/schedule/conflicts',
        generateSchedule: 'POST /api/v1/schedule/generate'
      },
      rescheduling: {
        cancelSession: 'POST /api/v1/reschedule/cancel-session/:sessionId',
        bulkCancel: 'POST /api/v1/reschedule/bulk-cancel',
        reportRBTUnavailability: 'POST /api/v1/reschedule/rbt-unavailable/:rbtId',
        findReschedulingOptions: 'POST /api/v1/reschedule/optimize/:sessionId',
        executeRescheduling: 'POST /api/v1/reschedule/execute/:sessionId',
        analyzeImpact: 'GET /api/v1/reschedule/impact/:sessionId',
        getCancellationStats: 'GET /api/v1/reschedule/stats/cancellations',
        getUnavailabilityStats: 'GET /api/v1/reschedule/stats/unavailability'
      },
      notifications: {
        sendNotification: 'POST /api/v1/notifications/send',
        getNotification: 'GET /api/v1/notifications/:id',
        getNotificationsByRecipient: 'GET /api/v1/notifications/recipient/:recipientId',
        getNotificationStats: 'GET /api/v1/notifications/stats',
        cancelNotification: 'DELETE /api/v1/notifications/:id',
        getTemplates: 'GET /api/v1/notifications/templates',
        getTemplate: 'GET /api/v1/notifications/templates/:type/:channel',
        upsertTemplate: 'PUT /api/v1/notifications/templates/:type/:channel',
        deleteTemplate: 'DELETE /api/v1/notifications/templates/:type/:channel',
        setTemplateStatus: 'PATCH /api/v1/notifications/templates/:type/:channel/status',
        getScheduledNotifications: 'GET /api/v1/notifications/scheduled',
        testNotification: 'POST /api/v1/notifications/test'
      },
      calendar: {
        createSessionEvent: 'POST /api/v1/calendar/sessions/:sessionId/events',
        updateSessionEvent: 'PUT /api/v1/calendar/sessions/:sessionId/events',
        cancelSessionEvent: 'DELETE /api/v1/calendar/events',
        downloadICalFile: 'GET /api/v1/calendar/sessions/:sessionId/ical',
        getCalendarStatus: 'GET /api/v1/calendar/sessions/:sessionId/status'
      },
      monitoring: {
        getHealthStatus: 'GET /api/v1/monitoring/health',
        getSystemMetrics: 'GET /api/v1/monitoring/metrics/system',
        getApplicationMetrics: 'GET /api/v1/monitoring/metrics/application',
        getActiveAlerts: 'GET /api/v1/monitoring/alerts/active',
        getAllAlerts: 'GET /api/v1/monitoring/alerts/all',
        addAlertThreshold: 'POST /api/v1/monitoring/alerts/thresholds',
        removeAlertThreshold: 'DELETE /api/v1/monitoring/alerts/thresholds/:metric',
        getDashboardData: 'GET /api/v1/monitoring/dashboard'
      }
    }
  });
});

export default router;