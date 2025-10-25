import { ScheduleDisruptionReportingService } from '../ScheduleDisruptionReportingService';
import { ScheduleEventRepository } from '../../database/repositories/ScheduleEventRepository';
import { ScheduleEventType } from '../../types';

// Mock the ScheduleEventRepository
jest.mock('../../database/repositories/ScheduleEventRepository');

describe('ScheduleDisruptionReportingService', () => {
  let service: ScheduleDisruptionReportingService;
  let mockScheduleEventRepository: jest.Mocked<ScheduleEventRepository>;

  beforeEach(() => {
    service = new ScheduleDisruptionReportingService();
    mockScheduleEventRepository = new ScheduleEventRepository() as jest.Mocked<ScheduleEventRepository>;
    
    // Replace the private repository with our mock
    (service as any).scheduleEventRepository = mockScheduleEventRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDisruptionFrequencyReport', () => {
    it('should generate comprehensive disruption frequency report', async () => {
      const mockDisruptionEvents = [
        {
          eventType: 'session_cancelled' as ScheduleEventType,
          sessionId: 'session-1',
          clientId: 'client-1',
          rbtId: 'rbt-1',
          reason: 'Client illness',
          createdAt: new Date('2024-10-01T10:00:00')
        },
        {
          eventType: 'session_rescheduled' as ScheduleEventType,
          sessionId: 'session-2',
          clientId: 'client-2',
          rbtId: 'rbt-2',
          reason: 'RBT unavailable',
          createdAt: new Date('2024-10-02T14:00:00')
        },
        {
          eventType: 'rbt_unavailable' as ScheduleEventType,
          rbtId: 'rbt-1',
          reason: 'Sick leave',
          createdAt: new Date('2024-10-03T09:00:00')
        }
      ];

      const mockSessionCount = [{ count: '50' }];
      const mockDisruptionData = [
        {
          event_type: 'session_cancelled' as ScheduleEventType,
          session_id: 'session-1',
          client_id: 'client-1',
          rbt_id: 'rbt-1',
          created_at: new Date('2024-10-01T10:00:00'),
          old_values: '{}',
          new_values: '{}',
          original_start_time: new Date('2024-10-01T10:00:00')
        }
      ];

      const mockTopReasons = [
        { reason: 'Client illness', count: '2' },
        { reason: 'RBT unavailable', count: '1' }
      ];

      const mockTimeDistribution = [
        { hour: '9', count: '1' },
        { hour: '10', count: '1' },
        { hour: '14', count: '1' }
      ];

      const mockDayDistribution = [
        { day_of_week: '1', count: '2' },
        { day_of_week: '2', count: '1' }
      ];

      mockScheduleEventRepository.query = jest.fn().mockResolvedValue(mockDisruptionEvents);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce(mockSessionCount) // Total sessions count
        .mockResolvedValueOnce(mockDisruptionData) // Disruption impact analysis
        .mockResolvedValueOnce([{ count: '1' }]) // First half trend
        .mockResolvedValueOnce([{ count: '2' }]) // Second half trend
        .mockResolvedValueOnce(mockTopReasons) // Top reasons
        .mockResolvedValueOnce(mockTimeDistribution) // Time distribution
        .mockResolvedValueOnce(mockDayDistribution); // Day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);

      expect(result.period.startDate).toEqual(startDate);
      expect(result.period.endDate).toEqual(endDate);
      expect(result.metrics.totalDisruptions).toBe(3);
      expect(result.metrics.disruptionsByType.session_cancelled).toBe(1);
      expect(result.metrics.disruptionsByType.session_rescheduled).toBe(1);
      expect(result.metrics.disruptionsByType.rbt_unavailable).toBe(1);
      expect(result.metrics.disruptionRate).toBeGreaterThan(0);
      expect(result.impactAnalysis).toBeDefined();
      expect(result.topDisruptionReasons).toBeDefined();
      expect(result.disruptionsByTimeOfDay).toBeDefined();
      expect(result.disruptionsByDayOfWeek).toBeDefined();
    });

    it('should handle period with no disruptions', async () => {
      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce([{ count: '10' }]) // Total sessions
        .mockResolvedValueOnce([]) // No disruption data
        .mockResolvedValueOnce([{ count: '0' }]) // First half trend
        .mockResolvedValueOnce([{ count: '0' }]) // Second half trend
        .mockResolvedValueOnce([]) // No top reasons
        .mockResolvedValueOnce([]) // No time distribution
        .mockResolvedValueOnce([]); // No day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);

      expect(result.metrics.totalDisruptions).toBe(0);
      expect(result.metrics.disruptionRate).toBe(0);
      expect(result.metrics.mostCommonReason).toBe('No disruptions');
      expect(result.topDisruptionReasons).toHaveLength(0);
    });
  });

  describe('generateClientDisruptionProfile', () => {
    it('should generate client disruption profile', async () => {
      const mockTotalSessions = [{ count: '20' }];
      const mockDisruptionEvents = [
        {
          eventType: 'session_cancelled' as ScheduleEventType,
          sessionId: 'session-1',
          clientId: 'client-123',
          rbtId: 'rbt-1',
          createdAt: new Date('2024-10-01T10:00:00')
        },
        {
          eventType: 'session_rescheduled' as ScheduleEventType,
          sessionId: 'session-2',
          clientId: 'client-123',
          rbtId: 'rbt-2',
          createdAt: new Date('2024-10-02T14:00:00')
        }
      ];

      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue(mockTotalSessions);
      mockScheduleEventRepository.findByClientId = jest.fn().mockResolvedValue(mockDisruptionEvents);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateClientDisruptionProfile('client-123', startDate, endDate);

      expect(result.clientId).toBe('client-123');
      expect(result.totalSessions).toBe(20);
      expect(result.disruptedSessions).toBeGreaterThan(0);
      expect(result.disruptionRate).toBeGreaterThan(0);
      expect(result.mostCommonDisruptionType).toBeDefined();
      expect(result.continuityImpact).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle client with no sessions', async () => {
      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue([{ count: '0' }]);
      mockScheduleEventRepository.findByClientId = jest.fn().mockResolvedValue([]);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateClientDisruptionProfile('client-123', startDate, endDate);

      expect(result.clientId).toBe('client-123');
      expect(result.totalSessions).toBe(0);
      expect(result.disruptedSessions).toBe(0);
      expect(result.disruptionRate).toBe(0);
    });

    it('should generate appropriate recommendations based on disruption patterns', async () => {
      const mockTotalSessions = [{ count: '10' }];
      const mockHighDisruptionEvents = Array.from({ length: 8 }, (_, i) => ({
        eventType: 'session_cancelled' as ScheduleEventType,
        sessionId: `session-${i}`,
        clientId: 'client-123',
        rbtId: 'rbt-1',
        createdAt: new Date(`2024-10-${i + 1}T10:00:00`)
      }));

      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue(mockTotalSessions);
      mockScheduleEventRepository.findByClientId = jest.fn().mockResolvedValue(mockHighDisruptionEvents);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateClientDisruptionProfile('client-123', startDate, endDate);

      expect(result.disruptionRate).toBeGreaterThan(20); // High disruption rate
      expect(result.recommendations).toContain(
        expect.stringContaining('High disruption rate detected')
      );
    });
  });

  describe('generateRbtDisruptionProfile', () => {
    it('should generate RBT disruption profile', async () => {
      const mockTotalSessions = [{ count: '15' }];
      const mockDisruptionEvents = [
        {
          eventType: 'rbt_unavailable' as ScheduleEventType,
          rbtId: 'rbt-123',
          createdAt: new Date('2024-10-01T10:00:00')
        },
        {
          eventType: 'session_cancelled' as ScheduleEventType,
          sessionId: 'session-1',
          rbtId: 'rbt-123',
          createdAt: new Date('2024-10-02T14:00:00')
        }
      ];

      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue(mockTotalSessions);
      mockScheduleEventRepository.findByRbtId = jest.fn().mockResolvedValue(mockDisruptionEvents);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateRbtDisruptionProfile('rbt-123', startDate, endDate);

      expect(result.rbtId).toBe('rbt-123');
      expect(result.totalSessions).toBe(15);
      expect(result.causedDisruptions).toBe(1); // rbt_unavailable events
      expect(result.affectedByDisruptions).toBe(1); // session_cancelled events
      expect(result.unavailabilityEvents).toBe(1);
      expect(result.disruptionRate).toBeGreaterThan(0);
      expect(result.reliability).toBeLessThan(100);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle RBT with no disruptions', async () => {
      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue([{ count: '10' }]);
      mockScheduleEventRepository.findByRbtId = jest.fn().mockResolvedValue([]);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateRbtDisruptionProfile('rbt-123', startDate, endDate);

      expect(result.rbtId).toBe('rbt-123');
      expect(result.totalSessions).toBe(10);
      expect(result.causedDisruptions).toBe(0);
      expect(result.affectedByDisruptions).toBe(0);
      expect(result.unavailabilityEvents).toBe(0);
      expect(result.disruptionRate).toBe(0);
      expect(result.reliability).toBe(100);
    });

    it('should generate recommendations for unreliable RBT', async () => {
      const mockTotalSessions = [{ count: '10' }];
      const mockHighDisruptionEvents = [
        ...Array.from({ length: 6 }, (_, i) => ({
          eventType: 'rbt_unavailable' as ScheduleEventType,
          rbtId: 'rbt-123',
          createdAt: new Date(`2024-10-${i + 1}T10:00:00`)
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          eventType: 'session_cancelled' as ScheduleEventType,
          sessionId: `session-${i}`,
          rbtId: 'rbt-123',
          createdAt: new Date(`2024-10-${i + 10}T10:00:00`)
        }))
      ];

      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue(mockTotalSessions);
      mockScheduleEventRepository.findByRbtId = jest.fn().mockResolvedValue(mockHighDisruptionEvents);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateRbtDisruptionProfile('rbt-123', startDate, endDate);

      expect(result.unavailabilityEvents).toBe(6);
      expect(result.causedDisruptions).toBe(6);
      expect(result.recommendations).toContain(
        expect.stringContaining('Frequent unavailability events')
      );
      expect(result.recommendations).toContain(
        expect.stringContaining('Multiple disruptions caused')
      );
    });
  });

  describe('getScheduleChangeAuditTrail', () => {
    it('should get audit trail for session', async () => {
      const mockAuditTrail = {
        entityType: 'session' as const,
        entityId: 'session-123',
        events: [
          {
            eventId: 'event-1',
            eventType: 'session_created' as ScheduleEventType,
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

      mockScheduleEventRepository.getAuditTrail = jest.fn().mockResolvedValue(mockAuditTrail);

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.getScheduleChangeAuditTrail('session', 'session-123', startDate, endDate);

      expect(result.entityType).toBe('session');
      expect(result.entityId).toBe('session-123');
      expect(result.events).toHaveLength(1);
      expect(result.totalEvents).toBe(1);
    });

    it('should get audit trail for RBT', async () => {
      const mockAuditTrail = {
        entityType: 'rbt' as const,
        entityId: 'rbt-123',
        events: [],
        totalEvents: 0,
        dateRange: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        }
      };

      mockScheduleEventRepository.getAuditTrail = jest.fn().mockResolvedValue(mockAuditTrail);

      const result = await service.getScheduleChangeAuditTrail('rbt', 'rbt-123');

      expect(result.entityType).toBe('rbt');
      expect(result.entityId).toBe('rbt-123');
      expect(result.events).toHaveLength(0);
    });

    it('should get audit trail for client', async () => {
      const mockAuditTrail = {
        entityType: 'client' as const,
        entityId: 'client-123',
        events: [
          {
            eventId: 'event-1',
            eventType: 'session_cancelled' as ScheduleEventType,
            timestamp: new Date('2024-10-01T10:00:00'),
            description: 'Session cancelled',
            affectedEntities: { clientId: 'client-123' },
            createdBy: 'user-123'
          }
        ],
        totalEvents: 1,
        dateRange: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-31')
        }
      };

      mockScheduleEventRepository.getAuditTrail = jest.fn().mockResolvedValue(mockAuditTrail);

      const result = await service.getScheduleChangeAuditTrail('client', 'client-123');

      expect(result.entityType).toBe('client');
      expect(result.entityId).toBe('client-123');
      expect(result.events).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockScheduleEventRepository.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      await expect(service.generateDisruptionFrequencyReport(startDate, endDate))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle invalid date ranges', async () => {
      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn().mockResolvedValue([]);

      const startDate = new Date('2024-10-31');
      const endDate = new Date('2024-10-01'); // End before start

      // The service should still work but with empty results
      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);
      expect(result).toBeDefined();
    });

    it('should handle malformed JSON in event data', async () => {
      const mockDisruptionData = [
        {
          event_type: 'session_cancelled' as ScheduleEventType,
          session_id: 'session-1',
          client_id: 'client-1',
          rbt_id: 'rbt-1',
          created_at: new Date('2024-10-01T10:00:00'),
          old_values: 'invalid json',
          new_values: '{"valid": "json"}',
          original_start_time: new Date('2024-10-01T10:00:00')
        }
      ];

      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce([{ count: '10' }]) // Total sessions
        .mockResolvedValueOnce(mockDisruptionData) // Disruption data with invalid JSON
        .mockResolvedValueOnce([{ count: '0' }]) // First half trend
        .mockResolvedValueOnce([{ count: '0' }]) // Second half trend
        .mockResolvedValueOnce([]) // Top reasons
        .mockResolvedValueOnce([]) // Time distribution
        .mockResolvedValueOnce([]); // Day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);
      expect(result).toBeDefined();
      expect(result.impactAnalysis).toBeDefined();
    });
  });

  describe('trend calculation', () => {
    it('should detect increasing disruption trend', async () => {
      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce([{ count: '10' }]) // Total sessions
        .mockResolvedValueOnce([]) // Disruption data
        .mockResolvedValueOnce([{ count: '2' }]) // First half: 2 disruptions
        .mockResolvedValueOnce([{ count: '8' }]) // Second half: 8 disruptions (400% increase)
        .mockResolvedValueOnce([]) // Top reasons
        .mockResolvedValueOnce([]) // Time distribution
        .mockResolvedValueOnce([]); // Day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);

      expect(result.metrics.trend).toBe('increasing');
    });

    it('should detect decreasing disruption trend', async () => {
      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce([{ count: '10' }]) // Total sessions
        .mockResolvedValueOnce([]) // Disruption data
        .mockResolvedValueOnce([{ count: '10' }]) // First half: 10 disruptions
        .mockResolvedValueOnce([{ count: '2' }]) // Second half: 2 disruptions (80% decrease)
        .mockResolvedValueOnce([]) // Top reasons
        .mockResolvedValueOnce([]) // Time distribution
        .mockResolvedValueOnce([]); // Day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);

      expect(result.metrics.trend).toBe('decreasing');
    });

    it('should detect stable disruption trend', async () => {
      mockScheduleEventRepository.query = jest.fn().mockResolvedValue([]);
      mockScheduleEventRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce([{ count: '10' }]) // Total sessions
        .mockResolvedValueOnce([]) // Disruption data
        .mockResolvedValueOnce([{ count: '5' }]) // First half: 5 disruptions
        .mockResolvedValueOnce([{ count: '6' }]) // Second half: 6 disruptions (20% increase - within stable range)
        .mockResolvedValueOnce([]) // Top reasons
        .mockResolvedValueOnce([]) // Time distribution
        .mockResolvedValueOnce([]); // Day distribution

      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateDisruptionFrequencyReport(startDate, endDate);

      expect(result.metrics.trend).toBe('stable');
    });
  });
});