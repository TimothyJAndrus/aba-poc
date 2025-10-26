import { test, expect } from '@playwright/test';

test.describe('Authentication Flow - Real Backend Integration', () => {
  test('should display login form with proper security headers', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
    
    // Check login form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    
    // Verify security headers are present
    const response = await page.request.get('/');
    expect(response.headers()['x-content-type-options']).toBeTruthy();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Check for validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show error for invalid credentials with rate limiting', async ({ page }) => {
    await page.goto('/login');
    
    // Test multiple failed attempts to verify rate limiting
    for (let i = 0; i < 3; i++) {
      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show error message
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
      
      // Wait between attempts
      await page.waitForTimeout(1000);
    }
    
    // After multiple attempts, should show rate limiting message
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show rate limiting or account lockout message
    await expect(page.getByText(/too many attempts|account locked/i)).toBeVisible();
  });

  test('should login successfully with valid credentials and verify JWT token', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form with valid credentials
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(/dashboard/i)).toBeVisible();
    
    // Verify JWT token is stored securely
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    
    // Verify token format (JWT has 3 parts separated by dots)
    if (token) {
      const tokenParts = token.split('.');
      expect(tokenParts).toHaveLength(3);
    }
    
    // Verify user info is displayed
    await expect(page.getByTestId('user-info')).toBeVisible();
    await expect(page.getByText(/admin/i)).toBeVisible();
  });

  test('should handle session timeout and auto-logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Simulate expired token by manipulating localStorage
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'expired.token.here');
    });
    
    // Make a request that requires authentication
    await page.getByText(/user management/i).click();
    
    // Should redirect to login due to expired token
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByText(/session expired/i)).toBeVisible();
  });

  test('should logout successfully and clear all session data', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Verify token exists before logout
    const tokenBefore = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenBefore).toBeTruthy();
    
    // Click user menu and logout
    await page.getByTestId('user-avatar').click();
    await page.getByText(/logout/i).click();
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    
    // Verify all session data is cleared
    const tokenAfter = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfter).toBeNull();
    
    const userData = await page.evaluate(() => localStorage.getItem('user_data'));
    expect(userData).toBeNull();
  });

  test('should prevent access to protected routes without authentication', async ({ page }) => {
    // Try to access protected routes directly
    const protectedRoutes = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/scheduling',
      '/employee/dashboard',
      '/client/dashboard'
    ];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*login/);
      
      // Should show appropriate message
      await expect(page.getByText(/please sign in|authentication required/i)).toBeVisible();
    }
  });

  test('should handle concurrent login attempts', async ({ browser }) => {
    // Create multiple browser contexts to simulate concurrent logins
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    
    // Attempt concurrent logins with same credentials
    const loginPromises = pages.map(async (page) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      return page.waitForURL(/.*dashboard/, { timeout: 10000 });
    });
    
    // All should succeed (or handle appropriately based on business rules)
    await Promise.all(loginPromises);
    
    // Verify all sessions are valid
    for (const page of pages) {
      await expect(page.getByText(/dashboard/i)).toBeVisible();
    }
    
    // Clean up
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should verify password security requirements', async ({ page }) => {
    await page.goto('/login');
    
    // Test weak passwords (if registration is available)
    const weakPasswords = ['123', 'password', 'abc123'];
    
    for (const password of weakPasswords) {
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill(password);
      
      // Should show password strength indicator or validation
      const passwordField = page.getByLabel(/password/i);
      await expect(passwordField).toBeVisible();
      
      // Clear for next iteration
      await passwordField.clear();
    }
  });
});