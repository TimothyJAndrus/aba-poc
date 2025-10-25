import { Request, Response } from 'express';
import { getMonitoringService } from '../services/MonitoringService';
import { logger } from '../utils/logger';

export class MonitoringController {
  private monitoringService = getMonitoringService();

  /**
   * Get system health status
   */
  getHealthStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthStatus = this.monitoringService.getHealthStatus();
      
      res.status(200).json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      logger.error('Error getting health status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get system metrics
   */
  getSystemMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const systemMetrics = this.monitoringService.getSystemMetrics();
      
      if (!systemMetrics) {
        res.status(404).json({
          success: false,
          error: 'System metrics not available'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: systemMetrics
      });
    } catch (error) {
      logger.error('Error getting system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get application metrics
   */
  getApplicationMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const applicationMetrics = this.monitoringService.getApplicationMetrics();
      
      if (!applicationMetrics) {
        res.status(404).json({
          success: false,
          error: 'Application metrics not available'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: applicationMetrics
      });
    } catch (error) {
      logger.error('Error getting application metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get active alerts
   */
  getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const activeAlerts = this.monitoringService.getActiveAlerts();
      
      res.status(200).json({
        success: true,
        data: {
          alerts: activeAlerts,
          count: activeAlerts.length
        }
      });
    } catch (error) {
      logger.error('Error getting active alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const allAlerts = this.monitoringService.getAllAlerts();
      
      const startIndex = parseInt(offset as string);
      const endIndex = startIndex + parseInt(limit as string);
      const paginatedAlerts = allAlerts.slice(startIndex, endIndex);
      
      res.status(200).json({
        success: true,
        data: {
          alerts: paginatedAlerts,
          total: allAlerts.length,
          limit: parseInt(limit as string),
          offset: startIndex
        }
      });
    } catch (error) {
      logger.error('Error getting all alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Add custom alert threshold
   */
  addAlertThreshold = async (req: Request, res: Response): Promise<void> => {
    try {
      const { metric, operator, value, severity, description } = req.body;

      if (!metric || !operator || value === undefined || !severity || !description) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: metric, operator, value, severity, description'
        });
        return;
      }

      const validOperators = ['gt', 'lt', 'eq', 'gte', 'lte'];
      if (!validOperators.includes(operator)) {
        res.status(400).json({
          success: false,
          error: 'Invalid operator. Must be one of: gt, lt, eq, gte, lte'
        });
        return;
      }

      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(severity)) {
        res.status(400).json({
          success: false,
          error: 'Invalid severity. Must be one of: low, medium, high, critical'
        });
        return;
      }

      const threshold = {
        metric,
        operator,
        value: parseFloat(value),
        severity,
        description
      };

      this.monitoringService.addAlertThreshold(threshold);

      res.status(201).json({
        success: true,
        message: 'Alert threshold added successfully',
        data: threshold
      });
    } catch (error) {
      logger.error('Error adding alert threshold', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Remove alert threshold
   */
  removeAlertThreshold = async (req: Request, res: Response): Promise<void> => {
    try {
      const { metric } = req.params;

      if (!metric) {
        res.status(400).json({
          success: false,
          error: 'Metric name is required'
        });
        return;
      }

      this.monitoringService.removeAlertThreshold(metric);

      res.status(200).json({
        success: true,
        message: 'Alert threshold removed successfully'
      });
    } catch (error) {
      logger.error('Error removing alert threshold', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get comprehensive monitoring dashboard data
   */
  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      const [healthStatus, systemMetrics, applicationMetrics, activeAlerts] = await Promise.all([
        this.monitoringService.getHealthStatus(),
        this.monitoringService.getSystemMetrics(),
        this.monitoringService.getApplicationMetrics(),
        this.monitoringService.getActiveAlerts()
      ]);

      res.status(200).json({
        success: true,
        data: {
          health: healthStatus,
          system: systemMetrics,
          application: applicationMetrics,
          alerts: {
            active: activeAlerts,
            count: activeAlerts.length
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}