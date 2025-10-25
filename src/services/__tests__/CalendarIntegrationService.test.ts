import { CalendarIntegrationService } from '../CalendarIntegrationService';
import { Session } from '../../models/Session';
import { Client } from '../../models/Client';
import { RBT } from '../../models/RBT';

describe('CalendarIntegrationService', () => {
  let calendarService: CalendarIntegrationService;
  let mockSession: Session;
  let mockClient: Client;
  let mockRBT: RBT;

  beforeEach(() => {
    const config = {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/auth/callback'
      }
    };

    calendarService = new CalendarIntegrationService(config);

    mockSession = {
      id: 'session-123',
      clientId: 'client-123',
      rbtId: 'rbt-123',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T13:00:00Z'),
      status: 'scheduled',
      location: 'Therapy Room A',
      notes: 'Initial session',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'coordinator-123'
    };

    mockClient = {
      id: 'client-123',
      email: 'parent@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      role: 'client_family',
      dateOfBirth: new Date('2015-06-15'),
      guardianContact: {
        email: 'parent@example.com',
        phone: '+1234567890'
      },
      specialNeeds: ['autism', 'communication'],
      preferredSchedule: [],
      isActive: true,
      enrollmentDate: new Date('2024-01-01'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockRBT = {
      id: 'rbt-123',
      email: 'rbt@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1987654321',
      role: 'rbt',
      licenseNumber: 'RBT-12345',
      qualifications: ['ABA Therapy', 'Autism Spectrum'],
      hourlyRate: 45.00,
      isActive: true,
      hireDate: new Date('2023-01-01'),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('generateICalFile', () => {
    it('should generate valid iCal content for a session', () => {
      const icalContent = calendarService.generateICalFile(mockSession, mockClient, mockRBT);

      expect(icalContent).toContain('BEGIN:VCALENDAR');
      expect(icalContent).toContain('END:VCALENDAR');
      expect(icalContent).toContain('BEGIN:VEVENT');
      expect(icalContent).toContain('END:VEVENT');
      expect(icalContent).toContain('ABA Therapy Session - John Doe');
      expect(icalContent).toContain('Therapy Room A');
      expect(icalContent).toContain('rbt@example.com');
      expect(icalContent).toContain('parent@example.com');
    });

    it('should include session details in the description', () => {
      const icalContent = calendarService.generateICalFile(mockSession, mockClient, mockRBT);

      expect(icalContent).toContain('Client: John Doe');
      expect(icalContent).toContain('RBT: Jane Smith');
      expect(icalContent).toContain('Duration: 3 hours');
      expect(icalContent).toContain('Session ID: session-123');
    });
  });

  describe('createSessionEvent', () => {
    it('should successfully create iCal event', async () => {
      const result = await calendarService.createSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'ical'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ical');
      expect(result.eventId).toBe(mockSession.id);
    });

    it('should handle Google Calendar integration when not configured', async () => {
      const result = await calendarService.createSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'google'
      );

      expect(result.success).toBe(false);
      expect(result.provider).toBe('google');
      expect(result.error).toBeDefined();
    });

    it('should handle Outlook integration (not implemented)', async () => {
      const result = await calendarService.createSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'outlook'
      );

      expect(result.success).toBe(false);
      expect(result.provider).toBe('outlook');
      expect(result.error).toContain('Outlook integration not implemented');
    });
  });

  describe('updateSessionEvent', () => {
    it('should successfully update iCal event', async () => {
      const result = await calendarService.updateSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'event-123',
        'ical'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ical');
      expect(result.eventId).toBe(mockSession.id);
    });
  });

  describe('cancelSessionEvent', () => {
    it('should successfully cancel iCal event', async () => {
      const result = await calendarService.cancelSessionEvent('event-123', 'ical');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ical');
    });
  });
});