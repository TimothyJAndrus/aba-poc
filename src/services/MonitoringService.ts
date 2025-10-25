import { logger } from '../utils/logger';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
}

export interface ApplicationMetrics {
  schedulingMetrics: {
    totalSessions: number;
    scheduledSessions: number;
    cancelledSessions: number;
    completedSessions: number;
    averageSchedulingTime: number;
    conflictRate: number;
  };
  reschedulingMetrics: {
    totalReschedules: number;
    automaticReschedules: number;
    manualReschedules: number;
    averageReschedulingTime: number;
    successRate: number;
  };
  continuityMetrics: {
    averageContinuityScore: number;
    preferredRBTAssignmentRate: number;
    teamStabilityScore: number;
  };
  notificationMetrics: {
    totalNotifications: number;
    deliveredNotifications: number;
    failedNotifications: number;
    averageDeliveryTime: number;
  };
}

export interface PerformanceMetrics {
  databaseMetrics: {
    connectionPoolSize: number;
    activeConnections: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    memoryUsage: number;
  };
  apiMetrics: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
  };
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface Alert {
  id: string;
  metric: string;
  currentValue: number;
  threshold: AlertThreshold;
  triggeredAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  message: string;
}

export class MonitoringService {
  private metrics: Map<string, any> = new Map();
  private alerts: Alert[] = [];
  private alertThresholds: AlertThreshold[] = [];
  private startTime: Date = new Date();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.initializeDefaultThresholds();
    this.startMetricsCollection();
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'memory_usage_percentage',
        operator: 'gt',
        value: 85,
        severity: 'high',
        description: 'Memory usage exceeds 85%'
      },
      {
        metric: 'error_rate',
        operator: 'gt',
        value: 5,
        severity: 'medium',
        description: 'Error rate exceeds 5%'
      },
      {
        metric: 'average_response_time',
        operator: 'gt',
        value: 2000,
        severity: 'medium',
        description: 'Average response time exceeds 2 seconds'
      },
      {
        metric: 'scheduling_conflict_rate',
        operator: 'gt',
        value: 10,
        severity: 'high',
        description: 'Scheduling conflict rate exceeds 10%'
      },
      {
        metric: 'notification_failure_rate',
        operator: 'gt',
        value: 15,
        severity: 'medium',
        description: 'Notification failure rate exceeds 15%'
      },
      {
        metric: 'database_connection_pool_usage',
        operator: 'gt',
        value: 90,
        severity: 'critical',
        description: 'Database connection pool usage exceeds 90%'
      }
    ];
  }

  /**
   * Start collecting system metrics at regular intervals
   */
  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    const systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
    this.intervals.push(systemMetricsInterval);

    // Collect application metrics every 5 minutes
    const appMetricsInterval = setInterval(() => {
      this.collectApplicationMetrics();
    }, 300000);
    this.intervals.push(appMetricsInterval);

    // Check alerts every minute
    const alertsInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000);
    this.intervals.push(alertsInterval);
  }

  /**
   * Collect system-level metrics
   */
  private collectSystemMetrics(): void {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0, // Would be populated from actual connection tracking
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      averageResponseTime: this.calculateAverageResponseTime()
    };

    this.metrics.set('system', metrics);
    
    logger.info('System metrics collected', {
      memoryUsage: metrics.memoryUsage,
      uptime: metrics.uptime,
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount
    });
  }

  /**
   * Collect application-specific metrics
   */
  private async collectApplicationMetrics(): Promise<void> {
    try {
      // In a real implementation, these would query the database
      const metrics: ApplicationMetrics = {
        schedulingMetrics: {
          totalSessions: 0,
          scheduledSessions: 0,
          cancelledSessions: 0,
          completedSessions: 0,
          averageSchedulingTime: 0,
          conflictRate: 0
        },
        reschedulingMetrics: {
          totalReschedules: 0,
          automaticReschedules: 0,
          manualReschedules: 0,
          averageReschedulingTime: 0,
          successRate: 0
        },
        continuityMetrics: {
          averageContinuityScore: 0,
          preferredRBTAssignmentRate: 0,
          teamStabilityScore: 0
        },
        notificationMetrics: {
          totalNotifications: 0,
          deliveredNotifications: 0,
          failedNotifications: 0,
          averageDeliveryTime: 0
        }
      };

      this.metrics.set('application', metrics);
      
      logger.info('Application metrics collected', {
        schedulingMetrics: metrics.schedulingMetrics,
        reschedulingMetrics: metrics.reschedulingMetrics
      });
    } catch (error) {
      logger.error('Failed to collect application metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record a request for metrics tracking
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    
    if (isError) {
      this.errorCount++;
    }

    // Keep only last 1000 response times for memory efficiency
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * Check all metrics against alert thresholds
   */
  private checkAlerts(): void {
    const systemMetrics = this.metrics.get('system') as SystemMetrics;
    if (!systemMetrics) return;

    // Check memory usage
    const memoryUsagePercentage = (systemMetrics.memoryUsage.heapUsed / systemMetrics.memoryUsage.heapTotal) * 100;
    this.checkThreshold('memory_usage_percentage', memoryUsagePercentage);

    // Check error rate
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    this.checkThreshold('error_rate', errorRate);

    // Check average response time
    this.checkThreshold('average_response_time', systemMetrics.averageResponseTime);
  }

  /**
   * Check a specific metric against its threshold
   */
  private checkThreshold(metricName: string, currentValue: number): void {
    const threshold = this.alertThresholds.find(t => t.metric === metricName);
    if (!threshold) return;

    const shouldAlert = this.evaluateThreshold(currentValue, threshold);
    const existingAlert = this.alerts.find(a => a.metric === metricName && !a.resolved);

    if (shouldAlert && !existingAlert) {
      // Create new alert
      const alert: Alert = {
        id: `alert-${Date.now()}-${metricName}`,
        metric: metricName,
        currentValue,
        threshold,
        triggeredAt: new Date(),
        resolved: false,
        message: `${threshold.description}. Current value: ${currentValue}`
      };

      this.alerts.push(alert);
      this.sendAlert(alert);
    } else if (!shouldAlert && existingAlert) {
      // Resolve existing alert
      existingAlert.resolved = true;
      existingAlert.resolvedAt = new Date();
      
      logger.info('Alert resolved', {
        alertId: existingAlert.id,
        metric: existingAlert.metric,
        resolvedAt: existingAlert.resolvedAt
      });
    }
  }

  /**
   * Evaluate if a threshold condition is met
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      default: return false;
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(alert: Alert): void {
    logger.error('ALERT TRIGGERED', {
      alertId: alert.id,
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      severity: alert.threshold.severity,
      message: alert.message,
      triggeredAt: alert.triggeredAt
    });

    // In a real implementation, this would send notifications via email, Slack, etc.
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics | null {
    return this.metrics.get('system') || null;
  }

  /**
   * Get current application metrics
   */
  getApplicationMetrics(): ApplicationMetrics | null {
    return this.metrics.get('application') || null;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved ones)
   */
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Add custom alert threshold
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
    logger.info('Alert threshold added', { threshold });
  }

  /**
   * Remove alert threshold
   */
  removeAlertThreshold(metric: string): void {
    this.alertThresholds = this.alertThresholds.filter(t => t.metric !== metric);
    logger.info('Alert threshold removed', { metric });
  }

  /**
   * Get health status summary
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    activeAlerts: number;
    criticalAlerts: number;
    lastCheck: Date;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.threshold.severity === 'critical');
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 0) {
      status = 'warning';
    }

    return {
      status,
      uptime: process.uptime(),
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastCheck: new Date()
    };
  }

  /**
   * Clean up intervals and resources
   */
  cleanup(): void {
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals = [];
  }
}

// Singleton instance
let monitoringService: MonitoringService | null = null;

export const getMonitoringService = (): MonitoringService => {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
};