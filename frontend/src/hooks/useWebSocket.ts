import { useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { websocketService } from '../services/websocketService';
import { notificationService } from '../services/notificationService';
import { selectIsConnected, selectConnectionStatus } from '../store/notificationSlice';
import type { RootState } from '../store';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  subscribeToUserUpdates?: boolean;
  subscribeToScheduleUpdates?: boolean;
  onConnectionChange?: (status: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    subscribeToUserUpdates = true,
    subscribeToScheduleUpdates = true,
    onConnectionChange,
  } = options;

  const navigate = useNavigate();
  const isConnected = useSelector(selectIsConnected);
  const connectionStatus = useSelector(selectConnectionStatus);
  const { user, token } = useSelector((state: RootState) => state.auth);
  
  const connectionListenerRef = useRef<((status: string) => void) | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    try {
      await websocketService.connect(token);
      
      // Join user-specific room if user is available
      if (user?.id && subscribeToUserUpdates) {
        websocketService.joinUserRoom(user.id);
      }

      // Subscribe to schedule updates if requested
      if (user?.id && subscribeToScheduleUpdates) {
        websocketService.subscribeToScheduleUpdates(user.id);
      }

      // Join admin room if user is admin
      if (user?.role === 'admin') {
        websocketService.joinAdminRoom();
      }

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [token, user, subscribeToUserUpdates, subscribeToScheduleUpdates]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (user?.id) {
      websocketService.leaveUserRoom(user.id);
      websocketService.unsubscribeFromScheduleUpdates(user.id);
    }
    
    if (user?.role === 'admin') {
      websocketService.leaveAdminRoom();
    }
    
    websocketService.disconnect();
  }, [user]);

  // Reconnect to WebSocket
  const reconnect = useCallback(async () => {
    disconnect();
    await connect();
  }, [connect, disconnect]);

  // Setup event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Schedule change notifications
    const handleScheduleChange = (data: any) => {
      notificationService.addNotification({
        id: `schedule-${data.sessionId}-${Date.now()}`,
        title: 'Schedule Updated',
        message: data.message,
        type: 'info',
        timestamp: new Date(),
        read: false,
        category: 'schedule',
        actionUrl: `/sessions/${data.sessionId}`,
        dismissible: true,
      });

      // Show toast for immediate feedback
      notificationService.showInfo(data.message, 'Schedule Updated');
    };

    // Session reminder notifications
    const handleSessionReminder = (data: any) => {
      notificationService.addNotification({
        id: `reminder-${data.sessionId}-${Date.now()}`,
        title: 'Session Reminder',
        message: data.message,
        type: 'info',
        timestamp: new Date(),
        read: false,
        category: 'session',
        actionUrl: data.sessionUrl,
        dismissible: true,
      });

      // Show persistent toast with action
      notificationService.showToast({
        id: `toast-reminder-${data.sessionId}`,
        title: 'Session Reminder',
        message: data.message,
        type: 'info',
        duration: 0,
        persistent: true,
        action: {
          label: 'View Session',
          onClick: () => navigate(data.sessionUrl),
        },
      });
    };

    // Session cancellation notifications
    const handleSessionCancelled = (data: any) => {
      notificationService.addNotification({
        id: `cancelled-${data.sessionId}-${Date.now()}`,
        title: 'Session Cancelled',
        message: data.message,
        type: 'warning',
        timestamp: new Date(),
        read: false,
        category: 'session',
        dismissible: true,
      });

      notificationService.showWarning(data.message, 'Session Cancelled');
    };

    // Session rescheduled notifications
    const handleSessionRescheduled = (data: any) => {
      notificationService.addNotification({
        id: `rescheduled-${data.sessionId}-${Date.now()}`,
        title: 'Session Rescheduled',
        message: data.message,
        type: 'info',
        timestamp: new Date(),
        read: false,
        category: 'session',
        dismissible: true,
      });

      notificationService.showInfo(data.message, 'Session Rescheduled');
    };

    // Generic notification handler
    const handleNewNotification = (notification: any) => {
      notificationService.addNotification({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        timestamp: new Date(),
        read: false,
        category: notification.category,
        actionUrl: notification.actionUrl,
        dismissible: true,
      });

      // Show toast for important notifications
      if (notification.type === 'error' || notification.type === 'warning') {
        notificationService.showToast({
          id: `toast-${notification.id}`,
          message: notification.message,
          type: notification.type,
          duration: notification.type === 'error' ? 0 : 5000,
          persistent: notification.type === 'error',
        });
      }
    };

    // System alert handler
    const handleSystemAlert = (alert: any) => {
      notificationService.addNotification({
        id: alert.id,
        title: 'System Alert',
        message: alert.message,
        type: alert.type,
        timestamp: new Date(alert.timestamp),
        read: false,
        category: 'system',
        dismissible: true,
      });

      // Show toast for critical alerts
      if (alert.type === 'error' || alert.type === 'warning') {
        notificationService.showToast({
          id: `toast-alert-${alert.id}`,
          message: alert.message,
          type: alert.type,
          duration: alert.type === 'error' ? 0 : 5000,
          persistent: alert.type === 'error',
        });
      }
    };

    // Register event listeners
    websocketService.onScheduleChanged(handleScheduleChange);
    websocketService.onSessionReminder(handleSessionReminder);
    websocketService.onSessionCancelled(handleSessionCancelled);
    websocketService.onSessionRescheduled(handleSessionRescheduled);
    websocketService.onNewNotification(handleNewNotification);
    websocketService.onNewAlert(handleSystemAlert);

    // Cleanup function
    return () => {
      websocketService.offScheduleChanged(handleScheduleChange);
      websocketService.offSessionReminder(handleSessionReminder);
      websocketService.offSessionCancelled(handleSessionCancelled);
      websocketService.offSessionRescheduled(handleSessionRescheduled);
      websocketService.offNewNotification(handleNewNotification);
      websocketService.offNewAlert(handleSystemAlert);
    };
  }, [isConnected, navigate]);

  // Setup connection status listener
  useEffect(() => {
    if (onConnectionChange) {
      connectionListenerRef.current = onConnectionChange;
      websocketService.addConnectionListener(onConnectionChange);

      return () => {
        if (connectionListenerRef.current) {
          websocketService.removeConnectionListener(connectionListenerRef.current);
        }
      };
    }
  }, [onConnectionChange]);

  // Auto-connect on mount if enabled and user is authenticated
  useEffect(() => {
    if (autoConnect && token && !isConnected && connectionStatus !== 'connecting') {
      connect();
    }
  }, [autoConnect, token, isConnected, connectionStatus, connect]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Reconnect when user changes (e.g., login/logout)
  useEffect(() => {
    if (token && user && isConnected) {
      // User changed while connected, reconnect to update subscriptions
      reconnect();
    }
  }, [user?.id, user?.role]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    reconnect,
    websocketService,
  };
};