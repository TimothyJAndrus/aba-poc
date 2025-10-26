import { test, expect } from '@playwright/test';

test.describe('Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('employee@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display employee dashboard', async ({ page }) => {
    // Check for employee-specific widgets
    await expect(page.getByText(/my schedule/i)).toBeVisible();
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible();
    await expect(page.getByTestId('personal-schedule-widget')).toBeVisible();
  });

  test('should show personal schedule', async ({ page }) => {
    // Navigate to schedule
    await page.getByText(/my schedule/i).click();
    
    // Should show personal calendar
    await expect(page).toHaveURL(/.*schedule/);
    await expect(page.getByTestId('personal-calendar')).toBeVisible();
    
    // Should be read-only (no edit buttons)
    await expect(page.getByRole('button', { name: /add session/i })).not.toBeVisible();
  });

  test('should submit time-off request', async ({ page }) => {
    // Navigate to time-off
    await page.getByText(/time off/i).click();
    await expect(page).toHaveURL(/.*time-off/);
    
    // Click request time-off button
    await page.getByRole('button', { name: /request time off/i }).click();
    
    // Fill time-off form
    await page.getByLabel(/start date/i).fill('2024-01-20');
    await page.getByLabel(/end date/i).fill('2024-01-21');
    await page.getByLabel(/reason/i).selectOption('Personal');
    await page.getByLabel(/notes/i).fill('Family vacation');
    
    // Submit request
    await page.getByRole('button', { name: /submit request/i }).click();
    
    // Should show success message
    await expect(page.getByText(/time-off request submitted/i)).toBeVisible();
  });

  test('should view time-off history', async ({ page }) => {
    // Navigate to time-off
    await page.getByText(/time off/i).click();
    
    // Check time-off history
    await expect(page.getByTestId('time-off-history')).toBeVisible();
    await expect(page.getByText(/request history/i)).toBeVisible();
  });

  test('should not access admin features', async ({ page }) => {
    // Should not see admin menu items
    await expect(page.getByText(/user management/i)).not.toBeVisible();
    await expect(page.getByText(/reports/i)).not.toBeVisible();
    
    // Direct navigation to admin pages should be blocked
    await page.goto('/admin/users');
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });

  test('should receive real-time notifications', async ({ page }) => {
    // Simulate receiving a notification
    await page.evaluate(() => {
      // Mock WebSocket message
      window.dispatchEvent(new CustomEvent('notification', {
        detail: {
          type: 'schedule_change',
          message: 'Your session has been rescheduled'
        }
      }));
    });
    
    // Should show toast notification
    await expect(page.getByTestId('toast-notification')).toBeVisible();
    await expect(page.getByText(/session has been rescheduled/i)).toBeVisible();
  });
});