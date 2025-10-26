import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Typography,
  Button,
} from '@mui/material';
import {
  WifiOutlined,
  WifiOffOutlined,
  SyncOutlined,
  ErrorOutlineOutlined,
  RefreshOutlined,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectConnectionStatus, selectIsConnected } from '../../store/notificationSlice';
import { websocketService } from '../../services/websocketService';

interface ConnectionStatusProps {
  showLabel?: boolean;
  variant?: 'chip' | 'icon' | 'full';
  size?: 'small' | 'medium';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showLabel = true,
  variant = 'chip',
  size = 'medium',
}) => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const isConnected = useSelector(selectIsConnected);
  const [showReconnectSnackbar, setShowReconnectSnackbar] = useState(false);
  const [lastConnectionTime, setLastConnectionTime] = useState<Date | null>(null);

  useEffect(() => {
    if (isConnected) {
      setLastConnectionTime(new Date());
      setShowReconnectSnackbar(false);
    } else if (connectionStatus === 'error') {
      setShowReconnectSnackbar(true);
    }
  }, [isConnected, connectionStatus]);

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'success' as const,
          icon: <WifiOutlined />,
          label: 'Connected',
          tooltip: `Connected${lastConnectionTime ? ` since ${lastConnectionTime.toLocaleTimeString()}` : ''}`,
        };
      case 'connecting':
        return {
          color: 'warning' as const,
          icon: <SyncOutlined className="animate-spin" />,
          label: 'Connecting...',
          tooltip: 'Connecting to server...',
        };
      case 'disconnected':
        return {
          color: 'default' as const,
          icon: <WifiOffOutlined />,
          label: 'Disconnected',
          tooltip: 'Disconnected from server',
        };
      case 'error':
        return {
          color: 'error' as const,
          icon: <ErrorOutlineOutlined />,
          label: 'Connection Error',
          tooltip: 'Failed to connect to server',
        };
      default:
        return {
          color: 'default' as const,
          icon: <WifiOffOutlined />,
          label: 'Unknown',
          tooltip: 'Connection status unknown',
        };
    }
  };

  const handleReconnect = async () => {
    try {
      await websocketService.reconnect();
      setShowReconnectSnackbar(false);
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  };

  const statusConfig = getStatusConfig();

  if (variant === 'icon') {
    return (
      <Tooltip title={statusConfig.tooltip}>
        <IconButton
          size={size}
          color={statusConfig.color}
          onClick={connectionStatus === 'error' ? handleReconnect : undefined}
          sx={{
            '& .animate-spin': {
              animation: 'spin 1s linear infinite',
            },
            '@keyframes spin': {
              '0%': {
                transform: 'rotate(0deg)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }}
        >
          {statusConfig.icon}
        </IconButton>
      </Tooltip>
    );
  }

  if (variant === 'full') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: `${statusConfig.color}.main`,
          }}
        >
          {statusConfig.icon}
          <Typography variant="body2" color="inherit">
            {statusConfig.label}
          </Typography>
        </Box>
        {connectionStatus === 'error' && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<RefreshOutlined />}
            onClick={handleReconnect}
          >
            Retry
          </Button>
        )}
        
        {/* Reconnection snackbar */}
        <Snackbar
          open={showReconnectSnackbar}
          autoHideDuration={null}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleReconnect}>
                Reconnect
              </Button>
            }
            onClose={() => setShowReconnectSnackbar(false)}
          >
            Connection lost. Some features may not work properly.
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // Default chip variant
  return (
    <Tooltip title={statusConfig.tooltip}>
      <Chip
        icon={statusConfig.icon}
        label={showLabel ? statusConfig.label : undefined}
        color={statusConfig.color}
        size={size}
        variant={isConnected ? 'filled' : 'outlined'}
        onClick={connectionStatus === 'error' ? handleReconnect : undefined}
        clickable={connectionStatus === 'error'}
        sx={{
          '& .MuiChip-icon.animate-spin': {
            animation: 'spin 1s linear infinite',
          },
          '@keyframes spin': {
            '0%': {
              transform: 'rotate(0deg)',
            },
            '100%': {
              transform: 'rotate(360deg)',
            },
          },
        }}
      />
    </Tooltip>
  );
};