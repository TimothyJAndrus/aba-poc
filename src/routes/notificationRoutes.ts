import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const notificationController = new NotificationController();

// Apply authentication to all notification routes
router.use(authMiddleware.authenticate);

// Notification management routes
router.post('/send', notificationController.sendNotification.bind(notificationController));
router.get('/stats', authMiddleware.requireManager, notificationController.getNotificationStats.bind(notificationController));
router.get('/scheduled', authMiddleware.requireManager, notificationController.getScheduledNotifications.bind(notificationController));
router.post('/test', authMiddleware.requireAdmin, notificationController.testNotification.bind(notificationController));

// Individual notification routes
router.get('/:id', notificationController.getNotification.bind(notificationController));
router.delete('/:id', notificationController.cancelNotification.bind(notificationController));

// Recipient-specific routes
router.get('/recipient/:recipientId', notificationController.getNotificationsByRecipient.bind(notificationController));

// Template management routes (admin only)
router.get('/templates', authMiddleware.requireManager, notificationController.getTemplates.bind(notificationController));
router.get('/templates/:type/:channel', authMiddleware.requireManager, notificationController.getTemplate.bind(notificationController));
router.put('/templates/:type/:channel', authMiddleware.requireAdmin, notificationController.upsertTemplate.bind(notificationController));
router.delete('/templates/:type/:channel', authMiddleware.requireAdmin, notificationController.deleteTemplate.bind(notificationController));
router.patch('/templates/:type/:channel/status', authMiddleware.requireAdmin, notificationController.setTemplateStatus.bind(notificationController));

export default router;