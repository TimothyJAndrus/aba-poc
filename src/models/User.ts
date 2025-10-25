import { BaseEntity, UserRole, ContactInfo } from '../types';
import { validateEmail, validatePhone, validateUserRole, validateUUID } from '../utils/validation';

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  password: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UserWithAuth extends User {
  passwordHash: string;
  salt: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
}

// Validation functions
export const validateUser = (user: Partial<User>): string[] => {
  const errors: string[] = [];

  if (user.email !== undefined && !validateEmail(user.email)) {
    errors.push('Valid email is required');
  }

  if (user.firstName !== undefined && (user.firstName.length < 1 || user.firstName.length > 50)) {
    errors.push('First name must be 1-50 characters');
  }

  if (user.lastName !== undefined && (user.lastName.length < 1 || user.lastName.length > 50)) {
    errors.push('Last name must be 1-50 characters');
  }

  if (user.phone !== undefined && !validatePhone(user.phone)) {
    errors.push('Valid phone number is required');
  }

  if (user.role !== undefined && !validateUserRole(user.role)) {
    errors.push('Valid user role is required');
  }

  return errors;
};

export const validateCreateUserRequest = (data: CreateUserRequest): string[] => {
  const errors: string[] = [];

  // Validate required fields
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

export const validateUpdateUserRequest = (data: UpdateUserRequest): string[] => {
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

  return errors;
};