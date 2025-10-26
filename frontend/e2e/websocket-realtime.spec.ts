import { test, expect } from '@playwright/test';

test.describe('WebSocket and Real-time Updates - Backend Integration', () => {
  test.describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on login', async ({ page }) => {
      // Monitor WebSocket connections
      const wsConnections: any[] = [];
      page.on('websocket', ws => {
        wsConnections.push(ws);
        console.log(`WebSocket opened: ${ws.url()}`);
      });

      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Wait for WebSocket connection
      await page.waitForTimeout(2000);
      
      // Should have established WebSocket connection
      expect(wsConnections.length).toBeGreaterThan(0);
      
      // Verify connection status indicator
      await expect(page.getByTestId('connection-status')).toHaveText(/connected/i);
    });

    test('should handle WebSocket reconnection on network issues', async ({ page }) => {
      let wsConnections: any[] = [];
      let wsMessages: any[] = [];
      
      page.on('websocket', ws => {
        wsConnections.push(ws);
        
        ws.on('framereceived', event => {
          wsMessages.push(event.payload);
        });
        
        ws.on('close', () => {
          console.log('WebSocket closed');
        });
      });

      // Login and establish connection
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      const initialConnections = wsConnections.length;
      expect(initialConnections).toBeGreaterThan(0);
      
      // Simulate network disconnection
      await page.setOffline(true);
      await page.waitForTimeout(1000);
      
      // Should show disconnected status
      await expect(page.getByTestId('connection-status')).toHaveText(/disconnected|reconnecting/i);
      
      // Restore network
      await page.setOffline(false);
      await page.waitForTimeout(3000);
      
      // Should reconnect and show connected status
      await expect(page.getByTestId('connection-status')).toHaveText(/connected/i);
      
      // Should have attempted reconnection (may have more connections)
      expect(wsConnections.length).toBeGreaterThanOrEqual(initialConnections);
    });

    test('should close WebSocket connection on logout', async ({ page }) => {
      const wsConnections: any[] = [];
      let connectionClosed = false;
      
      page.on('websocket', ws => {
        wsConnections.push(ws);
        
        ws.on('close', () => {
          connectionClosed = true;
        });
      });

      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      expect(wsConnections.length).toBeGreaterThan(0);
      
      // Logout
      await page.getByTestId('user-avatar').click();
      await page.getByText(/logout/i).click();
      
      await expect(page).toHaveURL(/.*login/);
      await page.waitForTimeout(1000);
      
      // WebSocket should be closed
      expect(connectionClosed).toBeTruthy();
    });
  });

  test.describe('Real-time Notifications', () => {
    test('should receive and display real-time notifications', async ({ page, browser }) => {
      // Create two browser contexts to simulate different users
      const adminContext = await browser.newContext();
      const employeeContext = await browser.newContext();
      
      const adminPage = await adminContext.newPage();
      const employeePage = await employeeContext.newPage();
      
      // Login admin user
      await adminPage.goto('/login');
      await adminPage.getByLabel(/email/i).fill('admin@example.com');
      await adminPage.getByLabel(/password/i).fill('password123');
      await adminPage.getByRole('button', { name: /sign in/i }).click();
      await expect(adminPage).toHaveURL(/.*dashboard/);
      
      // Login employee user
      await employeePage.goto('/login');
      await employeePage.getByLabel(/email/i).fill('employee@example.com');
      await employeePage.getByLabel(/password/i).fill('password123');
      await employeePage.getByRole('button', { name: /sign in/i }).click();
      await expect(employeePage).toHaveURL(/.*dashboard/);
      
      // Wait for WebSocket connections
      await Promise.all([
        adminPage.waitForTimeout(2000),
        employeePage.waitForTimeout(2000)
      ]);
      
      // Admin creates a new session (this should trigger notifications)
      await adminPage.getByText(/scheduling/i).click();
      await adminPage.getByRole('button', { name: /add session/i }).click();
      
      // Fill session form
      await adminPage.getByLabel(/client/i).selectOption('John Doe');
      await adminPage.getByLabel(/rbt/i).selectOption('employee@example.com');
      await adminPage.getByLabel(/date/i).fill('2024-01-20');
      await adminPage.getByLabel(/start time/i).fill('10:00');
      await adminPage.getByLabel(/end time/i).fill('11:00');
      
      // Submit form
      await adminPage.getByRole('button', { name: /create session/i }).click();
      
      // Employee should receive real-time notification
      await expect(employeePage.getByTestId('toast-notification')).toBeVisible({ timeout: 10000 });
      await expect(employeePage.getByText(/new session scheduled/i)).toBeVisible();
      
      // Notification badge should update
      await expect(employeePage.getByTestId('notification-badge')).toBeVisible();
      
      // Clean up
      await adminContext.close();
      await employeeContext.close();
    });

    test('should handle different notification types', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      // Simulate different types of notifications via WebSocket
      const notificationTypes = [
        {
          type: 'session_scheduled',
          message: 'New session scheduled for John Doe',
          priority: 'info'
        },
        {
          type: 'session_cancelled',
          message: 'Session cancelled by client',
          priority: 'warning'
        },
        {
          type: 'system_alert',
          message: 'System maintenance scheduled',
          priority: 'error'
        }
      ];
      
      for (const notification of notificationTypes) {
        // Simulate WebSocket message
        await page.evaluate((notif) => {
          window.dispatchEvent(new CustomEvent('websocket-message', {
            detail: {
              type: 'notification',
              data: notif
            }
          }));
        }, notification);
        
        // Should show toast notification
        await expect(page.getByTestId('toast-notification')).toBeVisible();
        await expect(page.getByText(notification.message)).toBeVisible();
        
        // Wait for toast to disappear before next notification
        await page.waitForTimeout(3000);
      }
    });

    test('should persist notifications in notification panel', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      // Simulate notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: {
            type: 'notification',
            data: {
              id: 'notif-1',
              type: 'session_scheduled',
              message: 'New session scheduled',
              timestamp: new Date().toISOString()
            }
          }
        }));
      });
      
      // Should show toast
      await expect(page.getByTestId('toast-notification')).toBeVisible();
      
      // Click notification bell to open panel
      await page.getByTestId('notification-bell').click();
      
      // Should show notification in panel
      await expect(page.getByTestId('notification-panel')).toBeVisible();
      await expect(page.getByText(/new session scheduled/i)).toBeVisible();
      
      // Should show timestamp
      await expect(page.getByText(/just now|minute ago/i)).toBeVisible();
    });

    test('should handle notification preferences', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Open notification preferences
      await page.getByTestId('notification-bell').click();
      await page.getByText(/preferences/i).click();
      
      // Should show notification preferences
      await expect(page.getByTestId('notification-preferences')).toBeVisible();
      
      // Disable session notifications
      await page.getByLabel(/session notifications/i).uncheck();
      await page.getByRole('button', { name: /save preferences/i }).click();
      
      // Simulate session notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: {
            type: 'notification',
            data: {
              type: 'session_scheduled',
              message: 'New session scheduled'
            }
          }
        }));
      });
      
      // Should NOT show toast notification (disabled)
      await expect(page.getByTestId('toast-notification')).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Real-time Data Updates', () => {
    test('should update dashboard metrics in real-time', async ({ page, browser }) => {
      // Create admin and employee contexts
      const adminContext = await browser.newContext();
      const employeeContext = await browser.newContext();
      
      const adminPage = await adminContext.newPage();
      const employeePage = await employeeContext.newPage();
      
      // Login both users
      await adminPage.goto('/login');
      await adminPage.getByLabel(/email/i).fill('admin@example.com');
      await adminPage.getByLabel(/password/i).fill('password123');
      await adminPage.getByRole('button', { name: /sign in/i }).click();
      await expect(adminPage).toHaveURL(/.*dashboard/);
      
      await employeePage.goto('/login');
      await employeePage.getByLabel(/email/i).fill('employee@example.com');
      await employeePage.getByLabel(/password/i).fill('password123');
      await employeePage.getByRole('button', { name: /sign in/i }).click();
      await expect(employeePage).toHaveURL(/.*dashboard/);
      
      // Wait for initial load
      await Promise.all([
        adminPage.waitForTimeout(2000),
        employeePage.waitForTimeout(2000)
      ]);
      
      // Get initial session count from admin dashboard
      const initialCount = await adminPage.getByTestId('total-sessions-metric').textContent();
      
      // Employee submits time-off request (should update metrics)
      await employeePage.getByText(/time off/i).click();
      await employeePage.getByRole('button', { name: /request time off/i }).click();
      
      await employeePage.getByLabel(/start date/i).fill('2024-01-25');
      await employeePage.getByLabel(/end date/i).fill('2024-01-26');
      await employeePage.getByLabel(/reason/i).selectOption('Personal');
      await employeePage.getByRole('button', { name: /submit request/i }).click();
      
      // Admin dashboard should update in real-time
      await expect(adminPage.getByTestId('pending-requests-metric')).not.toHaveText('0', { timeout: 10000 });
      
      // Clean up
      await adminContext.close();
      await employeeContext.close();
    });

    test('should update calendar view in real-time', async ({ page, browser }) => {
      // Create two admin contexts to simulate concurrent users
      const admin1Context = await browser.newContext();
      const admin2Context = await browser.newContext();
      
      const admin1Page = await admin1Context.newPage();
      const admin2Page = await admin2Context.newPage();
      
      // Login both admins
      await Promise.all([
        loginAdmin(admin1Page),
        loginAdmin(admin2Page)
      ]);
      
      // Both navigate to scheduling
      await admin1Page.getByText(/scheduling/i).click();
      await admin2Page.getByText(/scheduling/i).click();
      
      await Promise.all([
        expect(admin1Page).toHaveURL(/.*scheduling/),
        expect(admin2Page).toHaveURL(/.*scheduling/)
      ]);
      
      // Admin 1 creates a session
      await admin1Page.getByRole('button', { name: /add session/i }).click();
      await admin1Page.getByLabel(/client/i).selectOption('John Doe');
      await admin1Page.getByLabel(/rbt/i).selectOption('Jane Smith');
      await admin1Page.getByLabel(/date/i).fill('2024-01-22');
      await admin1Page.getByLabel(/start time/i).fill('14:00');
      await admin1Page.getByLabel(/end time/i).fill('15:00');
      await admin1Page.getByRole('button', { name: /create session/i }).click();
      
      // Admin 2's calendar should update in real-time
      await expect(admin2Page.getByText(/john doe/i)).toBeVisible({ timeout: 10000 });
      
      // Clean up
      await admin1Context.close();
      await admin2Context.close();
    });

    test('should handle real-time session status updates', async ({ page, browser }) => {
      // Create client and admin contexts
      const clientContext = await browser.newContext();
      const adminContext = await browser.newContext();
      
      const clientPage = await clientContext.newPage();
      const adminPage = await adminContext.newPage();
      
      // Login both users
      await clientPage.goto('/login');
      await clientPage.getByLabel(/email/i).fill('client@example.com');
      await clientPage.getByLabel(/password/i).fill('password123');
      await clientPage.getByRole('button', { name: /sign in/i }).click();
      await expect(clientPage).toHaveURL(/.*dashboard/);
      
      await adminPage.goto('/login');
      await adminPage.getByLabel(/email/i).fill('admin@example.com');
      await adminPage.getByLabel(/password/i).fill('password123');
      await adminPage.getByRole('button', { name: /sign in/i }).click();
      await expect(adminPage).toHaveURL(/.*dashboard/);
      
      // Client cancels a session
      await clientPage.getByText(/sessions/i).click();
      
      const cancelButton = clientPage.getByTestId('cancel-session-button').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await clientPage.getByLabel(/reason/i).selectOption('Illness');
        await clientPage.getByRole('button', { name: /confirm cancellation/i }).click();
        
        // Admin should see the cancellation in real-time
        await adminPage.getByText(/scheduling/i).click();
        await expect(adminPage.getByText(/cancelled/i)).toBeVisible({ timeout: 10000 });
      }
      
      // Clean up
      await clientContext.close();
      await adminContext.close();
    });
  });

  test.describe('WebSocket Error Handling', () => {
    test('should handle WebSocket connection failures gracefully', async ({ page }) => {
      // Mock WebSocket to fail
      await page.addInitScript(() => {
        const originalWebSocket = window.WebSocket;
        window.WebSocket = class extends originalWebSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            // Simulate connection failure
            setTimeout(() => {
              this.dispatchEvent(new Event('error'));
              this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
            }, 1000);
          }
        };
      });
      
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Should show connection error status
      await expect(page.getByTestId('connection-status')).toHaveText(/disconnected|error/i, { timeout: 5000 });
      
      // Should show retry option
      await expect(page.getByRole('button', { name: /retry connection/i })).toBeVisible();
    });

    test('should handle malformed WebSocket messages', async ({ page }) => {
      let wsConnection: any;
      
      page.on('websocket', ws => {
        wsConnection = ws;
      });
      
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      // Send malformed message
      if (wsConnection) {
        await page.evaluate(() => {
          // Simulate malformed WebSocket message
          window.dispatchEvent(new CustomEvent('websocket-message', {
            detail: 'invalid json message'
          }));
        });
      }
      
      // Application should continue to work normally
      await expect(page.getByText(/dashboard/i)).toBeVisible();
      await expect(page.getByTestId('connection-status')).toHaveText(/connected/i);
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle high frequency of WebSocket messages', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      await page.waitForTimeout(2000);
      
      const startTime = Date.now();
      
      // Send many messages rapidly
      for (let i = 0; i < 50; i++) {
        await page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('websocket-message', {
            detail: {
              type: 'notification',
              data: {
                id: `notif-${index}`,
                type: 'test',
                message: `Test message ${index}`
              }
            }
          }));
        }, i);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should handle messages efficiently (under 2 seconds)
      expect(processingTime).toBeLessThan(2000);
      
      // UI should remain responsive
      await expect(page.getByText(/dashboard/i)).toBeVisible();
    });
  });

  // Helper function
  async function loginAdmin(page: any) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  }
});