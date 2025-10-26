import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display admin dashboard with metrics', async ({ page }) => {
    // Check for metric cards
    await expect(page.getByText(/total sessions/i)).toBeVisible();
    await expect(page.getByText(/active users/i)).toBeVisible();
    await expect(page.getByText(/completion rate/i)).toBeVisible();
    
    // Check for charts
    await expect(page.getByTestId('metrics-chart')).toBeVisible();
  });

  test('should navigate to user management', async ({ page }) => {
    // Click on user management in sidebar
    await page.getByText(/user management/i).click();
    
    // Should navigate to user management page
    await expect(page).toHaveURL(/.*users/);
    await expect(page.getByText(/manage users/i)).toBeVisible();
  });

  test('should navigate to scheduling management', async ({ page }) => {
    // Click on scheduling in sidebar
    await page.getByText(/scheduling/i).click();
    
    // Should navigate to scheduling page
    await expect(page).toHaveURL(/.*scheduling/);
    await expect(page.getByTestId('calendar-view')).toBeVisible();
  });

  test('should show notifications panel', async ({ page }) => {
    // Click notification bell
    await page.getByTestId('notification-bell').click();
    
    // Should show notification panel
    await expect(page.getByTestId('notification-panel')).toBeVisible();
    await expect(page.getByText(/notifications/i)).toBeVisible();
  });

  test('should perform global search', async ({ page }) => {
    // Type in search box
    await page.getByPlaceholder(/search/i).fill('John Doe');
    await page.keyboard.press('Enter');
    
    // Should show search results
    await expect(page.getByTestId('search-results')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Sidebar should be collapsed on mobile
    await expect(page.getByTestId('sidebar')).toHaveClass(/collapsed/);
    
    // Mobile menu button should be visible
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
  });
});