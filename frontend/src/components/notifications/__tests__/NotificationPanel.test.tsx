import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { NotificationPanel } from '../NotificationPanel';
import { createTestStore } from '../../../test/utils';

describe('NotificationPanel Component', () => {
  const mockNotifications = [
    {
      id: '1',
      message: 'Session scheduled for tomorrow',
      type: 'info' as const,
      read: false,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: '2',
      message: 'Time-off request approved',
      type: 'success' as const,
      read: true,
      timestamp: new Date('2024-01-14T15:30:00Z'),
    },
    {
      id: '3',
      message: 'Schedule conflict detected',
      type: 'warning' as const,
      read: false,
      timestamp: new Date('2024-01-13T09:15:00Z'),
    },
  ];

  it('displays all notifications', () => {
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    expect(screen.getByText('Session scheduled for tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Time-off request approved')).toBeInTheDocument();
    expect(screen.getByText('Schedule conflict detected')).toBeInTheDocument();
  });

  it('shows unread count in header', () => {
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    expect(screen.getByText('Notifications (2)')).toBeInTheDocument();
  });

  it('marks notification as read when clicked', () => {
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    const unreadNotification = screen.getByTestId('notification-1');
    fireEvent.click(unreadNotification);

    // Verify the notification is marked as read (would check store state)
    expect(unreadNotification).toHaveClass('read');
  });

  it('shows different icons for different notification types', () => {
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    expect(screen.getByTestId('success-icon')).toBeInTheDocument();
    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
  });

  it('handles mark all as read action', () => {
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    fireEvent.click(screen.getByText(/mark all as read/i));

    // Verify all notifications are marked as read
    expect(screen.queryByText('Notifications (0)')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    const store = createTestStore({
      notifications: {
        notifications: [],
        unreadCount: 0,
      },
    });

    render(<NotificationPanel open onClose={vi.fn()} />, { store });

    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('closes panel when close button is clicked', () => {
    const onClose = vi.fn();
    const store = createTestStore({
      notifications: {
        notifications: mockNotifications,
        unreadCount: 2,
      },
    });

    render(<NotificationPanel open onClose={onClose} />, { store });

    fireEvent.click(screen.getByTestId('close-panel-button'));
    expect(onClose).toHaveBeenCalled();
  });
});