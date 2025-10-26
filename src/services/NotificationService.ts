import Bull, { Queue, Job } from 'bull';
import { createClient } from 'redis';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { notificationTemplateService } from './NotificationTemplateService';
import {
  NotificationData,
  NotificationTemplate,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  QueueJobData
} from '../types';

export class NotificationService {
  private emailQueue!: Queue;
  private smsQueue!: Queue;
  private scheduledQueue!: Queue;
  private redisClient!: Redis.RedisClientType;
  private emailTransporter?: nodemailer.Transporter;
  private twilioClient?: twilio.Twilio;
  private notifications: Map<string, NotificationData> = new Map();

  constructor() {
    this.initializeRedis();
    this.initializeQueues();
    this.initializeEmailTransporter();
    this.initializeTwilioClient();
  }

  private initializeRedis(): void {
    const clientOptions: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      database: config.redis.db,
    };

    if (config.redis.password) {
      clientOptions.password = config.redis.password;
    }

    this.redisClient = createClient(clientOptions);

    this.redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redisClient.on('connect', () => {
      logger.info('Connected to Redis for notifications');
    });
  }

  private initializeQueues(): void {
    const redisConfig: any = {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      },
    };

    if (config.redis.password) {
      redisConfig.redis.password = config.redis.password;
    }

    // Create separate queues for different notification types
    this.emailQueue = new Bull('email notifications', redisConfig);
    this.smsQueue = new Bull('sms notifications', redisConfig);
    this.scheduledQueue = new Bull('scheduled notifications', redisConfig);

    // Process email notifications
    this.emailQueue.process(async (job: Job<QueueJobData>) => {
      return this.processEmailNotification(job.data);
    });

    // Process SMS notifications
    this.smsQueue.process(async (job: Job<QueueJobData>) => {
      return this.processSmsNotification(job.data);
    });

    // Process scheduled notifications
    this.scheduledQueue.process(async (job: Job<QueueJobData>) => {
      return this.processScheduledNotification(job.data);
    });

    // Error handling
    this.emailQueue.on('failed', (job, err) => {
      logger.error(`Email notification job ${job.id} failed:`, err);
      this.updateNotificationStatus(job.data.notificationId, 'failed', err.message);
    });

    this.smsQueue.on('failed', (job, err) => {
      logger.error(`SMS notification job ${job.id} failed:`, err);
      this.updateNotificationStatus(job.data.notificationId, 'failed', err.message);
    });

    logger.info('Notification queues initialized');
  }

  private initializeEmailTransporter(): void {
    if (!config.notifications.email.host) {
      logger.warn('Email configuration not provided, email notifications will be disabled');
      return;
    }

    this.emailTransporter = nodemailer.createTransport({
      host: config.notifications.email.host,
      port: config.notifications.email.port,
      secure: config.notifications.email.port === 465,
      auth: {
        user: config.notifications.email.username,
        pass: config.notifications.email.password,
      },
    });

    logger.info('Email transporter initialized');
  }

  private initializeTwilioClient(): void {
    if (!config.notifications.sms.accountSid || !config.notifications.sms.authToken) {
      logger.warn('Twilio configuration not provided, SMS notifications will be disabled');
      return;
    }

    this.twilioClient = twilio(
      config.notifications.sms.accountSid,
      config.notifications.sms.authToken
    );

    logger.info('Twilio client initialized');
  }


  /**
   * Send a notification through the appropriate channel
   */
  async sendNotification(
    type: NotificationType,
    recipientId: string,
    recipientEmail: string | undefined,
    recipientPhone: string | undefined,
    channel: NotificationChannel,
    templateData: Record<string, any>,
    scheduledFor?: Date
  ): Promise<string> {
    const notificationId = uuidv4();
    
    // Get template
    const template = notificationTemplateService.getTemplate(type, channel);
    if (!template) {
      throw new Error(`No template found for ${type} on ${channel} channel`);
    }

    // Create notification record
    const notification: NotificationData = {
      id: notificationId,
      type,
      recipientId,
      channel,
      subject: notificationTemplateService.renderTemplate(template.subject, templateData),
      content: notificationTemplateService.renderTemplate(template.content, templateData),
      templateData,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (recipientEmail) {
      notification.recipientEmail = recipientEmail;
    }
    if (recipientPhone) {
      notification.recipientPhone = recipientPhone;
    }
    if (scheduledFor) {
      notification.scheduledFor = scheduledFor;
    }

    this.notifications.set(notificationId, notification);

    // Queue the notification
    const jobData: QueueJobData = {
      notificationId,
      type,
      recipientId,
      channel,
      templateData,
    };

    if (scheduledFor) {
      jobData.scheduledFor = scheduledFor;
    }

    if (scheduledFor && scheduledFor > new Date()) {
      // Schedule for future delivery
      const delay = scheduledFor.getTime() - Date.now();
      await this.scheduledQueue.add(jobData, { delay });
      logger.info(`Scheduled notification ${notificationId} for ${scheduledFor}`);
    } else {
      // Send immediately
      switch (channel) {
        case 'email':
          await this.emailQueue.add(jobData);
          break;
        case 'sms':
          await this.smsQueue.add(jobData);
          break;
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }
      logger.info(`Queued ${channel} notification ${notificationId}`);
    }

    return notificationId;
  }

  /**
   * Process email notification
   */
  private async processEmailNotification(jobData: QueueJobData): Promise<void> {
    const notification = this.notifications.get(jobData.notificationId);
    if (!notification) {
      throw new Error(`Notification ${jobData.notificationId} not found`);
    }

    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    if (!notification.recipientEmail) {
      throw new Error('Recipient email not provided');
    }

    try {
      notification.attempts++;
      notification.lastAttemptAt = new Date();
      this.updateNotificationStatus(jobData.notificationId, 'pending');

      const mailOptions = {
        from: config.notifications.email.from,
        to: notification.recipientEmail,
        subject: notification.subject,
        html: notification.content,
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      notification.deliveredAt = new Date();
      this.updateNotificationStatus(jobData.notificationId, 'delivered');
      
      logger.info(`Email notification ${jobData.notificationId} sent successfully`, {
        messageId: result.messageId,
        recipient: notification.recipientEmail,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send email notification ${jobData.notificationId}:`, error);
      
      if (notification.attempts >= notification.maxAttempts) {
        this.updateNotificationStatus(jobData.notificationId, 'failed', errorMessage);
      } else {
        // Retry with exponential backoff
        const delay = Math.pow(2, notification.attempts) * 1000; // 2s, 4s, 8s...
        await this.emailQueue.add(jobData, { delay });
      }
      
      throw error;
    }
  }

  /**
   * Process SMS notification
   */
  private async processSmsNotification(jobData: QueueJobData): Promise<void> {
    const notification = this.notifications.get(jobData.notificationId);
    if (!notification) {
      throw new Error(`Notification ${jobData.notificationId} not found`);
    }

    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    if (!notification.recipientPhone) {
      throw new Error('Recipient phone not provided');
    }

    try {
      notification.attempts++;
      notification.lastAttemptAt = new Date();
      this.updateNotificationStatus(jobData.notificationId, 'pending');

      const message = await this.twilioClient.messages.create({
        body: notification.content,
        from: config.notifications.sms.fromNumber || '',
        to: notification.recipientPhone,
      });

      notification.deliveredAt = new Date();
      this.updateNotificationStatus(jobData.notificationId, 'delivered');
      
      logger.info(`SMS notification ${jobData.notificationId} sent successfully`, {
        messageSid: message.sid,
        recipient: notification.recipientPhone,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send SMS notification ${jobData.notificationId}:`, error);
      
      if (notification.attempts >= notification.maxAttempts) {
        this.updateNotificationStatus(jobData.notificationId, 'failed', errorMessage);
      } else {
        // Retry with exponential backoff
        const delay = Math.pow(2, notification.attempts) * 1000;
        await this.smsQueue.add(jobData, { delay });
      }
      
      throw error;
    }
  }

  /**
   * Process scheduled notification
   */
  private async processScheduledNotification(jobData: QueueJobData): Promise<void> {
    // Re-queue to appropriate channel queue for immediate processing
    switch (jobData.channel) {
      case 'email':
        await this.emailQueue.add(jobData);
        break;
      case 'sms':
        await this.smsQueue.add(jobData);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${jobData.channel}`);
    }
  }

  /**
   * Update notification status
   */
  private updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus, 
    errorMessage?: string
  ): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = status;
      notification.updatedAt = new Date();
      if (errorMessage) {
        notification.errorMessage = errorMessage;
      }
    }
  }



  /**
   * Get notification by ID
   */
  getNotification(notificationId: string): NotificationData | undefined {
    return this.notifications.get(notificationId);
  }

  /**
   * Get notifications by recipient
   */
  getNotificationsByRecipient(recipientId: string): NotificationData[] {
    return Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === recipientId);
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    total: number;
    byStatus: Record<NotificationStatus, number>;
    byChannel: Record<NotificationChannel, number>;
    byType: Record<NotificationType, number>;
  } {
    const notifications = Array.from(this.notifications.values());
    
    const byStatus: Record<NotificationStatus, number> = {
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0,
    };
    
    const byChannel: Record<NotificationChannel, number> = {
      email: 0,
      sms: 0,
      push: 0,
    };
    
    const byType: Record<NotificationType, number> = {
      session_scheduled: 0,
      session_cancelled: 0,
      session_rescheduled: 0,
      session_reminder: 0,
      rbt_assignment_changed: 0,
      team_updated: 0,
      system_alert: 0,
    };

    notifications.forEach(notification => {
      byStatus[notification.status]++;
      byChannel[notification.channel]++;
      byType[notification.type]++;
    });

    return {
      total: notifications.length,
      byStatus,
      byChannel,
      byType,
    };
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }

    if (notification.status === 'delivered' || notification.status === 'failed') {
      return false; // Cannot cancel already processed notifications
    }

    // Remove from queues (this is a simplified approach)
    // In production, you'd want to track job IDs and remove specific jobs
    notification.status = 'cancelled';
    notification.updatedAt = new Date();
    
    logger.info(`Notification ${notificationId} cancelled`);
    return true;
  }

  /**
   * Cleanup old notifications
   */
  async cleanupOldNotifications(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let cleanedCount = 0;
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.createdAt < cutoffDate) {
        this.notifications.delete(id);
        cleanedCount++;
      }
    }
    
    logger.info(`Cleaned up ${cleanedCount} old notifications`);
    return cleanedCount;
  }

  /**
   * Shutdown queues gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down notification service...');
    
    await Promise.all([
      this.emailQueue.close(),
      this.smsQueue.close(),
      this.scheduledQueue.close(),
    ]);
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    logger.info('Notification service shutdown complete');
  }
}

// Export singleton instance
export const notificationService = new NotificationService();