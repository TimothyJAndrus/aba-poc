import { test, expect } from '@playwright/test';

test.describe('Scheduling Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Navigate to scheduling
    await page.getByText(/scheduling/i).click();
    await expect(page).toHaveURL(/.*scheduling/);
  });

  test('should display calendar with sessions', async ({ page }) => {
    // Check calendar is visible
    await expect(page.getByTestId('calendar-view')).toBeVisible();
    
    // Check for calendar navigation
    await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
    
    // Check for view mode buttons
    await expect(page.getByText(/month/i)).toBeVisible();
    await expect(page.getByText(/week/i)).toBeVisible();
    await expect(page.getByText(/day/i)).toBeVisible();
  });

  test('should switch calendar views', async ({ page }) => {
    // Switch to week view
    await page.getByText(/week/i).click();
    await expect(page.getByTestId('calendar-view')).toHaveAttribute('data-view', 'week');
    
    // Switch to day view
    await page.getByText(/day/i).click();
    await expect(page.getByTestId('calendar-view')).toHaveAttribute('data-view', 'day');
    
    // Switch back to month view
    await page.getByText(/month/i).click();
    await expect(page.getByTestId('calendar-view')).toHaveAttribute('data-view', 'month');
  });

  test('should create new session', async ({ page }) => {
    // Click on add session button
    await page.getByRole('button', { name: /add session/i }).click();
    
    // Fill session form
    await page.getByLabel(/client/i).selectOption('John Doe');
    await page.getByLabel(/rbt/i).selectOption('Jane Smith');
    await page.getByLabel(/date/i).fill('2024-01-15');
    await page.getByLabel(/start time/i).fill('10:00');
    await page.getByLabel(/end time/i).fill('11:00');
    
    // Submit form
    await page.getByRole('button', { name: /create session/i }).click();
    
    // Should show success message
    await expect(page.getByText(/session created successfully/i)).toBeVisible();
  });

  test('should edit existing session', async ({ page }) => {
    // Click on a session card
    await page.getByTestId('session-card').first().click();
    
    // Should open session details modal
    await expect(page.getByTestId('session-details-modal')).toBeVisible();
    
    // Click edit button
    await page.getByRole('button', { name: /edit/i }).click();
    
    // Modify session details
    await page.getByLabel(/notes/i).fill('Updated session notes');
    
    // Save changes
    await page.getByRole('button', { name: /save/i }).click();
    
    // Should show success message
    await expect(page.getByText(/session updated successfully/i)).toBeVisible();
  });

  test('should detect scheduling conflicts', async ({ page }) => {
    // Try to create overlapping session
    await page.getByRole('button', { name: /add session/i }).click();
    
    // Fill form with conflicting time
    await page.getByLabel(/client/i).selectOption('John Doe');
    await page.getByLabel(/rbt/i).selectOption('Jane Smith');
    await page.getByLabel(/date/i).fill('2024-01-15');
    await page.getByLabel(/start time/i).fill('10:30'); // Overlaps with existing
    await page.getByLabel(/end time/i).fill('11:30');
    
    // Should show conflict warning
    await expect(page.getByText(/scheduling conflict detected/i)).toBeVisible();
    await expect(page.getByTestId('conflict-warning')).toBeVisible();
  });

  test('should filter sessions by RBT', async ({ page }) => {
    // Use RBT filter
    await page.getByLabel(/filter by rbt/i).selectOption('Jane Smith');
    
    // Should show only Jane's sessions
    const sessionCards = page.getByTestId('session-card');
    await expect(sessionCards).toContainText('Jane Smith');
  });

  test('should export schedule data', async ({ page }) => {
    // Click export button
    await page.getByRole('button', { name: /export/i }).click();
    
    // Select export format
    await page.getByLabel(/format/i).selectOption('csv');
    
    // Click download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download/i }).click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('schedule');
  });
});