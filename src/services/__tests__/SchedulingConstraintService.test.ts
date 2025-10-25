import { SchedulingConstraintService, SchedulingContext } from '../SchedulingConstraintService';
import { CreateSessionRequest } from '../../models/Session';
import { SchedulingConstraints } from '../../types';

describe('SchedulingConstraintService', () => {
  let service: SchedulingConstraintService;
  let mockContext: SchedulingContext;

  beforeEach(() => {
    service = new SchedulingConstraintService();
    
    // Create mock context
    mockContext = {
      clientId: 'client-123',
      teamMembers: ['rbt-1', 'rbt-2', 'rbt-3'],
      existingSessions: [],
      rbtAvailability: [
        {
          id: 'avail-1',
          rbtId: 'rbt-1',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          isRecurring: true,
          effectiveDate: new Date('2025-01-01'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'avail-2',
          rbtId: 'rbt-2',
          dayOfWeek: 1, // Monday
          startTime: '10:00',
          endTime: '18:00',
          isRecurring: true,
          effectiveDate: new Date('2025-01-01'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      sessionHistory: [],
      constraints: {
        businessHours: {
          startTime: '09:00',
          endTime: '19:00',
          validDays: [1, 2, 3, 4, 5]
        },
        sessionDuration: 3,
        maxSessionsPerDay: 2,
        minBreakBetweenSessions: 30
      }
    };
  });

  describe('validateSessionConstraints', () => {
    it('should validate a valid session request', async () => {
      // Create a future Monday date
      const futureMonday = new Date();
      futureMonday.setDate(futureMonday.getDate() + 7); // Next week
      while (futureMonday.getDay() !== 1) { // Find next Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      futureMonday.setHours(10, 0, 0, 0); // 10 AM
      
      const endTime = new Date(futureMonday);
      endTime.setHours(13, 0, 0, 0); // 1 PM

      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: futureMonday,
        endTime: endTime,
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should reject session outside business hours', async () => {
      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2025-01-27T07:00:00'), // 7 AM - before business hours
        endTime: new Date('2025-01-27T10:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation',
          description: expect.stringContaining('business hours')
        })
      );
    });

    it('should reject session with incorrect duration', async () => {
      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2025-01-27T10:00:00'),
        endTime: new Date('2025-01-27T11:00:00'), // Only 1 hour instead of 3
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation',
          description: expect.stringContaining('duration must be exactly 3 hours')
        })
      );
    });

    it('should reject session on weekend', async () => {
      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2025-01-25T10:00:00'), // Saturday
        endTime: new Date('2025-01-25T13:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation',
          description: expect.stringContaining('business days')
        })
      );
    });

    it('should reject session in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 3 * 60 * 60 * 1000), // 3 hours later
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'business_hours_violation',
          description: expect.stringContaining('cannot be scheduled in the past')
        })
      );
    });

    it('should detect RBT conflicts with existing sessions', async () => {
      // Add existing session for RBT
      mockContext.existingSessions = [{
        id: 'session-1',
        clientId: 'other-client',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T09:00:00'),
        endTime: new Date('2024-10-28T12:00:00'),
        status: 'scheduled',
        location: 'Room B',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      }];

      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T10:00:00'), // Overlaps with existing session
        endTime: new Date('2024-10-28T13:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'rbt_unavailable',
          description: expect.stringContaining('conflicting session')
        })
      );
    });

    it('should detect client conflicts with existing sessions', async () => {
      // Add existing session for client
      mockContext.existingSessions = [{
        id: 'session-1',
        clientId: 'client-123',
        rbtId: 'rbt-2',
        startTime: new Date('2024-10-28T09:00:00'),
        endTime: new Date('2024-10-28T12:00:00'),
        status: 'scheduled',
        location: 'Room B',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      }];

      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T10:00:00'), // Overlaps with existing session
        endTime: new Date('2024-10-28T13:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'client_unavailable',
          description: expect.stringContaining('conflicting session')
        })
      );
    });

    it('should reject RBT not in team', async () => {
      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-999', // Not in team
        startTime: new Date('2024-10-28T10:00:00'),
        endTime: new Date('2024-10-28T13:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'rbt_unavailable',
          description: expect.stringContaining('not a member of the client\'s team')
        })
      );
    });

    it('should enforce daily session limits', async () => {
      // Add existing sessions for RBT on the same day (reaching limit)
      mockContext.existingSessions = [
        {
          id: 'session-1',
          clientId: 'other-client-1',
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
          id: 'session-2',
          clientId: 'other-client-2',
          rbtId: 'rbt-1',
          startTime: new Date('2024-10-28T14:00:00'),
          endTime: new Date('2024-10-28T17:00:00'),
          status: 'scheduled',
          location: 'Room B',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        }
      ];

      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T18:00:00'), // Third session of the day
        endTime: new Date('2024-10-28T21:00:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'rbt_unavailable',
          description: expect.stringContaining('maximum sessions per day')
        })
      );
    });

    it('should enforce minimum break between sessions', async () => {
      // Add existing session ending at 12:00
      mockContext.existingSessions = [{
        id: 'session-1',
        clientId: 'other-client',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T09:00:00'),
        endTime: new Date('2024-10-28T12:00:00'),
        status: 'scheduled',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      }];

      const request: CreateSessionRequest = {
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T12:15:00'), // Only 15 minutes after previous session
        endTime: new Date('2024-10-28T15:15:00'),
        location: 'Clinic Room A',
        createdBy: 'user-123'
      };

      const result = await service.validateSessionConstraints(request, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'rbt_unavailable',
          description: expect.stringContaining('Insufficient break time')
        })
      );
    });
  });

  describe('findAvailableTimeSlots', () => {
    it('should find available slots for team members', async () => {
      // Create a future Monday date
      const futureMonday = new Date();
      futureMonday.setDate(futureMonday.getDate() + 7); // Next week
      while (futureMonday.getDay() !== 1) { // Find next Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }

      const availableSlots = await service.findAvailableTimeSlots(
        'client-123',
        futureMonday,
        mockContext
      );

      expect(availableSlots.size).toBeGreaterThan(0);
      expect(availableSlots.has('rbt-1')).toBe(true);
      expect(availableSlots.has('rbt-2')).toBe(true);
    });

    it('should exclude slots with existing sessions', async () => {
      const date = new Date('2024-10-28'); // Monday
      
      // Add existing session that blocks some availability
      mockContext.existingSessions = [{
        id: 'session-1',
        clientId: 'other-client',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-28T10:00:00'),
        endTime: new Date('2024-10-28T13:00:00'),
        status: 'scheduled',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      }];

      const availableSlots = await service.findAvailableTimeSlots(
        'client-123',
        date,
        mockContext
      );

      // RBT-1 should have fewer available slots due to existing session
      const rbt1Slots = availableSlots.get('rbt-1') || [];
      const rbt2Slots = availableSlots.get('rbt-2') || [];
      
      expect(rbt2Slots.length).toBeGreaterThanOrEqual(rbt1Slots.length);
    });
  });

  describe('getDefaultConstraints', () => {
    it('should return valid default constraints', () => {
      const constraints = service.getDefaultConstraints();

      expect(constraints.businessHours.startTime).toBe('09:00');
      expect(constraints.businessHours.endTime).toBe('19:00');
      expect(constraints.businessHours.validDays).toEqual([1, 2, 3, 4, 5]);
      expect(constraints.sessionDuration).toBe(3);
      expect(constraints.maxSessionsPerDay).toBe(2);
      expect(constraints.minBreakBetweenSessions).toBe(30);
    });
  });
});