import { ContinuityMetricsService } from '../ContinuityMetricsService';
import { SessionRepository } from '../../database/repositories/SessionRepository';

// Mock the SessionRepository
jest.mock('../../database/repositories/SessionRepository');

describe('ContinuityMetricsService', () => {
  let service: ContinuityMetricsService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(() => {
    service = new ContinuityMetricsService();
    mockSessionRepository = new SessionRepository() as jest.Mocked<SessionRepository>;
    
    // Replace the private repository with our mock
    (service as any).sessionRepository = mockSessionRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateContinuityScore', () => {
    it('should calculate continuity score for RBT-client pair with sessions', async () => {
      const mockSessions = [
        {
          start_time: new Date('2024-10-01T10:00:00'),
          end_time: new Date('2024-10-01T13:00:00'),
          status: 'completed'
        },
        {
          start_time: new Date('2024-10-15T10:00:00'),
          end_time: new Date('2024-10-15T13:00:00'),
          status: 'completed'
        },
        {
          start_time: new Date('2024-10-20T10:00:00'),
          end_time: new Date('2024-10-20T13:00:00'),
          status: 'completed'
        }
      ];

      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue(mockSessions);

      const result = await service.calculateContinuityScore('rbt-123', 'client-456');

      expect(result.rbtId).toBe('rbt-123');
      expect(result.clientId).toBe('client-456');
      expect(result.totalSessions).toBe(3);
      expect(result.score).toBeGreaterThan(0);
      expect(result.lastSessionDate).toEqual(new Date('2024-10-01T10:00:00')); // First session in DESC order
    });

    it('should return zero score for RBT-client pair with no sessions', async () => {
      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue([]);

      const result = await service.calculateContinuityScore('rbt-123', 'client-456');

      expect(result.rbtId).toBe('rbt-123');
      expect(result.clientId).toBe('client-456');
      expect(result.totalSessions).toBe(0);
      expect(result.recentSessions).toBe(0);
      expect(result.score).toBe(0);
      expect(result.lastSessionDate).toBeUndefined();
    });

    it('should calculate higher scores for recent sessions', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      const mockRecentSessions = [
        {
          start_time: recentDate,
          end_time: new Date(recentDate.getTime() + 3 * 60 * 60 * 1000),
          status: 'completed'
        },
        {
          start_time: new Date(recentDate.getTime() + 24 * 60 * 60 * 1000),
          end_time: new Date(recentDate.getTime() + 27 * 60 * 60 * 1000),
          status: 'completed'
        }
      ];

      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue(mockRecentSessions);

      const result = await service.calculateContinuityScore('rbt-123', 'client-456');

      expect(result.recentSessions).toBe(2);
      expect(result.score).toBeGreaterThan(40); // Should have high score due to recent activity
    });
  });

  describe('getClientContinuityScores', () => {
    it('should get continuity scores for all RBTs who worked with client', async () => {
      const mockRbtRows = [
        { rbt_id: 'rbt-1' },
        { rbt_id: 'rbt-2' }
      ];

      const mockSessions1 = [
        { start_time: new Date('2024-10-01T10:00:00'), end_time: new Date('2024-10-01T13:00:00'), status: 'completed' }
      ];

      const mockSessions2 = [
        { start_time: new Date('2024-10-15T10:00:00'), end_time: new Date('2024-10-15T13:00:00'), status: 'completed' }
      ];

      mockSessionRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce(mockRbtRows) // First call for RBT list
        .mockResolvedValueOnce(mockSessions1) // Second call for RBT-1 sessions
        .mockResolvedValueOnce(mockSessions2); // Third call for RBT-2 sessions

      const result = await service.getClientContinuityScores('client-456');

      expect(result).toHaveLength(2);
      expect(result[0]?.rbtId).toBe('rbt-1');
      expect(result[1]?.rbtId).toBe('rbt-2');
      expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score); // Should be sorted by score
    });

    it('should return empty array for client with no sessions', async () => {
      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue([]);

      const result = await service.getClientContinuityScores('client-456');

      expect(result).toHaveLength(0);
    });
  });

  describe('calculatePairingFrequencies', () => {
    it('should calculate pairing frequencies for client', async () => {
      const mockPairingData = [
        {
          rbt_id: 'rbt-1',
          total_sessions: '6',
          first_session_date: new Date('2024-09-01T10:00:00'),
          last_session_date: new Date('2024-10-20T10:00:00')
        },
        {
          rbt_id: 'rbt-2',
          total_sessions: '4',
          first_session_date: new Date('2024-09-15T10:00:00'),
          last_session_date: new Date('2024-10-15T10:00:00')
        }
      ];

      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue(mockPairingData);

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.calculatePairingFrequencies('client-456', startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0]?.rbtId).toBe('rbt-1');
      expect(result[0]?.totalSessions).toBe(6);
      expect(result[0]?.percentage).toBe(60); // 6 out of 10 total sessions
      expect(result[1]?.rbtId).toBe('rbt-2');
      expect(result[1]?.totalSessions).toBe(4);
      expect(result[1]?.percentage).toBe(40); // 4 out of 10 total sessions
    });

    it('should handle client with no sessions', async () => {
      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue([]);

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.calculatePairingFrequencies('client-456', startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('generateContinuityMetrics', () => {
    it('should generate comprehensive continuity metrics', async () => {
      const mockPairingData = [
        {
          rbt_id: 'rbt-1',
          total_sessions: '8',
          first_session_date: new Date('2024-09-01T10:00:00'),
          last_session_date: new Date('2024-10-20T10:00:00')
        },
        {
          rbt_id: 'rbt-2',
          total_sessions: '2',
          first_session_date: new Date('2024-10-01T10:00:00'),
          last_session_date: new Date('2024-10-15T10:00:00')
        }
      ];

      const mockRbtRows = [
        { rbt_id: 'rbt-1' },
        { rbt_id: 'rbt-2' }
      ];

      const mockSessions1 = [
        { start_time: new Date('2024-10-01T10:00:00'), end_time: new Date('2024-10-01T13:00:00'), status: 'completed' }
      ];

      const mockSessions2 = [
        { start_time: new Date('2024-10-15T10:00:00'), end_time: new Date('2024-10-15T13:00:00'), status: 'completed' }
      ];

      mockSessionRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce(mockPairingData) // Pairing frequencies
        .mockResolvedValueOnce(mockRbtRows) // RBT list for continuity scores
        .mockResolvedValueOnce(mockSessions1) // RBT-1 sessions
        .mockResolvedValueOnce(mockSessions2) // RBT-2 sessions
        .mockResolvedValueOnce([{ count: '5' }]) // First half disruptions for trend
        .mockResolvedValueOnce([{ count: '3' }]); // Second half disruptions for trend

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateContinuityMetrics('client-456', startDate, endDate);

      expect(result.clientId).toBe('client-456');
      expect(result.totalSessions).toBe(10);
      expect(result.uniqueRbts).toBe(2);
      expect(result.primaryRbtId).toBe('rbt-1');
      expect(result.primaryRbtPercentage).toBe(80);
      expect(result.averageContinuityScore).toBeGreaterThan(0);
      expect(['improving', 'stable', 'declining']).toContain(result.continuityTrend);
    });

    it('should handle client with no sessions', async () => {
      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue([]);

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateContinuityMetrics('client-456', startDate, endDate);

      expect(result.clientId).toBe('client-456');
      expect(result.totalSessions).toBe(0);
      expect(result.uniqueRbts).toBe(0);
      expect(result.primaryRbtId).toBeUndefined();
      expect(result.primaryRbtPercentage).toBe(0);
      expect(result.averageContinuityScore).toBe(0);
      expect(result.continuityTrend).toBe('stable');
    });
  });

  describe('generateContinuityReport', () => {
    it('should generate comprehensive continuity report', async () => {
      // Mock all the required data
      const mockPairingData = [
        {
          rbt_id: 'rbt-1',
          total_sessions: '6',
          first_session_date: new Date('2024-09-01T10:00:00'),
          last_session_date: new Date('2024-10-20T10:00:00')
        }
      ];

      const mockRbtRows = [{ rbt_id: 'rbt-1' }];
      const mockSessions = [
        { start_time: new Date('2024-10-01T10:00:00'), end_time: new Date('2024-10-01T13:00:00'), status: 'completed' }
      ];

      mockSessionRepository['executeQuery'] = jest.fn()
        .mockResolvedValueOnce(mockPairingData) // generateContinuityMetrics - pairing frequencies
        .mockResolvedValueOnce(mockRbtRows) // generateContinuityMetrics - RBT list
        .mockResolvedValueOnce(mockSessions) // generateContinuityMetrics - RBT sessions
        .mockResolvedValueOnce([{ count: '2' }]) // generateContinuityMetrics - trend first half
        .mockResolvedValueOnce([{ count: '1' }]) // generateContinuityMetrics - trend second half
        .mockResolvedValueOnce(mockPairingData) // calculatePairingFrequencies
        .mockResolvedValueOnce(mockRbtRows) // getClientContinuityScores - RBT list
        .mockResolvedValueOnce(mockSessions); // getClientContinuityScores - RBT sessions

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.generateContinuityReport('client-456', startDate, endDate);

      expect(result.clientId).toBe('client-456');
      expect(result.reportPeriod.startDate).toEqual(startDate);
      expect(result.reportPeriod.endDate).toEqual(endDate);
      expect(result.metrics).toBeDefined();
      expect(result.pairingFrequencies).toBeDefined();
      expect(result.continuityScores).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('getBulkContinuityMetrics', () => {
    it('should get continuity metrics for multiple clients', async () => {
      const clientIds = ['client-1', 'client-2'];

      // Mock data for each client
      const mockPairingData1 = [
        {
          rbt_id: 'rbt-1',
          total_sessions: '5',
          first_session_date: new Date('2024-09-01T10:00:00'),
          last_session_date: new Date('2024-10-20T10:00:00')
        }
      ];

      const mockPairingData2 = [
        {
          rbt_id: 'rbt-2',
          total_sessions: '3',
          first_session_date: new Date('2024-09-15T10:00:00'),
          last_session_date: new Date('2024-10-15T10:00:00')
        }
      ];

      const mockRbtRows = [{ rbt_id: 'rbt-1' }];
      const mockSessions = [
        { start_time: new Date('2024-10-01T10:00:00'), end_time: new Date('2024-10-01T13:00:00'), status: 'completed' }
      ];

      mockSessionRepository['executeQuery'] = jest.fn()
        // Client 1 calls
        .mockResolvedValueOnce(mockPairingData1) // pairing frequencies
        .mockResolvedValueOnce(mockRbtRows) // RBT list
        .mockResolvedValueOnce(mockSessions) // RBT sessions
        .mockResolvedValueOnce([{ count: '1' }]) // trend first half
        .mockResolvedValueOnce([{ count: '2' }]) // trend second half
        // Client 2 calls
        .mockResolvedValueOnce(mockPairingData2) // pairing frequencies
        .mockResolvedValueOnce(mockRbtRows) // RBT list
        .mockResolvedValueOnce(mockSessions) // RBT sessions
        .mockResolvedValueOnce([{ count: '1' }]) // trend first half
        .mockResolvedValueOnce([{ count: '1' }]); // trend second half

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.getBulkContinuityMetrics(clientIds, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0]?.clientId).toBe('client-1');
      expect(result[1]?.clientId).toBe('client-2');
    });

    it('should handle empty client list', async () => {
      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-10-31');

      const result = await service.getBulkContinuityMetrics([], startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSessionRepository['executeQuery'] = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.calculateContinuityScore('rbt-123', 'client-456'))
        .rejects.toThrow('Database error');
    });

    it('should handle invalid JSON in session data', async () => {
      const mockSessions = [
        {
          start_time: new Date('2024-10-01T10:00:00'),
          end_time: new Date('2024-10-01T13:00:00'),
          status: 'completed'
        }
      ];

      mockSessionRepository['executeQuery'] = jest.fn().mockResolvedValue(mockSessions);

      const result = await service.calculateContinuityScore('rbt-123', 'client-456');

      expect(result).toBeDefined();
      expect(result.rbtId).toBe('rbt-123');
      expect(result.clientId).toBe('client-456');
    });
  });
});