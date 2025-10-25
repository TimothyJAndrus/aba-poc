import { ReschedulingOptimizationService, ReschedulingRequest } from '../ReschedulingOptimizationService';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import { TeamRepository } from '../../database/repositories/TeamRepository';
import { RBTRepository } from '../../database/repositories/RBTRepository';
import { ContinuityPreferenceService } from '../ContinuityPreferenceService';
import { SchedulingConstraintService } from '../SchedulingConstraintService';
import { Session } from '../../models/Session';
import { Team } from '../../models/Team';
import { RBT } from '../../models/RBT';

// Mock the dependencies
jest.mock('../../database/repositories/SessionRepository');
jest.mock('../../database/repositories/TeamRepository');
jest.mock('../../database/repositories/RBTRepository');
jest.mock('../ContinuityPreferenceService');
jest.mock('../SchedulingConstraintService');

describe('ReschedulingOptimizationService', () => {
  let service: ReschedulingOptimizationService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;
  let mockTeamRepository: jest.Mocked<TeamRepository>;
  let mockRBTRepository: jest.Mocked<RBTRepository>;
  let mockContinuityService: jest.Mocked<ContinuityPreferenceService>;
  let mockConstraintService: jest.Mocked<SchedulingConstraintService>;

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
    mockTeamRepository = new TeamRepository() as jest.Mocked<TeamRepository>;
    mockRBTRepository = new RBTRepository() as jest.Mocked<RBTRepository>;
    mockContinuityService = new ContinuityPreferenceService() as jest.Mocked<ContinuityPreferenceService>;
    mockConstraintService = new SchedulingConstraintService() as jest.Mocked<SchedulingConstraintService>;

    // Initialize service
    service = new ReschedulingOptimizationService(
      mockSessionRepository,
      mockTeamRepository,
      mockRBTRepository,
      mockContinuityService,
      mockConstraintService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOptimalReschedulingOptions', () => {
    const reschedulingRequest: ReschedulingRequest = {
      sessionId: 'session-123',
      reason: 'Client requested time change',
      requestedBy: 'user-123',
      preferences: {
        maxDaysFromOriginal: 7,
        allowDifferentRBT: true,
        prioritizeContinuity: true
      }
    };

    it('should find optimal rescheduling options', async () => {
      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT)
        .mockResolvedValueOnce({ ...mockRBT, id: 'rbt-456', firstName: 'Jane' });
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      mockContinuityService.calculateContinuityScore.mockReturnValue({
        rbtId: 'rbt-123',
        clientId: 'client-123',
        score: 85,
        totalSessions: 10,
        recentSessions: 3
      });

      const result = await service.findOptimalReschedulingOptions(reschedulingRequest);

      expect(result.success).toBe(true);
      expect(result.recommendedOptions).toBeDefined();
      expect(result.optimizationMetrics).toBeDefined();
      expect(result.optimizationMetrics.totalOptionsEvaluated).toBeGreaterThan(0);
    });

    it('should return error if session not found', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      const result = await service.findOptimalReschedulingOptions(reschedulingRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session not found');
    });

    it('should validate rescheduling constraints', async () => {
      const constrainedRequest: ReschedulingRequest = {
        ...reschedulingRequest,
        constraints: {
          minNoticeHours: 48
        }
      };

      // Mock a session that's too soon
      const soonSession = {
        ...mockSession,
        startTime: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      };
      mockSessionRepository.findById.mockResolvedValue(soonSession);

      const result = await service.findOptimalReschedulingOptions(constrainedRequest);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Rescheduling constraints not met');
    });

    it('should prioritize same RBT when continuity is important', async () => {
      const continuityRequest: ReschedulingRequest = {
        ...reschedulingRequest,
        preferences: {
          ...reschedulingRequest.preferences,
          prioritizeContinuity: true,
          allowDifferentRBT: true
        }
      };

      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT)
        .mockResolvedValueOnce({ ...mockRBT, id: 'rbt-456', firstName: 'Jane' });
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      
      // Mock higher continuity score for same RBT
      mockContinuityService.calculateContinuityScore
        .mockReturnValueOnce({
          rbtId: 'rbt-123',
          clientId: 'client-123',
          score: 95, // High score for same RBT
          totalSessions: 10,
          recentSessions: 3
        })
        .mockReturnValueOnce({
          rbtId: 'rbt-456',
          clientId: 'client-123',
          score: 60, // Lower score for different RBT
          totalSessions: 2,
          recentSessions: 1
        });

      const result = await service.findOptimalReschedulingOptions(continuityRequest);

      expect(result.success).toBe(true);
      if (result.recommendedOptions.length > 1) {
        // First option should be with the same RBT (higher continuity)
        expect(result.recommendedOptions[0]?.rbtId).toBe('rbt-123');
      }
    });

    it('should respect preferred times when provided', async () => {
      const timePreferenceRequest: ReschedulingRequest = {
        ...reschedulingRequest,
        preferences: {
          ...reschedulingRequest.preferences,
          preferredTimes: [
            { startTime: '14:00', endTime: '17:00' }
          ]
        }
      };

      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      mockContinuityService.calculateContinuityScore.mockReturnValue({
        rbtId: 'rbt-123',
        clientId: 'client-123',
        score: 85,
        totalSessions: 10,
        recentSessions: 3
      });

      const result = await service.findOptimalReschedulingOptions(timePreferenceRequest);

      expect(result.success).toBe(true);
      // Should find options at the preferred time
      const preferredTimeOptions = result.recommendedOptions.filter(
        option => option.startTime.getHours() === 14
      );
      expect(preferredTimeOptions.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeReschedulingImpact', () => {
    it('should analyze impact of rescheduling', async () => {
      const newStartTime = new Date('2024-01-16T14:00:00Z');
      const newRbtId = 'rbt-456';

      // Setup mocks
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([
        { ...mockSession, id: 'session-456', startTime: new Date('2024-01-16T10:00:00Z') }
      ]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      mockContinuityService.calculateContinuityScore
        .mockReturnValueOnce({
          rbtId: 'rbt-123',
          clientId: 'client-123',
          score: 90,
          totalSessions: 10,
          recentSessions: 3
        })
        .mockReturnValueOnce({
          rbtId: 'rbt-456',
          clientId: 'client-123',
          score: 70,
          totalSessions: 5,
          recentSessions: 1
        });

      const impact = await service.analyzeReschedulingImpact('session-123', newStartTime, newRbtId);

      expect(impact.affectedSessions).toBeDefined();
      expect(impact.cascadingChanges).toBeGreaterThanOrEqual(0);
      expect(impact.notificationCount).toBeGreaterThan(0);
      expect(impact.continuityDisruption).toBeGreaterThanOrEqual(0);
      expect(impact.operationalComplexity).toBeGreaterThanOrEqual(0);
    });

    it('should show no continuity disruption when keeping same RBT', async () => {
      const newStartTime = new Date('2024-01-16T14:00:00Z');
      // Same RBT as original

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([]);

      const impact = await service.analyzeReschedulingImpact('session-123', newStartTime);

      expect(impact.continuityDisruption).toBe(0);
    });

    it('should calculate higher disruption when changing RBT', async () => {
      const newStartTime = new Date('2024-01-16T14:00:00Z');
      const newRbtId = 'rbt-456';

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      
      // Mock different continuity scores
      mockContinuityService.calculateContinuityScore
        .mockReturnValueOnce({
          rbtId: 'rbt-123',
          clientId: 'client-123',
          score: 90, // High score for original RBT
          totalSessions: 10,
          recentSessions: 3
        })
        .mockReturnValueOnce({
          rbtId: 'rbt-456',
          clientId: 'client-123',
          score: 50, // Lower score for new RBT
          totalSessions: 2,
          recentSessions: 0
        });

      const impact = await service.analyzeReschedulingImpact('session-123', newStartTime, newRbtId);

      expect(impact.continuityDisruption).toBeGreaterThan(0);
      expect(impact.continuityDisruption).toBeLessThanOrEqual(100);
    });
  });

  describe('optimization scoring', () => {
    it('should score options based on multiple factors', async () => {
      const request: ReschedulingRequest = {
        sessionId: 'session-123',
        reason: 'Testing optimization',
        requestedBy: 'user-123',
        preferences: {
          prioritizeContinuity: true,
          allowDifferentRBT: true
        }
      };

      // Setup mocks for multiple options
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT)
        .mockResolvedValueOnce({ ...mockRBT, id: 'rbt-456', firstName: 'Jane' });
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([mockSession]);
      
      // Mock different continuity scores
      mockContinuityService.calculateContinuityScore
        .mockReturnValueOnce({
          rbtId: 'rbt-123',
          clientId: 'client-123',
          score: 95, // High continuity
          totalSessions: 10,
          recentSessions: 3
        })
        .mockReturnValueOnce({
          rbtId: 'rbt-456',
          clientId: 'client-123',
          score: 60, // Lower continuity
          totalSessions: 3,
          recentSessions: 1
        });

      const result = await service.findOptimalReschedulingOptions(request);

      expect(result.success).toBe(true);
      expect(result.recommendedOptions.length).toBeGreaterThan(0);
      
      // Options should be ranked (rank 1 should be best)
      const ranks = result.recommendedOptions.map(opt => opt.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      
      // First option should have highest optimization score
      if (result.recommendedOptions.length > 1) {
        expect(result.recommendedOptions[0]!.optimizationScore)
          .toBeGreaterThanOrEqual(result.recommendedOptions[1]!.optimizationScore);
      }
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      const request: ReschedulingRequest = {
        sessionId: 'session-123',
        reason: 'Testing error handling',
        requestedBy: 'user-123'
      };

      mockSessionRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await service.findOptimalReschedulingOptions(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Optimization failed');
    });

    it('should handle missing team gracefully', async () => {
      const request: ReschedulingRequest = {
        sessionId: 'session-123',
        reason: 'Testing missing team',
        requestedBy: 'user-123'
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(null);

      const result = await service.findOptimalReschedulingOptions(request);

      expect(result.success).toBe(true);
      expect(result.recommendedOptions).toHaveLength(0);
    });
  });
});