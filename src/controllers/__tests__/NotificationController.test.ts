import { Request, Response } from 'express';
import { NotificationController } from '../NotificationController';

// Mock the services
jest.mock('../../services/NotificationService', () => ({
  notificationService: {
    sendNotification: jest.fn(),
    getNotification: jest.fn(),
    getNotificationsByRecipient: jest.fn(),
    getNotificationStats: jest.fn(),
    cancelNotification: jest.fn()
  }
}));

jest.mock('../../services/NotificationTemplateService', () => ({
  notificationTemplateService: {
    getAllTemplates: jest.fn(),
    getTemplate: jest.fn(),
    getTemplatesByType: jest.fn(),
    getTemplatesByChannel: jest.fn(),
    upsertTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    setTemplateStatus: jest.fn()
  }
}));

jest.mock('../../services/NotificationSchedulerService', () => ({
  notificationSchedulerService: {
    getScheduledNotifications: jest.fn(),
    getAllScheduledNotifications: jest.fn()
  }
}));

import { notificationService } from '../../services/NotificationService';
import { notificationTemplateService } from '../../services/NotificationTemplateService';
import { notificationSchedulerService } from '../../services/NotificationSchedulerService';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    controller = new NotificationController();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockResponse = {
      json: mockJson,
      status: mockStatus
    };

    mockRequest = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin'
      },
      body: {},
      params: {},
      query: {}
    };

    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should successfully send a notification', async () => {
      const mockNotificationId = 'notification-123';
      (notificationService.sendNotification as jest.Mock).mockResolvedValue(mockNotificationId);

      mockRequest.body = {
        type: 'session_scheduled',
        recipientId: 'recipient-123',
        recipientEmail: 'recipient@example.com',
        channel: 'email',
        templateData: {
          recipientName: 'John Doe',
          clientName: 'Jane Smith'
        }
      };

      await controller.sendNotification(mockRequest as Request, mockResponse as Response);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        'session_scheduled',
        'recipient-123',
        'recipient@example.com',
        undefined,
        'email',
        { recipientName: 'John Doe', clientName: 'Jane Smith' },
        undefined
      );

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        notificationId: mockNotificationId,
        message: 'Notification queued successfully'
      });
    });

    it('should return 400 for missing required fields', async () => {
      mockRequest.body = {
        type: 'session_scheduled'
        // Missing other required fields
      };

      await controller.sendNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required fields: type, recipientId, channel, templateData'
      });
    });

    it('should return 400 for invalid notification type', async () => {
      mockRequest.body = {
        type: 'invalid_type',
        recipientId: 'recipient-123',
        channel: 'email',
        templateData: {}
      };

      await controller.sendNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid notification type')
        })
      );
    });

    it('should return 400 for email channel without recipientEmail', async () => {
      mockRequest.body = {
        type: 'session_scheduled',
        recipientId: 'recipient-123',
        channel: 'email',
        templateData: {}
        // Missing recipientEmail
      };

      await controller.sendNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'recipientEmail is required for email notifications'
      });
    });

    it('should handle service errors', async () => {
      (notificationService.sendNotification as jest.Mock).mockRejectedValue(new Error('Service error'));

      mockRequest.body = {
        type: 'session_scheduled',
        recipientId: 'recipient-123',
        recipientEmail: 'recipient@example.com',
        channel: 'email',
        templateData: {}
      };

      await controller.sendNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to send notification',
        error: 'Service error'
      });
    });
  });

  describe('getNotification', () => {
    it('should return notification by ID', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'session_scheduled',
        recipientId: 'recipient-123',
        status: 'delivered'
      };

      (notificationService.getNotification as jest.Mock).mockReturnValue(mockNotification);
      mockRequest.params = { id: 'notification-123' };

      await controller.getNotification(mockRequest as Request, mockResponse as Response);

      expect(notificationService.getNotification).toHaveBeenCalledWith('notification-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        notification: mockNotification
      });
    });

    it('should return 404 for non-existent notification', async () => {
      (notificationService.getNotification as jest.Mock).mockReturnValue(undefined);
      mockRequest.params = { id: 'non-existent' };

      await controller.getNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Notification not found'
      });
    });
  });

  describe('getNotificationsByRecipient', () => {
    it('should return filtered and paginated notifications', async () => {
      const mockNotifications = [
        { id: '1', type: 'session_scheduled', status: 'delivered', createdAt: new Date('2024-01-15') },
        { id: '2', type: 'session_reminder', status: 'pending', createdAt: new Date('2024-01-14') }
      ];

      (notificationService.getNotificationsByRecipient as jest.Mock).mockReturnValue(mockNotifications);
      
      mockRequest.params = { recipientId: 'recipient-123' };
      mockRequest.query = { 
        status: 'delivered', 
        limit: '10', 
        offset: '0' 
      };

      await controller.getNotificationsByRecipient(mockRequest as Request, mockResponse as Response);

      expect(notificationService.getNotificationsByRecipient).toHaveBeenCalledWith('recipient-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        notifications: [mockNotifications[0]], // Only delivered notification
        total: 1,
        limit: 10,
        offset: 0
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: { pending: 20, delivered: 70, failed: 10 },
        byChannel: { email: 80, sms: 20 },
        byType: { session_scheduled: 50, session_reminder: 30, session_cancelled: 20 }
      };

      (notificationService.getNotificationStats as jest.Mock).mockReturnValue(mockStats);

      await controller.getNotificationStats(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        stats: mockStats
      });
    });
  });

  describe('cancelNotification', () => {
    it('should successfully cancel a notification', async () => {
      (notificationService.cancelNotification as jest.Mock).mockResolvedValue(true);
      mockRequest.params = { id: 'notification-123' };

      await controller.cancelNotification(mockRequest as Request, mockResponse as Response);

      expect(notificationService.cancelNotification).toHaveBeenCalledWith('notification-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Notification cancelled successfully'
      });
    });

    it('should return 404 for non-existent notification', async () => {
      (notificationService.cancelNotification as jest.Mock).mockResolvedValue(false);
      mockRequest.params = { id: 'non-existent' };

      await controller.cancelNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Notification not found or cannot be cancelled'
      });
    });
  });

  describe('getTemplates', () => {
    it('should return all templates', async () => {
      const mockTemplates = [
        { id: '1', type: 'session_scheduled', channel: 'email' },
        { id: '2', type: 'session_reminder', channel: 'sms' }
      ];

      (notificationTemplateService.getAllTemplates as jest.Mock).mockReturnValue(mockTemplates);

      await controller.getTemplates(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        templates: mockTemplates
      });
    });

    it('should filter templates by type', async () => {
      const mockTemplates = [
        { id: '1', type: 'session_scheduled', channel: 'email' }
      ];

      (notificationTemplateService.getTemplatesByType as jest.Mock).mockReturnValue(mockTemplates);
      mockRequest.query = { type: 'session_scheduled' };

      await controller.getTemplates(mockRequest as Request, mockResponse as Response);

      expect(notificationTemplateService.getTemplatesByType).toHaveBeenCalledWith('session_scheduled');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        templates: mockTemplates
      });
    });
  });

  describe('upsertTemplate', () => {
    it('should create/update template successfully', async () => {
      const mockTemplate = {
        id: 'template-123',
        type: 'session_scheduled',
        channel: 'email',
        subject: 'Test Subject',
        content: 'Test Content',
        variables: ['test'],
        isActive: true
      };

      (notificationTemplateService.upsertTemplate as jest.Mock).mockReturnValue(mockTemplate);

      mockRequest.params = { type: 'session_scheduled', channel: 'email' };
      mockRequest.body = {
        subject: 'Test Subject',
        content: 'Test Content',
        variables: ['test']
      };

      await controller.upsertTemplate(mockRequest as Request, mockResponse as Response);

      expect(notificationTemplateService.upsertTemplate).toHaveBeenCalledWith({
        type: 'session_scheduled',
        channel: 'email',
        subject: 'Test Subject',
        content: 'Test Content',
        variables: ['test'],
        isActive: true
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        template: mockTemplate,
        message: 'Template saved successfully'
      });
    });

    it('should return 400 for missing required fields', async () => {
      mockRequest.params = { type: 'session_scheduled', channel: 'email' };
      mockRequest.body = {
        subject: 'Test Subject'
        // Missing content and variables
      };

      await controller.upsertTemplate(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required fields: subject, content, variables'
      });
    });
  });

  describe('testNotification', () => {
    it('should send test notification successfully', async () => {
      const mockNotificationId = 'test-notification-123';
      (notificationService.sendNotification as jest.Mock).mockResolvedValue(mockNotificationId);

      mockRequest.body = {
        recipientEmail: 'test@example.com',
        channel: 'email'
      };

      await controller.testNotification(mockRequest as Request, mockResponse as Response);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        'system_alert',
        'test-user',
        'test@example.com',
        undefined,
        'email',
        expect.objectContaining({
          recipientName: 'Test User',
          alertType: 'System Test'
        })
      );

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        notificationId: mockNotificationId,
        message: 'Test notification sent successfully'
      });
    });

    it('should return 400 when no recipient provided', async () => {
      mockRequest.body = {
        channel: 'email'
        // Missing recipientEmail and recipientPhone
      };

      await controller.testNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Either recipientEmail or recipientPhone is required'
      });
    });
  });
});