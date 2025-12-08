import { store } from '../store';
import {
  addNotification,
  addToastNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  removeToastNotification,
  updateSettings,
  type Notification,
  type ToastNotification,
} from '../store/notificationSlice';
import type { NotificationSettings } from '../types';

class NotificationService {
  private toastQueue: ToastNotification[] = [];
  private readonly maxToasts = 5;

  // Initialize the service
  async initialize() {
    this.loadNotificationsFromStorage();
    this.setupWebSocketListeners();
    await this.loadNotificationsFromBackend();
  }

  // Load notifications from backend
  private async loadNotificationsFromBackend() {
    try {
      const { notificationApiService } = await import(
        './notificationApiService'
      );
      const { authService } = await import('./authService');

      const currentUser = authService.getUser();
      if (!currentUser) {
        return;
      }

      const response = await notificationApiService.getNotificationsByRecipient(
        currentUser.id,
        {
          limit: 50,
          page: 1,
        }
      );

      // Convert backend notifications to UI format
      const uiNotifications = response.data.map(backendNotification => ({
        id: backendNotification.id,
        title: backendNotification.subject,
        message: backendNotification.content,
        type: this.mapNotificationTypeToUI(backendNotification.type),
        timestamp: new Date(backendNotification.createdAt),
        read: backendNotification.status === 'delivered',
        category: this.mapNotificationCategoryToUI(backendNotification.type),
        dismissible: true,
        actions: [],
      }));

      // Update the store with backend notifications
      store.dispatch({
        type: 'notifications/updateNotifications',
        payload: uiNotifications,
      });
      this.saveNotificationsToStorage();
    } catch (error) {
      console.error('Failed to load notifications from backend:', error);
    }
  }

  // Map backend notification types to UI types
  private mapNotificationTypeToUI(
    backendType: string
  ): 'info' | 'success' | 'warning' | 'error' {
    switch (backendType) {
      case 'session_scheduled':
      case 'session_reminder':
        return 'info';
      case 'session_cancelled':
        return 'warning';
      case 'system_alert':
        return 'error';
      case 'session_rescheduled':
      case 'rbt_assignment_changed':
      case 'team_updated':
        return 'success';
      default:
        return 'info';
    }
  }

  // Map backend notification types to UI categories
  private mapNotificationCategoryToUI(backendType: string): string {
    switch (backendType) {
      case 'session_scheduled':
      case 'session_cancelled':
      case 'session_rescheduled':
      case 'session_reminder':
        return 'session';
      case 'rbt_assignment_changed':
      case 'team_updated':
        return 'team';
      case 'system_alert':
        return 'system';
      default:
        return 'general';
    }
  }

  // Load notifications from localStorage
  private loadNotificationsFromStorage() {
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const notifications = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const parsedNotifications = notifications.map(
          (n: { timestamp: string } & Omit<Notification, 'timestamp'>) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          })
        );
        store.dispatch({
          type: 'notifications/updateNotifications',
          payload: parsedNotifications,
        });
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
    }
  }

  // Save notifications to localStorage
  private saveNotificationsToStorage() {
    try {
      const state = store.getState();
      const notifications = state.notifications.notifications;
      localStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }

  // Setup WebSocket listeners for real-time notifications
  private setupWebSocketListeners() {
    // Note: WebSocket event listeners are now handled in the useWebSocket hook
    // This method is kept for backward compatibility and future direct integrations
    console.log('Notification service WebSocket listeners initialized');
  }

  // Add a new notification
  addNotification(notification: Notification) {
    store.dispatch(addNotification(notification));
    this.saveNotificationsToStorage();
  }

  // Show a toast notification
  showToast(toast: ToastNotification) {
    // Check if we're at the limit
    if (this.toastQueue.length >= this.maxToasts) {
      // Remove the oldest toast
      const oldestToast = this.toastQueue.shift();
      if (oldestToast) {
        store.dispatch(removeToastNotification(oldestToast.id));
      }
    }

    this.toastQueue.push(toast);
    store.dispatch(addToastNotification(toast));
  }

  // Mark notification as read
  markAsRead(notificationId: string) {
    store.dispatch(markAsRead(notificationId));
    this.saveNotificationsToStorage();
  }

  // Mark all notifications as read
  markAllAsRead() {
    store.dispatch(markAllAsRead());
    this.saveNotificationsToStorage();
  }

  // Remove a notification
  removeNotification(notificationId: string) {
    store.dispatch(removeNotification(notificationId));
    this.saveNotificationsToStorage();
  }

  // Clear all notifications
  clearAllNotifications() {
    store.dispatch(clearAllNotifications());
    this.saveNotificationsToStorage();
  }

  // Remove a toast notification
  removeToast(toastId: string) {
    store.dispatch(removeToastNotification(toastId));
    this.toastQueue = this.toastQueue.filter(toast => toast.id !== toastId);
  }

  // Update notification settings
  updateSettings(settings: Partial<NotificationSettings>) {
    store.dispatch(updateSettings(settings));

    // Save to localStorage
    try {
      const currentSettings = store.getState().notifications.settings;
      localStorage.setItem(
        'notificationSettings',
        JSON.stringify(currentSettings)
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }

    // Send to backend if needed
    this.syncSettingsWithBackend(settings);
  }

  // Load settings from storage
  loadSettings() {
    try {
      const stored = localStorage.getItem('notificationSettings');
      if (stored) {
        const settings = JSON.parse(stored);
        store.dispatch(updateSettings(settings));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  // Sync settings with backend using the new API service
  private async syncSettingsWithBackend(
    settings: Partial<NotificationSettings>
  ) {
    try {
      // Import the notification API service dynamically to avoid circular dependencies
      const { notificationApiService } = await import(
        './notificationApiService'
      );
      const { authService } = await import('./authService');

      const currentUser = authService.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Convert UI settings to backend format
      const backendSettings = {
        emailEnabled: settings.email,
        smsEnabled: false, // SMS not implemented in UI yet
        pushEnabled: settings.push,
        preferences: {
          session_scheduled: {
            email: settings.scheduleChanges,
            push: settings.push,
            timing: {
              immediate: true,
              reminder24h: settings.reminders,
              reminder2h: settings.reminders,
            },
          },
          session_reminder: {
            email: settings.reminders,
            push: settings.reminders,
            timing: {
              immediate: true,
              reminder24h: true,
              reminder2h: true,
            },
          },
          session_cancelled: {
            email: settings.scheduleChanges,
            push: settings.push,
            timing: {
              immediate: true,
              reminder24h: false,
              reminder2h: false,
            },
          },
          session_rescheduled: {
            email: settings.scheduleChanges,
            push: settings.push,
            timing: {
              immediate: true,
              reminder24h: settings.reminders,
              reminder2h: settings.reminders,
            },
          },
          rbt_assignment_changed: {
            email: settings.scheduleChanges,
            push: settings.push,
            timing: {
              immediate: true,
              reminder24h: false,
              reminder2h: false,
            },
          },
          team_updated: {
            email: settings.scheduleChanges,
            push: settings.push,
            timing: {
              immediate: true,
              reminder24h: false,
              reminder2h: false,
            },
          },
          system_alert: {
            email: settings.systemAlerts,
            push: settings.systemAlerts,
            timing: {
              immediate: true,
              reminder24h: false,
              reminder2h: false,
            },
          },
        },
      };

      await notificationApiService.updateUserNotificationPreferences(
        currentUser.id,
        backendSettings
      );
    } catch (error) {
      console.error('Failed to sync notification settings:', error);
      // Show error toast
      this.showToast({
        id: `error-${Date.now()}`,
        message: 'Failed to save notification settings',
        type: 'error',
        duration: 5000,
      });
    }
  }

  // Request notification permission for browser notifications
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in globalThis)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Show browser notification
  showBrowserNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    }
    return null;
  }

  // Utility methods for common notification types
  showSuccess(message: string, title?: string) {
    this.showToast({
      id: `success-${Date.now()}`,
      title,
      message,
      type: 'success',
      duration: 3000,
    });
  }

  showError(message: string, title?: string, persistent = false) {
    this.showToast({
      id: `error-${Date.now()}`,
      title,
      message,
      type: 'error',
      duration: persistent ? 0 : 5000,
      persistent,
    });
  }

  showWarning(message: string, title?: string) {
    this.showToast({
      id: `warning-${Date.now()}`,
      title,
      message,
      type: 'warning',
      duration: 4000,
    });
  }

  showInfo(message: string, title?: string) {
    this.showToast({
      id: `info-${Date.now()}`,
      title,
      message,
      type: 'info',
      duration: 3000,
    });
  }

  // Schedule reminder notifications
  scheduleReminder(sessionId: string, sessionTime: Date, reminderMinutes = 15) {
    const reminderTime = new Date(
      sessionTime.getTime() - reminderMinutes * 60 * 1000
    );
    const now = new Date();

    if (reminderTime > now) {
      const timeoutMs = reminderTime.getTime() - now.getTime();

      setTimeout(() => {
        this.addNotification({
          id: `reminder-${sessionId}`,
          title: 'Session Reminder',
          message: `Your session starts in ${reminderMinutes} minutes`,
          type: 'info',
          timestamp: new Date(),
          read: false,
          category: 'session',
          dismissible: true,
        });

        this.showToast({
          id: `toast-reminder-${sessionId}`,
          title: 'Session Reminder',
          message: `Session starts in ${reminderMinutes} minutes`,
          type: 'info',
          duration: 0,
          persistent: true,
        });
      }, timeoutMs);
    }
  }
}

export const notificationService = new NotificationService();
