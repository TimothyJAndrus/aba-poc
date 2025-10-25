import { RBTUnavailabilityService, RBTUnavailabilityRequest } from '../RBTUnavailabilityService';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import { ScheduleEventRepository } from '../../database/repositories/ScheduleEventRepository';
import { TeamRepository } from '../../database/repositories/TeamRepository';
import { RBTRepository } from '../../database/repositories/RBTRepository';
import { SessionSchedulingService } from '../SessionSchedulingService';
import { ContinuityPreferenceService } from '../ContinuityPreferenceService';
import { SessionCancellationService } from '../SessionCancellationService';
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
jest.mock('../SessionCancellationService');
jest.mock('../../database/connection');

describe('RBTUnavailabilityService', () => {
  let service: RBTUnavailabilityService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;
  let mockScheduleEventRepository: jest.Mocked<ScheduleEventRepository>;
  let mockTeamRepository: jest.Mocked<TeamRepository>;
  let mockRBTRepository: jest.Mocked<RBTRepository>;
  let mockSchedulingService: jest.Mocked<SessionSchedulingService>;
  let mockContinuityService: jest.Mocked<ContinuityPreferenceService>;
  let mockCancellationService: jest.Mocked<SessionCancellationService>;

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

  beforeEach(() => {
    // Create mocked dependencies
    mockSessionRepository = new SessionRepository() as jest.Mocked<SessionRepository>;
    mockScheduleEventRepository = new ScheduleEventRepository() as jest.Mocked<ScheduleEventRepository>;
    mockTeamRepository = new TeamRepository() as jest.Mocked<TeamRepository>;
    mockRBTRepository = new RBTRepository() as jest.Mocked<RBTRepository>;
    mockSchedulingService = {} as jest.Mocked<SessionSchedulingService>;
    mockContinuityService = new ContinuityPreferenceService() as jest.Mocked<ContinuityPreferenceService>;
    mockCancellationService = {} as jest.Mocked<SessionCancellationService>;

    // Mock database
    (getDatabase as jest.Mock).mockReturnValue({
      transaction: jest.fn().mockImplementation((callback) => callback({}))
    });

    // Initialize service
    service = new RBTUnavailabilityService(
      mockSessionRepository,
      mockScheduleEventRepository,
      mockTeamRepository,
      mockRBTRepository,
      mockSchedulingService,
      mockContinuityService,
      mockCancellationService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processRBTUnavailability', () => {
    const unavailabilityRequest: RBTUnavailabilityRequest = {
      rbtId: 'rbt-123',
      startDate: new Date('2024-01-15T00:00:00Z'),
      endDate: new Date('2024-01-17T23:59:59Z'),
      reason: 'Sick leave',
      unavailabilityType: 'sick_leave',
      reportedBy: 'admin-123',
      autoReassign: true,
      notifyAffectedParties: true
    };

    it('should successfully process RBT unavailability', async () => {
      // Setup mocks
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockSessionRepository.findByRbtId.mockResolvedValue([mockSession]);
      mockScheduleEventRepository.logRbtUnavailable.mockResolvedValue({
        id: 'event-123',
        eventType: 'rbt_unavailable',
        rbtId: 'rbt-123',
        reason: 'Sick leave',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });

      const result = await service.processRBTUnavailability(unavailabilityRequest);

      expect(result.success).toBe(true);
      expect(result.affectedSessions).toHaveLength(1);
      expect(mockScheduleEventRepository.logRbtUnavailable).toHaveBeenCalledWith(
        'rbt-123',
        'Sick leave',
        expect.objectContaining({
          startDate: unavailabilityRequest.startDate,
          endDate: unavailabilityRequest.endDate,
          unavailabilityType: 'sick_leave'
        }),
        'admin-123',
        {}
      );
    });

    it('should return error if RBT not found', async () => {
      mockRBTRepository.findById.mockResolvedValue(null);

      const result = await service.processRBTUnavailability(unavailabilityRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('RBT not found');
    });

    it('should return error if RBT is inactive', async () => {
      const inactiveRBT = { ...mockRBT, isActive: false };
      mockRBTRepository.findById.mockResolvedValue(inactiveRBT);

      const result = await service.processRBTUnavailability(unavailabilityRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('RBT is not active');
    });

    it('should process reassignments when autoReassign is true', async () => {
      // Setup mocks for reassignment
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockSessionRepository.findByRbtId.mockResolvedValue([mockSession]);
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT) // First call for validation
        .mockResolvedValueOnce({ ...mockRBT, id: 'rbt-456' }); // Second call for replacement RBT
      mockSessionRepository.checkConflicts.mockResolvedValue([]);
      mockSessionRepository.findByClientId.mockResolvedValue([]);
      mockContinuityService.calculateContinuityScore.mockReturnValue({
        rbtId: 'rbt-456',
        clientId: 'client-123',
        score: 75,
        totalSessions: 5,
        recentSessions: 2
      });
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        rbtId: 'rbt-456'
      });
      mockScheduleEventRepository.logRbtUnavailable.mockResolvedValue({
        id: 'event-123',
        eventType: 'rbt_unavailable',
        rbtId: 'rbt-123',
        reason: 'Sick leave',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });
      mockScheduleEventRepository.logSessionRescheduled.mockResolvedValue({
        id: 'event-124',
        eventType: 'session_rescheduled',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-456',
        reason: 'RBT unavailability - reassigned to team member',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });

      const result = await service.processRBTUnavailability(unavailabilityRequest);

      expect(result.success).toBe(true);
      expect(result.reassignmentResults).toHaveLength(1);
      expect(result.reassignmentResults[0]?.reassignmentStatus).toBe('successful');
    });

    it('should handle reassignment failure when no team members available', async () => {
      // Setup mocks for failed reassignment
      mockRBTRepository.findById.mockResolvedValue(mockRBT);
      mockSessionRepository.findByRbtId.mockResolvedValue([mockSession]);
      mockTeamRepository.findActiveByClientId.mockResolvedValue({
        ...mockTeam,
        rbtIds: ['rbt-123'] // Only the unavailable RBT
      });
      mockScheduleEventRepository.logRbtUnavailable.mockResolvedValue({
        id: 'event-123',
        eventType: 'rbt_unavailable',
        rbtId: 'rbt-123',
        reason: 'Sick leave',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });

      const result = await service.processRBTUnavailability(unavailabilityRequest);

      expect(result.success).toBe(true);
      expect(result.reassignmentResults).toHaveLength(1);
      expect(result.reassignmentResults[0]?.reassignmentStatus).toBe('failed');
      expect(result.reassignmentResults[0]?.errorMessage).toBe('No other team members available');
    });
  });

  describe('getUnavailabilityStats', () => {
    it('should return unavailability statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockUnavailabilityEvents = [
        {
          id: 'event-1',
          eventType: 'rbt_unavailable' as const,
          rbtId: 'rbt-123',
          reason: 'Sick leave',
          newValues: { unavailabilityType: 'sick_leave' },
          createdAt: new Date('2024-01-15T09:00:00Z'),
          updatedAt: new Date('2024-01-15T09:00:00Z'),
          createdBy: 'admin-123'
        },
        {
          id: 'event-2',
          eventType: 'rbt_unavailable' as const,
          rbtId: 'rbt-456',
          reason: 'Vacation',
          newValues: { unavailabilityType: 'vacation' },
          createdAt: new Date('2024-01-20T10:00:00Z'),
          updatedAt: new Date('2024-01-20T10:00:00Z'),
          createdBy: 'admin-123'
        }
      ];

      const mockReassignmentEvents = [
        {
          id: 'event-3',
          eventType: 'session_rescheduled' as const,
          rbtId: 'rbt-123',
          newValues: { newRbtId: 'rbt-789' },
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:00:00Z'),
          createdBy: 'admin-123'
        }
      ];

      mockScheduleEventRepository.query
        .mockResolvedValueOnce(mockUnavailabilityEvents)
        .mockResolvedValueOnce(mockReassignmentEvents)
        .mockResolvedValueOnce([]); // Second unavailability event has no reassignments

      const stats = await service.getUnavailabilityStats(startDate, endDate);

      expect(stats.totalUnavailabilityEvents).toBe(2);
      expect(stats.unavailabilityByType['sick_leave']).toBe(1);
      expect(stats.unavailabilityByType['vacation']).toBe(1);
      expect(stats.unavailabilityByRbt['rbt-123']).toBe(1);
      expect(stats.unavailabilityByRbt['rbt-456']).toBe(1);
      expect(stats.successfulReassignments).toBe(1);
    });
  });

  describe('bulkProcessUnavailability', () => {
    it('should process multiple RBT unavailabilities', async () => {
      const requests: RBTUnavailabilityRequest[] = [
        {
          rbtId: 'rbt-123',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-17'),
          reason: 'Sick leave',
          unavailabilityType: 'sick_leave',
          reportedBy: 'admin-123'
        },
        {
          rbtId: 'rbt-456',
          startDate: new Date('2024-01-20'),
          endDate: new Date('2024-01-25'),
          reason: 'Vacation',
          unavailabilityType: 'vacation',
          reportedBy: 'admin-123'
        }
      ];

      // Mock successful processing for both
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT)
        .mockResolvedValueOnce({ ...mockRBT, id: 'rbt-456' });
      mockSessionRepository.findByRbtId
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockScheduleEventRepository.logRbtUnavailable
        .mockResolvedValueOnce({
          id: 'event-1',
          eventType: 'rbt_unavailable',
          rbtId: 'rbt-123',
          reason: 'Sick leave',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin-123'
        })
        .mockResolvedValueOnce({
          id: 'event-2',
          eventType: 'rbt_unavailable',
          rbtId: 'rbt-456',
          reason: 'Vacation',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin-123'
        });

      const result = await service.bulkProcessUnavailability(requests);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle mixed success and failure in bulk processing', async () => {
      const requests: RBTUnavailabilityRequest[] = [
        {
          rbtId: 'rbt-123',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-17'),
          reason: 'Sick leave',
          unavailabilityType: 'sick_leave',
          reportedBy: 'admin-123'
        },
        {
          rbtId: 'rbt-999', // Non-existent RBT
          startDate: new Date('2024-01-20'),
          endDate: new Date('2024-01-25'),
          reason: 'Vacation',
          unavailabilityType: 'vacation',
          reportedBy: 'admin-123'
        }
      ];

      // Mock one success, one failure
      mockRBTRepository.findById
        .mockResolvedValueOnce(mockRBT)
        .mockResolvedValueOnce(null);
      mockSessionRepository.findByRbtId.mockResolvedValueOnce([]);
      mockScheduleEventRepository.logRbtUnavailable.mockResolvedValueOnce({
        id: 'event-1',
        eventType: 'rbt_unavailable',
        rbtId: 'rbt-123',
        reason: 'Sick leave',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });

      const result = await service.bulkProcessUnavailability(requests);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.rbtId).toBe('rbt-999');
    });
  });

  describe('resolveUnavailability', () => {
    it('should successfully resolve unavailability', async () => {
      mockScheduleEventRepository.create.mockResolvedValue({
        id: 'event-resolution',
        eventType: 'rbt_unavailable',
        reason: 'Unavailability resolved: RBT returned to work',
        metadata: {
          resolvedUnavailabilityId: 'unavailability-123',
          resolutionType: 'resolved'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123'
      });

      const result = await service.resolveUnavailability(
        'unavailability-123',
        'admin-123',
        'RBT returned to work'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('RBT unavailability resolved successfully');
    });
  });
});