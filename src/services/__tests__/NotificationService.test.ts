import { NotificationService } from '../NotificationService';
import { notificationTemplateService } from '../NotificationTemplateService';
import { NotificationType, NotificationChannel } from '../../types';

// Mock external dependencies
jest.mock('bull');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    quit: jest.fn()
  }))
}));
jest.mock('nodemailer');
jest.mock('twilio');
jest.mock('uuid', () => {
  let counter = 0;
  return {
    v4: () => `mock-uuid-${++counter}`
  };
});

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    // Reset environment variables for testing
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USERNAME = 'test@example.com';
    process.env.EMAIL_PASSWORD = 'testpass';
    process.env.EMAIL_FROM = 'noreply@test.com';
    process.env.TWILIO_ACCOUNT_SID = 'test_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_token';
    process.env.TWILIO_FROM_NUMBER = '+1234567890';

    // Create a fresh instance for each test
    notificationService = new NotificationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should successfully queue an email notification', async () => {
      const templateData = {
        recipientName: 'John Doe',
        clientName: 'Jane Smith',
        rbtName: 'Dr. Johnson',
        sessionDate: 'Monday, January 15, 2024',
        sessionTime: '10:00 AM',
        duration: '3',
        location: 'Clinic Room A'
      };

      const notificationId = await notificationService.sendNotification(
        'session_scheduled',
        'user-123',
        'john@example.com',
        undefined,
        'email',
        templateData
      );

      expect(notificationId).toBeDefined();
      expect(typeof notificationId).toBe('string');

      // Verify notification was stored
      const notification = notificationService.getNotification(notificationId);
      expect(notification).toBeDefined();
      expect(notification?.type).toBe('session_scheduled');
      expect(notification?.recipientId).toBe('user-123');
      expect(notification?.channel).toBe('email');
      expect(notification?.status).toBe('pending');
    });

    it('should successfully queue an SMS notification', async () => {
      const templateData = {
        clientName: 'Jane Smith',
        sessionDate: 'Monday, January 15, 2024',
        sessionTime: '10:00 AM',
        rbtName: 'Dr. Johnson',
        location: 'Clinic Room A'
      };

      const notificationId = await notificationService.sendNotification(
        'session_scheduled',
        'user-123',
        undefined,
        '+1234567890',
        'sms',
        templateData
      );

      expect(notificationId).toBeDefined();
      
      const notification = notificationService.getNotification(notificationId);
      expect(notification?.channel).toBe('sms');
      expect(notification?.recipientPhone).toBe('+1234567890');
    });

    it('should schedule notification for future delivery', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const templateData = { recipientName: 'Test User', clientName: 'Test Client' };

      const notificationId = await notificationService.sendNotification(
        'session_reminder',
        'user-123',
        'test@example.com',
        undefined,
        'email',
        templateData,
        futureDate
      );

      const notification = notificationService.getNotification(notificationId);
      expect(notification?.scheduledFor).toEqual(futureDate);
    });

    it('should throw error for missing template', async () => {
      const templateData = { test: 'data' };

      await expect(
        notificationService.sendNotification(
          'system_alert' as NotificationType,
          'user-123',
          'test@example.com',
          undefined,
          'push' as NotificationChannel, // No template for push notifications
          templateData
        )
      ).rejects.toThrow('No template found');
    });
  });

  describe('getNotification', () => {
    it('should return notification by ID', async () => {
      const templateData = { recipientName: 'Test User' };
      const notificationId = await notificationService.sendNotification(
        'session_scheduled',
        'user-123',
        'test@example.com',
        undefined,
        'email',
        templateData
      );

      const notification = notificationService.getNotification(notificationId);
      expect(notification).toBeDefined();
      expect(notification?.id).toBe(notificationId);
    });

    it('should return undefined for non-existent notification', () => {
      const notification = notificationService.getNotification('non-existent-id');
      expect(notification).toBeUndefined();
    });
  });

  describe('getNotificationsByRecipient', () => {
    it('should return all notifications for a recipient', async () => {
      const templateData = { 
        recipientName: 'Test User',
        clientName: 'Test Client',
        rbtName: 'Test RBT',
        sessionDate: 'Test Date',
        sessionTime: 'Test Time',
        duration: '3',
        location: 'Test Location'
      };
      const recipientId = 'user-123';

      // Send first notification
      const firstId = await notificationService.sendNotification(
        'session_scheduled',
        recipientId,
        'test@example.com',
        undefined,
        'email',
        templateData
      );

      // Send second notification with different template data
      const secondId = await notificationService.sendNotification(
        'session_cancelled',
        recipientId,
        'test@example.com',
        undefined,
        'email',
        { 
          ...templateData, 
          reason: 'Test cancellation', 
          hasAlternatives: false 
        }
      );

      // Verify both notifications were created
      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();

      const notifications = notificationService.getNotificationsByRecipient(recipientId);
      expect(notifications).toHaveLength(2);
      expect(notifications.every(n => n.recipientId === recipientId)).toBe(true);
    });

    it('should return empty array for recipient with no notifications', () => {
      const notifications = notificationService.getNotificationsByRecipient('no-notifications');
      expect(notifications).toHaveLength(0);
    });
  });

  describe('getNotificationStats', () => {
    it('should return correct statistics', async () => {
      const templateData = { 
        recipientName: 'Test User',
        clientName: 'Test Client',
        rbtName: 'Test RBT',
        sessionDate: 'Test Date',
        sessionTime: 'Test Time',
        duration: '3',
        location: 'Test Location'
      };

      // Send email notification
      await notificationService.sendNotification(
        'session_scheduled',
        'user-1',
        'test1@example.com',
        undefined,
        'email',
        templateData
      );

      // Send SMS notification
      await notificationService.sendNotification(
        'session_scheduled',
        'user-2',
        undefined,
        '+1234567890',
        'sms',
        templateData
      );

      const stats = notificationService.getNotificationStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byChannel.email).toBe(1);
      expect(stats.byChannel.sms).toBe(1);
      expect(stats.byType.session_scheduled).toBe(2);
      expect(stats.byStatus.pending).toBe(2);
    });
  });

  describe('cancelNotification', () => {
    it('should successfully cancel a pending notification', async () => {
      const templateData = { recipientName: 'Test User' };
      const notificationId = await notificationService.sendNotification(
        'session_scheduled',
        'user-123',
        'test@example.com',
        undefined,
        'email',
        templateData
      );

      const cancelled = await notificationService.cancelNotification(notificationId);
      expect(cancelled).toBe(true);

      const notification = notificationService.getNotification(notificationId);
      expect(notification?.status).toBe('cancelled');
    });

    it('should return false for non-existent notification', async () => {
      const cancelled = await notificationService.cancelNotification('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should remove old notifications', async () => {
      const templateData = { recipientName: 'Test User' };
      
      // Create a notification and manually set old creation date
      const notificationId = await notificationService.sendNotification(
        'session_scheduled',
        'user-123',
        'test@example.com',
        undefined,
        'email',
        templateData
      );

      const notification = notificationService.getNotification(notificationId);
      if (notification) {
        // Set creation date to 31 days ago
        notification.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      const cleanedCount = await notificationService.cleanupOldNotifications(30);
      expect(cleanedCount).toBe(1);

      // Verify notification was removed
      const removedNotification = notificationService.getNotification(notificationId);
      expect(removedNotification).toBeUndefined();
    });
  });
});