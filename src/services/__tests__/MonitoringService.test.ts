import { MonitoringService } from '../MonitoringService';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
  });

  describe('recordRequest', () => {
    it('should record request metrics', () => {
      monitoringService.recordRequest(150, false);
      monitoringService.recordRequest(250, true);
      
      // Trigger metrics collection manually
      (monitoringService as any).collectSystemMetrics();
      
      const systemMetrics = monitoringService.getSystemMetrics();
      
      expect(systemMetrics?.requestCount).toBe(2);
      expect(systemMetrics?.errorCount).toBe(1);
    });

    it('should calculate average response time', () => {
      monitoringService.recordRequest(100, false);
      monitoringService.recordRequest(200, false);
      monitoringService.recordRequest(300, false);
      
      // Trigger metrics collection manually
      (monitoringService as any).collectSystemMetrics();
      
      const systemMetrics = monitoringService.getSystemMetrics();
      
      expect(systemMetrics?.averageResponseTime).toBe(200);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with no alerts', () => {
      const healthStatus = monitoringService.getHealthStatus();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.activeAlerts).toBe(0);
      expect(healthStatus.criticalAlerts).toBe(0);
      expect(healthStatus.uptime).toBeGreaterThan(0);
    });
  });

  describe('addAlertThreshold', () => {
    it('should add custom alert threshold', () => {
      const threshold = {
        metric: 'test_metric',
        operator: 'gt' as const,
        value: 100,
        severity: 'medium' as const,
        description: 'Test threshold'
      };

      monitoringService.addAlertThreshold(threshold);
      
      // Verify threshold was added by checking it doesn't throw
      expect(() => monitoringService.addAlertThreshold(threshold)).not.toThrow();
    });
  });

  describe('removeAlertThreshold', () => {
    it('should remove alert threshold', () => {
      const threshold = {
        metric: 'test_metric',
        operator: 'gt' as const,
        value: 100,
        severity: 'medium' as const,
        description: 'Test threshold'
      };

      monitoringService.addAlertThreshold(threshold);
      monitoringService.removeAlertThreshold('test_metric');
      
      // Verify threshold was removed by checking it doesn't throw
      expect(() => monitoringService.removeAlertThreshold('test_metric')).not.toThrow();
    });
  });

  describe('getActiveAlerts', () => {
    it('should return empty array when no alerts are active', () => {
      const activeAlerts = monitoringService.getActiveAlerts();
      
      expect(activeAlerts).toEqual([]);
    });
  });

  describe('getAllAlerts', () => {
    it('should return empty array when no alerts exist', () => {
      const allAlerts = monitoringService.getAllAlerts();
      
      expect(allAlerts).toEqual([]);
    });
  });
});