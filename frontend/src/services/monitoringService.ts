import { apiService } from './api';
import type {
  SystemMetrics,
  ApplicationMetrics,
  SystemAlert,
  AlertThreshold,
} from '../types';

type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export class MonitoringService {
  // Health and status
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
      websocket: 'up' | 'down';
      notifications: 'up' | 'down';
    };
    uptime: number;
    timestamp: string;
  }> {
    return apiService.get('/monitoring/health');
  }

  // System metrics
  async getSystemMetrics(params?: {
    startTime?: string;
    endTime?: string;
    interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  }): Promise<SystemMetrics[]> {
    return apiService.get<SystemMetrics[]>(
      '/monitoring/metrics/system',
      params
    );
  }

  async getApplicationMetrics(params?: {
    startTime?: string;
    endTime?: string;
    interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  }): Promise<ApplicationMetrics[]> {
    return apiService.get<ApplicationMetrics[]>(
      '/monitoring/metrics/application',
      params
    );
  }

  // Alerts
  async getActiveAlerts(): Promise<SystemAlert[]> {
    return apiService.get<SystemAlert[]>('/monitoring/alerts/active');
  }

  async getAllAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    alerts: SystemAlert[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return apiService.get('/monitoring/alerts/all', params);
  }

  async acknowledgeAlert(
    alertId: string,
    data: {
      acknowledgedBy: string;
      notes?: string;
    }
  ): Promise<SystemAlert> {
    return apiService.post<SystemAlert>(
      `/monitoring/alerts/${alertId}/acknowledge`,
      data
    );
  }

  async resolveAlert(
    alertId: string,
    data: {
      resolvedBy: string;
      resolution: string;
    }
  ): Promise<SystemAlert> {
    return apiService.post<SystemAlert>(
      `/monitoring/alerts/${alertId}/resolve`,
      data
    );
  }

  // Alert thresholds
  async getAlertThresholds(): Promise<AlertThreshold[]> {
    return apiService.get<AlertThreshold[]>('/monitoring/alerts/thresholds');
  }

  async addAlertThreshold(data: {
    metric: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'eq';
    severity: AlertSeverity;
    description?: string;
  }): Promise<AlertThreshold> {
    return apiService.post<AlertThreshold>(
      '/monitoring/alerts/thresholds',
      data
    );
  }

  async updateAlertThreshold(
    metric: string,
    data: {
      threshold?: number;
      operator?: 'gt' | 'lt' | 'eq';
      severity: AlertSeverity;
      description?: string;
    }
  ): Promise<AlertThreshold> {
    return apiService.put<AlertThreshold>(
      `/monitoring/alerts/thresholds/${metric}`,
      data
    );
  }
  async removeAlertThreshold(metric: string): Promise<void> {
    return apiService.delete<void>(`/monitoring/alerts/thresholds/${metric}`);
  }

  // Dashboard data
  async getDashboardData(): Promise<{
    systemHealth: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      uptime: number;
      lastCheck: string;
    };
    currentMetrics: {
      system: SystemMetrics;
      application: ApplicationMetrics;
    };
    recentAlerts: SystemAlert[];
    trends: {
      responseTime: number[];
      errorRate: number[];
      throughput: number[];
      timestamps: string[];
    };
    summary: {
      totalUsers: number;
      activeSessions: number;
      systemLoad: number;
      memoryUsage: number;
      diskUsage: number;
    };
  }> {
    return apiService.get('/monitoring/dashboard');
  }

  // Performance metrics
  async getPerformanceMetrics(params?: {
    startTime?: string;
    endTime?: string;
    endpoint?: string;
  }): Promise<{
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
    byEndpoint: Record<
      string,
      {
        averageResponseTime: number;
        errorRate: number;
        requestCount: number;
      }
    >;
  }> {
    return apiService.get('/monitoring/performance', params);
  }

  // Error tracking
  async getErrorLogs(params?: {
    page?: number;
    limit?: number;
    level?: 'error' | 'warn' | 'info';
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{
    logs: {
      id: string;
      timestamp: string;
      level: 'error' | 'warn' | 'info';
      message: string;
      stack?: string;
      metadata?: Record<string, unknown>;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return apiService.get('/monitoring/errors', params);
  }

  // Real-time monitoring
  async subscribeToMetrics(
    callback: (metrics: SystemMetrics & ApplicationMetrics) => void
  ): Promise<() => void> {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll implement polling
    const interval = setInterval(async () => {
      try {
        const [systemMetrics, appMetrics] = await Promise.all([
          this.getSystemMetrics({ interval: '1m' }),
          this.getApplicationMetrics({ interval: '1m' }),
        ]);

        if (systemMetrics.length > 0 && appMetrics.length > 0) {
          callback({ ...systemMetrics[0], ...appMetrics[0] });
        }
      } catch (error) {
        console.error('Error fetching real-time metrics:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }

  // Export data
  async exportMetrics(params: {
    startTime: string;
    endTime: string;
    format: 'csv' | 'json' | 'xlsx';
    metrics: ('system' | 'application' | 'alerts')[];
  }): Promise<Blob> {
    const response = await fetch(
      `${apiService.getCurrentToken() ? 'authenticated' : 'public'}/monitoring/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiService.getCurrentToken() && {
            Authorization: `Bearer ${apiService.getCurrentToken()}`,
          }),
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export metrics');
    }

    return response.blob();
  }
}

export const monitoringService = new MonitoringService();
