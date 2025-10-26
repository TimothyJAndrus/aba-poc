import React, { useEffect, useState } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Slide,
  type SlideProps,
  Grow,
  Fade,
} from '@mui/material';
import {
  CloseOutlined,
  InfoOutlined,
  WarningOutlined,
  ErrorOutlined,
  CheckCircleOutlined,
} from '@mui/icons-material';

export interface ToastNotification {
  id: string;
  title?: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  animation?: 'slide' | 'grow' | 'fade';
}

// Slide transition component
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export const ToastNotificationComponent: React.FC<ToastNotificationProps> = ({
  notification,
  onClose,
  position = { vertical: 'bottom', horizontal: 'right' },
  animation = 'slide',
}) => {
  const [open, setOpen] = useState(true);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
    setTimeout(() => onClose(notification.id), 150); // Wait for animation
  };

  const handleActionClick = () => {
    if (notification.action) {
      notification.action.onClick();
    }
    handleClose();
  };

  // Auto-close timer
  useEffect(() => {
    if (!notification.persistent && notification.duration !== 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.persistent, notification.duration]);

  const getTransitionComponent = () => {
    switch (animation) {
      case 'grow':
        return Grow;
      case 'fade':
        return Fade;
      case 'slide':
      default:
        return SlideTransition;
    }
  };

  const getSeverity = () => {
    switch (notification.type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <ErrorOutlined />;
      case 'warning':
        return <WarningOutlined />;
      case 'info':
        return <InfoOutlined />;
      case 'success':
        return <CheckCircleOutlined />;
      default:
        return <InfoOutlined />;
    }
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={notification.persistent ? null : (notification.duration || 5000)}
      onClose={handleClose}
      anchorOrigin={position}
      TransitionComponent={getTransitionComponent()}
      sx={{
        '& .MuiSnackbarContent-root': {
          padding: 0,
        },
      }}
    >
      <Alert
        severity={getSeverity()}
        icon={getIcon()}
        onClose={handleClose}
        sx={{
          minWidth: 300,
          maxWidth: 500,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {notification.action && (
              <IconButton
                size="small"
                color="inherit"
                onClick={handleActionClick}
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                {notification.action.label}
              </IconButton>
            )}
            <IconButton
              size="small"
              color="inherit"
              onClick={handleClose}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        {notification.title && (
          <AlertTitle sx={{ mb: notification.message ? 0.5 : 0 }}>
            {notification.title}
          </AlertTitle>
        )}
        {notification.message}
      </Alert>
    </Snackbar>
  );
};

// Toast container component for managing multiple toasts
interface ToastContainerProps {
  notifications: ToastNotification[];
  onClose: (id: string) => void;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  animation?: 'slide' | 'grow' | 'fade';
  maxToasts?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onClose,
  position = { vertical: 'bottom', horizontal: 'right' },
  animation = 'slide',
  maxToasts = 5,
}) => {
  // Limit the number of visible toasts
  const visibleNotifications = notifications.slice(-maxToasts);

  return (
    <Box
      sx={{
        position: 'fixed',
        zIndex: theme => theme.zIndex.snackbar,
        pointerEvents: 'none',
        '& > *': {
          pointerEvents: 'auto',
        },
      }}
    >
      {visibleNotifications.map((notification, index) => (
        <Box
          key={notification.id}
          sx={{
            mb: index > 0 ? 1 : 0,
          }}
        >
          <ToastNotificationComponent
            notification={notification}
            onClose={onClose}
            position={position}
            animation={animation}
          />
        </Box>
      ))}
    </Box>
  );
};