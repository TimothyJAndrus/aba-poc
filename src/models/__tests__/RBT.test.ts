import { 
  validateRBT, 
  validateCreateRBTRequest, 
  validateUpdateRBTRequest,
  CreateRBTRequest,
  UpdateRBTRequest,
  RBT 
} from '../RBT';

describe('RBT Model Validation', () => {
  describe('validateRBT', () => {
    it('should pass validation for valid RBT data', () => {
      const validRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy', 'Autism Spectrum Disorders'],
        hourlyRate: 25.50,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(validRBT);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for short license number', () => {
      const invalidRBT: Partial<RBT> = {
        licenseNumber: '123',
        qualifications: ['ABA Therapy'],
        hourlyRate: 25.50,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('License number must be 5-20 characters');
    });

    it('should fail validation for long license number', () => {
      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'a'.repeat(21),
        qualifications: ['ABA Therapy'],
        hourlyRate: 25.50,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('License number must be 5-20 characters');
    });

    it('should fail validation for non-array qualifications', () => {
      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: 'ABA Therapy' as any,
        hourlyRate: 25.50,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('Qualifications must be an array');
    });

    it('should fail validation for negative hourly rate', () => {
      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: -5,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('Hourly rate must be between 0 and 200');
    });

    it('should fail validation for excessive hourly rate', () => {
      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: 250,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('Hourly rate must be between 0 and 200');
    });

    it('should fail validation for future hire date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: 25.50,
        hireDate: futureDate
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('Hire date cannot be in the future');
    });

    it('should fail validation for termination date before hire date', () => {
      const hireDate = new Date('2023-06-01');
      const terminationDate = new Date('2023-01-01');

      const invalidRBT: Partial<RBT> = {
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: 25.50,
        hireDate,
        terminationDate
      };

      const errors = validateRBT(invalidRBT);
      expect(errors).toContain('Termination date cannot be before hire date');
    });
  });

  describe('validateCreateRBTRequest', () => {
    it('should pass validation for valid create request', () => {
      const validRequest: CreateRBTRequest = {
        email: 'rbt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-123-4567',
        password: 'securePassword123',
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy', 'Autism Spectrum Disorders'],
        hourlyRate: 30.00,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateCreateRBTRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidRequest = {} as CreateRBTRequest;

      const errors = validateCreateRBTRequest(invalidRequest);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Valid email is required');
      expect(errors).toContain('License number must be 5-20 characters');
      expect(errors).toContain('At least one qualification is required');
    });

    it('should fail validation for empty qualifications array', () => {
      const invalidRequest: CreateRBTRequest = {
        email: 'rbt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-123-4567',
        password: 'securePassword123',
        licenseNumber: 'RBT12345',
        qualifications: [],
        hourlyRate: 30.00,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateCreateRBTRequest(invalidRequest);
      expect(errors).toContain('At least one qualification is required');
    });

    it('should fail validation for undefined hourly rate', () => {
      const invalidRequest: CreateRBTRequest = {
        email: 'rbt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-123-4567',
        password: 'securePassword123',
        licenseNumber: 'RBT12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: undefined as any,
        hireDate: new Date('2023-01-15')
      };

      const errors = validateCreateRBTRequest(invalidRequest);
      expect(errors).toContain('Hourly rate must be between 0 and 200');
    });
  });

  describe('validateUpdateRBTRequest', () => {
    it('should pass validation for valid update request', () => {
      const validRequest: UpdateRBTRequest = {
        firstName: 'Janet',
        licenseNumber: 'RBT54321',
        qualifications: ['ABA Therapy', 'Behavioral Analysis'],
        hourlyRate: 35.00,
        isActive: true
      };

      const errors = validateUpdateRBTRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for empty update request', () => {
      const emptyRequest: UpdateRBTRequest = {};

      const errors = validateUpdateRBTRequest(emptyRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for empty qualifications in update', () => {
      const invalidRequest: UpdateRBTRequest = {
        qualifications: []
      };

      const errors = validateUpdateRBTRequest(invalidRequest);
      expect(errors).toContain('At least one qualification is required');
    });

    it('should fail validation for invalid hourly rate in update', () => {
      const invalidRequest: UpdateRBTRequest = {
        hourlyRate: -10
      };

      const errors = validateUpdateRBTRequest(invalidRequest);
      expect(errors).toContain('Hourly rate must be between 0 and 200');
    });
  });
});