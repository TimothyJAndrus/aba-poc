import { BaseEntity } from '../types';
import { User } from './User';
import { validateEmail, validatePhone, validateUUID } from '../utils/validation';

export interface RBT extends User {
  licenseNumber: string;
  qualifications: string[];
  hourlyRate: number;
  isActive: boolean;
  hireDate: Date;
  terminationDate?: Date;
}

export interface CreateRBTRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  licenseNumber: string;
  qualifications: string[];
  hourlyRate: number;
  hireDate: Date;
}

export interface UpdateRBTRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  licenseNumber?: string;
  qualifications?: string[];
  hourlyRate?: number;
  isActive?: boolean;
  terminationDate?: Date;
}

export interface RBTAvailabilitySummary {
  rbtId: string;
  totalHoursAvailable: number;
  scheduledHours: number;
  availableHours: number;
  utilizationRate: number; // Percentage
}

// Validation functions
export const validateRBT = (rbt: Partial<RBT>): string[] => {
  const errors: string[] = [];

  if (rbt.licenseNumber !== undefined && (rbt.licenseNumber.length < 5 || rbt.licenseNumber.length > 20)) {
    errors.push('License number must be 5-20 characters');
  }

  if (rbt.qualifications !== undefined && !Array.isArray(rbt.qualifications)) {
    errors.push('Qualifications must be an array');
  }

  if (rbt.hourlyRate !== undefined && (rbt.hourlyRate < 0 || rbt.hourlyRate > 200)) {
    errors.push('Hourly rate must be between 0 and 200');
  }

  if (rbt.hireDate !== undefined && rbt.hireDate > new Date()) {
    errors.push('Hire date cannot be in the future');
  }

  if (rbt.terminationDate !== undefined && rbt.hireDate !== undefined && rbt.terminationDate < rbt.hireDate) {
    errors.push('Termination date cannot be before hire date');
  }

  return errors;
};

export const validateCreateRBTRequest = (data: CreateRBTRequest): string[] => {
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

  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  // Validate RBT-specific fields
  if (!data.licenseNumber || data.licenseNumber.length < 5 || data.licenseNumber.length > 20) {
    errors.push('License number must be 5-20 characters');
  }

  if (!Array.isArray(data.qualifications) || data.qualifications.length === 0) {
    errors.push('At least one qualification is required');
  }

  if (data.hourlyRate === undefined || data.hourlyRate < 0 || data.hourlyRate > 200) {
    errors.push('Hourly rate must be between 0 and 200');
  }

  if (!data.hireDate || data.hireDate > new Date()) {
    errors.push('Valid hire date is required and cannot be in the future');
  }

  return errors;
};

export const validateUpdateRBTRequest = (data: UpdateRBTRequest): string[] => {
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

  if (data.licenseNumber !== undefined && (data.licenseNumber.length < 5 || data.licenseNumber.length > 20)) {
    errors.push('License number must be 5-20 characters');
  }

  if (data.qualifications !== undefined && (!Array.isArray(data.qualifications) || data.qualifications.length === 0)) {
    errors.push('At least one qualification is required');
  }

  if (data.hourlyRate !== undefined && (data.hourlyRate < 0 || data.hourlyRate > 200)) {
    errors.push('Hourly rate must be between 0 and 200');
  }

  return errors;
};