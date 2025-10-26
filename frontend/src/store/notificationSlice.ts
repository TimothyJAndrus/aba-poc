import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { NotificationSettings } from '../types';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
  category?: 'schedule' | 'system' | 'user' | 'session';
  actionUrl?: string;
  dismissible?: boolean;
}

export interface ToastNotification {
  id: string;
  title?: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  toastNotifications: ToastNotification[];
  settings: NotificationSettings;
  unreadCount: number;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const initialSettings: NotificationSettings = {
  email: true,
  push: true,
  scheduleChanges: true,
  reminders: true,
  systemAlerts: true,
};

const initialState: NotificationState = {
  notifications: [],
  toastNotifications: [],
  settings: initialSettings,
  unreadCount: 0,
  isConnected: false,
  connectionStatus: 'disconnected',
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Notification management
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
    },
    
    addMultipleNotifications: (state, action: PayloadAction<Notification[]>) => {
      const newNotifications = action.payload;
      state.notifications = [...newNotifications, ...state.notifications];
      state.unreadCount = state.notifications.filter(n => !n.read).length;
    },
    
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    // Toast notifications
    addToastNotification: (state, action: PayloadAction<ToastNotification>) => {
      state.toastNotifications.push(action.payload);
    },
    
    removeToastNotification: (state, action: PayloadAction<string>) => {
      state.toastNotifications = state.toastNotifications.filter(
        toast => toast.id !== action.payload
      );
    },
    
    clearAllToastNotifications: (state) => {
      state.toastNotifications = [];
    },
    
    // Settings management
    updateSettings: (state, action: PayloadAction<Partial<NotificationSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    
    resetSettings: (state) => {
      state.settings = initialSettings;
    },
    
    // Connection status
    setConnectionStatus: (state, action: PayloadAction<NotificationState['connectionStatus']>) => {
      state.connectionStatus = action.payload;
      state.isConnected = action.payload === 'connected';
    },
    
    // Bulk operations
    updateNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.read).length;
    },
  },
});

export const {
  addNotification,
  addMultipleNotifications,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  addToastNotification,
  removeToastNotification,
  clearAllToastNotifications,
  updateSettings,
  resetSettings,
  setConnectionStatus,
  updateNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) => 
  state.notifications.notifications;

export const selectUnreadNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications.filter(n => !n.read);

export const selectToastNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.toastNotifications;

export const selectNotificationSettings = (state: { notifications: NotificationState }) =>
  state.notifications.settings;

export const selectUnreadCount = (state: { notifications: NotificationState }) =>
  state.notifications.unreadCount;

export const selectConnectionStatus = (state: { notifications: NotificationState }) =>
  state.notifications.connectionStatus;

export const selectIsConnected = (state: { notifications: NotificationState }) =>
  state.notifications.isConnected;