import { apiService } from './api';
import type { LoginCredentials, AuthResponse, User } from '../types';

type UserRole = 'admin' | 'employee' | 'client' | 'coordinator';

class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly USER_KEY = 'user';
  private refreshTimer: number | null = null;

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(
        '/auth/login',
        credentials
      );

      // Store tokens and user data
      this.setTokens(response.token, response.refreshToken);
      this.setUser(response.user);

      // Set up automatic token refresh
      this.scheduleTokenRefresh(response.expiresIn);

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Invalid credentials');
    }
  }

  /**
   * Logout user and clear stored data
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate tokens on server
      await apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if server call fails
      console.warn('Logout server call failed:', error);
    } finally {
      this.clearAuthData();
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiService.post<AuthResponse>('/auth/refresh', {
        refreshToken,
      });

      // Update stored tokens and user data
      this.setTokens(response.token, response.refreshToken);
      this.setUser(response.user);

      // Schedule next refresh
      this.scheduleTokenRefresh(response.expiresIn);

      return response;
    } catch (error) {
      // If refresh fails, clear auth data and redirect to login
      this.clearAuthData();
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Get current user data
   */
  getUser(): User | null {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  }

  /**
   * Get user role for authorization checks
   */
  getUserRole(): UserRole | null {
    const user = this.getUser();
    const validRoles: UserRole[] = [
      'admin',
      'employee',
      'client',
      'coordinator',
    ];
    return user?.role && validRoles.includes(user.role as UserRole)
      ? (user.role as UserRole)
      : null;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    return this.getUserRole() === role;
  }

  /**
   * Check if user has admin privileges
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Store authentication tokens
   */
  private setTokens(token: string, refreshToken: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * Store user data
   */
  private setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh token 5 minutes before expiration
    const refreshTime = (expiresIn - 300) * 1000; // Convert to milliseconds

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          console.error('Automatic token refresh failed:', error);
          // Redirect to login page or dispatch logout action
          globalThis.location.href = '/login';
        });
      }, refreshTime);
    }
  }

  /**
   * Initialize auth service (call on app startup)
   */
  initialize(): void {
    // Check if user is already authenticated and set up refresh timer
    if (this.isAuthenticated()) {
      // Try to refresh token to ensure it's still valid
      // Only attempt if we have a refresh token
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        this.refreshToken().catch(() => {
          // If refresh fails, clear auth data
          this.clearAuthData();
        });
      }
    }
  }
}

export const authService = new AuthService();
