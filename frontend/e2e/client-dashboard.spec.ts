import { test, expect } from '@playwright/test';

test.describe('Client Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as client
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('client@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display client dashboard', async ({ page }) => {
    // Check for client-specific widgets
    await expect(page.getByText(/child's schedule/i)).toBeVisible();
    await expect(page.getByTestId('upcoming-sessions-widget')).toBeVisible();
    await expect(page.getByTestId('child-info-widget')).toBeVisible();
  });

  test('should view child schedule', async ({ page }) => {
    // Navigate to schedule
    await page.getByText(/schedule/i).click();
    
    // Should show child's calendar
    await expect(page).toHaveURL(/.*schedule/);
    await expect(page.getByTestId('child-calendar')).toBeVisible();
    
    // Should show only child's sessions
    await expect(page.getByText(/john's sessions/i)).toBeVisible();
  });

  test('should cancel a session', async ({ page }) => {
    // Navigate to sessions
    await page.getByText(/sessions/i).click();
    
    // Click cancel on a session
    await page.getByTestId('cancel-session-button').first().click();
    
    // Fill cancellation form
    await page.getByLabel(/reason/i).selectOption('Illness');
    await page.getByLabel(/notes/i).fill('Child is sick');
    
    // Confirm cancellation
    await page.getByRole('button', { name: /confirm cancellation/i }).click();
    
    // Should show success message
    await expect(page.getByText(/session cancelled successfully/i)).toBeVisible();
  });

  test('should request additional session', async ({ page }) => {
    // Navigate to sessions
    await page.getByText(/sessions/i).click();
    
    // Click request additional session
    await page.getByRole('button', { name: /request additional session/i }).click();
    
    // Fill request form
    await page.getByLabel(/preferred date/i).fill('2024-01-25');
    await page.getByLabel(/preferred time/i).selectOption('Morning');
    await page.getByLabel(/reason/i).fill('Extra practice needed');
    
    // Submit request
    await page.getByRole('button', { name: /submit request/i }).click();
    
    // Should show success message
    await expect(page.getByText(/session request submitted/i)).toBeVisible();
  });

  test('should reschedule a session', async ({ page }) => {
    // Navigate to sessions
    await page.getByText(/sessions/i).click();
    
    // Click reschedule on a session
    await page.getByTestId('reschedule-session-button').first().click();
    
    // Select new date and time
    await page.getByLabel(/new date/i).fill('2024-01-22');
    await page.getByLabel(/new time/i).selectOption('2:00 PM');
    await page.getByLabel(/reason/i).fill('Schedule conflict');
    
    // Confirm reschedule
    await page.getByRole('button', { name: /confirm reschedule/i }).click();
    
    // Should show success message
    await expect(page.getByText(/session rescheduled successfully/i)).toBeVisible();
  });

  test('should view session history', async ({ page }) => {
    // Check session history widget
    await expect(page.getByTestId('session-history-summary')).toBeVisible();
    
    // Click view all history
    await page.getByText(/view all history/i).click();
    
    // Should show detailed history
    await expect(page.getByTestId('session-history-table')).toBeVisible();
    await expect(page.getByText(/completed sessions/i)).toBeVisible();
  });

  test('should use communication center', async ({ page }) => {
    // Check communication widget
    await expect(page.getByTestId('communication-center')).toBeVisible();
    
    // Click send message
    await page.getByRole('button', { name: /send message/i }).click();
    
    // Fill message form
    await page.getByLabel(/recipient/i).selectOption('RBT');
    await page.getByLabel(/subject/i).fill('Question about progress');
    await page.getByLabel(/message/i).fill('How is my child doing?');
    
    // Send message
    await page.getByRole('button', { name: /send/i }).click();
    
    // Should show success message
    await expect(page.getByText(/message sent successfully/i)).toBeVisible();
  });

  test('should not access admin or employee features', async ({ page }) => {
    // Should not see admin/employee menu items
    await expect(page.getByText(/user management/i)).not.toBeVisible();
    await expect(page.getByText(/time off/i)).not.toBeVisible();
    
    // Direct navigation should be blocked
    await page.goto('/admin/users');
    await expect(page.getByText(/access denied/i)).toBeVisible();
    
    await page.goto('/employee/time-off');
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });
});