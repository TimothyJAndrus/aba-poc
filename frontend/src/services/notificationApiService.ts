import { apiService } from './api';
import {
  NotificationData,
  NotificationTemplate,
  NotificationType,
  NotificationChannel,
  PaginatedResponse,
} from '../types';

export class NotificationApiService {
  // Notification operations
  async sendNotification(data: {
    type: NotificationType;
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    channel: NotificationChannel;
    templateData?: Record<string, any>;
    scheduledFor?: Date;
  }): Promise<NotificationData> {
    return apiService.post<NotificationData>('/notifications/send', data);
  }

  async getNotification(id: string): Promise<NotificationData> {
    return apiService.get<NotificationData>(`/notifications/${id}`);
  }

  async getNotificationsByRecipient(
    recipientId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      channel?: NotificationChannel;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedResponse<NotificationData>> {
    return apiService.get<PaginatedResponse<NotificationData>>(
      `/notifications/recipient/${recipientId}`,
      params
    );
  }

  async cancelNotification(id: string): Promise<void> {
    return apiService.delete<void>(`/notifications/${id}`);
  }

  // Notification statistics
  async getNotificationStats(params?: {
    startDate?: string;
    endDate?: string;
    type?: NotificationType;
    channel?: NotificationChannel;
  }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    byChannel: Record<NotificationChannel, {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }>;
    byType: Record<NotificationType, {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }>;
  }> {
    return apiService.get('/notifications/stats', params);
  }

  // Template management
  async getTemplates(): Promise<NotificationTemplate[]> {
    return apiService.get<NotificationTemplate[]>('/notifications/templates');
  }

  async getTemplate(type: NotificationType, channel: NotificationChannel): Promise<NotificationTemplate> {
    return apiService.get<NotificationTemplate>(`/notifications/templates/${type}/${channel}`);
  }

  async upsertTemplate(
    type: NotificationType,
    channel: NotificationChannel,
    data: {
      subject: string;
      content: string;
      variables: string[];
      isActive: boolean;
    }
  ): Promise<NotificationTemplate> {
    return apiService.put<NotificationTemplate>(`/notifications/templates/${type}/${channel}`, data);
  }

  async deleteTemplate(type: NotificationType, channel: NotificationChannel): Promise<void> {
    return apiService.delete<void>(`/notifications/templates/${type}/${channel}`);
  }

  async setTemplateStatus(
    type: NotificationType,
    channel: NotificationChannel,
    isActive: boolean
  ): Promise<NotificationTemplate> {
    return apiService.patch<NotificationTemplate>(
      `/notifications/templates/${type}/${channel}/status`,
      { isActive }
    );
  }

  // Scheduled notifications
  async getScheduledNotifications(params?: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    recipientId?: string;
    scheduledAfter?: string;
    scheduledBefore?: string;
  }): Promise<PaginatedResponse<NotificationData>> {
    return apiService.get<PaginatedResponse<NotificationData>>('/notifications/scheduled', params);
  }

  // Test notifications
  async testNotification(data: {
    type: NotificationType;
    channel: NotificationChannel;
    recipientEmail?: string;
    recipientPhone?: string;
    templateData?: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
    notificationId?: string;
  }> {
    return apiService.post('/notifications/test', data);
  }

  // Bulk operations
  async bulkSendNotifications(notifications: {
    type: NotificationType;
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    channel: NotificationChannel;
    templateData?: Record<string, any>;
    scheduledFor?: Date;
  }[]): Promise<NotificationData[]> {
    return apiService.post<NotificationData[]>('/notifications/bulk-send', { notifications });
  }

  async bulkCancelNotifications(notificationIds: string[]): Promise<{
    cancelled: string[];
    failed: string[];
  }> {
    return apiService.post('/notifications/bulk-cancel', { notificationIds });
  }

  // Notification preferences (user-specific)
  async getUserNotificationPreferences(userId: string): Promise<{
    userId: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    preferences: Record<NotificationType, {
      email: boolean;
      sms: boolean;
      push: boolean;
      timing: {
        immediate: boolean;
        reminder24h: boolean;
        reminder2h: boolean;
      };
    }>;
  }> {
    return apiService.get(`/notifications/preferences/${userId}`);
  }

  async updateUserNotificationPreferences(
    userId: string,
    preferences: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      preferences?: Record<NotificationType, {
        email?: boolean;
        sms?: boolean;
        push?: boolean;
        timing?: {
          immediate?: boolean;
          reminder24h?: boolean;
          reminder2h?: boolean;
        };
      }>;
    }
  ): Promise<void> {
    return apiService.put(`/notifications/preferences/${userId}`, preferences);
  }
}

export const notificationApiService = new NotificationApiService();