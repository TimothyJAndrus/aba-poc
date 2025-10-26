import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { RootState } from '../store/store';

// Auth components (keep these as regular imports since they're used frequently)
import { ProtectedRoute, AdminRoute, EmployeeRoute, ClientRoute } from '../components/auth';
import { Layout } from '../components/layout';

// Lazy-loaded page components
const LoginPage = React.lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })));

// Admin pages
const AdminDashboard = React.lazy(() => import('../pages/admin').then(module => ({ default: module.AdminDashboard })));
const UserManagement = React.lazy(() => import('../pages/admin').then(module => ({ default: module.UserManagement })));
const SchedulingManagement = React.lazy(() => import('../pages/admin').then(module => ({ default: module.SchedulingManagement })));
const AnalyticsDashboard = React.lazy(() => import('../pages/admin').then(module => ({ default: module.AnalyticsDashboard })));
const ReportingDashboard = React.lazy(() => import('../pages/admin').then(module => ({ default: module.ReportingDashboard })));
const SearchPage = React.lazy(() => import('../pages/admin').then(module => ({ default: module.SearchPage })));

// Employee pages
const EmployeeDashboard = React.lazy(() => import('../pages/employee').then(module => ({ default: module.EmployeeDashboard })));
const TimeOffManagement = React.lazy(() => import('../pages/employee').then(module => ({ default: module.TimeOffManagement })));

// Client pages
const ClientDashboard = React.lazy(() => import('../pages/client').then(module => ({ default: module.ClientDashboard })));
const SessionManagement = React.lazy(() => import('../pages/client').then(module => ({ default: module.SessionManagement })));

// Loading component for Suspense fallback
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    minHeight="200px"
    gap={2}
  >
    <CircularProgress size={40} />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to={getDashboardPath(user?.role)} replace />
          ) : (
            <Suspense fallback={<LoadingFallback message="Loading login..." />}>
              <LoginPage />
            </Suspense>
          )
        } 
      />

      {/* Protected routes with layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Root redirect */}
                  <Route 
                    path="/" 
                    element={<Navigate to={getDashboardPath(user?.role)} replace />} 
                  />

                  {/* Admin routes */}
                  <Route path="/admin/*" element={
                    <AdminRoute>
                      <Routes>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="schedules" element={<SchedulingManagement />} />
                        <Route path="analytics" element={<AnalyticsDashboard />} />
                        <Route path="reports" element={<ReportingDashboard />} />
                        <Route path="search" element={<SearchPage />} />
                        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                      </Routes>
                    </AdminRoute>
                  } />

                  {/* Employee routes */}
                  <Route path="/employee/*" element={
                    <EmployeeRoute>
                      <Routes>
                        <Route path="dashboard" element={<EmployeeDashboard />} />
                        <Route path="timeoff" element={<TimeOffManagement />} />
                        <Route path="*" element={<Navigate to="/employee/dashboard" replace />} />
                      </Routes>
                    </EmployeeRoute>
                  } />

                  {/* Client routes */}
                  <Route path="/client/*" element={
                    <ClientRoute>
                      <Routes>
                        <Route path="dashboard" element={<ClientDashboard />} />
                        <Route path="sessions" element={<SessionManagement />} />
                        <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
                      </Routes>
                    </ClientRoute>
                  } />

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to={getDashboardPath(user?.role)} replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

/**
 * Get dashboard path based on user role
 */
function getDashboardPath(role?: string): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'employee':
      return '/employee/dashboard';
    case 'client':
      return '/client/dashboard';
    default:
      return '/login';
  }
}