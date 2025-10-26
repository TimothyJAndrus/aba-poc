import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { Sidebar } from '../Sidebar';
import { mockUsers, createTestStore } from '../../../test/utils';

describe('Sidebar Component', () => {
  it('shows admin navigation items for admin users', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<Sidebar />, { store });

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/user management/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduling/i)).toBeInTheDocument();
    expect(screen.getByText(/reports/i)).toBeInTheDocument();
  });

  it('shows employee navigation items for employee users', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.employee,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<Sidebar />, { store });

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/my schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/time off/i)).toBeInTheDocument();
    expect(screen.queryByText(/user management/i)).not.toBeInTheDocument();
  });

  it('shows client navigation items for client users', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.client,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<Sidebar />, { store });

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/sessions/i)).toBeInTheDocument();
    expect(screen.queryByText(/user management/i)).not.toBeInTheDocument();
  });

  it('can be collapsed and expanded', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<Sidebar />, { store });

    const collapseButton = screen.getByTestId('sidebar-collapse');
    fireEvent.click(collapseButton);

    expect(screen.getByTestId('sidebar')).toHaveClass('collapsed');
  });

  it('highlights active navigation item', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(<Sidebar />, { store });

    // Assuming we're on the dashboard page
    const dashboardLink = screen.getByText(/dashboard/i).closest('a');
    expect(dashboardLink).toHaveClass('active');
  });
});