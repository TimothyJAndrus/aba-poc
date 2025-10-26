import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { RootState } from '../../store/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'employee' | 'client';
  allowedRoles?: ('admin' | 'employee' | 'client')[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  allowedRoles,
  fallbackPath = '/login',
}) => {
  const location = useLocation();
  const { isAuthenticated, user, isLoading } = useSelector((state: RootState) => state.auth);

  // Show loading spinner while authentication state is being determined
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access
  const hasRequiredRole = checkRoleAccess(user.role, requiredRole, allowedRoles);
  
  if (!hasRequiredRole) {
    // Redirect to appropriate dashboard based on user's actual role
    const redirectPath = getRoleDashboardPath(user.role);
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

/**
 * Check if user has required role access
 */
function checkRoleAccess(
  userRole: string,
  requiredRole?: string,
  allowedRoles?: string[]
): boolean {
  // If no role restrictions, allow access
  if (!requiredRole && !allowedRoles) {
    return true;
  }

  // Check specific required role
  if (requiredRole && userRole === requiredRole) {
    return true;
  }

  // Check if user role is in allowed roles
  if (allowedRoles && allowedRoles.includes(userRole as any)) {
    return true;
  }

  return false;
}

/**
 * Get dashboard path based on user role
 */
function getRoleDashboardPath(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'employee':
      return '/employee/dashboard';
    case 'client':
      return '/client/dashboard';
    default:
      return '/';
  }
}

// Higher-order component for role-based route protection
export const withRoleProtection = (
  Component: React.ComponentType,
  requiredRole?: 'admin' | 'employee' | 'client',
  allowedRoles?: ('admin' | 'employee' | 'client')[]
) => {
  return (props: any) => (
    <ProtectedRoute requiredRole={requiredRole} allowedRoles={allowedRoles}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Specific role-based route components
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>
);

export const EmployeeRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRole="employee">{children}</ProtectedRoute>
);

export const ClientRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRole="client">{children}</ProtectedRoute>
);

// Multi-role route components
export const AdminOrEmployeeRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin', 'employee']}>{children}</ProtectedRoute>
);

export const AnyAuthenticatedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin', 'employee', 'client']}>{children}</ProtectedRoute>
);