import { AuditableEntity, ScheduleEventType } from '../types';
import { validateUUID, validateEventType } from '../utils/validation';

export interface ScheduleEvent extends AuditableEntity {
  eventType: ScheduleEventType;
  sessionId?: string;
  rbtId?: string;
  clientId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface CreateScheduleEventRequest {
  eventType: ScheduleEventType;
  sessionId?: string;
  rbtId?: string;
  clientId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface ScheduleEventQuery {
  eventType?: ScheduleEventType;
  sessionId?: string;
  rbtId?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface ScheduleEventSummary {
  eventId: string;
  eventType: ScheduleEventType;
  timestamp: Date;
  description: string;
  affectedEntities: {
    sessionId?: string;
    rbtId?: string;
    clientId?: string;
  };
  createdBy: string;
}

export interface AuditTrail {
  entityType: 'session' | 'rbt' | 'client' | 'team';
  entityId: string;
  events: ScheduleEventSummary[];
  totalEvents: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

// Validation functions
export const validateAuditEntityType = (entityType: string): entityType is AuditTrail['entityType'] => {
  return ['session', 'rbt', 'client', 'team'].includes(entityType);
};

export const validateScheduleEvent = (event: Partial<ScheduleEvent>): string[] => {
  const errors: string[] = [];

  if (event.eventType !== undefined && !validateEventType(event.eventType)) {
    errors.push('Valid event type is required');
  }

  if (event.sessionId !== undefined && !validateUUID(event.sessionId)) {
    errors.push('Session ID must be a valid UUID if provided');
  }

  if (event.rbtId !== undefined && !validateUUID(event.rbtId)) {
    errors.push('RBT ID must be a valid UUID if provided');
  }

  if (event.clientId !== undefined && !validateUUID(event.clientId)) {
    errors.push('Client ID must be a valid UUID if provided');
  }

  if (event.reason !== undefined && event.reason.length > 500) {
    errors.push('Reason cannot exceed 500 characters');
  }

  // Validate that at least one entity ID is provided
  if (event.sessionId === undefined && event.rbtId === undefined && event.clientId === undefined) {
    errors.push('At least one entity ID (sessionId, rbtId, or clientId) must be provided');
  }

  return errors;
};

export const validateCreateScheduleEventRequest = (data: CreateScheduleEventRequest): string[] => {
  const errors: string[] = [];

  if (!data.eventType || !validateEventType(data.eventType)) {
    errors.push('Valid event type is required');
  }

  if (data.sessionId && !validateUUID(data.sessionId)) {
    errors.push('Session ID must be a valid UUID if provided');
  }

  if (data.rbtId && !validateUUID(data.rbtId)) {
    errors.push('RBT ID must be a valid UUID if provided');
  }

  if (data.clientId && !validateUUID(data.clientId)) {
    errors.push('Client ID must be a valid UUID if provided');
  }

  if (data.reason && data.reason.length > 500) {
    errors.push('Reason cannot exceed 500 characters');
  }

  if (!data.createdBy || !validateUUID(data.createdBy)) {
    errors.push('Valid creator ID is required');
  }

  // Validate that at least one entity ID is provided
  if (!data.sessionId && !data.rbtId && !data.clientId) {
    errors.push('At least one entity ID (sessionId, rbtId, or clientId) must be provided');
  }

  return errors;
};

export const validateScheduleEventQuery = (query: ScheduleEventQuery): string[] => {
  const errors: string[] = [];

  if (query.eventType && !validateEventType(query.eventType)) {
    errors.push('Valid event type is required');
  }

  if (query.sessionId && !validateUUID(query.sessionId)) {
    errors.push('Session ID must be a valid UUID if provided');
  }

  if (query.rbtId && !validateUUID(query.rbtId)) {
    errors.push('RBT ID must be a valid UUID if provided');
  }

  if (query.clientId && !validateUUID(query.clientId)) {
    errors.push('Client ID must be a valid UUID if provided');
  }

  if (query.createdBy && !validateUUID(query.createdBy)) {
    errors.push('Creator ID must be a valid UUID if provided');
  }

  if (query.startDate && query.endDate && query.startDate > query.endDate) {
    errors.push('Start date must be before end date');
  }

  if (query.limit !== undefined && (query.limit < 1 || query.limit > 1000)) {
    errors.push('Limit must be between 1 and 1000');
  }

  if (query.offset !== undefined && query.offset < 0) {
    errors.push('Offset must be non-negative');
  }

  return errors;
};

export const validateAuditTrail = (auditTrail: Partial<AuditTrail>): string[] => {
  const errors: string[] = [];

  if (auditTrail.entityType !== undefined && !validateAuditEntityType(auditTrail.entityType)) {
    errors.push('Valid entity type is required');
  }

  if (auditTrail.entityId !== undefined && !validateUUID(auditTrail.entityId)) {
    errors.push('Valid entity ID is required');
  }

  if (auditTrail.dateRange !== undefined) {
    if (auditTrail.dateRange.startDate > auditTrail.dateRange.endDate) {
      errors.push('Start date must be before end date');
    }
  }

  return errors;
};