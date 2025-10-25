import { 
  validateClient, 
  validateCreateClientRequest, 
  validateUpdateClientRequest,
  validateContactInfo,
  validateSchedulePreference,
  CreateClientRequest,
  UpdateClientRequest,
  Client 
} from '../Client';
import { ContactInfo, SchedulePreference } from '../../types';

describe('Client Model Validation', () => {
  const validContactInfo: ContactInfo = {
    email: 'guardian@example.com',
    phone: '+1-555-123-4567',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345'
    }
  };

  const validSchedulePreference: SchedulePreference = {
    dayOfWeek: 1, // Monday
    preferredStartTime: '09:00',
    preferredEndTime: '12:00',
    priority: 1
  };

  describe('validateContactInfo', () => {
    it('should pass validation for valid contact info', () => {
      const errors = validateContactInfo(validContactInfo);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid email', () => {
      const invalidContact: ContactInfo = {
        ...validContactInfo,
        email: 'invalid-email'
      };

      const errors = validateContactInfo(invalidContact);
      expect(errors).toContain('Valid guardian email is required');
    });

    it('should fail validation for invalid phone', () => {
      const invalidContact: ContactInfo = {
        ...validContactInfo,
        phone: 'invalid-phone'
      };

      const errors = validateContactInfo(invalidContact);
      expect(errors).toContain('Valid guardian phone is required');
    });

    it('should fail validation for invalid zip code', () => {
      const invalidContact: ContactInfo = {
        ...validContactInfo,
        address: {
          ...validContactInfo.address!,
          zipCode: 'invalid'
        }
      };

      const errors = validateContactInfo(invalidContact);
      expect(errors).toContain('Valid zip code is required');
    });

    it('should fail validation for invalid state code', () => {
      const invalidContact: ContactInfo = {
        ...validContactInfo,
        address: {
          ...validContactInfo.address!,
          state: 'INVALID'
        }
      };

      const errors = validateContactInfo(invalidContact);
      expect(errors).toContain('Valid state code is required');
    });
  });

  describe('validateSchedulePreference', () => {
    it('should pass validation for valid schedule preference', () => {
      const errors = validateSchedulePreference(validSchedulePreference);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid day of week', () => {
      const invalidPreference: SchedulePreference = {
        ...validSchedulePreference,
        dayOfWeek: 7
      };

      const errors = validateSchedulePreference(invalidPreference);
      expect(errors).toContain('Day of week must be 0-6');
    });

    it('should fail validation for invalid time format', () => {
      const invalidPreference: SchedulePreference = {
        ...validSchedulePreference,
        preferredStartTime: '25:00'
      };

      const errors = validateSchedulePreference(invalidPreference);
      expect(errors).toContain('Valid preferred start time is required (HH:MM format)');
    });

    it('should fail validation for invalid priority', () => {
      const invalidPreference: SchedulePreference = {
        ...validSchedulePreference,
        priority: 6
      };

      const errors = validateSchedulePreference(invalidPreference);
      expect(errors).toContain('Priority must be 1-5');
    });

    it('should fail validation for start time after end time', () => {
      const invalidPreference: SchedulePreference = {
        ...validSchedulePreference,
        preferredStartTime: '15:00',
        preferredEndTime: '12:00'
      };

      const errors = validateSchedulePreference(invalidPreference);
      expect(errors).toContain('Preferred start time must be before end time');
    });
  });

  describe('validateClient', () => {
    it('should pass validation for valid client data', () => {
      const validClient: Partial<Client> = {
        dateOfBirth: new Date('2015-06-15'), // 8 years old
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateClient(validClient);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for client too old', () => {
      const invalidClient: Partial<Client> = {
        dateOfBirth: new Date('2000-01-01'), // 23 years old
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateClient(invalidClient);
      expect(errors).toContain('Client must be between 0 and 18 years old');
    });

    it('should fail validation for future birth date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invalidClient: Partial<Client> = {
        dateOfBirth: futureDate,
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateClient(invalidClient);
      expect(errors).toContain('Client must be between 0 and 18 years old');
    });

    it('should fail validation for non-array special needs', () => {
      const invalidClient: Partial<Client> = {
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: validContactInfo,
        specialNeeds: 'Autism' as any,
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateClient(invalidClient);
      expect(errors).toContain('Special needs must be an array');
    });

    it('should fail validation for future enrollment date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invalidClient: Partial<Client> = {
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: futureDate
      };

      const errors = validateClient(invalidClient);
      expect(errors).toContain('Enrollment date cannot be in the future');
    });

    it('should fail validation for discharge date before enrollment', () => {
      const enrollmentDate = new Date('2023-06-01');
      const dischargeDate = new Date('2023-01-01');

      const invalidClient: Partial<Client> = {
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate,
        dischargeDate
      };

      const errors = validateClient(invalidClient);
      expect(errors).toContain('Discharge date cannot be before enrollment date');
    });
  });

  describe('validateCreateClientRequest', () => {
    it('should pass validation for valid create request', () => {
      const validRequest: CreateClientRequest = {
        email: 'client@example.com',
        firstName: 'Alex',
        lastName: 'Johnson',
        phone: '+1-555-123-4567',
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [validSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateCreateClientRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidRequest = {} as CreateClientRequest;

      const errors = validateCreateClientRequest(invalidRequest);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Valid email is required');
      expect(errors).toContain('Date of birth is required');
      expect(errors).toContain('Guardian contact information is required');
    });

    it('should fail validation for invalid schedule preferences', () => {
      const invalidSchedulePreference: SchedulePreference = {
        dayOfWeek: 8,
        preferredStartTime: 'invalid',
        preferredEndTime: '12:00',
        priority: 6
      };

      const invalidRequest: CreateClientRequest = {
        email: 'client@example.com',
        firstName: 'Alex',
        lastName: 'Johnson',
        phone: '+1-555-123-4567',
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder'],
        preferredSchedule: [invalidSchedulePreference],
        enrollmentDate: new Date('2023-01-15')
      };

      const errors = validateCreateClientRequest(invalidRequest);
      expect(errors).toContain('Schedule preference 1: Day of week must be 0-6');
      expect(errors).toContain('Schedule preference 1: Valid preferred start time is required (HH:MM format)');
      expect(errors).toContain('Schedule preference 1: Priority must be 1-5');
    });
  });

  describe('validateUpdateClientRequest', () => {
    it('should pass validation for valid update request', () => {
      const validRequest: UpdateClientRequest = {
        firstName: 'Alexander',
        guardianContact: validContactInfo,
        specialNeeds: ['Autism Spectrum Disorder', 'ADHD'],
        isActive: true
      };

      const errors = validateUpdateClientRequest(validRequest);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for empty update request', () => {
      const emptyRequest: UpdateClientRequest = {};

      const errors = validateUpdateClientRequest(emptyRequest);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid guardian contact in update', () => {
      const invalidContact: ContactInfo = {
        email: 'invalid-email',
        phone: '+1-555-123-4567'
      };

      const invalidRequest: UpdateClientRequest = {
        guardianContact: invalidContact
      };

      const errors = validateUpdateClientRequest(invalidRequest);
      expect(errors).toContain('Valid guardian email is required');
    });
  });
});