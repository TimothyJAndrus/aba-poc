import { Request, Response } from 'express';
import { ReportingController } from '../ReportingController';
import { ContinuityMetricsService } from '../../services/ContinuityMetricsService';
import { ScheduleDisruptionReportingService } from '../../services/ScheduleDisruptionReportingService';

// Mock the services
jest.mock('../../services/ContinuityMetricsService');
jest.mock('../../services/ScheduleDisruptionReportingService');

describe('ReportingController', () => {
  let controller: ReportingController;
  let mockContinuityService: jest.Mocked<ContinuityMetricsService>;
  let mockDisruptionService: jest.Mocked<ScheduleDisruptionReportingService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ReportingController();
    
    mockContinuityService = new ContinuityMetricsService() as jest.Mocked<ContinuityMetricsService>;
    mockDisruptionService = new ScheduleDisruptionReportingService() as jest.Mocked<ScheduleDisruptionReportingService>;
    
    // Replace the private services with our mocks
    (controller as any).continuityMetricsService = mockContinuityService;
    (controller as any).disruptionReportingService = mockDisruptionService;

    mockRequest = {
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getClientContinuityScores', () => {
    it('should get continuity scores for a client', async () => {
      const mockScores = [
        {
          rbtId: 'rbt-1',
          clientId: 'client-123',
          score: 85,
          totalSessions: 10,
          recentSessions: 3,
          lastSessionDate: new Date('2024-10-20T10:00:00')
        },
        {
          rbtId: 'rbt-2',
          clientId: 'client-123',
          score: 65,
          totalSessions: 5,
          recentSessions: 1,
          lastSessionDate: new Date('2024-10-15T10:00:00')
        }
      ];

      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = { referenceDate: '2024-10-25T00:00:00.000Z' };
      mockContinuityService.getClientContinuityScores.mockResolvedValue(mockScores);

      await controller.getClientContinuityScores(mockRequest as Request, mockResponse as Response);

      expect(mockContinuityService.getClientContinuityScores).toHaveBeenCalledWith(
        'client-123',
        new Date('2024-10-25T00:00:00.000Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        clientId: 'client-123',
        referenceDate: new Date('2024-10-25T00:00:00.000Z'),
        continuityScores: mockScores,
        totalRbts: 2
      });
    });

    it('should handle invalid client ID', async () => {
      mockRequest.params = { clientId: 'invalid-id' };

      await controller.getClientContinuityScores(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Valid client ID is required'
      });
    });

    it('should handle invalid reference date', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = { referenceDate: 'invalid-date' };

      await controller.getClientContinuityScores(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid reference date format'
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockContinuityService.getClientContinuityScores.mockRejectedValue(new Error('Database error'));

      await controller.getClientContinuityScores(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Database error'
      });
    });
  });

  describe('generateContinuityReport', () => {
    it('should generate continuity report', async () => {
      const mockReport = {
        clientId: 'client-123',
        reportPeriod: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        },
        metrics: {
          clientId: 'client-123',
          totalSessions: 20,
          uniqueRbts: 3,
          averageContinuityScore: 75,
          primaryRbtId: 'rbt-1',
          primaryRbtPercentage: 60,
          continuityTrend: 'stable' as const
        },
        pairingFrequencies: [],
        continuityScores: [],
        recommendations: ['Consider increasing sessions with primary RBT']
      };

      mockRequest.body = {
        clientId: 'client-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockContinuityService.generateContinuityReport.mockResolvedValue(mockReport);

      await controller.generateContinuityReport(mockRequest as Request, mockResponse as Response);

      expect(mockContinuityService.generateContinuityReport).toHaveBeenCalledWith(
        'client-123',
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        report: mockReport
      });
    });

    it('should validate request body', async () => {
      mockRequest.body = {
        clientId: 'invalid-id',
        startDate: 'invalid-date',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      await controller.generateContinuityReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        details: expect.arrayContaining([
          'Valid client ID is required',
          'Invalid start date format'
        ])
      });
    });
  });

  describe('getPairingFrequencies', () => {
    it('should get pairing frequencies for a client', async () => {
      const mockFrequencies = [
        {
          rbtId: 'rbt-1',
          clientId: 'client-123',
          totalSessions: 12,
          percentage: 60,
          firstSessionDate: new Date('2024-09-01'),
          lastSessionDate: new Date('2024-10-20'),
          averageSessionsPerWeek: 2.4
        },
        {
          rbtId: 'rbt-2',
          clientId: 'client-123',
          totalSessions: 8,
          percentage: 40,
          firstSessionDate: new Date('2024-09-15'),
          lastSessionDate: new Date('2024-10-15'),
          averageSessionsPerWeek: 1.6
        }
      ];

      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = {
        startDate: '2024-09-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockContinuityService.calculatePairingFrequencies.mockResolvedValue(mockFrequencies);

      await controller.getPairingFrequencies(mockRequest as Request, mockResponse as Response);

      expect(mockContinuityService.calculatePairingFrequencies).toHaveBeenCalledWith(
        'client-123',
        new Date('2024-09-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        clientId: 'client-123',
        period: {
          startDate: new Date('2024-09-01T00:00:00.000Z'),
          endDate: new Date('2024-10-31T23:59:59.999Z')
        },
        pairingFrequencies: mockFrequencies,
        totalPairings: 2
      });
    });

    it('should validate query parameters', async () => {
      mockRequest.params = { clientId: 'client-123' };
      mockRequest.query = {
        startDate: '2024-10-31T00:00:00.000Z',
        endDate: '2024-10-01T23:59:59.999Z' // End before start
      };

      await controller.getPairingFrequencies(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Start date must be before end date'
      });
    });
  });

  describe('getBulkContinuityMetrics', () => {
    it('should get bulk continuity metrics', async () => {
      const mockMetrics = [
        {
          clientId: 'client-1',
          totalSessions: 20,
          uniqueRbts: 2,
          averageContinuityScore: 80,
          primaryRbtId: 'rbt-1',
          primaryRbtPercentage: 70,
          continuityTrend: 'improving' as const
        },
        {
          clientId: 'client-2',
          totalSessions: 15,
          uniqueRbts: 3,
          averageContinuityScore: 65,
          primaryRbtId: 'rbt-2',
          primaryRbtPercentage: 50,
          continuityTrend: 'stable' as const
        }
      ];

      mockRequest.body = {
        clientIds: ['client-1', 'client-2'],
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockContinuityService.getBulkContinuityMetrics.mockResolvedValue(mockMetrics);

      await controller.getBulkContinuityMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockContinuityService.getBulkContinuityMetrics).toHaveBeenCalledWith(
        ['client-1', 'client-2'],
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        period: {
          startDate: new Date('2024-10-01T00:00:00.000Z'),
          endDate: new Date('2024-10-31T23:59:59.999Z')
        },
        clientMetrics: mockMetrics,
        totalClients: 2
      });
    });

    it('should validate client IDs', async () => {
      mockRequest.body = {
        clientIds: ['invalid-id', 'client-2'],
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      await controller.getBulkContinuityMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        details: ['Client ID 1 is not a valid UUID']
      });
    });
  });

  describe('generateDisruptionFrequencyReport', () => {
    it('should generate disruption frequency report', async () => {
      const mockReport = {
        period: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        },
        metrics: {
          totalDisruptions: 15,
          disruptionsByType: {
            session_created: 0,
            session_cancelled: 8,
            session_rescheduled: 5,
            rbt_unavailable: 2,
            team_created: 0,
            team_updated: 0,
            team_ended: 0,
            rbt_added: 0,
            rbt_removed: 0,
            primary_changed: 0
          },
          disruptionRate: 12.5,
          averageDisruptionsPerWeek: 3.75,
          mostCommonReason: 'Client illness',
          trend: 'stable' as const
        },
        impactAnalysis: {
          affectedSessions: 13,
          affectedClients: 8,
          affectedRbts: 5,
          rescheduleSuccessRate: 62.5,
          averageRescheduleTime: 4.2,
          clientImpactScore: 25
        },
        topDisruptionReasons: [
          { reason: 'Client illness', count: 5, percentage: 33.33 },
          { reason: 'RBT unavailable', count: 3, percentage: 20 }
        ],
        disruptionsByTimeOfDay: [
          { hour: 9, count: 3 },
          { hour: 14, count: 5 }
        ],
        disruptionsByDayOfWeek: [
          { dayOfWeek: 1, dayName: 'Monday', count: 4 },
          { dayOfWeek: 2, dayName: 'Tuesday', count: 3 }
        ]
      };

      mockRequest.body = {
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockDisruptionService.generateDisruptionFrequencyReport.mockResolvedValue(mockReport);

      await controller.generateDisruptionFrequencyReport(mockRequest as Request, mockResponse as Response);

      expect(mockDisruptionService.generateDisruptionFrequencyReport).toHaveBeenCalledWith(
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        report: mockReport
      });
    });
  });

  describe('generateClientDisruptionProfile', () => {
    it('should generate client disruption profile', async () => {
      const mockProfile = {
        clientId: 'client-123',
        totalSessions: 20,
        disruptedSessions: 4,
        disruptionRate: 20,
        mostCommonDisruptionType: 'session_cancelled' as const,
        averageRescheduleTime: 3.5,
        continuityImpact: 40,
        recommendations: [
          'High disruption rate detected. Consider reviewing scheduling preferences.'
        ]
      };

      mockRequest.body = {
        clientId: 'client-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockDisruptionService.generateClientDisruptionProfile.mockResolvedValue(mockProfile);

      await controller.generateClientDisruptionProfile(mockRequest as Request, mockResponse as Response);

      expect(mockDisruptionService.generateClientDisruptionProfile).toHaveBeenCalledWith(
        'client-123',
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        profile: mockProfile
      });
    });
  });

  describe('generateRbtDisruptionProfile', () => {
    it('should generate RBT disruption profile', async () => {
      const mockProfile = {
        rbtId: 'rbt-123',
        totalSessions: 25,
        causedDisruptions: 2,
        affectedByDisruptions: 3,
        unavailabilityEvents: 2,
        disruptionRate: 8,
        reliability: 92,
        recommendations: []
      };

      mockRequest.body = {
        rbtId: 'rbt-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockDisruptionService.generateRbtDisruptionProfile.mockResolvedValue(mockProfile);

      await controller.generateRbtDisruptionProfile(mockRequest as Request, mockResponse as Response);

      expect(mockDisruptionService.generateRbtDisruptionProfile).toHaveBeenCalledWith(
        'rbt-123',
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        profile: mockProfile
      });
    });
  });

  describe('getAuditTrail', () => {
    it('should get audit trail for session', async () => {
      const mockAuditTrail = {
        entityType: 'session' as const,
        entityId: 'session-123',
        events: [
          {
            eventId: 'event-1',
            eventType: 'session_created' as const,
            timestamp: new Date('2024-10-01T10:00:00'),
            description: 'Session created',
            affectedEntities: { sessionId: 'session-123' },
            createdBy: 'user-123'
          }
        ],
        totalEvents: 1,
        dateRange: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        }
      };

      mockRequest.query = {
        entityType: 'session',
        entityId: 'session-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockDisruptionService.getScheduleChangeAuditTrail.mockResolvedValue(mockAuditTrail);

      await controller.getAuditTrail(mockRequest as Request, mockResponse as Response);

      expect(mockDisruptionService.getScheduleChangeAuditTrail).toHaveBeenCalledWith(
        'session',
        'session-123',
        new Date('2024-10-01T00:00:00.000Z'),
        new Date('2024-10-31T23:59:59.999Z')
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        auditTrail: mockAuditTrail
      });
    });

    it('should validate audit trail query parameters', async () => {
      mockRequest.query = {
        entityType: 'invalid-type',
        entityId: 'session-123'
      };

      await controller.getAuditTrail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        details: ['Valid entity type is required (session, rbt, or client)']
      });
    });
  });

  describe('getPerformanceDashboard', () => {
    it('should get performance dashboard data', async () => {
      const mockReport = {
        period: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        },
        metrics: {
          totalDisruptions: 10,
          disruptionsByType: {
            session_created: 0,
            session_cancelled: 6,
            session_rescheduled: 3,
            rbt_unavailable: 1,
            team_created: 0,
            team_updated: 0,
            team_ended: 0,
            rbt_added: 0,
            rbt_removed: 0,
            primary_changed: 0
          },
          disruptionRate: 8.3,
          averageDisruptionsPerWeek: 2.5,
          mostCommonReason: 'Client illness',
          trend: 'stable' as const
        },
        impactAnalysis: {
          affectedSessions: 9,
          affectedClients: 6,
          affectedRbts: 4,
          rescheduleSuccessRate: 75,
          averageRescheduleTime: 2.8,
          clientImpactScore: 18
        },
        topDisruptionReasons: [
          { reason: 'Client illness', count: 4, percentage: 40 }
        ],
        disruptionsByTimeOfDay: [
          { hour: 10, count: 3 }
        ],
        disruptionsByDayOfWeek: [
          { dayOfWeek: 1, dayName: 'Monday', count: 2 }
        ]
      };

      mockRequest.query = {
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      mockDisruptionService.generateDisruptionFrequencyReport.mockResolvedValue(mockReport);

      await controller.getPerformanceDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        dashboard: {
          period: mockReport.period,
          summary: {
            totalDisruptions: 10,
            disruptionRate: 8.3,
            averageDisruptionsPerWeek: 2.5,
            trend: 'stable',
            rescheduleSuccessRate: 75,
            affectedSessions: 9,
            affectedClients: 6,
            affectedRbts: 4
          },
          charts: {
            disruptionsByType: mockReport.metrics.disruptionsByType,
            disruptionsByTimeOfDay: mockReport.disruptionsByTimeOfDay,
            disruptionsByDayOfWeek: mockReport.disruptionsByDayOfWeek,
            topReasons: mockReport.topDisruptionReasons.slice(0, 5)
          }
        }
      });
    });

    it('should validate dashboard query parameters', async () => {
      mockRequest.query = {
        startDate: '2024-10-31T00:00:00.000Z',
        endDate: '2024-10-01T23:59:59.999Z' // End before start
      };

      await controller.getPerformanceDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Start date must be before end date'
      });
    });
  });

  describe('validation methods', () => {
    it('should validate continuity report request correctly', () => {
      const validRequest = {
        clientId: 'client-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      const result = (controller as any).validateContinuityReportRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid continuity report request', () => {
      const invalidRequest = {
        clientId: 'invalid-id',
        startDate: 'invalid-date',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      const result = (controller as any).validateContinuityReportRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid client ID is required');
      expect(result.errors).toContain('Invalid start date format');
    });

    it('should validate audit trail query correctly', () => {
      const validQuery = {
        entityType: 'session',
        entityId: 'session-123',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '2024-10-31T23:59:59.999Z'
      };

      const result = (controller as any).validateAuditTrailQuery(validQuery);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid audit trail query', () => {
      const invalidQuery = {
        entityType: 'invalid-type',
        entityId: 'invalid-id',
        startDate: '2024-10-31T00:00:00.000Z',
        endDate: '2024-10-01T23:59:59.999Z'
      };

      const result = (controller as any).validateAuditTrailQuery(invalidQuery);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid entity type is required (session, rbt, or client)');
      expect(result.errors).toContain('Valid entity ID is required');
      expect(result.errors).toContain('Start date must be before end date');
    });
  });
});