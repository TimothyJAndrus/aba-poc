import { 
  validateSession, 
  validateCreateSessionRequest, 
  validateUpdateSessionRequest,
  validateSessionConflictType,
  CreateSessionRequest,
  UpdateSessionRequest,
  Session 
} from '../Session';
import { SessionStatus } from '../../types';

describe('Session Model Validation', () => {
  // Use future dates for testing
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7); // Next week
  futureDate.setHours(10, 0, 0, 0); // 10:00 AM
  
  const validStartTime = new Date(futureDate);
  const validEndTime = new Date(futureDate);
  validEndTime.setHours(13, 0, 0, 0); // 1:00 PM (3 hours later)

  describe('validateSessionConflictType', () => {
    it('should validate correct conflict types', () => {
      expect(validateSessionConflictType('rbt_double_booked')).toBe(true);
      expect(validateSessionConflictType('client_double_booked')).toBe(true);
      expect(validateSessionConflictType('outside_business_hours')).toBe(true);
      expect(validateSessionConflictType('rbt_unavailable')).toBe(true);
    });

    it('should reject invalid conflict types', () => {
      expect(validateSessionConflictType('invalid_type')).toBe(false);
      expect(validateSessionConflictType('')).toBe(false);
    });
  });

  describe('validateSession', () => {
    it('should pass validation for valid session data', () => {
      const validSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A',
        notes: 'Regular session'
      };

      const errors = validateSession(validSession);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid client ID', () => {
      const invalidSession: Partial<Session> = {
        clientId: 'invalid-uuid',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Valid client ID is required');
    });

    it('should fail validation for invalid RBT ID', () => {
      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: 'invalid-uuid',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Valid RBT ID is required');
    });

    it('should fail validation for incorrect session duration', () => {
      const invalidEndTime = new Date('2024-01-15T11:00:00Z'); // Only 1 hour

      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: invalidEndTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Session duration must be exactly 3 hours');
    });

    it('should fail validation for weekend scheduling', () => {
      // Find next Sunday
      const nextSunday = new Date();
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
      nextSunday.setHours(10, 0, 0, 0);
      
      const weekendStart = new Date(nextSunday);
      const weekendEnd = new Date(nextSunday);
      weekendEnd.setHours(13, 0, 0, 0);

      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: weekendStart,
        endTime: weekendEnd,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Sessions can only be scheduled Monday through Friday');
    });

    it('should fail validation for start time after end time', () => {
      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validEndTime,
        endTime: validStartTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Start time must be before end time');
    });

    it('should fail validation for past session time', () => {
      const pastStart = new Date('2020-01-15T10:00:00Z');
      const pastEnd = new Date('2020-01-15T13:00:00Z');

      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: pastStart,
        endTime: pastEnd,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Session cannot be scheduled in the past');
    });

    it('should fail validation for invalid status', () => {
      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'invalid_status' as SessionStatus,
        location: 'Therapy Room A'
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Valid session status is required');
    });

    it('should fail validation for empty location', () => {
      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'scheduled' as SessionStatus,
        location: ''
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Location must be 1-200 characters');
    });

    it('should fail validation for overly long notes', () => {
      const invalidSession: Partial<Session> = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        status: 'scheduled' as SessionStatus,
        location: 'Therapy Room A',
        notes: 'a'.repeat(1001)
      };

      const errors = validateSession(invalidSession);
      expect(errors).toContain('Notes cannot exceed 1000 characters');
    });
  });

  describe('validateCreateSessionRequest', () => {
    it('should pass validation for valid create request', () => {
      const validRequest: CreateSessionRequest = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: validStartTime,
        endTime: validEndTime,
        location: 'Therapy Room A',
        createdBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateCreateSessionRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation without RBT ID (auto-assignment)', () => {
      const validRequest: CreateSessionRequest = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        startTime: validStartTime,
        endTime: validEndTime,
        location: 'Therapy Room A',
        createdBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateCreateSessionRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidRequest = {} as CreateSessionRequest;

      const errors = validateCreateSessionRequest(invalidRequest);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Valid client ID is required');
      expect(errors).toContain('Start time and end time are required');
      expect(errors).toContain('Location must be 1-200 characters');
      expect(errors).toContain('Valid creator ID is required');
    });

    it('should fail validation for invalid RBT ID when provided', () => {
      const invalidRequest: CreateSessionRequest = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        rbtId: 'invalid-uuid',
        startTime: validStartTime,
        endTime: validEndTime,
        location: 'Therapy Room A',
        createdBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateCreateSessionRequest(invalidRequest);
      expect(errors).toContain('RBT ID must be a valid UUID if provided');
    });
  });

  describe('validateUpdateSessionRequest', () => {
    it('should pass validation for valid update request', () => {
      const validRequest: UpdateSessionRequest = {
        rbtId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'confirmed',
        notes: 'Session confirmed by RBT',
        updatedBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateUpdateSessionRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for empty update request with updatedBy', () => {
      const validRequest: UpdateSessionRequest = {
        updatedBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateUpdateSessionRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing updatedBy', () => {
      const invalidRequest = {} as UpdateSessionRequest;

      const errors = validateUpdateSessionRequest(invalidRequest);
      expect(errors).toContain('Valid updater ID is required');
    });

    it('should fail validation for invalid status in update', () => {
      const invalidRequest: UpdateSessionRequest = {
        status: 'invalid_status' as SessionStatus,
        updatedBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateUpdateSessionRequest(invalidRequest);
      expect(errors).toContain('Valid session status is required');
    });

    it('should fail validation for overly long cancellation reason', () => {
      const invalidRequest: UpdateSessionRequest = {
        cancellationReason: 'a'.repeat(501),
        updatedBy: '123e4567-e89b-12d3-a456-426614174002'
      };

      const errors = validateUpdateSessionRequest(invalidRequest);
      expect(errors).toContain('Cancellation reason cannot exceed 500 characters');
    });
  });
});