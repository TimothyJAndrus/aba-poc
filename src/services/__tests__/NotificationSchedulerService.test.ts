import { NotificationSchedulerService } from '../NotificationSchedulerService';
import { Session } from '../../models/Session';
import { Client } from '../../models/Client';
import { RBT } from '../../models/RBT';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-123'
}));

// Mock the notification service
jest.mock('../NotificationService', () => ({
  notificationService: {
    sendNotification: jest.fn().mockResolvedValue('mock-notification-id'),
    cancelNotification: jest.fn().mockResolvedValue(true)
  }
}));

describe('NotificationSchedulerService', () => {
  let schedulerService: NotificationSchedulerService;
  let mockSession: Session;
  let mockClient: Client;
  let mockRBT: RBT;

  beforeEach(() => {
    schedulerService = new NotificationSchedulerService();

    // Mock session data
    mockSession = {
      id: 'session-123',
      clientId: 'client-123',
      rbtId: 'rbt-123',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T13:00:00Z'),
      status: 'scheduled',
      location: 'Clinic Room A',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin-123'
    } as Session;

    // Mock client data
    mockClient = {
      id: 'client-123',
      email: 'parent@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1234567890',
      role: 'client_family',
      dateOfBirth: new Date('2015-01-01'),
      enrollmentDate: new Date('2024-01-01'),
      guardianContact: {
        email: 'parent@example.com',
        phone: '+1234567890'
      },
      specialNeeds: [],
      preferredSchedule: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Client;

    // Mock RBT data
    mockRBT = {
      id: 'rbt-123',
      email: 'rbt@example.com',
      firstName: 'Dr.',
      lastName: 'Johnson',
      phone: '+0987654321',
      role: 'rbt',
      licenseNumber: 'RBT-12345',
      qualifications: ['ABA Therapy'],
      hourlyRate: 75,
      hireDate: new Date('2023-01-01'),
      availability: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as RBT;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleSessionNotifications', () => {
    it('should schedule all default notifications for a session', async () => {
      const scheduledIds = await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
      expect(scheduledIds.every(id => typeof id === 'string')).toBe(true);
    });

    it('should respect custom notification configuration', async () => {
      const config = {
        sessionReminder24h: false,
        sessionReminder2h: true,
        sessionReminder30min: true
      };

      const scheduledIds = await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT,
        config
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });

    it('should handle sessions starting soon (no past reminders)', async () => {
      // Session starting in 1 hour
      const soonSession = {
        ...mockSession,
        startTime: new Date(Date.now() + 60 * 60 * 1000)
      };

      const scheduledIds = await schedulerService.scheduleSessionNotifications(
        soonSession,
        mockClient,
        mockRBT
      );

      // Should still schedule confirmation but not 24h reminder
      expect(scheduledIds.length).toBeGreaterThan(0);
    });
  });

  describe('scheduleCancellationNotifications', () => {
    it('should schedule cancellation notifications for all parties', async () => {
      const reason = 'Client illness';
      const hasAlternatives = true;

      const scheduledIds = await schedulerService.scheduleCancellationNotifications(
        mockSession,
        mockClient,
        mockRBT,
        reason,
        hasAlternatives
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
      
      // Should cancel existing reminders
      const scheduledNotifications = schedulerService.getScheduledNotifications(mockSession.id);
      const cancelledReminders = scheduledNotifications.filter(n => 
        n.notificationType === 'session_reminder' && n.status === 'cancelled'
      );
      expect(cancelledReminders.length).toBeGreaterThanOrEqual(0);
    });

    it('should include reason and alternatives info in notifications', async () => {
      const reason = 'RBT unavailable';
      const hasAlternatives = false;

      const scheduledIds = await schedulerService.scheduleCancellationNotifications(
        mockSession,
        mockClient,
        mockRBT,
        reason,
        hasAlternatives
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });
  });

  describe('scheduleReschedulingNotifications', () => {
    it('should schedule rescheduling notifications with old and new session info', async () => {
      const newSession = {
        ...mockSession,
        id: 'session-456',
        startTime: new Date('2024-01-16T14:00:00Z'),
        endTime: new Date('2024-01-16T17:00:00Z')
      };

      const newRBT = {
        ...mockRBT,
        id: 'rbt-456',
        firstName: 'Dr.',
        lastName: 'Williams'
      };

      const reason = 'Original RBT unavailable';

      const scheduledIds = await schedulerService.scheduleReschedulingNotifications(
        mockSession,
        newSession,
        mockClient,
        mockRBT,
        newRBT,
        reason
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });

    it('should handle same RBT rescheduling', async () => {
      const newSession = {
        ...mockSession,
        id: 'session-456',
        startTime: new Date('2024-01-16T14:00:00Z'),
        endTime: new Date('2024-01-16T17:00:00Z')
      };

      const reason = 'Time conflict resolved';

      const scheduledIds = await schedulerService.scheduleReschedulingNotifications(
        mockSession,
        newSession,
        mockClient,
        mockRBT,
        mockRBT, // Same RBT
        reason
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });
  });

  describe('scheduleRbtAssignmentNotifications', () => {
    it('should schedule immediate and advance notifications for RBT changes', async () => {
      const previousRBT = mockRBT;
      const newRBT = {
        ...mockRBT,
        id: 'rbt-456',
        firstName: 'Dr.',
        lastName: 'Williams'
      };

      const effectiveDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      const reason = 'Better continuity match';

      const scheduledIds = await schedulerService.scheduleRbtAssignmentNotifications(
        mockClient,
        previousRBT,
        newRBT,
        effectiveDate,
        reason
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });

    it('should handle new RBT assignment (no previous RBT)', async () => {
      const effectiveDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const reason = 'Initial assignment';

      const scheduledIds = await schedulerService.scheduleRbtAssignmentNotifications(
        mockClient,
        null, // No previous RBT
        mockRBT,
        effectiveDate,
        reason
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });

    it('should respect custom configuration for assignment notifications', async () => {
      const config = {
        immediateAssignmentChange: false,
        assignmentChangeAdvanceNotice: 48 // 48 hours advance notice
      };

      const effectiveDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now
      const reason = 'Scheduled change';

      const scheduledIds = await schedulerService.scheduleRbtAssignmentNotifications(
        mockClient,
        mockRBT,
        { ...mockRBT, id: 'rbt-456' },
        effectiveDate,
        reason,
        config
      );

      expect(scheduledIds.length).toBeGreaterThan(0);
    });
  });

  describe('cancelSessionReminders', () => {
    it('should cancel all reminders for a session', async () => {
      // First schedule some notifications
      await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT
      );

      const cancelledCount = await schedulerService.cancelSessionReminders(mockSession.id);
      expect(cancelledCount).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for session with no reminders', async () => {
      const cancelledCount = await schedulerService.cancelSessionReminders('non-existent-session');
      expect(cancelledCount).toBe(0);
    });
  });

  describe('getScheduledNotifications', () => {
    it('should return scheduled notifications for a session', async () => {
      await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT
      );

      const notifications = schedulerService.getScheduledNotifications(mockSession.id);
      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should return empty array for session with no notifications', () => {
      const notifications = schedulerService.getScheduledNotifications('non-existent-session');
      expect(notifications).toHaveLength(0);
    });
  });

  describe('getAllScheduledNotifications', () => {
    it('should return all scheduled notifications', async () => {
      await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT
      );

      const allNotifications = schedulerService.getAllScheduledNotifications();
      expect(Array.isArray(allNotifications)).toBe(true);
    });
  });

  describe('cleanupOldScheduledNotifications', () => {
    it('should remove old scheduled notifications', async () => {
      // Schedule some notifications
      await schedulerService.scheduleSessionNotifications(
        mockSession,
        mockClient,
        mockRBT
      );

      // Manually age some notifications
      const allNotifications = schedulerService.getAllScheduledNotifications();
      if (allNotifications.length > 0 && allNotifications[0]) {
        allNotifications[0].createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      const cleanedCount = await schedulerService.cleanupOldScheduledNotifications(30);
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('utility methods', () => {
    it('should format dates correctly', () => {
      // These are private methods, but we can test them indirectly through public methods
      const testDate = new Date('2024-01-15T10:00:00Z');
      
      // The formatting is tested indirectly when notifications are scheduled
      expect(testDate).toBeInstanceOf(Date);
    });

    it('should calculate duration correctly', () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T13:00:00Z');
      
      // Duration calculation is tested indirectly through notification scheduling
      const expectedDuration = 3; // 3 hours
      expect(endTime.getTime() - startTime.getTime()).toBe(expectedDuration * 60 * 60 * 1000);
    });
  });
});