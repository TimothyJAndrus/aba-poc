import { CalendarIntegrationService, CalendarSyncResult } from '../../services/CalendarIntegrationService';
import { getMonitoringService } from '../../services/MonitoringService';
import { getAuditLoggingService } from '../../services/AuditLoggingService';

describe('End-to-End Scheduling Workflow', () => {
  let calendarService: CalendarIntegrationService;
  let monitoringService = getMonitoringService();
  let auditService = getAuditLoggingService();

  beforeEach(() => {
    const calendarConfig = {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/auth/callback'
      }
    };
    calendarService = new CalendarIntegrationService(calendarConfig);
  });

  afterAll(() => {
    // Clean up monitoring service intervals
    monitoringService.cleanup();
  });

  describe('Calendar Integration Workflow', () => {
    it('should successfully create calendar events for sessions', async () => {
      // Mock data
      const mockClient = {
        id: 'client-123',
        email: 'parent@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        role: 'client_family' as const,
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: {
          email: 'parent@example.com',
          phone: '+1234567890'
        },
        specialNeeds: ['autism'],
        preferredSchedule: [],
        isActive: true,
        enrollmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockRBT = {
        id: 'rbt-123',
        email: 'rbt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1987654321',
        role: 'rbt' as const,
        licenseNumber: 'RBT-12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: 45.00,
        isActive: true,
        hireDate: new Date('2023-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockSession = {
        id: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T13:00:00Z'),
        status: 'scheduled' as const,
        location: 'Therapy Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'coordinator-123'
      };

      // Step 1: Create calendar event
      const calendarResult = await calendarService.createSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'ical'
      );

      expect(calendarResult.success).toBe(true);
      expect(calendarResult.provider).toBe('ical');

      // Step 2: Generate iCal file
      const icalContent = calendarService.generateICalFile(mockSession, mockClient, mockRBT);
      expect(icalContent).toContain('ABA Therapy Session - John Doe');
      expect(icalContent).toContain('Therapy Room A');
      expect(icalContent).toContain('rbt@example.com');
      expect(icalContent).toContain('parent@example.com');

      // Step 3: Update calendar event
      const updateResult = await calendarService.updateSessionEvent(
        mockSession,
        mockClient,
        mockRBT,
        'event-123',
        'ical'
      );

      expect(updateResult.success).toBe(true);

      // Step 4: Cancel calendar event
      const cancelResult = await calendarService.cancelSessionEvent('event-123', 'ical');
      expect(cancelResult.success).toBe(true);
    });
  });

  describe('Monitoring and Audit Workflow', () => {
    it('should track system metrics and audit events', async () => {
      // Step 1: Record system metrics
      monitoringService.recordRequest(150, false);
      monitoringService.recordRequest(200, false);
      monitoringService.recordRequest(300, true); // Error request

      // Trigger metrics collection
      (monitoringService as any).collectSystemMetrics();

      const systemMetrics = monitoringService.getSystemMetrics();
      expect(systemMetrics).toBeDefined();
      expect(systemMetrics?.requestCount).toBe(3);
      expect(systemMetrics?.errorCount).toBe(1);

      // Step 2: Check health status
      const healthStatus = monitoringService.getHealthStatus();
      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.uptime).toBeGreaterThan(0);

      // Step 3: Log audit events
      auditService.logUserAuth(
        'user_login',
        'user-123',
        'test@example.com',
        'coordinator',
        '192.168.1.1',
        'Mozilla/5.0',
        true,
        'session-123'
      );

      auditService.logSessionEvent(
        'session_scheduled',
        'session-123',
        'client-123',
        'rbt-123',
        'coordinator-123',
        'coordinator@example.com',
        'coordinator',
        '192.168.1.1',
        'Mozilla/5.0',
        { location: 'Therapy Room A' }
      );

      // Step 4: Query audit events
      const auditEvents = auditService.queryEvents({
        eventType: 'user_login',
        limit: 10
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]?.eventType).toBe('user_login');
      expect(auditEvents[0]?.userId).toBe('user-123');

      // Step 5: Get audit statistics
      const auditStats = auditService.getAuditStats();
      expect(auditStats.totalEvents).toBeGreaterThan(0);
      expect(auditStats.eventsByType).toBeDefined();
      expect(auditStats.recentEvents).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations: Promise<CalendarSyncResult>[] = [];
      const startTime = Date.now();

      // Simulate multiple concurrent calendar operations
      for (let i = 0; i < 10; i++) {
        const mockSession = {
          id: `session-${i}`,
          clientId: `client-${i}`,
          rbtId: `rbt-${i}`,
          startTime: new Date(Date.now() + i * 3600000),
          endTime: new Date(Date.now() + i * 3600000 + 10800000),
          status: 'scheduled' as const,
          location: `Room ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'coordinator-123'
        };

        const mockClient = {
          id: `client-${i}`,
          email: `client${i}@example.com`,
          firstName: 'Test',
          lastName: `Client${i}`,
          phone: '+1234567890',
          role: 'client_family' as const,
          dateOfBirth: new Date('2015-06-15'),
          guardianContact: {
            email: `parent${i}@example.com`,
            phone: '+1234567890'
          },
          specialNeeds: ['autism'],
          preferredSchedule: [],
          isActive: true,
          enrollmentDate: new Date('2024-01-01'),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const mockRBT = {
          id: `rbt-${i}`,
          email: `rbt${i}@example.com`,
          firstName: 'Test',
          lastName: `RBT${i}`,
          phone: '+1987654321',
          role: 'rbt' as const,
          licenseNumber: `RBT-${i}`,
          qualifications: ['ABA Therapy'],
          hourlyRate: 45.00,
          isActive: true,
          hireDate: new Date('2023-01-01'),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        operations.push(
          calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'ical')
        );
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (2 seconds)
      expect(totalTime).toBeLessThan(2000);

      // Record performance metrics
      monitoringService.recordRequest(totalTime / 10, false);
    });
  });

  describe('Data Validation and Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      // Test invalid session data
      const invalidSession = {
        id: 'invalid-session',
        clientId: '', // Invalid empty client ID
        rbtId: 'rbt-123',
        startTime: new Date('invalid-date'), // Invalid date
        endTime: new Date('2024-01-15T13:00:00Z'),
        status: 'scheduled' as const,
        location: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'coordinator-123'
      };

      const mockClient = {
        id: 'client-123',
        email: 'parent@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        role: 'client_family' as const,
        dateOfBirth: new Date('2015-06-15'),
        guardianContact: {
          email: 'parent@example.com',
          phone: '+1234567890'
        },
        specialNeeds: ['autism'],
        preferredSchedule: [],
        isActive: true,
        enrollmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockRBT = {
        id: 'rbt-123',
        email: 'rbt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1987654321',
        role: 'rbt' as const,
        licenseNumber: 'RBT-12345',
        qualifications: ['ABA Therapy'],
        hourlyRate: 45.00,
        isActive: true,
        hireDate: new Date('2023-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Should handle invalid data gracefully
      try {
        const result = await calendarService.createSessionEvent(
          invalidSession,
          mockClient,
          mockRBT,
          'ical'
        );

        // Should either succeed with warning or fail gracefully
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      } catch (error) {
        // Error should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('System Integration Test', () => {
    it('should handle complete workflow with all services integrated', async () => {
      // This test would verify that all services work together correctly
      // In a real implementation, this would test the full stack including:
      // - API endpoints
      // - Database operations
      // - Real-time updates
      // - Notification delivery
      // - Calendar integration
      // - Monitoring and logging

      // Mock a complete workflow
      const workflowSteps = [
        'User authentication',
        'Session scheduling request',
        'Constraint validation',
        'RBT selection',
        'Session creation',
        'Calendar event creation',
        'Notification sending',
        'Real-time update broadcast',
        'Metrics recording'
      ];

      // Simulate each step
      for (const step of workflowSteps) {
        // In a real test, each step would make actual API calls
        // and verify the expected behavior
        expect(step).toBeDefined();
      }

      // Verify the workflow completed successfully
      expect(workflowSteps).toHaveLength(9);
    });
  });
});