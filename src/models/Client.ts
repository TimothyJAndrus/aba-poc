import { ContactInfo, SchedulePreference } from '../types';
import { User } from './User';
import { validateEmail, validatePhone, validateTime } from '../utils/validation';

export interface Client extends User {
  dateOfBirth: Date;
  guardianContact: ContactInfo;
  specialNeeds: string[];
  preferredSchedule: SchedulePreference[];
  isActive: boolean;
  enrollmentDate: Date;
  dischargeDate?: Date;
}

export interface CreateClientRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date;
  guardianContact: ContactInfo;
  specialNeeds: string[];
  preferredSchedule: SchedulePreference[];
  enrollmentDate: Date;
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  guardianContact?: ContactInfo;
  specialNeeds?: string[];
  preferredSchedule?: SchedulePreference[];
  isActive?: boolean;
  dischargeDate?: Date;
}

export interface ClientScheduleSummary {
  clientId: string;
  weeklyHoursScheduled: number;
  preferredHours: number;
  schedulingEfficiency: number; // Percentage of preferred times met
  continuityScore: number; // Average continuity with assigned RBTs
}

// Validation functions
export const validateContactInfo = (contact: ContactInfo): string[] => {
  const errors: string[] = [];

  if (!contact.email || !validateEmail(contact.email)) {
    errors.push('Valid guardian email is required');
  }

  if (!contact.phone || !validatePhone(contact.phone)) {
    errors.push('Valid guardian phone is required');
  }

  if (contact.address) {
    if (!contact.address.street || contact.address.street.length < 1) {
      errors.push('Street address is required');
    }
    if (!contact.address.city || contact.address.city.length < 1) {
      errors.push('City is required');
    }
    if (!contact.address.state || contact.address.state.length !== 2) {
      errors.push('Valid state code is required');
    }
    if (!contact.address.zipCode || !/^\d{5}(-\d{4})?$/.test(contact.address.zipCode)) {
      errors.push('Valid zip code is required');
    }
  }

  return errors;
};

export const validateSchedulePreference = (preference: SchedulePreference): string[] => {
  const errors: string[] = [];

  if (preference.dayOfWeek < 0 || preference.dayOfWeek > 6) {
    errors.push('Day of week must be 0-6');
  }

  if (!validateTime(preference.preferredStartTime)) {
    errors.push('Valid preferred start time is required (HH:MM format)');
  }

  if (!validateTime(preference.preferredEndTime)) {
    errors.push('Valid preferred end time is required (HH:MM format)');
  }

  if (preference.priority < 1 || preference.priority > 5) {
    errors.push('Priority must be 1-5');
  }

  // Validate time order
  if (preference.preferredStartTime >= preference.preferredEndTime) {
    errors.push('Preferred start time must be before end time');
  }

  return errors;
};

export const validateClient = (client: Partial<Client>): string[] => {
  const errors: string[] = [];

  if (client.dateOfBirth !== undefined) {
    const age = (new Date().getTime() - client.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (age < 0 || age > 18) {
      errors.push('Client must be between 0 and 18 years old');
    }
  }

  if (client.guardianContact !== undefined) {
    errors.push(...validateContactInfo(client.guardianContact));
  }

  if (client.specialNeeds !== undefined && !Array.isArray(client.specialNeeds)) {
    errors.push('Special needs must be an array');
  }

  if (client.preferredSchedule !== undefined) {
    if (!Array.isArray(client.preferredSchedule)) {
      errors.push('Preferred schedule must be an array');
    } else {
      client.preferredSchedule.forEach((pref, index) => {
        const prefErrors = validateSchedulePreference(pref);
        prefErrors.forEach(error => errors.push(`Schedule preference ${index + 1}: ${error}`));
      });
    }
  }

  if (client.enrollmentDate !== undefined && client.enrollmentDate > new Date()) {
    errors.push('Enrollment date cannot be in the future');
  }

  if (client.dischargeDate !== undefined && client.enrollmentDate !== undefined && client.dischargeDate < client.enrollmentDate) {
    errors.push('Discharge date cannot be before enrollment date');
  }

  return errors;
};

export const validateCreateClientRequest = (data: CreateClientRequest): string[] => {
  const errors: string[] = [];

  // Validate user fields
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

  // Validate client-specific fields
  if (!data.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    const age = (new Date().getTime() - data.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (age < 0 || age > 18) {
      errors.push('Client must be between 0 and 18 years old');
    }
  }

  if (!data.guardianContact) {
    errors.push('Guardian contact information is required');
  } else {
    errors.push(...validateContactInfo(data.guardianContact));
  }

  if (!Array.isArray(data.specialNeeds)) {
    errors.push('Special needs must be an array');
  }

  if (!Array.isArray(data.preferredSchedule)) {
    errors.push('Preferred schedule must be an array');
  } else {
    data.preferredSchedule.forEach((pref, index) => {
      const prefErrors = validateSchedulePreference(pref);
      prefErrors.forEach(error => errors.push(`Schedule preference ${index + 1}: ${error}`));
    });
  }

  if (!data.enrollmentDate || data.enrollmentDate > new Date()) {
    errors.push('Valid enrollment date is required and cannot be in the future');
  }

  return errors;
};

export const validateUpdateClientRequest = (data: UpdateClientRequest): string[] => {
  const errors: string[] = [];

  if (data.firstName !== undefined && (data.firstName.length < 1 || data.firstName.length > 50)) {
    errors.push('First name must be 1-50 characters');
  }

  if (data.lastName !== undefined && (data.lastName.length < 1 || data.lastName.length > 50)) {
    errors.push('Last name must be 1-50 characters');
  }

  if (data.phone !== undefined && !validatePhone(data.phone)) {
    errors.push('Valid phone number is required');
  }

  if (data.guardianContact !== undefined) {
    errors.push(...validateContactInfo(data.guardianContact));
  }

  if (data.specialNeeds !== undefined && !Array.isArray(data.specialNeeds)) {
    errors.push('Special needs must be an array');
  }

  if (data.preferredSchedule !== undefined) {
    if (!Array.isArray(data.preferredSchedule)) {
      errors.push('Preferred schedule must be an array');
    } else {
      data.preferredSchedule.forEach((pref, index) => {
        const prefErrors = validateSchedulePreference(pref);
        prefErrors.forEach(error => errors.push(`Schedule preference ${index + 1}: ${error}`));
      });
    }
  }

  return errors;
};