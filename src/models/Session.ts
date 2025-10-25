import { AuditableEntity, SessionStatus } from '../types';
import { validateUUID, validateSessionStatus, isValidBusinessHours, isValidSessionDuration } from '../utils/validation';

export interface Session extends AuditableEntity {
  clientId: string;
  rbtId: string;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  location: string;
  notes?: string;
  cancellationReason?: string;
  completionNotes?: string;
}

export interface CreateSessionRequest {
  clientId: string;
  rbtId?: string; // Optional - system can auto-assign
  startTime: Date;
  endTime: Date;
  location: string;
  createdBy: string;
}

export interface UpdateSessionRequest {
  rbtId?: string;
  startTime?: Date;
  endTime?: Date;
  status?: SessionStatus;
  location?: string;
  notes?: string;
  cancellationReason?: string;
  completionNotes?: string;
  updatedBy: string;
}

export interface SessionConflict {
  sessionId: string;
  conflictType: 'rbt_double_booked' | 'client_double_booked' | 'outside_business_hours' | 'rbt_unavailable';
  conflictingSessionId?: string;
  description: string;
}

export interface SessionSummary {
  sessionId: string;
  clientName: string;
  rbtName: string;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  duration: number; // in minutes
  location: string;
}

// Validation functions
export const validateSessionConflictType = (conflictType: string): conflictType is SessionConflict['conflictType'] => {
  return ['rbt_double_booked', 'client_double_booked', 'outside_business_hours', 'rbt_unavailable'].includes(conflictType);
};

export const validateSession = (session: Partial<Session>): string[] => {
  const errors: string[] = [];

  if (session.clientId !== undefined && !validateUUID(session.clientId)) {
    errors.push('Valid client ID is required');
  }

  if (session.rbtId !== undefined && !validateUUID(session.rbtId)) {
    errors.push('Valid RBT ID is required');
  }

  if (session.startTime !== undefined && session.endTime !== undefined) {
    // Validate session duration (must be exactly 3 hours for ABA)
    if (!isValidSessionDuration(session.startTime, session.endTime)) {
      errors.push('Session duration must be exactly 3 hours');
    }

    // Validate business hours
    const startTimeStr = session.startTime.toTimeString().substring(0, 5);
    const endTimeStr = session.endTime.toTimeString().substring(0, 5);
    if (!isValidBusinessHours(startTimeStr, endTimeStr)) {
      errors.push('Session must be within business hours (9:00 AM - 7:00 PM)');
    }

    // Validate day of week (Monday-Friday only)
    const dayOfWeek = session.startTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      errors.push('Sessions can only be scheduled Monday through Friday');
    }

    // Validate start time is before end time
    if (session.startTime >= session.endTime) {
      errors.push('Start time must be before end time');
    }

    // Validate session is not in the past (for new sessions)
    if (session.startTime < new Date()) {
      errors.push('Session cannot be scheduled in the past');
    }
  }

  if (session.status !== undefined && !validateSessionStatus(session.status)) {
    errors.push('Valid session status is required');
  }

  if (session.location !== undefined && (session.location.length < 1 || session.location.length > 200)) {
    errors.push('Location must be 1-200 characters');
  }

  if (session.notes !== undefined && session.notes.length > 1000) {
    errors.push('Notes cannot exceed 1000 characters');
  }

  if (session.cancellationReason !== undefined && session.cancellationReason.length > 500) {
    errors.push('Cancellation reason cannot exceed 500 characters');
  }

  if (session.completionNotes !== undefined && session.completionNotes.length > 1000) {
    errors.push('Completion notes cannot exceed 1000 characters');
  }

  return errors;
};

export const validateCreateSessionRequest = (data: CreateSessionRequest): string[] => {
  const errors: string[] = [];

  if (!data.clientId || !validateUUID(data.clientId)) {
    errors.push('Valid client ID is required');
  }

  if (data.rbtId && !validateUUID(data.rbtId)) {
    errors.push('RBT ID must be a valid UUID if provided');
  }

  if (!data.startTime || !data.endTime) {
    errors.push('Start time and end time are required');
  } else {
    // Validate session duration (must be exactly 3 hours for ABA)
    if (!isValidSessionDuration(data.startTime, data.endTime)) {
      errors.push('Session duration must be exactly 3 hours');
    }

    // Validate business hours
    const startTimeStr = data.startTime.toTimeString().substring(0, 5);
    const endTimeStr = data.endTime.toTimeString().substring(0, 5);
    if (!isValidBusinessHours(startTimeStr, endTimeStr)) {
      errors.push('Session must be within business hours (9:00 AM - 7:00 PM)');
    }

    // Validate day of week (Monday-Friday only)
    const dayOfWeek = data.startTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      errors.push('Sessions can only be scheduled Monday through Friday');
    }

    // Validate start time is before end time
    if (data.startTime >= data.endTime) {
      errors.push('Start time must be before end time');
    }

    // Validate session is not in the past
    if (data.startTime < new Date()) {
      errors.push('Session cannot be scheduled in the past');
    }
  }

  if (!data.location || data.location.length < 1 || data.location.length > 200) {
    errors.push('Location must be 1-200 characters');
  }

  if (!data.createdBy || !validateUUID(data.createdBy)) {
    errors.push('Valid creator ID is required');
  }

  return errors;
};

export const validateUpdateSessionRequest = (data: UpdateSessionRequest): string[] => {
  const errors: string[] = [];

  if (data.rbtId !== undefined && !validateUUID(data.rbtId)) {
    errors.push('Valid RBT ID is required');
  }

  if (data.startTime !== undefined && data.endTime !== undefined) {
    // Validate session duration (must be exactly 3 hours for ABA)
    if (!isValidSessionDuration(data.startTime, data.endTime)) {
      errors.push('Session duration must be exactly 3 hours');
    }

    // Validate business hours
    const startTimeStr = data.startTime.toTimeString().substring(0, 5);
    const endTimeStr = data.endTime.toTimeString().substring(0, 5);
    if (!isValidBusinessHours(startTimeStr, endTimeStr)) {
      errors.push('Session must be within business hours (9:00 AM - 7:00 PM)');
    }

    // Validate day of week (Monday-Friday only)
    const dayOfWeek = data.startTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      errors.push('Sessions can only be scheduled Monday through Friday');
    }

    // Validate start time is before end time
    if (data.startTime >= data.endTime) {
      errors.push('Start time must be before end time');
    }
  }

  if (data.status !== undefined && !validateSessionStatus(data.status)) {
    errors.push('Valid session status is required');
  }

  if (data.location !== undefined && (data.location.length < 1 || data.location.length > 200)) {
    errors.push('Location must be 1-200 characters');
  }

  if (data.notes !== undefined && data.notes.length > 1000) {
    errors.push('Notes cannot exceed 1000 characters');
  }

  if (data.cancellationReason !== undefined && data.cancellationReason.length > 500) {
    errors.push('Cancellation reason cannot exceed 500 characters');
  }

  if (data.completionNotes !== undefined && data.completionNotes.length > 1000) {
    errors.push('Completion notes cannot exceed 1000 characters');
  }

  if (!data.updatedBy || !validateUUID(data.updatedBy)) {
    errors.push('Valid updater ID is required');
  }

  return errors;
};