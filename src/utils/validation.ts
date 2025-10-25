import { UserRole, SessionStatus, ScheduleEventType } from '../types';

// Validation helper functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone);
};

export const validateUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const validateTime = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const validateTimeString = (time: string): boolean => {
  return validateTime(time);
};

export const validateDateString = (date: string): boolean => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

export const validateUserRole = (role: string): role is UserRole => {
  return ['admin', 'coordinator', 'rbt', 'client_family'].includes(role);
};

export const validateSessionStatus = (status: string): status is SessionStatus => {
  return ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status);
};

export const validateEventType = (eventType: string): eventType is ScheduleEventType => {
  return ['session_created', 'session_cancelled', 'session_rescheduled', 'rbt_unavailable', 'team_created', 'team_updated', 'team_ended', 'rbt_added', 'rbt_removed', 'primary_changed'].includes(eventType);
};

// User validation
export const validateCreateUserRequest = (data: any): string[] => {
  const errors: string[] = [];
  
  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }
  
  if (!data.firstName || data.firstName.length < 1 || data.firstName.length > 50) {
    errors.push('First name must be 1-50 characters');
  }
  
  if (!data.lastName || data.lastName.length < 1 || data.lastName.length > 50) {
    errors.push('Last name must be 1-50 characters');
  }
  
  if (!data.phone || !validatePhone(data.phone)) {
    errors.push('Valid phone number is required');
  }
  
  if (!data.role || !validateUserRole(data.role)) {
    errors.push('Valid user role is required');
  }
  
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  return errors;
};

// Session validation
export const validateCreateSessionRequest = (data: any): string[] => {
  const errors: string[] = [];
  
  if (!data.clientId || !validateUUID(data.clientId)) {
    errors.push('Valid client ID is required');
  }
  
  if (data.rbtId && !validateUUID(data.rbtId)) {
    errors.push('RBT ID must be a valid UUID if provided');
  }
  
  if (!data.startTime || !data.endTime) {
    errors.push('Start time and end time are required');
  }
  
  if (!data.location || data.location.length < 1 || data.location.length > 200) {
    errors.push('Location must be 1-200 characters');
  }
  
  if (!data.createdBy || !validateUUID(data.createdBy)) {
    errors.push('Valid creator ID is required');
  }
  
  return errors;
};

// Team validation
export const validateCreateTeamRequest = (data: any): string[] => {
  const errors: string[] = [];
  
  if (!data.clientId || !validateUUID(data.clientId)) {
    errors.push('Valid client ID is required');
  }
  
  if (!Array.isArray(data.rbtIds) || data.rbtIds.length === 0) {
    errors.push('At least one RBT ID is required');
  } else {
    for (const rbtId of data.rbtIds) {
      if (!validateUUID(rbtId)) {
        errors.push('All RBT IDs must be valid UUIDs');
        break;
      }
    }
  }
  
  if (!data.primaryRbtId || !validateUUID(data.primaryRbtId)) {
    errors.push('Valid primary RBT ID is required');
  }
  
  if (!data.effectiveDate) {
    errors.push('Effective date is required');
  }
  
  if (!data.createdBy || !validateUUID(data.createdBy)) {
    errors.push('Valid creator ID is required');
  }
  
  return errors;
};

export const isValidBusinessHours = (startTime: string, endTime: string): boolean => {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const businessStart = new Date('2000-01-01T09:00:00');
  const businessEnd = new Date('2000-01-01T19:00:00');
  
  return start >= businessStart && end <= businessEnd && start < end;
};

export const isValidSessionDuration = (startTime: Date, endTime: Date): boolean => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  return durationHours === 3; // ABA sessions must be exactly 3 hours
};