import { 
  validateUser, 
  validateCreateUserRequest, 
  validateUpdateUserRequest,
  CreateUserRequest,
  UpdateUserRequest 
} from '../User';
import { UserRole } from '../../types';

describe('User Model Validation', () => {
  describe('validateUser', () => {
    it('should pass validation for valid user data', () => {
      const validUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin' as UserRole
      };

      const errors = validateUser(validUser);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid email', () => {
      const invalidUser = {
        email: 'invalid-email',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin' as UserRole
      };

      const errors = validateUser(invalidUser);
      expect(errors).toContain('Valid email is required');
    });

    it('should fail validation for empty first name', () => {
      const invalidUser = {
        email: 'test@example.com',
        firstName: '',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin' as UserRole
      };

      const errors = validateUser(invalidUser);
      expect(errors).toContain('First name must be 1-50 characters');
    });

    it('should fail validation for long first name', () => {
      const invalidUser = {
        email: 'test@example.com',
        firstName: 'a'.repeat(51),
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin' as UserRole
      };

      const errors = validateUser(invalidUser);
      expect(errors).toContain('First name must be 1-50 characters');
    });

    it('should fail validation for invalid phone number', () => {
      const invalidUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: 'invalid-phone',
        role: 'admin' as UserRole
      };

      const errors = validateUser(invalidUser);
      expect(errors).toContain('Valid phone number is required');
    });

    it('should fail validation for invalid role', () => {
      const invalidUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'invalid-role' as UserRole
      };

      const errors = validateUser(invalidUser);
      expect(errors).toContain('Valid user role is required');
    });
  });

  describe('validateCreateUserRequest', () => {
    it('should pass validation for valid create request', () => {
      const validRequest: CreateUserRequest = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin',
        password: 'securePassword123'
      };

      const errors = validateCreateUserRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing email', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin',
        password: 'securePassword123'
      } as CreateUserRequest;

      const errors = validateCreateUserRequest(invalidRequest);
      expect(errors).toContain('Valid email is required');
    });

    it('should fail validation for short password', () => {
      const invalidRequest: CreateUserRequest = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-123-4567',
        role: 'admin',
        password: 'short'
      };

      const errors = validateCreateUserRequest(invalidRequest);
      expect(errors).toContain('Password must be at least 8 characters');
    });

    it('should fail validation for missing required fields', () => {
      const invalidRequest = {} as CreateUserRequest;

      const errors = validateCreateUserRequest(invalidRequest);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Valid email is required');
      expect(errors).toContain('First name must be 1-50 characters');
      expect(errors).toContain('Last name must be 1-50 characters');
      expect(errors).toContain('Valid phone number is required');
      expect(errors).toContain('Valid user role is required');
      expect(errors).toContain('Password must be at least 8 characters');
    });
  });

  describe('validateUpdateUserRequest', () => {
    it('should pass validation for valid update request', () => {
      const validRequest: UpdateUserRequest = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-987-6543',
        isActive: false
      };

      const errors = validateUpdateUserRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for empty update request', () => {
      const emptyRequest: UpdateUserRequest = {};

      const errors = validateUpdateUserRequest(emptyRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid phone in update', () => {
      const invalidRequest: UpdateUserRequest = {
        phone: 'invalid-phone'
      };

      const errors = validateUpdateUserRequest(invalidRequest);
      expect(errors).toContain('Valid phone number is required');
    });

    it('should fail validation for empty first name in update', () => {
      const invalidRequest: UpdateUserRequest = {
        firstName: ''
      };

      const errors = validateUpdateUserRequest(invalidRequest);
      expect(errors).toContain('First name must be 1-50 characters');
    });
  });
});