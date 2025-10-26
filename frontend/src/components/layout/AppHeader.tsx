import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Box,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Popover,
} from '@mui/material';
import {
  NotificationsOutlined,
  MenuOutlined,
  LogoutOutlined,
  SettingsOutlined,
  PersonOutlined,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { useAppDispatch } from '../../store/hooks';
import { logoutUser } from '../../store/authSlice';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { GlobalSearch } from '../common/GlobalSearch';
import { notificationService } from '../../services/notificationService';
import { 
  selectNotifications, 
  selectUnreadCount,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
} from '../../store/notificationSlice';
import { SearchResult } from '../../services/searchService';

interface AppHeaderProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}



export const AppHeader: React.FC<AppHeaderProps> = ({ 
  onMenuToggle, 
  showMenuButton = true 
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const { user } = useSelector((state: RootState) => state.auth);
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  
  // State for menus
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState<null | HTMLElement>(null);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
    notificationService.loadSettings();
  }, []);

  // Handle search result selection
  const handleSearchResultSelect = (result: SearchResult) => {
    if (result.url) {
      navigate(result.url);
    }
  };

  // Handle user menu
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // Handle notification menu
  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationMenuAnchor(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationMenuAnchor(null);
  };

  // Notification handlers
  const handleMarkAsRead = (notificationId: string) => {
    dispatch(markAsRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  const handleDismissNotification = (notificationId: string) => {
    dispatch(removeNotification(notificationId));
  };

  const handleClearAllNotifications = () => {
    dispatch(clearAllNotifications());
  };

  const handleNotificationClick = (notification: any) => {
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    handleNotificationMenuClose();
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      handleUserMenuClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      handleUserMenuClose();
    }
  };

  // Handle profile navigation
  const handleProfile = () => {
    navigate('/profile');
    handleUserMenuClose();
  };

  // Handle settings navigation
  const handleSettings = () => {
    navigate('/settings');
    handleUserMenuClose();
  };

  // Get role display text and color
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrator', color: 'primary' as const };
      case 'employee':
        return { label: 'Employee', color: 'secondary' as const };
      case 'client':
        return { label: 'Client', color: 'success' as const };
      default:
        return { label: 'User', color: 'default' as const };
    }
  };



  const roleInfo = user ? getRoleInfo(user.role) : { label: 'User', color: 'default' as const };

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'grey.200'
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
        {/* Menu button for mobile */}
        {showMenuButton && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={onMenuToggle}
            sx={{ 
              mr: 2,
              display: { md: 'none' }
            }}
          >
            <MenuOutlined />
          </IconButton>
        )}

        {/* Logo/Title */}
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            fontWeight: 600,
            color: 'primary.main',
            display: { xs: 'none', sm: 'block' }
          }}
        >
          ABA Scheduler
        </Typography>

        {/* Search bar */}
        <Box sx={{ flexGrow: 1, mx: { xs: 1, sm: 4 }, maxWidth: 400 }}>
          <GlobalSearch
            placeholder="Search users, clients, sessions..."
            onResultSelect={handleSearchResultSelect}
            size="small"
            fullWidth
          />
        </Box>

        {/* Right side actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Connection Status */}
          <ConnectionStatus variant="icon" size="small" />
          
          {/* Notifications */}
          <IconButton
            color="inherit"
            onClick={handleNotificationMenuOpen}
            aria-label="notifications"
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsOutlined />
            </Badge>
          </IconButton>

          {/* User info and menu */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Role chip - hidden on mobile */}
              <Chip
                label={roleInfo.label}
                color={roleInfo.color}
                size="small"
                sx={{ 
                  display: { xs: 'none', sm: 'flex' },
                  fontWeight: 500
                }}
              />
              
              {/* User avatar and name */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  cursor: 'pointer',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'grey.50'
                  }
                }}
                onClick={handleUserMenuOpen}
              >
                <Avatar
                  src={user.avatar}
                  alt={user.name}
                  sx={{ width: 32, height: 32 }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <Typography variant="body2" fontWeight={500}>
                    {user.name}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* User menu */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: { minWidth: 200, mt: 1 }
          }}
        >
          {user && (
            <>
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" fontWeight={500}>
                  {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
              <Divider />
            </>
          )}
          
          <MenuItem onClick={handleProfile}>
            <ListItemIcon>
              <PersonOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Profile</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={handleSettings}>
            <ListItemIcon>
              <SettingsOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </MenuItem>
        </Menu>

        {/* Notifications popover */}
        <Popover
          open={Boolean(notificationMenuAnchor)}
          anchorEl={notificationMenuAnchor}
          onClose={handleNotificationMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: { 
              minWidth: 400, 
              maxWidth: 450,
              mt: 1,
            }
          }}
        >
          <NotificationPanel
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onDismiss={handleDismissNotification}
            onClearAll={handleClearAllNotifications}
            onNotificationClick={handleNotificationClick}
            maxHeight={500}
          />
        </Popover>
      </Toolbar>
    </AppBar>
  );
};