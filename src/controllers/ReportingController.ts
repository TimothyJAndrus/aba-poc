import { Request, Response } from 'express';
import { ContinuityMetricsService } from '../services/ContinuityMetricsService';
import { ScheduleDisruptionReportingService } from '../services/ScheduleDisruptionReportingService';
import { validateUUID, validateDateString } from '../utils/validation';

export interface ContinuityReportRequestBody {
  clientId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface BulkContinuityMetricsRequestBody {
  clientIds: string[];
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface DisruptionReportRequestBody {
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface ClientDisruptionProfileRequestBody {
  clientId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface RbtDisruptionProfileRequestBody {
  rbtId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface AuditTrailQuery {
  entityType: 'session' | 'rbt' | 'client';
  entityId: string;
  startDate: string | undefined; // ISO string
  endDate: string | undefined; // ISO string
}

/**
 * Controller for reporting and analytics API endpoints
 * Handles continuity metrics and schedule disruption reporting
 * Requirements: 2.3, 3.5 - Create endpoints for continuity reports and schedule analytics
 */
export class ReportingController {
  private continuityMetricsService: ContinuityMetricsService;
  private disruptionReportingService: ScheduleDisruptionReportingService;

  constructor() {
    this.continuityMetricsService = new ContinuityMetricsService();
    this.disruptionReportingService = new ScheduleDisruptionReportingService();
  }

  /**
   * GET /api/reports/continuity/client/:clientId
   * Get continuity scores for a specific client
   * Requirements: 2.2 - Track frequency of RBT-Client pairings
   */
  async getClientContinuityScores(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { referenceDate } = req.query;

      if (!clientId || !validateUUID(clientId)) {
        res.status(400).json({ error: 'Valid client ID is required' });
        return;
      }

      const refDate = referenceDate ? new Date(referenceDate as string) : new Date();
      if (referenceDate && isNaN(refDate.getTime())) {
        res.status(400).json({ error: 'Invalid reference date format' });
        return;
      }

      const continuityScores = await this.continuityMetricsService.getClientContinuityScores(
        clientId,
        refDate
      );

      res.status(200).json({
        success: true,
        clientId,
        referenceDate: refDate,
        continuityScores,
        totalRbts: continuityScores.length
      });

    } catch (error) {
      console.error('Error getting client continuity scores:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/reports/continuity/report
   * Generate comprehensive continuity report for a client
   * Requirements: 2.3 - Generate reports showing continuity preference metrics
   */
  async generateContinuityReport(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as ContinuityReportRequestBody;

      // Validate request body
      const validation = this.validateContinuityReportRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      const report = await this.continuityMetricsService.generateContinuityReport(
        body.clientId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        report
      });

    } catch (error) {
      console.error('Error generating continuity report:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/reports/continuity/pairing-frequency/:clientId
   * Get RBT-client pairing frequencies
   * Requirements: 2.2 - Track frequency of RBT-Client pairings
   */
  async getPairingFrequencies(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      if (!clientId || !validateUUID(clientId)) {
        res.status(400).json({ error: 'Valid client ID is required' });
        return;
      }

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (start >= end) {
        res.status(400).json({ error: 'Start date must be before end date' });
        return;
      }

      const pairingFrequencies = await this.continuityMetricsService.calculatePairingFrequencies(
        clientId,
        start,
        end
      );

      res.status(200).json({
        success: true,
        clientId,
        period: { startDate: start, endDate: end },
        pairingFrequencies,
        totalPairings: pairingFrequencies.length
      });

    } catch (error) {
      console.error('Error getting pairing frequencies:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/reports/continuity/bulk-metrics
   * Get continuity metrics for multiple clients
   * Requirements: 2.3 - Generate reports showing continuity preference metrics
   */
  async getBulkContinuityMetrics(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as BulkContinuityMetricsRequestBody;

      // Validate request body
      const validation = this.validateBulkContinuityMetricsRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      const metrics = await this.continuityMetricsService.getBulkContinuityMetrics(
        body.clientIds,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        period: { startDate, endDate },
        clientMetrics: metrics,
        totalClients: metrics.length
      });

    } catch (error) {
      console.error('Error getting bulk continuity metrics:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/reports/disruption/frequency
   * Generate disruption frequency report
   * Requirements: 3.5 - Implement disruption frequency and impact analysis
   */
  async generateDisruptionFrequencyReport(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as DisruptionReportRequestBody;

      // Validate request body
      const validation = this.validateDisruptionReportRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      const report = await this.disruptionReportingService.generateDisruptionFrequencyReport(
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        report
      });

    } catch (error) {
      console.error('Error generating disruption frequency report:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/reports/disruption/client-profile
   * Generate client disruption profile
   * Requirements: 3.5 - Analyze impact of disruptions on individual clients
   */
  async generateClientDisruptionProfile(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as ClientDisruptionProfileRequestBody;

      // Validate request body
      const validation = this.validateClientDisruptionProfileRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      const profile = await this.disruptionReportingService.generateClientDisruptionProfile(
        body.clientId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        profile
      });

    } catch (error) {
      console.error('Error generating client disruption profile:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/reports/disruption/rbt-profile
   * Generate RBT disruption profile
   * Requirements: 4.5 - Analyze RBT-related disruptions
   */
  async generateRbtDisruptionProfile(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as RbtDisruptionProfileRequestBody;

      // Validate request body
      const validation = this.validateRbtDisruptionProfileRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      const profile = await this.disruptionReportingService.generateRbtDisruptionProfile(
        body.rbtId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        profile
      });

    } catch (error) {
      console.error('Error generating RBT disruption profile:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/reports/audit-trail
   * Get audit trail for schedule changes
   * Requirements: 3.5 - Create audit trail queries for schedule changes
   */
  async getAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, entityId, startDate, endDate } = req.query;

      // Validate query parameters
      const validation = this.validateAuditTrailQuery({ 
        entityType: entityType as 'session' | 'rbt' | 'client', 
        entityId: entityId as string, 
        startDate: startDate as string | undefined, 
        endDate: endDate as string | undefined 
      });
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const auditTrail = await this.disruptionReportingService.getScheduleChangeAuditTrail(
        entityType as 'session' | 'rbt' | 'client',
        entityId as string,
        start,
        end
      );

      res.status(200).json({
        success: true,
        auditTrail
      });

    } catch (error) {
      console.error('Error getting audit trail:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/reports/dashboard/performance
   * Get performance dashboard data
   * Requirements: 2.3, 3.5 - Implement schedule analytics and performance dashboards
   */
  async getPerformanceDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (start >= end) {
        res.status(400).json({ error: 'Start date must be before end date' });
        return;
      }

      // Get disruption frequency report for dashboard
      const disruptionReport = await this.disruptionReportingService.generateDisruptionFrequencyReport(
        start,
        end
      );

      // Calculate summary statistics
      const dashboardData = {
        period: { startDate: start, endDate: end },
        summary: {
          totalDisruptions: disruptionReport.metrics.totalDisruptions,
          disruptionRate: disruptionReport.metrics.disruptionRate,
          averageDisruptionsPerWeek: disruptionReport.metrics.averageDisruptionsPerWeek,
          trend: disruptionReport.metrics.trend,
          rescheduleSuccessRate: disruptionReport.impactAnalysis.rescheduleSuccessRate,
          affectedSessions: disruptionReport.impactAnalysis.affectedSessions,
          affectedClients: disruptionReport.impactAnalysis.affectedClients,
          affectedRbts: disruptionReport.impactAnalysis.affectedRbts
        },
        charts: {
          disruptionsByType: disruptionReport.metrics.disruptionsByType,
          disruptionsByTimeOfDay: disruptionReport.disruptionsByTimeOfDay,
          disruptionsByDayOfWeek: disruptionReport.disruptionsByDayOfWeek,
          topReasons: disruptionReport.topDisruptionReasons.slice(0, 5)
        }
      };

      res.status(200).json({
        success: true,
        dashboard: dashboardData
      });

    } catch (error) {
      console.error('Error getting performance dashboard:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validates continuity report request
   */
  private validateContinuityReportRequest(body: ContinuityReportRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.clientId || !validateUUID(body.clientId)) {
      errors.push('Valid client ID is required');
    }

    if (!body.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (!body.endDate) {
      errors.push('End date is required');
    } else {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates bulk continuity metrics request
   */
  private validateBulkContinuityMetricsRequest(body: BulkContinuityMetricsRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(body.clientIds) || body.clientIds.length === 0) {
      errors.push('At least one client ID is required');
    } else {
      body.clientIds.forEach((clientId, index) => {
        if (!validateUUID(clientId)) {
          errors.push(`Client ID ${index + 1} is not a valid UUID`);
        }
      });
    }

    if (!body.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (!body.endDate) {
      errors.push('End date is required');
    } else {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates disruption report request
   */
  private validateDisruptionReportRequest(body: DisruptionReportRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (!body.endDate) {
      errors.push('End date is required');
    } else {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates client disruption profile request
   */
  private validateClientDisruptionProfileRequest(body: ClientDisruptionProfileRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.clientId || !validateUUID(body.clientId)) {
      errors.push('Valid client ID is required');
    }

    if (!body.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (!body.endDate) {
      errors.push('End date is required');
    } else {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates RBT disruption profile request
   */
  private validateRbtDisruptionProfileRequest(body: RbtDisruptionProfileRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.rbtId || !validateUUID(body.rbtId)) {
      errors.push('Valid RBT ID is required');
    }

    if (!body.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (!body.endDate) {
      errors.push('End date is required');
    } else {
      const endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates audit trail query
   */
  private validateAuditTrailQuery(query: AuditTrailQuery): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query.entityType || !['session', 'rbt', 'client'].includes(query.entityType)) {
      errors.push('Valid entity type is required (session, rbt, or client)');
    }

    if (!query.entityId || !validateUUID(query.entityId)) {
      errors.push('Valid entity ID is required');
    }

    if (query.startDate) {
      const startDate = new Date(query.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    if (query.startDate && query.endDate) {
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}