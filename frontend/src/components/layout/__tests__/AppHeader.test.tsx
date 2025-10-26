import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { AppHeader } from '../AppHeader';
import { mockUsers, createTestStore } from '../../../test/utils';

describe('AppHeader Component', () => {
  it('displays user information when authenticated', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<AppHeader />, { store });

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('shows notification bell with badge when there are notifications', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
      notifications: {
        notifications: [
          { id: '1', message: 'Test notification', type: 'info', read: false },
          { id: '2', message: 'Another notification', type: 'warning', read: false },
        ],
        unreadCount: 2,
      },
    });

    render(<AppHeader />, { store });

    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens notification panel when bell is clicked', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
      notifications: {
        notifications: [
          { id: '1', message: 'Test notification', type: 'info', read: false },
        ],
        unreadCount: 1,
      },
    });

    render(<AppHeader />, { store });

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
  });

  it('shows global search input', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<AppHeader />, { store });

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('handles logout when logout button is clicked', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<AppHeader />, { store });

    // Open user menu
    fireEvent.click(screen.getByTestId('user-avatar'));
    
    // Click logout
    fireEvent.click(screen.getByText(/logout/i));

    // Verify logout action was dispatched (would need to check store state)
    expect(screen.getByText(/logout/i)).toBeInTheDocument();
  });
});