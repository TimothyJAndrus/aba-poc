import { BaseEntity } from '../types';
import { SessionSummary } from './Session';
import { validateUUID, validateTime, isValidBusinessHours } from '../utils/validation';

export interface AvailabilitySlot extends BaseEntity {
  rbtId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isRecurring: boolean;
  effectiveDate: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface CreateAvailabilitySlotRequest {
  rbtId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  effectiveDate: Date;
  endDate?: Date;
}

export interface UpdateAvailabilitySlotRequest {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isRecurring?: boolean;
  effectiveDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface AvailabilityWindow {
  rbtId: string;
  date: Date;
  availableSlots: TimeSlot[];
  scheduledSlots: TimeSlot[];
  unavailableSlots: TimeSlot[];
}

export interface TimeSlot {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  duration: number; // in minutes
  isAvailable: boolean;
  sessionId?: string; // if occupied
}

export interface WeeklyAvailability {
  rbtId: string;
  weekStartDate: Date;
  dailyAvailability: DailyAvailability[];
  totalAvailableHours: number;
  totalScheduledHours: number;
}

export interface DailyAvailability {
  date: Date;
  dayOfWeek: number;
  availableSlots: TimeSlot[];
  scheduledSessions: SessionSummary[];
  totalAvailableHours: number;
  totalScheduledHours: number;
}

// Validation functions
export const validateAvailabilitySlot = (slot: Partial<AvailabilitySlot>): string[] => {
  const errors: string[] = [];

  if (slot.rbtId !== undefined && !validateUUID(slot.rbtId)) {
    errors.push('Valid RBT ID is required');
  }

  if (slot.dayOfWeek !== undefined && (slot.dayOfWeek < 0 || slot.dayOfWeek > 6)) {
    errors.push('Day of week must be 0-6 (Sunday-Saturday)');
  }

  if (slot.startTime !== undefined && !validateTime(slot.startTime)) {
    errors.push('Valid start time is required (HH:MM format)');
  }

  if (slot.endTime !== undefined && !validateTime(slot.endTime)) {
    errors.push('Valid end time is required (HH:MM format)');
  }

  // Validate time order and business hours
  if (slot.startTime !== undefined && slot.endTime !== undefined) {
    if (slot.startTime >= slot.endTime) {
      errors.push('Start time must be before end time');
    }

    if (!isValidBusinessHours(slot.startTime, slot.endTime)) {
      errors.push('Availability must be within business hours (9:00 AM - 7:00 PM)');
    }
  }

  // Validate business days only (Monday-Friday)
  if (slot.dayOfWeek !== undefined && (slot.dayOfWeek === 0 || slot.dayOfWeek === 6)) {
    errors.push('Availability can only be set for business days (Monday-Friday)');
  }

  if (slot.effectiveDate !== undefined && slot.effectiveDate > new Date()) {
    errors.push('Effective date cannot be in the future');
  }

  if (slot.endDate !== undefined && slot.effectiveDate !== undefined && slot.endDate < slot.effectiveDate) {
    errors.push('End date cannot be before effective date');
  }

  return errors;
};

export const validateCreateAvailabilitySlotRequest = (data: CreateAvailabilitySlotRequest): string[] => {
  const errors: string[] = [];

  if (!data.rbtId || !validateUUID(data.rbtId)) {
    errors.push('Valid RBT ID is required');
  }

  if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
    errors.push('Day of week must be 0-6 (Sunday-Saturday)');
  }

  // Validate business days only (Monday-Friday)
  if (data.dayOfWeek === 0 || data.dayOfWeek === 6) {
    errors.push('Availability can only be set for business days (Monday-Friday)');
  }

  if (!data.startTime || !validateTime(data.startTime)) {
    errors.push('Valid start time is required (HH:MM format)');
  }

  if (!data.endTime || !validateTime(data.endTime)) {
    errors.push('Valid end time is required (HH:MM format)');
  }

  // Validate time order and business hours
  if (data.startTime && data.endTime) {
    if (data.startTime >= data.endTime) {
      errors.push('Start time must be before end time');
    }

    if (!isValidBusinessHours(data.startTime, data.endTime)) {
      errors.push('Availability must be within business hours (9:00 AM - 7:00 PM)');
    }
  }

  if (!data.effectiveDate) {
    errors.push('Effective date is required');
  } else if (data.effectiveDate > new Date()) {
    errors.push('Effective date cannot be in the future');
  }

  if (data.endDate && data.effectiveDate && data.endDate < data.effectiveDate) {
    errors.push('End date cannot be before effective date');
  }

  return errors;
};

export const validateUpdateAvailabilitySlotRequest = (data: UpdateAvailabilitySlotRequest): string[] => {
  const errors: string[] = [];

  if (data.dayOfWeek !== undefined && (data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
    errors.push('Day of week must be 0-6 (Sunday-Saturday)');
  }

  // Validate business days only (Monday-Friday)
  if (data.dayOfWeek !== undefined && (data.dayOfWeek === 0 || data.dayOfWeek === 6)) {
    errors.push('Availability can only be set for business days (Monday-Friday)');
  }

  if (data.startTime !== undefined && !validateTime(data.startTime)) {
    errors.push('Valid start time is required (HH:MM format)');
  }

  if (data.endTime !== undefined && !validateTime(data.endTime)) {
    errors.push('Valid end time is required (HH:MM format)');
  }

  // Validate time order and business hours (if both are provided)
  if (data.startTime !== undefined && data.endTime !== undefined) {
    if (data.startTime >= data.endTime) {
      errors.push('Start time must be before end time');
    }

    if (!isValidBusinessHours(data.startTime, data.endTime)) {
      errors.push('Availability must be within business hours (9:00 AM - 7:00 PM)');
    }
  }

  if (data.endDate !== undefined && data.effectiveDate !== undefined && data.endDate < data.effectiveDate) {
    errors.push('End date cannot be before effective date');
  }

  return errors;
};

export const validateTimeSlot = (slot: TimeSlot): string[] => {
  const errors: string[] = [];

  if (!validateTime(slot.startTime)) {
    errors.push('Valid start time is required (HH:MM format)');
  }

  if (!validateTime(slot.endTime)) {
    errors.push('Valid end time is required (HH:MM format)');
  }

  if (slot.startTime >= slot.endTime) {
    errors.push('Start time must be before end time');
  }

  if (slot.duration <= 0) {
    errors.push('Duration must be positive');
  }

  if (slot.sessionId && !validateUUID(slot.sessionId)) {
    errors.push('Session ID must be a valid UUID if provided');
  }

  return errors;
};