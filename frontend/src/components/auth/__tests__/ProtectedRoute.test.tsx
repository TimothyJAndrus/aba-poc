import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import { ProtectedRoute } from '../ProtectedRoute';
import { mockUsers, createTestStore } from '../../../test/utils';

describe('ProtectedRoute Component', () => {
  const TestComponent = () => <div>Protected Content</div>;

  it('renders children when user is authenticated and has correct role', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.admin,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(
      <ProtectedRoute allowedRoles={['admin']}>
        <TestComponent />
      </ProtectedRoute>,
      { store }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    const store = createTestStore({
      auth: {
        user: null,
        isAuthenticated: false,
        token: null,
      },
    });

    render(
      <ProtectedRoute allowedRoles={['admin']}>
        <TestComponent />
      </ProtectedRoute>,
      { store }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows access denied when user lacks required role', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.employee,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(
      <ProtectedRoute allowedRoles={['admin']}>
        <TestComponent />
      </ProtectedRoute>,
      { store }
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows access when user has one of multiple allowed roles', () => {
    const store = createTestStore({
      auth: {
        user: mockUsers.employee,
        isAuthenticated: true,
        token: 'mock-token',
      },
    });

    render(
      <ProtectedRoute allowedRoles={['admin', 'employee']}>
        <TestComponent />
      </ProtectedRoute>,
      { store }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});