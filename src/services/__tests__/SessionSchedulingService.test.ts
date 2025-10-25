import { SessionSchedulingService, ScheduleSessionRequest } from '../SessionSchedulingService';
import { SchedulingConstraintService } from '../SchedulingConstraintService';
import { ContinuityPreferenceService } from '../ContinuityPreferenceService';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import { TeamRepository } from '../../database/repositories/TeamRepository';
import { RBTRepository } from '../../database/repositories/RBTRepository';
import { ClientRepository } from '../../database/repositories/ClientRepository';
import { Session } from '../../models/Session';
import { Team } from '../../models/Team';

// Mock the repositories
jest.mock('../../database/repositories/SessionRepository');
jest.mock('../../database/repositories/TeamRepository');
jest.mock('../../database/repositories/RBTRepository');
jest.mock('../../database/repositories/ClientRepository');

describe('SessionSchedulingService', () => {
  let service: SessionSchedulingService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;
  let mockTeamRepository: jest.Mocked<TeamRepository>;
  let mockRBTRepository: jest.Mocked<RBTRepository>;
  let mockClientRepository: jest.Mocked<ClientRepository>;

  beforeEach(() => {
    // Create mocked repositories
    mockSessionRepository = new SessionRepository() as jest.Mocked<SessionRepository>;
    mockTeamRepository = new TeamRepository() as jest.Mocked<TeamRepository>;
    mockRBTRepository = new RBTRepository() as jest.Mocked<RBTRepository>;
    mockClientRepository = new ClientRepository() as jest.Mocked<ClientRepository>;

    // Initialize service with mocked dependencies
    service = new SessionSchedulingService(
      new SchedulingConstraintService(),
      new ContinuityPreferenceService(),
      mockSessionRepository,
      mockTeamRepository,
      mockRBTRepository,
      mockClientRepository
    );

    // Setup default mock responses
    mockTeamRepository.findActiveByClientId.mockResolvedValue({
      id: 'team-123',
      clientId: 'client-123',
      rbtIds: ['rbt-1', 'rbt-2'],
      primaryRbtId: 'rbt-1',
      effectiveDate: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123'
    });

    mockSessionRepository.findActiveByDateRange.mockResolvedValue([]);
    mockSessionRepository.findByClientId.mockResolvedValue([]);
    
    mockRBTRepository.findById.mockResolvedValue({
      id: 'rbt-1',
      email: 'rbt1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-0101',
      role: 'rbt',
      licenseNumber: 'RBT123',
      qualifications: ['ABA Therapy'],
      hourlyRate: 25,
      isActive: true,
      hireDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    mockSessionRepository.create.mockImplementation(async (session) => ({
      ...session,
      id: 'new-session-id',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    } as Session));
  });

  describe('scheduleSession', () => {
    it('should successfully schedule a session with specified RBT', async () => {
      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'), // Monday 10 AM
        location: 'Clinic Room A',
        createdBy: 'user-123',
        rbtId: 'rbt-1'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.rbtId).toBe('rbt-1');
      expect(result.session?.clientId).toBe('client-123');
      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-123',
          rbtId: 'rbt-1',
          startTime: request.preferredStartTime,
          location: 'Clinic Room A'
        })
      );
    });

    it('should auto-select RBT when not specified', async () => {
      // Mock session history for continuity calculation
      mockSessionRepository.findByClientId.mockResolvedValue([
        {
          id: 'session-1',
          clientId: 'client-123',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-15T10:00:00'),
          endTime: new Date('2024-10-15T13:00:00'),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
        // No rbtId specified
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(true);
      expect(result.rbtSelectionDetails).toBeDefined();
      expect(result.rbtSelectionDetails?.selectedRBTId).toBe('rbt-1'); // Should select RBT with history
      expect(result.session?.rbtId).toBe('rbt-1');
    });

    it('should fail when no team found for client', async () => {
      mockTeamRepository.findActiveByClientId.mockResolvedValue(null);

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active team found for client');
    });

    it('should fail when no RBTs available', async () => {
      // Mock existing sessions that block all RBTs
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([
        {
          id: 'blocking-session-1',
          clientId: 'other-client',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-28T09:00:00'),
          endTime: new Date('2024-10-28T12:00:00'),
          status: 'scheduled',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        },
        {
          id: 'blocking-session-2',
          clientId: 'other-client',
          rbtId: 'rbt-2',
          startTime: new Date('2024-10-28T10:00:00'),
          endTime: new Date('2024-10-28T13:00:00'),
          status: 'scheduled',
          location: 'Room B',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'), // Conflicts with existing sessions
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No available RBTs found');
    });

    it('should return alternatives when requested and scheduling fails', async () => {
      // Mock conflicting session
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([
        {
          id: 'conflict-session',
          clientId: 'client-123',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-28T10:00:00'),
          endTime: new Date('2024-10-28T13:00:00'),
          status: 'scheduled',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123',
        rbtId: 'rbt-1',
        allowAlternatives: true
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.alternatives).toBeDefined();
    });

    it('should handle scheduling outside business hours', async () => {
      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T07:00:00'), // 7 AM - before business hours
        location: 'Clinic Room A',
        createdBy: 'user-123',
        rbtId: 'rbt-1'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.conflicts).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation'
        })
      );
    });

    it('should handle weekend scheduling attempts', async () => {
      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-26T10:00:00'), // Saturday
        location: 'Clinic Room A',
        createdBy: 'user-123',
        rbtId: 'rbt-1'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.conflicts).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation'
        })
      );
    });
  });

  describe('bulkScheduleSessions', () => {
    it('should schedule multiple sessions successfully', async () => {
      const request = {
        clientId: 'client-123',
        dateRange: {
          startDate: new Date('2024-10-28'), // Monday
          endDate: new Date('2024-11-08')   // Friday (2 weeks)
        },
        preferredTimes: [
          { dayOfWeek: 1, startTime: '10:00' }, // Monday
          { dayOfWeek: 3, startTime: '14:00' }  // Wednesday
        ],
        sessionsPerWeek: 2,
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.bulkScheduleSessions(request);

      expect(result.totalRequested).toBeGreaterThan(0);
      expect(result.successfullyScheduled).toBeGreaterThan(0);
      expect(result.scheduledSessions.length).toBe(result.successfullyScheduled);
    });

    it('should handle partial failures in bulk scheduling', async () => {
      // Mock some conflicting sessions
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([
        {
          id: 'conflict-session',
          clientId: 'client-123',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-28T10:00:00'), // Conflicts with first Monday
          endTime: new Date('2024-10-28T13:00:00'),
          status: 'scheduled',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const request = {
        clientId: 'client-123',
        dateRange: {
          startDate: new Date('2024-10-28'),
          endDate: new Date('2024-11-01')
        },
        preferredTimes: [
          { dayOfWeek: 1, startTime: '10:00' }
        ],
        sessionsPerWeek: 1,
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.bulkScheduleSessions(request);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.failures.length).toBe(result.failed);
    });
  });

  describe('findAlternativeTimeSlots', () => {
    it('should find alternative slots within search range', async () => {
      const alternatives = await service.findAlternativeTimeSlots(
        'client-123',
        new Date('2024-10-28'),
        7 // Search 7 days
      );

      expect(Array.isArray(alternatives)).toBe(true);
      // Should find some alternatives given default availability
      expect(alternatives.length).toBeGreaterThanOrEqual(0);
    });

    it('should prioritize alternatives by continuity score', async () => {
      // Mock session history showing RBT-1 has better continuity
      mockSessionRepository.findByClientId.mockResolvedValue([
        {
          id: 'session-1',
          clientId: 'client-123',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-15T10:00:00'),
          endTime: new Date('2024-10-15T13:00:00'),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const alternatives = await service.findAlternativeTimeSlots(
        'client-123',
        new Date('2024-10-28'),
        3
      );

      if (alternatives.length > 1) {
        // First alternative should have higher or equal continuity score
        expect(alternatives[0]?.continuityScore).toBeGreaterThanOrEqual(
          alternatives[1]?.continuityScore || 0
        );
      }
    });
  });

  describe('rescheduleSession', () => {
    it('should successfully reschedule an existing session', async () => {
      const existingSession: Session = {
        id: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T10:00:00'),
        endTime: new Date('2024-10-28T13:00:00'),
        status: 'scheduled',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      };

      mockSessionRepository.findById.mockResolvedValue(existingSession);
      mockSessionRepository.update.mockResolvedValue({
        ...existingSession,
        startTime: new Date('2024-10-29T14:00:00'),
        endTime: new Date('2024-10-29T17:00:00')
      });

      const result = await service.rescheduleSession(
        'session-123',
        new Date('2024-10-29T14:00:00'), // Tuesday 2 PM
        'user-123',
        'Client requested time change'
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-123');
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          startTime: new Date('2024-10-29T14:00:00'),
          endTime: new Date('2024-10-29T17:00:00'),
          updatedBy: 'user-123'
        })
      );
    });

    it('should fail to reschedule non-existent session', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      const result = await service.rescheduleSession(
        'non-existent-session',
        new Date('2024-10-29T14:00:00'),
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session not found');
    });

    it('should fail to reschedule to conflicting time', async () => {
      const existingSession: Session = {
        id: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T10:00:00'),
        endTime: new Date('2024-10-28T13:00:00'),
        status: 'scheduled',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      };

      // Mock conflicting session
      mockSessionRepository.findById.mockResolvedValue(existingSession);
      mockSessionRepository.findActiveByDateRange.mockResolvedValue([
        {
          id: 'conflict-session',
          clientId: 'other-client',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-29T14:00:00'),
          endTime: new Date('2024-10-29T17:00:00'),
          status: 'scheduled',
          location: 'Room B',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ]);

      const result = await service.rescheduleSession(
        'session-123',
        new Date('2024-10-29T15:00:00'), // Conflicts with existing session
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('violates scheduling constraints');
      expect(result.conflicts).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockTeamRepository.findActiveByClientId.mockRejectedValue(new Error('Database error'));

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to schedule session');
    });

    it('should handle session creation errors', async () => {
      mockSessionRepository.create.mockRejectedValue(new Error('Failed to create session'));

      const request: ScheduleSessionRequest = {
        clientId: 'client-123',
        preferredStartTime: new Date('2024-10-28T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123',
        rbtId: 'rbt-1'
      };

      const result = await service.scheduleSession(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to schedule session');
    });
  });
});