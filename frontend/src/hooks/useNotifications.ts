import { useApiQuery, useApiMutation, useInvalidateQueries, queryKeys } from './useApi';
import { notificationApiService } from '../services/notificationApiService';
import {
  NotificationData,
  NotificationTemplate,
  NotificationType,
  NotificationChannel,
  PaginatedResponse,
} from '../types';

// Notification CRUD hooks
export function useNotification(id: string) {
  return useApiQuery({
    queryKey: queryKeys.notifications.detail(id),
    queryFn: () => notificationApiService.getNotification(id),
    enabled: !!id,
  });
}

export function useNotificationsByRecipient(
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
) {
  return useApiQuery({
    queryKey: queryKeys.notifications.byRecipient(recipientId),
    queryFn: () => notificationApiService.getNotificationsByRecipient(recipientId, params),
    enabled: !!recipientId,
    staleTime: 1 * 60 * 1000, // 1 minute - notifications change frequently
  });
}

export function useSendNotification() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: {
      type: NotificationType;
      recipientId: string;
      recipientEmail?: string;
      recipientPhone?: string;
      channel: NotificationChannel;
      templateData?: Record<string, any>;
      scheduledFor?: Date;
    }) => notificationApiService.sendNotification(data),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

export function useCancelNotification() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (id: string) => notificationApiService.cancelNotification(id),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

// Notification statistics hooks
export function useNotificationStats(params?: {
  startDate?: string;
  endDate?: string;
  type?: NotificationType;
  channel?: NotificationChannel;
}) {
  return useApiQuery({
    queryKey: queryKeys.notifications.stats(params || {}),
    queryFn: () => notificationApiService.getNotificationStats(params),
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
  });
}

// Template management hooks
export function useNotificationTemplates() {
  return useApiQuery({
    queryKey: queryKeys.notifications.templates(),
    queryFn: () => notificationApiService.getTemplates(),
    staleTime: 10 * 60 * 1000, // 10 minutes - templates don't change frequently
  });
}

export function useNotificationTemplate(type: NotificationType, channel: NotificationChannel) {
  return useApiQuery({
    queryKey: queryKeys.notifications.template(type, channel),
    queryFn: () => notificationApiService.getTemplate(type, channel),
    enabled: !!(type && channel),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useUpsertNotificationTemplate() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ type, channel, data }: {
      type: NotificationType;
      channel: NotificationChannel;
      data: {
        subject: string;
        content: string;
        variables: string[];
        isActive: boolean;
      };
    }) => notificationApiService.upsertTemplate(type, channel, data),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

export function useDeleteNotificationTemplate() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ type, channel }: {
      type: NotificationType;
      channel: NotificationChannel;
    }) => notificationApiService.deleteTemplate(type, channel),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

export function useSetTemplateStatus() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ type, channel, isActive }: {
      type: NotificationType;
      channel: NotificationChannel;
      isActive: boolean;
    }) => notificationApiService.setTemplateStatus(type, channel, isActive),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

// Scheduled notifications hooks
export function useScheduledNotifications(params?: {
  page?: number;
  limit?: number;
  type?: NotificationType;
  recipientId?: string;
  scheduledAfter?: string;
  scheduledBefore?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.notifications.scheduled(params || {}),
    queryFn: () => notificationApiService.getScheduledNotifications(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - scheduled notifications change frequently
  });
}

// Test notifications hooks
export function useTestNotification() {
  return useApiMutation({
    mutationFn: (data: {
      type: NotificationType;
      channel: NotificationChannel;
      recipientEmail?: string;
      recipientPhone?: string;
      templateData?: Record<string, any>;
    }) => notificationApiService.testNotification(data),
  });
}

// Bulk operations hooks
export function useBulkSendNotifications() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (notifications: {
      type: NotificationType;
      recipientId: string;
      recipientEmail?: string;
      recipientPhone?: string;
      channel: NotificationChannel;
      templateData?: Record<string, any>;
      scheduledFor?: Date;
    }[]) => notificationApiService.bulkSendNotifications(notifications),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

export function useBulkCancelNotifications() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (notificationIds: string[]) => 
      notificationApiService.bulkCancelNotifications(notificationIds),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

// User notification preferences hooks
export function useUserNotificationPreferences(userId: string) {
  return useApiQuery({
    queryKey: queryKeys.notifications.list({ userId, preferences: true }),
    queryFn: () => notificationApiService.getUserNotificationPreferences(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - preferences don't change frequently
  });
}

export function useUpdateUserNotificationPreferences() {
  const { invalidateNotifications } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ userId, preferences }: {
      userId: string;
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
      };
    }) => notificationApiService.updateUserNotificationPreferences(userId, preferences),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
}

// Utility hooks for dashboard data
export function useRecentNotifications(recipientId: string, limit: number = 10) {
  return useApiQuery({
    queryKey: queryKeys.notifications.list({ recipientId, recent: true, limit }),
    queryFn: () => notificationApiService.getNotificationsByRecipient(recipientId, {
      limit,
      page: 1,
    }),
    enabled: !!recipientId,
    staleTime: 1 * 60 * 1000, // 1 minute - recent notifications change frequently
  });
}

export function useUnreadNotificationsCount(recipientId: string) {
  return useApiQuery({
    queryKey: queryKeys.notifications.list({ recipientId, unread: true }),
    queryFn: async () => {
      const response = await notificationApiService.getNotificationsByRecipient(recipientId, {
        status: 'delivered',
        limit: 1,
      });
      return response.total;
    },
    enabled: !!recipientId,
    staleTime: 30 * 1000, // 30 seconds - unread count changes frequently
  });
}

export function useNotificationSummary() {
  return useApiQuery({
    queryKey: queryKeys.notifications.list({ summary: true }),
    queryFn: async () => {
      const [stats, scheduled] = await Promise.all([
        notificationApiService.getNotificationStats(),
        notificationApiService.getScheduledNotifications({ limit: 1 }),
      ]);

      return {
        totalSent: stats.totalSent,
        totalDelivered: stats.totalDelivered,
        totalFailed: stats.totalFailed,
        deliveryRate: stats.deliveryRate,
        scheduledCount: scheduled.total,
        emailDeliveryRate: stats.byChannel.email?.deliveryRate || 0,
        smsDeliveryRate: stats.byChannel.sms?.deliveryRate || 0,
        pushDeliveryRate: stats.byChannel.push?.deliveryRate || 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Real-time notification hooks
export function useNotificationUpdates(recipientId: string) {
  const { invalidateNotifications } = useInvalidateQueries();

  // This would typically use WebSocket or Server-Sent Events
  // For now, we'll implement polling for new notifications
  return useApiQuery({
    queryKey: queryKeys.notifications.list({ recipientId, realtime: true }),
    queryFn: () => notificationApiService.getNotificationsByRecipient(recipientId, {
      limit: 5,
      page: 1,
    }),
    enabled: !!recipientId,
    staleTime: 10 * 1000, // 10 seconds - poll frequently for real-time updates
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    onSuccess: () => {
      // Invalidate other notification queries to keep them fresh
      invalidateNotifications();
    },
  });
}