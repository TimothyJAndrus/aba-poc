import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { notificationService } from './NotificationService';
import { notificationTemplateService } from './NotificationTemplateService';
import {
  NotificationType,
  NotificationChannel
} from '../types';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { RBT } from '../models/RBT';
import { Client } from '../models/Client';

export interface ScheduledNotification {
  id: string;
  sessionId: string;
  notificationType: NotificationType;
  recipientId: string;
  channel: NotificationChannel;
  scheduledFor: Date;
  templateData: Record<string, any>;
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationScheduleConfig {
  // Session reminders
  sessionReminder24h: boolean;
  sessionReminder2h: boolean;
  sessionReminder30min: boolean;
  
  // Cancellation notifications
  immediateCancellation: boolean;
  
  // Rescheduling notifications
  immediateReschedule: boolean;
  
  // RBT assignment changes
  immediateAssignmentChange: boolean;
  assignmentChangeAdvanceNotice: number; // hours before effective date
  
  // Team updates
  immediateTeamUpdate: boolean;
}

export class NotificationSchedulerService {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private defaultConfig: NotificationScheduleConfig = {
    sessionReminder24h: true,
    sessionReminder2h: true,
    sessionReminder30min: false, // SMS only for immediate reminders
    immediateCancellation: true,
    immediateReschedule: true,
    immediateAssignmentChange: true,
    assignmentChangeAdvanceNotice: 24, // 24 hours advance notice
    immediateTeamUpdate: true,
  };

  /**
   * Schedule notifications for a new session
   */
  async scheduleSessionNotifications(
    session: Session,
    client: Client,
    rbt: RBT,
    config: Partial<NotificationScheduleConfig> = {}
  ): Promise<string[]> {
    const scheduleConfig = { ...this.defaultConfig, ...config };
    const scheduledIds: string[] = [];

    try {
      // Schedule session confirmation (immediate)
      const confirmationId = await this.scheduleSessionConfirmation(session, client, rbt);
      scheduledIds.push(confirmationId);

      // Schedule 24-hour reminder
      if (scheduleConfig.sessionReminder24h) {
        const reminder24hId = await this.scheduleSessionReminder(
          session, 
          client, 
          rbt, 
          24, 
          'email'
        );
        scheduledIds.push(reminder24hId);
      }

      // Schedule 2-hour reminder
      if (scheduleConfig.sessionReminder2h) {
        const reminder2hId = await this.scheduleSessionReminder(
          session, 
          client, 
          rbt, 
          2, 
          'sms'
        );
        scheduledIds.push(reminder2hId);
      }

      // Schedule 30-minute reminder (SMS only)
      if (scheduleConfig.sessionReminder30min) {
        const reminder30minId = await this.scheduleSessionReminder(
          session, 
          client, 
          rbt, 
          0.5, 
          'sms'
        );
        scheduledIds.push(reminder30minId);
      }

      logger.info(`Scheduled ${scheduledIds.length} notifications for session ${session.id}`);
      return scheduledIds;
    } catch (error) {
      logger.error(`Failed to schedule session notifications for ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Schedule session confirmation notification (immediate)
   */
  private async scheduleSessionConfirmation(
    session: Session,
    client: Client,
    rbt: RBT
  ): Promise<string> {
    const templateData = {
      recipientName: `${client.firstName} ${client.lastName}`,
      clientName: `${client.firstName} ${client.lastName}`,
      rbtName: `${rbt.firstName} ${rbt.lastName}`,
      sessionDate: this.formatDate(session.startTime),
      sessionTime: this.formatTime(session.startTime),
      duration: this.calculateDuration(session.startTime, session.endTime),
      location: session.location || 'TBD',
    };

    // Send to client's guardian
    const notificationId = await notificationService.sendNotification(
      'session_scheduled',
      client.id,
      client.email,
      client.phone,
      'email',
      templateData
    );

    // Also send to RBT
    await notificationService.sendNotification(
      'session_scheduled',
      rbt.id,
      rbt.email,
      rbt.phone,
      'email',
      {
        ...templateData,
        recipientName: `${rbt.firstName} ${rbt.lastName}`,
      }
    );

    return notificationId;
  }

  /**
   * Schedule session reminder notification
   */
  private async scheduleSessionReminder(
    session: Session,
    client: Client,
    rbt: RBT,
    hoursBeforeSession: number,
    channel: NotificationChannel
  ): Promise<string> {
    const reminderTime = new Date(session.startTime.getTime() - (hoursBeforeSession * 60 * 60 * 1000));
    
    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) {
      logger.warn(`Reminder time ${reminderTime} is in the past for session ${session.id}`);
      return '';
    }

    const templateData = {
      recipientName: `${client.firstName} ${client.lastName}`,
      clientName: `${client.firstName} ${client.lastName}`,
      rbtName: `${rbt.firstName} ${rbt.lastName}`,
      sessionDate: this.formatDate(session.startTime),
      sessionTime: this.formatTime(session.startTime),
      location: session.location || 'TBD',
      reminderTime: hoursBeforeSession >= 1 ? 'tomorrow' : 'in 2 hours',
    };

    // Send reminder to client's guardian
    const notificationId = await notificationService.sendNotification(
      'session_reminder',
      client.id,
      client.email,
      client.phone,
      channel,
      templateData,
      reminderTime
    );

    // Track scheduled notification
    const scheduledNotification: ScheduledNotification = {
      id: uuidv4(),
      sessionId: session.id,
      notificationType: 'session_reminder',
      recipientId: client.id,
      channel,
      scheduledFor: reminderTime,
      templateData,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.scheduledNotifications.set(scheduledNotification.id, scheduledNotification);

    logger.info(`Scheduled ${hoursBeforeSession}h reminder for session ${session.id} at ${reminderTime}`);
    return notificationId;
  }

  /**
   * Schedule cancellation notifications
   */
  async scheduleCancellationNotifications(
    session: Session,
    client: Client,
    rbt: RBT,
    reason: string,
    hasAlternatives: boolean = false
  ): Promise<string[]> {
    const scheduledIds: string[] = [];

    const templateData = {
      recipientName: `${client.firstName} ${client.lastName}`,
      clientName: `${client.firstName} ${client.lastName}`,
      rbtName: `${rbt.firstName} ${rbt.lastName}`,
      sessionDate: this.formatDate(session.startTime),
      sessionTime: this.formatTime(session.startTime),
      reason,
      hasAlternatives,
    };

    try {
      // Notify client's guardian
      const clientNotificationId = await notificationService.sendNotification(
        'session_cancelled',
        client.id,
        client.email,
        client.phone,
        'email',
        templateData
      );
      scheduledIds.push(clientNotificationId);

      // Also send SMS for immediate awareness
      const clientSmsId = await notificationService.sendNotification(
        'session_cancelled',
        client.id,
        client.email,
        client.phone,
        'sms',
        templateData
      );
      scheduledIds.push(clientSmsId);

      // Notify RBT
      const rbtNotificationId = await notificationService.sendNotification(
        'session_cancelled',
        rbt.id,
        rbt.email,
        rbt.phone,
        'email',
        {
          ...templateData,
          recipientName: `${rbt.firstName} ${rbt.lastName}`,
        }
      );
      scheduledIds.push(rbtNotificationId);

      // Cancel any existing reminders for this session
      await this.cancelSessionReminders(session.id);

      logger.info(`Scheduled ${scheduledIds.length} cancellation notifications for session ${session.id}`);
      return scheduledIds;
    } catch (error) {
      logger.error(`Failed to schedule cancellation notifications for ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Schedule rescheduling notifications
   */
  async scheduleReschedulingNotifications(
    originalSession: Session,
    newSession: Session,
    client: Client,
    originalRbt: RBT,
    newRbt: RBT,
    reason: string
  ): Promise<string[]> {
    const scheduledIds: string[] = [];

    const templateData = {
      recipientName: `${client.firstName} ${client.lastName}`,
      clientName: `${client.firstName} ${client.lastName}`,
      originalDate: this.formatDate(originalSession.startTime),
      originalTime: this.formatTime(originalSession.startTime),
      originalRbt: `${originalRbt.firstName} ${originalRbt.lastName}`,
      newDate: this.formatDate(newSession.startTime),
      newTime: this.formatTime(newSession.startTime),
      newRbt: `${newRbt.firstName} ${newRbt.lastName}`,
      location: newSession.location || 'TBD',
      reason,
    };

    try {
      // Notify client's guardian
      const clientNotificationId = await notificationService.sendNotification(
        'session_rescheduled',
        client.id,
        client.email,
        client.phone,
        'email',
        templateData
      );
      scheduledIds.push(clientNotificationId);

      // Send SMS for immediate awareness
      const clientSmsId = await notificationService.sendNotification(
        'session_rescheduled',
        client.id,
        client.email,
        client.phone,
        'sms',
        templateData
      );
      scheduledIds.push(clientSmsId);

      // Notify original RBT if different from new RBT
      if (originalRbt.id !== newRbt.id) {
        const originalRbtNotificationId = await notificationService.sendNotification(
          'session_rescheduled',
          originalRbt.id,
          originalRbt.email,
          originalRbt.phone,
          'email',
          {
            ...templateData,
            recipientName: `${originalRbt.firstName} ${originalRbt.lastName}`,
          }
        );
        scheduledIds.push(originalRbtNotificationId);
      }

      // Notify new RBT
      const newRbtNotificationId = await notificationService.sendNotification(
        'session_rescheduled',
        newRbt.id,
        newRbt.email,
        newRbt.phone,
        'email',
        {
          ...templateData,
          recipientName: `${newRbt.firstName} ${newRbt.lastName}`,
        }
      );
      scheduledIds.push(newRbtNotificationId);

      // Cancel old session reminders and schedule new ones
      await this.cancelSessionReminders(originalSession.id);
      await this.scheduleSessionNotifications(newSession, client, newRbt);

      logger.info(`Scheduled ${scheduledIds.length} rescheduling notifications`);
      return scheduledIds;
    } catch (error) {
      logger.error('Failed to schedule rescheduling notifications:', error);
      throw error;
    }
  }

  /**
   * Schedule RBT assignment change notifications
   */
  async scheduleRbtAssignmentNotifications(
    client: Client,
    previousRbt: RBT | null,
    newRbt: RBT,
    effectiveDate: Date,
    reason: string,
    config: Partial<NotificationScheduleConfig> = {}
  ): Promise<string[]> {
    const scheduleConfig = { ...this.defaultConfig, ...config };
    const scheduledIds: string[] = [];

    const templateData = {
      recipientName: `${client.firstName} ${client.lastName}`,
      clientName: `${client.firstName} ${client.lastName}`,
      previousRbt: previousRbt ? `${previousRbt.firstName} ${previousRbt.lastName}` : null,
      newRbt: `${newRbt.firstName} ${newRbt.lastName}`,
      effectiveDate: this.formatDate(effectiveDate),
      reason,
    };

    try {
      // Immediate notification
      if (scheduleConfig.immediateAssignmentChange) {
        const immediateNotificationId = await notificationService.sendNotification(
          'rbt_assignment_changed',
          client.id,
          client.email,
          client.phone,
          'email',
          templateData
        );
        scheduledIds.push(immediateNotificationId);
      }

      // Advance notice notification
      if (scheduleConfig.assignmentChangeAdvanceNotice > 0) {
        const advanceNoticeTime = new Date(
          effectiveDate.getTime() - (scheduleConfig.assignmentChangeAdvanceNotice * 60 * 60 * 1000)
        );

        if (advanceNoticeTime > new Date()) {
          const advanceNotificationId = await notificationService.sendNotification(
            'rbt_assignment_changed',
            client.id,
            client.email,
            client.phone,
            'sms',
            templateData,
            advanceNoticeTime
          );
          scheduledIds.push(advanceNotificationId);
        }
      }

      logger.info(`Scheduled ${scheduledIds.length} RBT assignment notifications for client ${client.id}`);
      return scheduledIds;
    } catch (error) {
      logger.error('Failed to schedule RBT assignment notifications:', error);
      throw error;
    }
  }

  /**
   * Cancel session reminders
   */
  async cancelSessionReminders(sessionId: string): Promise<number> {
    let cancelledCount = 0;
    
    for (const [id, notification] of this.scheduledNotifications.entries()) {
      if (notification.sessionId === sessionId && 
          notification.notificationType === 'session_reminder' &&
          notification.status === 'scheduled') {
        
        // Cancel the notification
        await notificationService.cancelNotification(id);
        notification.status = 'cancelled';
        notification.updatedAt = new Date();
        cancelledCount++;
      }
    }

    logger.info(`Cancelled ${cancelledCount} session reminders for session ${sessionId}`);
    return cancelledCount;
  }

  /**
   * Get scheduled notifications for a session
   */
  getScheduledNotifications(sessionId: string): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
      .filter(notification => notification.sessionId === sessionId);
  }

  /**
   * Get all scheduled notifications
   */
  getAllScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  /**
   * Clean up old scheduled notifications
   */
  async cleanupOldScheduledNotifications(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let cleanedCount = 0;
    for (const [id, notification] of this.scheduledNotifications.entries()) {
      if (notification.createdAt < cutoffDate) {
        this.scheduledNotifications.delete(id);
        cleanedCount++;
      }
    }
    
    logger.info(`Cleaned up ${cleanedCount} old scheduled notifications`);
    return cleanedCount;
  }

  /**
   * Utility methods
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  private calculateDuration(startTime: Date, endTime: Date): number {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
  }
}

// Export singleton instance
export const notificationSchedulerService = new NotificationSchedulerService();