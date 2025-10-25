import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { notificationService } from '../services/NotificationService';
import { notificationTemplateService } from '../services/NotificationTemplateService';
import { notificationSchedulerService } from '../services/NotificationSchedulerService';
import {
  NotificationType,
  NotificationChannel,
  NotificationPreference
} from '../types';

export class NotificationController {
  /**
   * Send a notification
   * POST /api/notifications/send
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        recipientId,
        recipientEmail,
        recipientPhone,
        channel,
        templateData,
        scheduledFor
      } = req.body;

      // Validate required fields
      if (!type || !recipientId || !channel || !templateData) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: type, recipientId, channel, templateData'
        });
        return;
      }

      // Validate notification type and channel
      const validTypes: NotificationType[] = [
        'session_scheduled', 'session_cancelled', 'session_rescheduled',
        'session_reminder', 'rbt_assignment_changed', 'team_updated', 'system_alert'
      ];
      const validChannels: NotificationChannel[] = ['email', 'sms', 'push'];

      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
        });
        return;
      }

      if (!validChannels.includes(channel)) {
        res.status(400).json({
          success: false,
          message: `Invalid channel. Must be one of: ${validChannels.join(', ')}`
        });
        return;
      }

      // Validate channel-specific requirements
      if (channel === 'email' && !recipientEmail) {
        res.status(400).json({
          success: false,
          message: 'recipientEmail is required for email notifications'
        });
        return;
      }

      if (channel === 'sms' && !recipientPhone) {
        res.status(400).json({
          success: false,
          message: 'recipientPhone is required for SMS notifications'
        });
        return;
      }

      const scheduledForDate = scheduledFor ? new Date(scheduledFor) : undefined;

      const notificationId = await notificationService.sendNotification(
        type,
        recipientId,
        recipientEmail,
        recipientPhone,
        channel,
        templateData,
        scheduledForDate
      );

      logger.info(`Notification sent via API: ${notificationId}`, {
        type,
        recipientId,
        channel,
        userId: req.user?.userId
      });

      res.status(201).json({
        success: true,
        notificationId,
        message: 'Notification queued successfully'
      });
    } catch (error) {
      logger.error('Failed to send notification via API:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get notification by ID
   * GET /api/notifications/:id
   */
  async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
        return;
      }

      const notification = notificationService.getNotification(id);
      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        notification
      });
    } catch (error) {
      logger.error('Failed to get notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get notifications for a recipient
   * GET /api/notifications/recipient/:recipientId
   */
  async getNotificationsByRecipient(req: Request, res: Response): Promise<void> {
    try {
      const { recipientId } = req.params;
      const { status, type, channel, limit = '50', offset = '0' } = req.query;

      if (!recipientId) {
        res.status(400).json({
          success: false,
          message: 'Recipient ID is required'
        });
        return;
      }

      let notifications = notificationService.getNotificationsByRecipient(recipientId);

      // Apply filters
      if (status && typeof status === 'string') {
        notifications = notifications.filter(n => n.status === status);
      }
      if (type && typeof type === 'string') {
        notifications = notifications.filter(n => n.type === type);
      }
      if (channel && typeof channel === 'string') {
        notifications = notifications.filter(n => n.channel === channel);
      }

      // Sort by creation date (newest first)
      notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const paginatedNotifications = notifications.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        notifications: paginatedNotifications,
        total: notifications.length,
        limit: limitNum,
        offset: offsetNum
      });
    } catch (error) {
      logger.error('Failed to get notifications by recipient:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = notificationService.getNotificationStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cancel a notification
   * DELETE /api/notifications/:id
   */
  async cancelNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
        return;
      }

      const cancelled = await notificationService.cancelNotification(id);
      if (!cancelled) {
        res.status(404).json({
          success: false,
          message: 'Notification not found or cannot be cancelled'
        });
        return;
      }

      logger.info(`Notification cancelled via API: ${id}`, {
        userId: req.user?.userId
      });

      res.json({
        success: true,
        message: 'Notification cancelled successfully'
      });
    } catch (error) {
      logger.error('Failed to cancel notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get notification templates
   * GET /api/notifications/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { type, channel } = req.query;

      let templates = notificationTemplateService.getAllTemplates();

      // Apply filters
      if (type && typeof type === 'string') {
        templates = notificationTemplateService.getTemplatesByType(type as NotificationType);
      }
      if (channel && typeof channel === 'string') {
        templates = notificationTemplateService.getTemplatesByChannel(channel as NotificationChannel);
      }

      res.json({
        success: true,
        templates
      });
    } catch (error) {
      logger.error('Failed to get notification templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification templates',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a specific template
   * GET /api/notifications/templates/:type/:channel
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { type, channel } = req.params;

      const template = notificationTemplateService.getTemplate(
        type as NotificationType,
        channel as NotificationChannel
      );

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        template
      });
    } catch (error) {
      logger.error('Failed to get notification template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create or update a template
   * PUT /api/notifications/templates/:type/:channel
   */
  async upsertTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { type, channel } = req.params;
      const { subject, content, variables, isActive = true } = req.body;

      // Validate required fields
      if (!subject || !content || !variables) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: subject, content, variables'
        });
        return;
      }

      if (!Array.isArray(variables)) {
        res.status(400).json({
          success: false,
          message: 'variables must be an array of strings'
        });
        return;
      }

      const template = notificationTemplateService.upsertTemplate({
        type: type as NotificationType,
        channel: channel as NotificationChannel,
        subject,
        content,
        variables,
        isActive
      });

      logger.info(`Template upserted via API: ${type}_${channel}`, {
        userId: req.user?.userId
      });

      res.json({
        success: true,
        template,
        message: 'Template saved successfully'
      });
    } catch (error) {
      logger.error('Failed to upsert notification template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save notification template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a template
   * DELETE /api/notifications/templates/:type/:channel
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { type, channel } = req.params;

      const deleted = notificationTemplateService.deleteTemplate(
        type as NotificationType,
        channel as NotificationChannel
      );

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }

      logger.info(`Template deleted via API: ${type}_${channel}`, {
        userId: req.user?.userId
      });

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete notification template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Activate or deactivate a template
   * PATCH /api/notifications/templates/:type/:channel/status
   */
  async setTemplateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { type, channel } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value'
        });
        return;
      }

      const updated = notificationTemplateService.setTemplateStatus(
        type as NotificationType,
        channel as NotificationChannel,
        isActive
      );

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }

      logger.info(`Template status updated via API: ${type}_${channel} -> ${isActive}`, {
        userId: req.user?.userId
      });

      res.json({
        success: true,
        message: `Template ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      logger.error('Failed to update template status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update template status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get scheduled notifications
   * GET /api/notifications/scheduled
   */
  async getScheduledNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.query;

      let scheduledNotifications;
      if (sessionId && typeof sessionId === 'string') {
        scheduledNotifications = notificationSchedulerService.getScheduledNotifications(sessionId);
      } else {
        scheduledNotifications = notificationSchedulerService.getAllScheduledNotifications();
      }

      res.json({
        success: true,
        scheduledNotifications
      });
    } catch (error) {
      logger.error('Failed to get scheduled notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve scheduled notifications',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test notification delivery
   * POST /api/notifications/test
   */
  async testNotification(req: Request, res: Response): Promise<void> {
    try {
      const {
        type = 'system_alert',
        recipientEmail,
        recipientPhone,
        channel = 'email'
      } = req.body;

      if (!recipientEmail && !recipientPhone) {
        res.status(400).json({
          success: false,
          message: 'Either recipientEmail or recipientPhone is required'
        });
        return;
      }

      const templateData = {
        recipientName: 'Test User',
        alertType: 'System Test',
        message: 'This is a test notification from the ABA Scheduling System',
        timestamp: new Date().toISOString(),
        actionRequired: 'No action required - this is a test message.'
      };

      const notificationId = await notificationService.sendNotification(
        type,
        'test-user',
        recipientEmail,
        recipientPhone,
        channel,
        templateData
      );

      logger.info(`Test notification sent: ${notificationId}`, {
        userId: req.user?.userId,
        channel,
        recipient: recipientEmail || recipientPhone
      });

      res.json({
        success: true,
        notificationId,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}