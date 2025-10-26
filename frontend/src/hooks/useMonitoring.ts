import { useApiQuery, useApiMutation, useInvalidateQueries, queryKeys } from './useApi';
import { monitoringService } from '../services/monitoringService';
import {
  SystemMetrics,
  ApplicationMetrics,
  SystemAlert,
  AlertThreshold,
} from '../types';

// Health and status hooks
export function useHealthStatus() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.health(),
    queryFn: () => monitoringService.getHealthStatus(),
    staleTime: 30 * 1000, // 30 seconds - health status changes frequently
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

// System metrics hooks
export function useSystemMetrics(params?: {
  startTime?: string;
  endTime?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}) {
  return useApiQuery({
    queryKey: queryKeys.monitoring.systemMetrics(params || {}),
    queryFn: () => monitoringService.getSystemMetrics(params),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

export function useApplicationMetrics(params?: {
  startTime?: string;
  endTime?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}) {
  return useApiQuery({
    queryKey: queryKeys.monitoring.appMetrics(params || {}),
    queryFn: () => monitoringService.getApplicationMetrics(params),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

// Alert hooks
export function useActiveAlerts() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.alerts.active(),
    queryFn: () => monitoringService.getActiveAlerts(),
    staleTime: 30 * 1000, // 30 seconds - active alerts change frequently
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useAllAlerts(params?: {
  page?: number;
  limit?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  acknowledged?: boolean;
  startDate?: string;
  endDate?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.monitoring.alerts.list(params || {}),
    queryFn: () => monitoringService.getAllAlerts(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAcknowledgeAlert() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ alertId, data }: {
      alertId: string;
      data: {
        acknowledgedBy: string;
        notes?: string;
      };
    }) => monitoringService.acknowledgeAlert(alertId, data),
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

export function useResolveAlert() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ alertId, data }: {
      alertId: string;
      data: {
        resolvedBy: string;
        resolution: string;
      };
    }) => monitoringService.resolveAlert(alertId, data),
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

// Alert threshold hooks
export function useAlertThresholds() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.alerts.list({ thresholds: true }),
    queryFn: () => monitoringService.getAlertThresholds(),
    staleTime: 10 * 60 * 1000, // 10 minutes - thresholds don't change frequently
  });
}

export function useAddAlertThreshold() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: {
      metric: string;
      threshold: number;
      operator: 'gt' | 'lt' | 'eq';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description?: string;
    }) => monitoringService.addAlertThreshold(data),
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

export function useUpdateAlertThreshold() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ metric, data }: {
      metric: string;
      data: {
        threshold?: number;
        operator?: 'gt' | 'lt' | 'eq';
        severity?: 'low' | 'medium' | 'high' | 'critical';
        description?: string;
      };
    }) => monitoringService.updateAlertThreshold(metric, data),
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

export function useRemoveAlertThreshold() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (metric: string) => monitoringService.removeAlertThreshold(metric),
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

// Dashboard data hooks
export function useMonitoringDashboard() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.dashboard(),
    queryFn: () => monitoringService.getDashboardData(),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

// Performance metrics hooks
export function usePerformanceMetrics(params?: {
  startTime?: string;
  endTime?: string;
  endpoint?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.monitoring.performance(params || {}),
    queryFn: () => monitoringService.getPerformanceMetrics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Error tracking hooks
export function useErrorLogs(params?: {
  page?: number;
  limit?: number;
  level?: 'error' | 'warn' | 'info';
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.monitoring.list({ errors: true, ...params }),
    queryFn: () => monitoringService.getErrorLogs(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Real-time monitoring hooks
export function useRealTimeMetrics() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiQuery({
    queryKey: queryKeys.monitoring.list({ realtime: true }),
    queryFn: async () => {
      const [systemMetrics, appMetrics] = await Promise.all([
        monitoringService.getSystemMetrics({ interval: '1m' }),
        monitoringService.getApplicationMetrics({ interval: '1m' })
      ]);
      
      if (systemMetrics.length > 0 && appMetrics.length > 0) {
        return { ...systemMetrics[0], ...appMetrics[0] };
      }
      return null;
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}

// Export data hooks
export function useExportMetrics() {
  return useApiMutation({
    mutationFn: (params: {
      startTime: string;
      endTime: string;
      format: 'csv' | 'json' | 'xlsx';
      metrics: ('system' | 'application' | 'alerts')[];
    }) => monitoringService.exportMetrics(params),
  });
}

// Utility hooks for dashboard widgets
export function useSystemHealth() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.health(),
    queryFn: async () => {
      const health = await monitoringService.getHealthStatus();
      return {
        status: health.status,
        uptime: health.uptime,
        checks: health.checks,
        lastCheck: health.timestamp,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useAlertSummary() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.alerts.list({ summary: true }),
    queryFn: async () => {
      const alerts = await monitoringService.getActiveAlerts();
      
      const summary = {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length,
      };

      return summary;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

export function useCurrentMetrics() {
  return useApiQuery({
    queryKey: queryKeys.monitoring.list({ current: true }),
    queryFn: async () => {
      const dashboard = await monitoringService.getDashboardData();
      return dashboard.currentMetrics;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

export function useMetricsTrends(timeRange: '1h' | '6h' | '24h' | '7d' = '24h') {
  const now = new Date();
  const startTime = new Date();
  
  switch (timeRange) {
    case '1h':
      startTime.setHours(now.getHours() - 1);
      break;
    case '6h':
      startTime.setHours(now.getHours() - 6);
      break;
    case '24h':
      startTime.setDate(now.getDate() - 1);
      break;
    case '7d':
      startTime.setDate(now.getDate() - 7);
      break;
  }

  return useApiQuery({
    queryKey: queryKeys.monitoring.list({ trends: true, timeRange }),
    queryFn: async () => {
      const dashboard = await monitoringService.getDashboardData();
      return dashboard.trends;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Bulk alert operations
export function useBulkAcknowledgeAlerts() {
  const { invalidateMonitoring } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: async (data: {
      alertIds: string[];
      acknowledgedBy: string;
      notes?: string;
    }) => {
      const results = await Promise.allSettled(
        data.alertIds.map(alertId => 
          monitoringService.acknowledgeAlert(alertId, {
            acknowledgedBy: data.acknowledgedBy,
            notes: data.notes,
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      invalidateMonitoring();
    },
  });
}