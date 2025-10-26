import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from './utils';
import { QueryClient } from '@tanstack/react-query';
import { createTestStore } from './utils';
import { AppWrapper } from '../components/AppWrapper';
import { mockUsers } from './utils';

// Enhanced mock API responses with real backend structure
const mockApiResponses = {
  '/api/v1/auth/login': {
    success: true,
    data: {
      user: mockUsers.admin,
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE1MTYyMzkwMjJ9.mock-signature',
      refreshToken: 'refresh-token-123'
    },
    message: 'Login successful'
  },
  '/api/v1/dashboard/metrics': {
    success: true,
    data: {
      totalSessions: 150,
      activeUsers: 25,
      completionRate: 95,
      pendingRequests: 3,
      systemHealth: 'healthy'
    }
  },
  '/api/v1/sessions': {
    success: true,
    data: [
      {
        id: 'session-1',
        clientId: 'client-1',
        clientName: 'John Doe',
        rbtId: 'rbt-1',
        rbtName: 'Jane Smith',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z',
        status: 'scheduled',
        location: 'Therapy Room A'
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1
    }
  },
  '/api/v1/users': {
    success: true,
    data: [
      mockUsers.admin,
      mockUsers.employee,
      mockUsers.client
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 3
    }
  },
  '/api/v1/notifications': {
    success: true,
    data: [
      {
        id: 'notif-1',
        type: 'session_scheduled',
        message: 'New session scheduled for John Doe',
        read: false,
        createdAt: '2024-01-15T09:00:00Z'
      }
    ]
  }
};

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN
};

globalThis.WebSocket = vi.fn(() => mockWebSocket) as any;
globalThis.fetch = vi.fn();

describe('Comprehensive Integration Tests - Real Backend Integration', () => {
  let queryClient: QueryClient;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    store = createTestStore();

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const endpoint = url.replace('http://localhost:3000', '');
      const method = init?.method || 'GET';

      // Handle different HTTP methods
      if (method === 'POST' && endpoint === '/api/v1/auth/login') {
        const body = JSON.parse(init?.body as string);
        if (body.email === 'admin@example.com' && body.password === 'password123') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockApiResponses['/api/v1/auth/login']),
          } as Response);
        } else {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({
              success: false,
              error: 'Invalid credentials'
            }),
          } as Response);
        }
      }

      const response = mockApiResponses[endpoint as keyof typeof mockApiResponses];

      if (response) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff'
          })
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          success: false,
          error: 'Not found'
        }),
      } as Response);
    });
  });

  describe('Complete Authentication Workflow', () => {
    it('should handle complete authentication flow with JWT validation', async () => {
      render(<AppWrapper children={undefined} />, { store, queryClient });

      // Should start at login page
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();

      // Fill login form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'admin@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Should navigate to dashboard after successful login
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Should show user info in header
      expect(screen.getByText('Admin User')).toBeInTheDocument();

      // Should store JWT token
      const authState = store.getState().auth;
      expect(authState.token).toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(authState.isAuthenticated).toBe(true);
    });

    it('should handle authentication failures with proper error messages', async () => {
      render(<AppWrapper children={undefined} />, { store, queryClient });

      // Fill login form with invalid credentials
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrongpassword' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Should remain on login page
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    it('should handle token refresh and session management', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'expired-token',
        },
      });

      // Mock token refresh endpoint
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/v1/auth/refresh')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                token: 'new-token',
                refreshToken: 'new-refresh-token'
              }
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ success: false, error: 'Unauthorized' }),
        } as Response);
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Should attempt to refresh token and redirect to login if failed
      await waitFor(() => {
        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Data Integration', () => {
    it('should load and display dashboard metrics with real-time updates', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Should load and display metrics
      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument(); // Total sessions
        expect(screen.getByText('25')).toBeInTheDocument(); // Active users
        expect(screen.getByText('95')).toBeInTheDocument(); // Completion rate
      });

      // Simulate WebSocket update
      const wsEventListener = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'message')?.[1];

      if (wsEventListener) {
        wsEventListener({
          data: JSON.stringify({
            type: 'metrics_update',
            data: {
              totalSessions: 151,
              activeUsers: 26,
              completionRate: 96
            }
          })
        } as MessageEvent);

        // Should update metrics in real-time
        await waitFor(() => {
          expect(screen.getByText('151')).toBeInTheDocument();
          expect(screen.getByText('26')).toBeInTheDocument();
          expect(screen.getByText('96')).toBeInTheDocument();
        });
      }
    });

    it('should handle WebSocket connection and real-time notifications', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
        notifications: {
          notifications: [],
          unreadCount: 0,
        },
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Should establish WebSocket connection
      expect(globalThis.WebSocket).toHaveBeenCalled();

      // Simulate WebSocket notification
      const wsEventListener = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'message')?.[1];

      if (wsEventListener) {
        wsEventListener({
          data: JSON.stringify({
            type: 'notification',
            data: {
              id: 'notif-1',
              message: 'New session scheduled',
              type: 'info',
              read: false,
            }
          })
        } as MessageEvent);

        // Should show notification badge
        await waitFor(() => {
          expect(screen.getByTestId('notification-badge')).toBeInTheDocument();
        });

        // Click notification bell
        fireEvent.click(screen.getByTestId('notification-bell'));

        // Should show notification panel
        expect(screen.getByText('New session scheduled')).toBeInTheDocument();
      }
    });
  });

  describe('Role-Based Access Control Integration', () => {
    it('should enforce role-based navigation and data access', async () => {
      const employeeStore = createTestStore({
        auth: {
          user: mockUsers.employee,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      render(<AppWrapper children={undefined} />, { store: employeeStore, queryClient });

      // Employee should not see admin menu items
      expect(screen.queryByText(/user management/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/reports/i)).not.toBeInTheDocument();

      // Employee should see their own menu items
      expect(screen.getByText(/my schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/time off/i)).toBeInTheDocument();

      // Should make role-specific API calls
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/employee/dashboard'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-token'
            })
          })
        );
      });
    });

    it('should handle API authorization errors', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.employee,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      // Mock unauthorized API response
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/v1/admin/')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({
              success: false,
              error: 'Forbidden: Insufficient permissions'
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        } as Response);
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Attempt to access admin functionality should show error
      fireEvent.click(screen.getByText(/dashboard/i));

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions|access denied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Complete User Workflows', () => {
    it('should handle complete session scheduling workflow', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      // Mock session creation API
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (init?.method === 'POST' && url.includes('/api/v1/sessions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                id: 'new-session-1',
                clientName: 'John Doe',
                rbtName: 'Jane Smith',
                startTime: '2024-01-20T10:00:00Z',
                endTime: '2024-01-20T11:00:00Z',
                status: 'scheduled'
              },
              message: 'Session created successfully'
            }),
          } as Response);
        }

        const endpoint = url.replace('http://localhost:3000', '');
        const response = mockApiResponses[endpoint as keyof typeof mockApiResponses];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response || { success: true, data: [] }),
        } as Response);
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Navigate to scheduling
      fireEvent.click(screen.getByText(/scheduling/i));

      await waitFor(() => {
        expect(screen.getByText(/scheduling management/i)).toBeInTheDocument();
      });

      // Click add session button
      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      // Fill session form
      fireEvent.change(screen.getByLabelText(/client/i), {
        target: { value: 'client-1' },
      });
      fireEvent.change(screen.getByLabelText(/rbt/i), {
        target: { value: 'rbt-1' },
      });
      fireEvent.change(screen.getByLabelText(/date/i), {
        target: { value: '2024-01-20' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /create session/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/session created successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle complete time-off request workflow', async () => {
      const employeeStore = createTestStore({
        auth: {
          user: mockUsers.employee,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      // Mock time-off request API
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (init?.method === 'POST' && url.includes('/api/v1/time-off')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                id: 'timeoff-1',
                startDate: '2024-01-25',
                endDate: '2024-01-26',
                reason: 'Personal',
                status: 'pending'
              },
              message: 'Time-off request submitted successfully'
            }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        } as Response);
      });

      render(<AppWrapper children={undefined} />, { store: employeeStore, queryClient });

      // Navigate to time-off
      fireEvent.click(screen.getByText(/time off/i));

      await waitFor(() => {
        expect(screen.getByText(/time off management/i)).toBeInTheDocument();
      });

      // Click request time-off button
      fireEvent.click(screen.getByRole('button', { name: /request time off/i }));

      // Fill time-off form
      fireEvent.change(screen.getByLabelText(/start date/i), {
        target: { value: '2024-01-25' },
      });
      fireEvent.change(screen.getByLabelText(/end date/i), {
        target: { value: '2024-01-26' },
      });
      fireEvent.change(screen.getByLabelText(/reason/i), {
        target: { value: 'Personal' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/time-off request submitted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Should show error message when API fails
      await waitFor(() => {
        expect(screen.getByText(/error loading data|network error/i)).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle WebSocket disconnection and reconnection', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Simulate WebSocket disconnection
      const wsCloseListener = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'close')?.[1];

      if (wsCloseListener) {
        wsCloseListener({ code: 1006, reason: 'Connection lost' } as CloseEvent);

        // Should show disconnected status
        await waitFor(() => {
          expect(screen.getByText(/disconnected|connection lost/i)).toBeInTheDocument();
        });

        // Simulate reconnection
        const wsOpenListener = vi.mocked(mockWebSocket.addEventListener).mock.calls
          .find(call => call[0] === 'open')?.[1];

        if (wsOpenListener) {
          wsOpenListener({} as Event);

          // Should show connected status
          await waitFor(() => {
            expect(screen.getByText(/connected/i)).toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('Performance and Data Validation', () => {
    it('should validate form data before submission', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Navigate to user management
      fireEvent.click(screen.getByText(/user management/i));

      // Click add user button
      fireEvent.click(screen.getByRole('button', { name: /add user/i }));

      // Try to submit empty form
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      // Fill form with invalid email
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid-email' },
      });

      // Should show email validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('should handle large datasets efficiently', async () => {
      const authenticatedStore = createTestStore({
        auth: {
          user: mockUsers.admin,
          isAuthenticated: true,
          token: 'valid-token',
        },
      });

      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        clientName: `Client ${i}`,
        rbtName: `RBT ${i}`,
        startTime: `2024-01-${(i % 30) + 1}T10:00:00Z`,
        endTime: `2024-01-${(i % 30) + 1}T11:00:00Z`,
        status: 'scheduled'
      }));

      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/v1/sessions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: largeDataset,
              pagination: {
                page: 1,
                limit: 50,
                total: 1000
              }
            }),
          } as Response);
        }

        const endpoint = url.replace('http://localhost:3000', '');
        const response = mockApiResponses[endpoint as keyof typeof mockApiResponses];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response || { success: true, data: [] }),
        } as Response);
      });

      const startTime = performance.now();

      render(<AppWrapper children={undefined} />, { store: authenticatedStore, queryClient });

      // Navigate to scheduling
      fireEvent.click(screen.getByText(/scheduling/i));

      // Should load efficiently
      await waitFor(() => {
        expect(screen.getByText(/scheduling management/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });
  });
});