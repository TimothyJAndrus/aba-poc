import { getMonitoringService } from '../../services/MonitoringService';
import { CalendarIntegrationService, CalendarSyncResult } from '../../services/CalendarIntegrationService';

describe('System Performance Tests', () => {
  let monitoringService = getMonitoringService();
  let calendarService: CalendarIntegrationService;

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

  describe('Calendar Performance', () => {
    it('should generate calendar events within acceptable time limits', async () => {
      const startTime = Date.now();
      const calendarRequests: Promise<CalendarSyncResult>[] = [];

      // Create mock data
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

      // Create 10 concurrent calendar requests
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
          createdBy: 'test-coordinator'
        };

        calendarRequests.push(
          calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'ical')
        );
      }

      // Execute all requests concurrently
      const results = await Promise.all(calendarRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify performance - should complete within 1 second
      expect(totalTime).toBeLessThan(1000);

      // Record performance metrics
      monitoringService.recordRequest(totalTime / 10, false); // Average per request
    });

    it('should handle high-frequency calendar operations without performance degradation', async () => {
      const requestTimes: number[] = [];
      const numberOfRequests = 20;

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

      for (let i = 0; i < numberOfRequests; i++) {
        const requestStart = Date.now();

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
          createdBy: 'test-coordinator'
        };

        const result = await calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'ical');
        const requestEnd = Date.now();

        requestTimes.push(requestEnd - requestStart);

        expect(result.success).toBe(true);
      }

      // Calculate performance metrics
      const averageTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
      const maxTime = Math.max(...requestTimes);

      // Performance assertions
      expect(averageTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxTime).toBeLessThan(200); // No single request should take more than 200ms

      // Verify no significant performance degradation over time
      const firstHalf = requestTimes.slice(0, numberOfRequests / 2);
      const secondHalf = requestTimes.slice(numberOfRequests / 2);

      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // If both averages are 0 (very fast operations), that's acceptable
      if (firstHalfAvg > 0) {
        // Second half should not be more than 50% slower than first half
        expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
      } else {
        // Both are very fast, which is good
        expect(secondHalfAvg).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Memory Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
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
          createdBy: 'test-coordinator'
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

        // Simulate calendar operation
        await calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'ical');
      }

      const finalMemory = process.memoryUsage();

      // Memory increase should be reasonable (less than 50MB)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle calendar errors quickly without blocking', async () => {
      const errorRequests: Promise<any>[] = [];
      const startTime = Date.now();

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

      // Create multiple requests that will test error handling
      for (let i = 0; i < 5; i++) {
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
          createdBy: 'test-coordinator'
        };

        // Test with unsupported provider to trigger error handling
        errorRequests.push(
          calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'google')
            .catch(error => ({ error }))
        );
      }

      const results = await Promise.all(errorRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify errors were handled gracefully
      results.forEach(result => {
        expect(result).toBeDefined();
        // Should either have success: false or be an error object
        if ('success' in result) {
          expect(result.success).toBe(false);
        } else {
          expect(result).toHaveProperty('error');
        }
      });

      // Error handling should be fast (under 1 second for all requests)
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent calendar requests safely', async () => {
      const concurrentRequests: Promise<CalendarSyncResult>[] = [];
      const numberOfConcurrentRequests = 15;

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

      // Create many concurrent requests
      for (let i = 0; i < numberOfConcurrentRequests; i++) {
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
          createdBy: 'test-coordinator'
        };

        concurrentRequests.push(
          calendarService.createSessionEvent(mockSession, mockClient, mockRBT, 'ical')
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Concurrent execution should be efficient
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('System Resource Monitoring', () => {
    it('should track system metrics during operations', async () => {
      const initialMetrics = monitoringService.getSystemMetrics();

      // Perform operations while monitoring
      for (let i = 0; i < 10; i++) {
        const responseTime = Math.random() * 100 + 50; // 50-150ms
        monitoringService.recordRequest(responseTime, false);
      }

      // Trigger metrics collection
      (monitoringService as any).collectSystemMetrics();

      const finalMetrics = monitoringService.getSystemMetrics();

      expect(finalMetrics).toBeDefined();
      expect(finalMetrics?.requestCount).toBeGreaterThan(0);
      expect(finalMetrics?.averageResponseTime).toBeGreaterThan(0);
      expect(finalMetrics?.averageResponseTime).toBeLessThan(200);
    });
  });
});