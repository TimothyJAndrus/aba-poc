import { SessionCancellationService, CancelSessionRequest } from '../SessionCancellationService';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import { ScheduleEventRepository } from '../../database/repositories/ScheduleEventRepository';
import { TeamRepository } from '../../database/repositories/TeamRepository';
import { RBTRepository } from '../../database/repositories/RBTRepository';
import { SessionSchedulingService } from '../SessionSchedulingService';
import { ContinuityPreferenceService } from '../ContinuityPreferenceService';
import { Session } from '../../models/Session';
import { Team } from '../../models/Team';
import { RBT } from '../../models/RBT';
import { getDatabase } from '../../database/connection';

// Mock the dependencies
jest.mock('../../database/repositories/SessionRepository');
jest.mock('../../database/repositories/ScheduleEventRepository');
jest.mock('../../database/repositories/TeamRepository');
jest.mock('../../database/repositories/RBTRepository');
jest.mock('../SessionSchedulingService');
jest.mock('../ContinuityPreferenceService');
jest.mock('../../database/connection');

describe('SessionCancellationService', () => {
  let service: SessionCancellationService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;
  let mockScheduleEventRepository: jest.Mocked<ScheduleEventRepository>;
  let mockTeamRepository: jest.Mocked<TeamRepository>;
  let mockRBTRepository: jest.Mocked<RBTRepository>;
  let mockSchedulingService: jest.Mocked<SessionSchedulingService>;
  let mockContinuityService: jest.Mocked<ContinuityPreferenceService>;
  let mockConnection: any;

  const mockSession: Session = {
    id: 'session-123',
    clientId: 'client-123',
    rbtId: 'rbt-123',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T13:00:00Z'),
    status: 'scheduled',
    location: 'Clinic Room A',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-123'
  };

  const mockTeam: Team = {
    id: 'team-123',
    clientId: 'client-123',
    rbtIds: ['rbt-123', 'rbt-456'],
    primaryRbtId: 'rbt-123',
    effectiveDate: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-123'
  };

  const mockRBT: RBT = {
    id: 'rbt-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-0123',
    role: 'rbt',
    licenseNumber: 'RBT-12345',
    qualifications: ['ABA Therapy'],
    hourlyRate: 25.00,
    isActive: true,
    hireDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Create mocked dependencies
    mockSessionRepository = new SessionRepository() as jest.Mocked<SessionRepository>;
    mockScheduleEventRepository = new ScheduleEventRepository() as jest.Mocked<ScheduleEventRepository>;
    mockTeamRepository = new TeamRepository() as jest.Mocked<TeamRepository>;
    mockRBTRepository = new RBTRepository() as jest.Mocked<RBTRepository>;
    mockSchedulingService = {} as jest.Mocked<SessionSchedulingService>;
    mockContinuityService = new ContinuityPreferenceService() as jest.Mocked<ContinuityPreferenceService>;

    // Mock database connection
    mockConnection = {
      query: jest.fn(),
      release: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue({
      getClient: jest.fn().mockResolvedValue(mockConnection)
    });

    // Initialize service
    service = new SessionCancellationService(
      mockSessionRepository,
      mockScheduleEventRepository,
      mockTeamRepository,
      mockRBTRepository,
      mockSchedulingService,
      mockContinuityService
    );

    // Setup default mock responses
    mockConnection.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cancelSession', () => {
    const cancelRequest: CancelSessionRequest = {
      sessionId: 'session-123',
      reason: 'Client illness',
      cancelledBy: 'user-123',
      findAlternatives: true,
      maxAlternatives: 5
    };

    it('should successfully cancel a session', async () => {
      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        status: 'cancelled',
        cancellationReason: 'Client illness'
      });
      mockScheduleEventRepository.logSessionCancelled.mockResolvedValue({
        id: 'event-123',
        eventType: 'session_cancelled',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        reason: 'Client illness',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      });

      const result = await service.cancelSession(cancelRequest);

      expect(result.success).toBe(true);
      expect(result.cancelledSession?.status).toBe('cancelled');
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        'session-123',
        {
          status: 'cancelled',
          cancellationReason: 'Client illness',
          updatedBy: 'user-123'
        },
        mockConnection
      );
    });

    it('should return error if session not found', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      const result = await service.cancelSession(cancelRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session not found');
    });

    it('should return error if session already cancelled', async () => {
      const cancelledSession = { ...mockSession, status: 'cancelled' as const };
      mockSessionRepository.findById.mockResolvedValue(cancelledSession);

      const result = await service.cancelSession(cancelRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session is already cancelled');
    });

    it('should return error if session is completed', async () => {
      const completedSession = { ...mockSession, status: 'completed' as const };
      mockSessionRepository.findById.mockResolvedValue(completedSession);

      const result = await service.cancelSession(cancelRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot cancel a completed session');
    });

    it('should find alternative opportunities when requested', async () => {
      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        status: 'cancelled'
      });
      mockScheduleEventRepository.logSessionCancelled.mockResolvedValue({
        id: 'event-123',
        eventType: 'session_cancelled',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        reason: 'Client illness',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      });
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockTeamRepository.findByRbtId.mockResolvedValue([mockTeam]);
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([]);
      mockContinuityService.calculateContinuityScore.mockReturnValue({
        rbtId: 'rbt-456',
        clientId: 'client-456',
        score: 85,
        totalSessions: 10,
        recentSessions: 3
      });

      const result = await service.cancelSession(cancelRequest);

      expect(result.success).toBe(true);
      expect(result.alternativeOpportunities).toBeDefined();
    });
  });

  describe('findAlternativeOpportunities', () => {
    it('should find alternative opportunities for cancelled session', async () => {
      // Setup mocks
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockTeamRepository.findByRbtId.mockResolvedValue([mockTeam]);
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([]);
      mockContinuityService.calculateContinuityScore.mockReturnValue({
        rbtId: 'rbt-456',
        clientId: 'client-456',
        score: 75,
        totalSessions: 8,
        recentSessions: 2
      });

      const opportunities = await service.findAlternativeOpportunities(mockSession, 3);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]?.availableTimeSlot.rbtId).toBe('rbt-123');
    });

    it('should return empty array if RBT not found', async () => {
      mockRBTRepository.findById.mockResolvedValue(null);

      const opportunities = await service.findAlternativeOpportunities(mockSession, 3);

      expect(opportunities).toHaveLength(0);
    });

    it('should return empty array if RBT is inactive', async () => {
      const inactiveRBT = { ...mockRBT, isActive: false };
      mockRBTRepository.findById.mockResolvedValue(inactiveRBT);

      const opportunities = await service.findAlternativeOpportunities(mockSession, 3);

      expect(opportunities).toHaveLength(0);
    });
  });

  describe('getCancellationStats', () => {
    it('should return cancellation statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockEvents = [
        {
          id: 'event-1',
          eventType: 'session_cancelled' as const,
          reason: 'Client illness',
          rbtId: 'rbt-123',
          clientId: 'client-123',
          oldValues: { startTime: new Date('2024-01-15T10:00:00Z') },
          createdAt: new Date('2024-01-14T09:00:00Z'),
          updatedAt: new Date('2024-01-14T09:00:00Z'),
          createdBy: 'user-123'
        },
        {
          id: 'event-2',
          eventType: 'session_cancelled' as const,
          reason: 'RBT unavailable',
          rbtId: 'rbt-456',
          clientId: 'client-456',
          oldValues: { startTime: new Date('2024-01-20T14:00:00Z') },
          createdAt: new Date('2024-01-19T10:00:00Z'),
          updatedAt: new Date('2024-01-19T10:00:00Z'),
          createdBy: 'user-456'
        }
      ];

      mockScheduleEventRepository.query.mockResolvedValue(mockEvents);

      const stats = await service.getCancellationStats(startDate, endDate);

      expect(stats.totalCancellations).toBe(2);
      expect(stats.cancellationsByReason['Client illness']).toBe(1);
      expect(stats.cancellationsByReason['RBT unavailable']).toBe(1);
      expect(stats.cancellationsByRbt['rbt-123']).toBe(1);
      expect(stats.cancellationsByRbt['rbt-456']).toBe(1);
      expect(stats.averageNoticeTime).toBeGreaterThan(0);
    });
  });

  describe('bulkCancelSessions', () => {
    it('should cancel multiple sessions successfully', async () => {
      const sessionIds = ['session-1', 'session-2'];
      const reason = 'Emergency closure';
      const cancelledBy = 'admin-123';

      // Mock successful cancellations
      mockSessionRepository.findById
        .mockResolvedValueOnce({ ...mockSession, id: 'session-1' })
        .mockResolvedValueOnce({ ...mockSession, id: 'session-2' });
      
      mockSessionRepository.update
        .mockResolvedValueOnce({ ...mockSession, id: 'session-1', status: 'cancelled' })
        .mockResolvedValueOnce({ ...mockSession, id: 'session-2', status: 'cancelled' });

      mockScheduleEventRepository.logSessionCancelled
        .mockResolvedValueOnce({
          id: 'event-1',
          eventType: 'session_cancelled',
          sessionId: 'session-1',
          clientId: 'client-123',
          rbtId: 'rbt-123',
          reason,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: cancelledBy
        })
        .mockResolvedValueOnce({
          id: 'event-2',
          eventType: 'session_cancelled',
          sessionId: 'session-2',
          clientId: 'client-123',
          rbtId: 'rbt-123',
          reason,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: cancelledBy
        });

      const result = await service.bulkCancelSessions(sessionIds, reason, cancelledBy, false);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle mixed success and failure', async () => {
      const sessionIds = ['session-1', 'session-2'];
      const reason = 'Emergency closure';
      const cancelledBy = 'admin-123';

      // Mock one success, one failure
      mockSessionRepository.findById
        .mockResolvedValueOnce({ ...mockSession, id: 'session-1' })
        .mockResolvedValueOnce(null); // Session not found

      mockSessionRepository.update
        .mockResolvedValueOnce({ ...mockSession, id: 'session-1', status: 'cancelled' });

      mockScheduleEventRepository.logSessionCancelled
        .mockResolvedValueOnce({
          id: 'event-1',
          eventType: 'session_cancelled',
          sessionId: 'session-1',
          clientId: 'client-123',
          rbtId: 'rbt-123',
          reason,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: cancelledBy
        });

      const result = await service.bulkCancelSessions(sessionIds, reason, cancelledBy, false);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.sessionId).toBe('session-2');
    });
  });
});