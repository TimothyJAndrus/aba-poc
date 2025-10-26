import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control - Real Backend Integration', () => {
  // Test data for different user roles
  const users = {
    admin: {
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      expectedRoutes: ['/admin/dashboard', '/admin/users', '/admin/scheduling', '/admin/reports'],
      forbiddenRoutes: []
    },
    employee: {
      email: 'employee@example.com',
      password: 'password123',
      role: 'employee',
      expectedRoutes: ['/employee/dashboard', '/employee/schedule', '/employee/time-off'],
      forbiddenRoutes: ['/admin/users', '/admin/scheduling', '/client/dashboard']
    },
    client: {
      email: 'client@example.com',
      password: 'password123',
      role: 'client',
      expectedRoutes: ['/client/dashboard', '/client/schedule', '/client/sessions'],
      forbiddenRoutes: ['/admin/users', '/employee/time-off', '/admin/scheduling']
    }
  };

  test.describe('Admin Role Access Control', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.admin.email);
      await page.getByLabel(/password/i).fill(users.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should have access to all admin features', async ({ page }) => {
      // Verify admin can access all admin routes
      for (const route of users.admin.expectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
        
        // Should not show access denied
        await expect(page.getByText(/access denied|unauthorized/i)).not.toBeVisible();
      }
    });

    test('should see admin-specific navigation menu', async ({ page }) => {
      // Check for admin menu items
      await expect(page.getByText(/user management/i)).toBeVisible();
      await expect(page.getByText(/scheduling management/i)).toBeVisible();
      await expect(page.getByText(/reports & analytics/i)).toBeVisible();
      await expect(page.getByText(/system settings/i)).toBeVisible();
    });

    test('should be able to manage users', async ({ page }) => {
      await page.getByText(/user management/i).click();
      await expect(page).toHaveURL(/.*users/);
      
      // Should see user management controls
      await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /bulk actions/i })).toBeVisible();
      
      // Should see user table with all users
      await expect(page.getByTestId('users-table')).toBeVisible();
      
      // Should be able to edit user roles
      const firstEditButton = page.getByTestId('edit-user-button').first();
      if (await firstEditButton.isVisible()) {
        await firstEditButton.click();
        await expect(page.getByLabel(/role/i)).toBeVisible();
      }
    });

    test('should be able to access system-wide scheduling', async ({ page }) => {
      await page.getByText(/scheduling/i).click();
      await expect(page).toHaveURL(/.*scheduling/);
      
      // Should see all sessions across all clients
      await expect(page.getByTestId('calendar-view')).toBeVisible();
      
      // Should have admin scheduling controls
      await expect(page.getByRole('button', { name: /bulk operations/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /add session/i })).toBeVisible();
    });

    test('should access comprehensive analytics', async ({ page }) => {
      await page.getByText(/reports/i).click();
      await expect(page).toHaveURL(/.*reports/);
      
      // Should see system-wide metrics
      await expect(page.getByTestId('system-metrics')).toBeVisible();
      await expect(page.getByText(/total sessions/i)).toBeVisible();
      await expect(page.getByText(/completion rate/i)).toBeVisible();
      
      // Should have export capabilities
      await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    });
  });

  test.describe('Employee Role Access Control', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.employee.email);
      await page.getByLabel(/password/i).fill(users.employee.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should have access only to employee features', async ({ page }) => {
      // Verify employee can access their routes
      for (const route of users.employee.expectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
        await expect(page.getByText(/access denied|unauthorized/i)).not.toBeVisible();
      }
    });

    test('should be blocked from admin routes', async ({ page }) => {
      // Verify employee cannot access forbidden routes
      for (const route of users.employee.forbiddenRoutes) {
        await page.goto(route);
        
        // Should either redirect or show access denied
        const currentUrl = page.url();
        const isRedirected = !currentUrl.includes(route);
        const hasAccessDenied = await page.getByText(/access denied|unauthorized|forbidden/i).isVisible();
        
        expect(isRedirected || hasAccessDenied).toBeTruthy();
      }
    });

    test('should see employee-specific navigation menu', async ({ page }) => {
      // Should see employee menu items
      await expect(page.getByText(/my schedule/i)).toBeVisible();
      await expect(page.getByText(/time off/i)).toBeVisible();
      
      // Should NOT see admin menu items
      await expect(page.getByText(/user management/i)).not.toBeVisible();
      await expect(page.getByText(/system settings/i)).not.toBeVisible();
    });

    test('should only see personal schedule data', async ({ page }) => {
      await page.getByText(/my schedule/i).click();
      await expect(page).toHaveURL(/.*schedule/);
      
      // Should see personal calendar
      await expect(page.getByTestId('personal-calendar')).toBeVisible();
      
      // Should NOT have admin scheduling controls
      await expect(page.getByRole('button', { name: /bulk operations/i })).not.toBeVisible();
      
      // Calendar should be read-only
      await expect(page.getByRole('button', { name: /add session/i })).not.toBeVisible();
    });

    test('should be able to manage time-off requests', async ({ page }) => {
      await page.getByText(/time off/i).click();
      await expect(page).toHaveURL(/.*time-off/);
      
      // Should see time-off management
      await expect(page.getByRole('button', { name: /request time off/i })).toBeVisible();
      await expect(page.getByTestId('time-off-history')).toBeVisible();
      
      // Should only see own time-off requests
      const timeOffRequests = page.getByTestId('time-off-request');
      if (await timeOffRequests.count() > 0) {
        // All requests should belong to current user
        const requestElements = await timeOffRequests.all();
        for (const request of requestElements) {
          await expect(request).toContainText(users.employee.email);
        }
      }
    });
  });

  test.describe('Client Role Access Control', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.client.email);
      await page.getByLabel(/password/i).fill(users.client.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should have access only to client features', async ({ page }) => {
      // Verify client can access their routes
      for (const route of users.client.expectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
        await expect(page.getByText(/access denied|unauthorized/i)).not.toBeVisible();
      }
    });

    test('should be blocked from admin and employee routes', async ({ page }) => {
      // Verify client cannot access forbidden routes
      for (const route of users.client.forbiddenRoutes) {
        await page.goto(route);
        
        // Should either redirect or show access denied
        const currentUrl = page.url();
        const isRedirected = !currentUrl.includes(route);
        const hasAccessDenied = await page.getByText(/access denied|unauthorized|forbidden/i).isVisible();
        
        expect(isRedirected || hasAccessDenied).toBeTruthy();
      }
    });

    test('should see client-specific navigation menu', async ({ page }) => {
      // Should see client menu items
      await expect(page.getByText(/child's schedule/i)).toBeVisible();
      await expect(page.getByText(/sessions/i)).toBeVisible();
      
      // Should NOT see admin or employee menu items
      await expect(page.getByText(/user management/i)).not.toBeVisible();
      await expect(page.getByText(/time off/i)).not.toBeVisible();
    });

    test('should only see child-specific data', async ({ page }) => {
      await page.getByText(/schedule/i).click();
      await expect(page).toHaveURL(/.*schedule/);
      
      // Should see child's calendar
      await expect(page.getByTestId('child-calendar')).toBeVisible();
      
      // Should only show sessions for their child
      const sessionCards = page.getByTestId('session-card');
      if (await sessionCards.count() > 0) {
        // All sessions should be for the client's child
        const sessions = await sessionCards.all();
        for (const session of sessions) {
          // Should contain client's child name or client email
          const sessionText = await session.textContent();
          expect(sessionText).toMatch(/john|client@example\.com/i);
        }
      }
    });

    test('should be able to manage own sessions only', async ({ page }) => {
      await page.getByText(/sessions/i).click();
      await expect(page).toHaveURL(/.*sessions/);
      
      // Should see session management options
      await expect(page.getByRole('button', { name: /request additional session/i })).toBeVisible();
      
      // Should be able to cancel/reschedule own sessions
      const cancelButtons = page.getByTestId('cancel-session-button');
      if (await cancelButtons.count() > 0) {
        await cancelButtons.first().click();
        await expect(page.getByTestId('cancellation-modal')).toBeVisible();
      }
    });
  });

  test.describe('Cross-Role Data Isolation', () => {
    test('should prevent data leakage between roles', async ({ browser }) => {
      // Create separate contexts for different users
      const adminContext = await browser.newContext();
      const employeeContext = await browser.newContext();
      const clientContext = await browser.newContext();
      
      const adminPage = await adminContext.newPage();
      const employeePage = await employeeContext.newPage();
      const clientPage = await clientContext.newPage();
      
      // Login each user
      await Promise.all([
        loginUser(adminPage, users.admin),
        loginUser(employeePage, users.employee),
        loginUser(clientPage, users.client)
      ]);
      
      // Admin should see all data
      await adminPage.goto('/admin/users');
      const adminUserCount = await adminPage.getByTestId('user-row').count();
      expect(adminUserCount).toBeGreaterThan(2); // Should see all users
      
      // Employee should only see limited data
      await employeePage.goto('/employee/schedule');
      const employeeSessionCount = await employeePage.getByTestId('session-card').count();
      
      // Client should only see their child's data
      await clientPage.goto('/client/schedule');
      const clientSessionCount = await clientPage.getByTestId('session-card').count();
      
      // Client should see fewer sessions than employee (only their child's)
      expect(clientSessionCount).toBeLessThanOrEqual(employeeSessionCount);
      
      // Clean up
      await Promise.all([
        adminContext.close(),
        employeeContext.close(),
        clientContext.close()
      ]);
    });

    test('should prevent privilege escalation attempts', async ({ page }) => {
      // Login as employee
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.employee.email);
      await page.getByLabel(/password/i).fill(users.employee.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Try to manipulate role in localStorage
      await page.evaluate(() => {
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        userData.role = 'admin';
        localStorage.setItem('user_data', JSON.stringify(userData));
      });
      
      // Try to access admin route
      await page.goto('/admin/users');
      
      // Should still be blocked (server-side validation)
      const currentUrl = page.url();
      const isBlocked = !currentUrl.includes('/admin/users') || 
                       await page.getByText(/access denied|unauthorized/i).isVisible();
      
      expect(isBlocked).toBeTruthy();
    });
  });

  test.describe('API Endpoint Access Control', () => {
    test('should enforce role-based API access', async ({ page }) => {
      // Login as client
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.client.email);
      await page.getByLabel(/password/i).fill(users.client.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Try to make admin API calls directly
      const response = await page.request.get('/api/v1/admin/users');
      
      // Should return 403 Forbidden or 401 Unauthorized
      expect([401, 403]).toContain(response.status());
    });

    test('should validate JWT tokens for API access', async ({ page }) => {
      // Login first to get valid token
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(users.admin.email);
      await page.getByLabel(/password/i).fill(users.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Get the token
      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      
      // Make API call with valid token
      const validResponse = await page.request.get('/api/v1/dashboard/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(validResponse.status()).toBe(200);
      
      // Make API call with invalid token
      const invalidResponse = await page.request.get('/api/v1/dashboard/metrics', {
        headers: {
          'Authorization': 'Bearer invalid.token.here'
        }
      });
      
      expect([401, 403]).toContain(invalidResponse.status());
    });
  });

  // Helper function to login a user
  async function loginUser(page: any, user: any) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  }
});