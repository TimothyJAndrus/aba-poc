import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  NotificationsOutlined,
  InfoOutlined,
  WarningOutlined,
  ErrorOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  MarkEmailReadOutlined,
  DeleteOutlined,
  FilterListOutlined,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
  category?: 'schedule' | 'system' | 'user' | 'session';
  actionUrl?: string;
  dismissible?: boolean;
}

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (notificationId: string) => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: Notification) => void;
  maxHeight?: number;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
  onNotificationClick,
  maxHeight = 400,
}) => {
  const theme = useTheme();
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>(notifications);

  // Filter notifications based on selected filter
  useEffect(() => {
    let filtered = notifications;
    
    switch (selectedFilter) {
      case 'unread':
        filtered = notifications.filter(n => !n.read);
        break;
      case 'schedule':
        filtered = notifications.filter(n => n.category === 'schedule');
        break;
      case 'system':
        filtered = notifications.filter(n => n.category === 'system');
        break;
      case 'user':
        filtered = notifications.filter(n => n.category === 'user');
        break;
      case 'session':
        filtered = notifications.filter(n => n.category === 'session');
        break;
      default:
        filtered = notifications;
    }
    
    setFilteredNotifications(filtered);
  }, [notifications, selectedFilter]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <InfoOutlined color="info" />;
      case 'warning':
        return <WarningOutlined color="warning" />;
      case 'error':
        return <ErrorOutlined color="error" />;
      case 'success':
        return <CheckCircleOutlined color="success" />;
      default:
        return <NotificationsOutlined />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return theme.palette.info.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      case 'success':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
    handleFilterMenuClose();
  };

  const formatTimestamp = (timestamp: Date) => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'schedule':
        return 'Schedule';
      case 'system':
        return 'System';
      case 'user':
        return 'User';
      case 'session':
        return 'Session';
      default:
        return 'General';
    }
  };

  return (
    <Box sx={{ width: '100%', maxHeight, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        px: 2, 
        py: 1.5, 
        borderBottom: 1, 
        borderColor: 'grey.200',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Filter notifications">
            <IconButton size="small" onClick={handleFilterMenuOpen}>
              <FilterListOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          
          {unreadCount > 0 && (
            <Tooltip title="Mark all as read">
              <IconButton size="small" onClick={onMarkAllAsRead}>
                <MarkEmailReadOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {notifications.length > 0 && (
            <Tooltip title="Clear all">
              <IconButton size="small" onClick={onClearAll}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Filter indicator */}
      {selectedFilter !== 'all' && (
        <Box sx={{ px: 2, py: 1, backgroundColor: 'grey.50' }}>
          <Chip
            label={`Filter: ${selectedFilter}`}
            size="small"
            onDelete={() => setSelectedFilter('all')}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* Notifications list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsOutlined 
              sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} 
            />
            <Typography variant="body2" color="text.secondary">
              {selectedFilter === 'all' ? 'No notifications' : `No ${selectedFilter} notifications`}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    borderLeft: 4,
                    borderColor: getNotificationColor(notification.type),
                    backgroundColor: notification.read ? 'transparent' : 'grey.50',
                    '&:hover': {
                      backgroundColor: notification.read ? 'grey.50' : 'grey.100'
                    }
                  }}
                  secondaryAction={
                    notification.dismissible && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(notification.id);
                        }}
                      >
                        <CloseOutlined fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemButton 
                    sx={{ p: 0 }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography 
                            variant="body2" 
                            fontWeight={notification.read ? 400 : 600}
                            sx={{ flex: 1, mr: 1 }}
                          >
                            {notification.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(notification.timestamp)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ mb: notification.category ? 0.5 : 0 }}
                          >
                            {notification.message}
                          </Typography>
                          {notification.category && (
                            <Chip
                              label={getCategoryLabel(notification.category)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Filter menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={handleFilterMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem 
          onClick={() => handleFilterSelect('all')}
          selected={selectedFilter === 'all'}
        >
          All Notifications
        </MenuItem>
        <MenuItem 
          onClick={() => handleFilterSelect('unread')}
          selected={selectedFilter === 'unread'}
        >
          Unread Only
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleFilterSelect('schedule')}
          selected={selectedFilter === 'schedule'}
        >
          Schedule
        </MenuItem>
        <MenuItem 
          onClick={() => handleFilterSelect('session')}
          selected={selectedFilter === 'session'}
        >
          Sessions
        </MenuItem>
        <MenuItem 
          onClick={() => handleFilterSelect('user')}
          selected={selectedFilter === 'user'}
        >
          Users
        </MenuItem>
        <MenuItem 
          onClick={() => handleFilterSelect('system')}
          selected={selectedFilter === 'system'}
        >
          System
        </MenuItem>
      </Menu>
    </Box>
  );
};