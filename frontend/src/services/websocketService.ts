import { io, Socket } from 'socket.io-client';
import type { DashboardMetric } from '../types';
import { store } from '../store';
import { setConnectionStatus } from '../store/notificationSlice';

export interface WebSocketEvents {
  'metrics:update': (metrics: DashboardMetric[]) => void;
  'alert:new': (alert: SystemAlert) => void;
  'activity:new': (activity: ActivityItem) => void;
  'user:connected': (userId: string) => void;
  'user:disconnected': (userId: string) => void;
  'schedule:changed': (data: ScheduleChangeData) => void;
  'session:reminder': (data: SessionReminderData) => void;
  'session:cancelled': (data: SessionCancelledData) => void;
  'session:rescheduled': (data: SessionRescheduledData) => void;
  'notification:new': (notification: NotificationData) => void;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  dismissed?: boolean;
}

export interface ActivityItem {
  id: string;
  message: string;
  timestamp: Date;
  userId?: string;
  type: 'user' | 'session' | 'system';
}

export interface ScheduleChangeData {
  sessionId: string;
  userId: string;
  changeType: 'created' | 'updated' | 'cancelled' | 'rescheduled';
  message: string;
  sessionDetails?: {
    clientName: string;
    rbtName: string;
    startTime: Date;
    endTime: Date;
  };
}

export interface SessionReminderData {
  sessionId: string;
  userId: string;
  message: string;
  sessionUrl: string;
  minutesUntilSession: number;
}

export interface SessionCancelledData {
  sessionId: string;
  userId: string;
  message: string;
  reason?: string;
  cancelledBy: string;
}

export interface SessionRescheduledData {
  sessionId: string;
  userId: string;
  message: string;
  oldTime: Date;
  newTime: Date;
  rescheduledBy: string;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category?: 'schedule' | 'system' | 'user' | 'session';
  actionUrl?: string;
  userId: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private connectionListeners: Array<(status: string) => void> = [];
  private heartbeatInterval: number | null = null;

  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

      // Update connection status
      store.dispatch(setConnectionStatus('connecting'));

      this.socket = io(wsUrl, {
        auth: {
          token: token || localStorage.getItem('authToken'),
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        store.dispatch(setConnectionStatus('connected'));
        this.notifyConnectionListeners('connected');
        this.startHeartbeat();
        resolve();
      });

      this.socket.on('disconnect', reason => {
        console.log('WebSocket disconnected:', reason);
        store.dispatch(setConnectionStatus('disconnected'));
        this.notifyConnectionListeners('disconnected');
        this.stopHeartbeat();

        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', error => {
        console.error('WebSocket connection error:', error);
        store.dispatch(setConnectionStatus('error'));
        this.notifyConnectionListeners('error');
        this.handleReconnect();
        reject(error);
      });

      // Set up automatic reconnection
      this.socket.on('reconnect', attemptNumber => {
        console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
        this.reconnectAttempts = 0;
        store.dispatch(setConnectionStatus('connected'));
        this.notifyConnectionListeners('connected');
      });

      this.socket.on('reconnect_error', error => {
        console.error('WebSocket reconnection error:', error);
        store.dispatch(setConnectionStatus('error'));
        this.notifyConnectionListeners('error');
      });

      this.socket.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed after maximum attempts');
        store.dispatch(setConnectionStatus('error'));
        this.notifyConnectionListeners('error');
      });
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      store.dispatch(setConnectionStatus('connecting'));
      this.notifyConnectionListeners('connecting');

      setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.socket?.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      store.dispatch(setConnectionStatus('error'));
      this.notifyConnectionListeners('error');
    }
  }

  // Connection status management
  addConnectionListener(listener: (status: string) => void) {
    this.connectionListeners.push(listener);
  }

  removeConnectionListener(listener: (status: string) => void) {
    this.connectionListeners = this.connectionListeners.filter(
      l => l !== listener
    );
  }

  private notifyConnectionListeners(status: string) {
    for (const listener of this.connectionListeners) {
      listener(status);
    }
  }

  // Heartbeat to maintain connection
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      store.dispatch(setConnectionStatus('disconnected'));
      this.notifyConnectionListeners('disconnected');
    }
  }

  // Force reconnection
  reconnect() {
    this.disconnect();
    const token = localStorage.getItem('authToken');
    return this.connect(token || undefined);
  }

  // Event listeners
  onMetricsUpdate(callback: (metrics: DashboardMetric[]) => void) {
    this.socket?.on('metrics:update', callback);
  }

  onNewAlert(callback: (alert: SystemAlert) => void) {
    this.socket?.on('alert:new', callback);
  }

  onNewActivity(callback: (activity: ActivityItem) => void) {
    this.socket?.on('activity:new', callback);
  }

  onUserConnected(callback: (userId: string) => void) {
    this.socket?.on('user:connected', callback);
  }

  onUserDisconnected(callback: (userId: string) => void) {
    this.socket?.on('user:disconnected', callback);
  }

  onScheduleChanged(callback: (data: ScheduleChangeData) => void) {
    this.socket?.on('schedule:changed', callback);
  }

  onSessionReminder(callback: (data: SessionReminderData) => void) {
    this.socket?.on('session:reminder', callback);
  }

  onSessionCancelled(callback: (data: SessionCancelledData) => void) {
    this.socket?.on('session:cancelled', callback);
  }

  onSessionRescheduled(callback: (data: SessionRescheduledData) => void) {
    this.socket?.on('session:rescheduled', callback);
  }

  onNewNotification(callback: (notification: NotificationData) => void) {
    this.socket?.on('notification:new', callback);
  }

  // Event emitters
  joinAdminRoom() {
    this.socket?.emit('join:admin');
  }

  leaveAdminRoom() {
    this.socket?.emit('leave:admin');
  }

  joinUserRoom(userId: string) {
    this.socket?.emit('join:user', userId);
  }

  leaveUserRoom(userId: string) {
    this.socket?.emit('leave:user', userId);
  }

  requestMetricsUpdate() {
    this.socket?.emit('metrics:request');
  }

  dismissAlert(alertId: string) {
    this.socket?.emit('alert:dismiss', alertId);
  }

  markNotificationAsRead(notificationId: string) {
    this.socket?.emit('notification:read', notificationId);
  }

  subscribeToScheduleUpdates(userId: string) {
    this.socket?.emit('subscribe:schedule', userId);
  }

  unsubscribeFromScheduleUpdates(userId: string) {
    this.socket?.emit('unsubscribe:schedule', userId);
  }

  // Remove event listeners
  offMetricsUpdate(callback?: (metrics: DashboardMetric[]) => void) {
    this.socket?.off('metrics:update', callback);
  }

  offNewAlert(callback?: (alert: SystemAlert) => void) {
    this.socket?.off('alert:new', callback);
  }

  offNewActivity(callback?: (activity: ActivityItem) => void) {
    this.socket?.off('activity:new', callback);
  }

  offUserConnected(callback?: (userId: string) => void) {
    this.socket?.off('user:connected', callback);
  }

  offUserDisconnected(callback?: (userId: string) => void) {
    this.socket?.off('user:disconnected', callback);
  }

  offScheduleChanged(callback?: (data: ScheduleChangeData) => void) {
    this.socket?.off('schedule:changed', callback);
  }

  offSessionReminder(callback?: (data: SessionReminderData) => void) {
    this.socket?.off('session:reminder', callback);
  }

  offSessionCancelled(callback?: (data: SessionCancelledData) => void) {
    this.socket?.off('session:cancelled', callback);
  }

  offSessionRescheduled(callback?: (data: SessionRescheduledData) => void) {
    this.socket?.off('session:rescheduled', callback);
  }

  offNewNotification(callback?: (notification: NotificationData) => void) {
    this.socket?.off('notification:new', callback);
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get connectionId(): string | undefined {
    return this.socket?.id;
  }
}

export const websocketService = new WebSocketService();
