import { useState, useEffect, useCallback } from 'react';
import type { DashboardMetric } from '../types';
import { apiService } from '../services/api';
import { websocketService } from '../services/websocketService';
import type { SystemAlert, ActivityItem } from '../services/websocketService';

export interface AdminDashboardData {
  metrics: DashboardMetric[];
  alerts: SystemAlert[];
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export const useAdminDashboard = () => {
  const [data, setData] = useState<AdminDashboardData>({
    metrics: [],
    alerts: [],
    activities: [],
    loading: true,
    error: null,
    lastUpdated: new Date(),
    connectionStatus: 'disconnected',
  });

  const updateMetrics = useCallback((newMetrics: DashboardMetric[]) => {
    setData(prev => ({
      ...prev,
      metrics: newMetrics,
      lastUpdated: new Date(),
    }));
  }, []);

  const addAlert = useCallback((alert: SystemAlert) => {
    setData(prev => ({
      ...prev,
      alerts: [alert, ...prev.alerts].slice(0, 10), // Keep only latest 10 alerts
    }));
  }, []);

  const removeAlert = useCallback((alertId: string) => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== alertId),
    }));
  }, []);

  const addActivity = useCallback((activity: ActivityItem) => {
    setData(prev => ({
      ...prev,
      activities: [activity, ...prev.activities].slice(0, 20), // Keep only latest 20 activities
    }));
  }, []);

  const refreshData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Fetch initial data from API
      const [metricsResponse, alertsResponse, activitiesResponse] = await Promise.all([
        apiService.get<DashboardMetric[]>('/admin/metrics').catch(() => []),
        apiService.get<SystemAlert[]>('/admin/alerts').catch(() => []),
        apiService.get<ActivityItem[]>('/admin/activities').catch(() => []),
      ]);

      setData(prev => ({
        ...prev,
        metrics: metricsResponse as DashboardMetric[],
        alerts: alertsResponse as SystemAlert[],
        activities: activitiesResponse as ActivityItem[],
        loading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data',
      }));
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, connectionStatus: 'connecting' }));
      
      await websocketService.connect();
      
      setData(prev => ({ ...prev, connectionStatus: 'connected' }));

      // Join admin room for real-time updates
      websocketService.joinAdminRoom();

      // Set up event listeners
      websocketService.onMetricsUpdate(updateMetrics);
      websocketService.onNewAlert(addAlert);
      websocketService.onNewActivity(addActivity);

      // Request initial metrics update
      websocketService.requestMetricsUpdate();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setData(prev => ({ 
        ...prev, 
        connectionStatus: 'disconnected',
        error: 'Failed to establish real-time connection',
      }));
    }
  }, [updateMetrics, addAlert, addActivity]);

  const disconnectWebSocket = useCallback(() => {
    websocketService.leaveAdminRoom();
    websocketService.offMetricsUpdate();
    websocketService.offNewAlert();
    websocketService.offNewActivity();
    websocketService.disconnect();
    
    setData(prev => ({ ...prev, connectionStatus: 'disconnected' }));
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    removeAlert(alertId);
    websocketService.dismissAlert(alertId);
  }, [removeAlert]);

  useEffect(() => {
    // Initial data load
    refreshData();
    
    // Connect WebSocket
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
    };
  }, []);

  return {
    ...data,
    refreshData,
    dismissAlert,
    connectWebSocket,
    disconnectWebSocket,
  };
};