import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';
import { ToastContainer } from './notifications/ToastNotification';
import { selectToastNotifications } from '../store/notificationSlice';
import { notificationService } from '../services/notificationService';
import type { RootState } from '../store';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const toastNotifications = useSelector(selectToastNotifications);

  // Initialize WebSocket connection for authenticated users
  useWebSocket({
    autoConnect: isAuthenticated,
    subscribeToUserUpdates: true,
    subscribeToScheduleUpdates: true,
    onConnectionChange: (status) => {
      // Handle connection status changes
      if (status === 'connected') {
        notificationService.showSuccess('Connected to server');
      } else if (status === 'error') {
        notificationService.showError('Connection failed', 'Connection Error', true);
      }
    },
  });

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
    notificationService.loadSettings();
  }, []);

  // Request notification permission on first load for authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      notificationService.requestNotificationPermission().then((granted) => {
        if (!granted) {
          console.warn('Notification permission not granted');
        }
      });
    }
  }, [isAuthenticated, user]);

  // Handle toast notification removal
  const handleRemoveToast = (toastId: string) => {
    notificationService.removeToast(toastId);
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh' }}>
      {children}
      
      {/* Toast Notifications Container */}
      <ToastContainer
        notifications={toastNotifications}
        onClose={handleRemoveToast}
        position={{ vertical: 'bottom', horizontal: 'right' }}
        animation="slide"
        maxToasts={5}
      />
    </Box>
  );
};