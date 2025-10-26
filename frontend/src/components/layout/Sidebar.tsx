import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  DashboardOutlined,
  PeopleOutlined,
  CalendarTodayOutlined,
  NotificationsOutlined,
  BarChartOutlined,
  SettingsOutlined,
  PersonOutlined,
  GroupOutlined,
  EventNoteOutlined,
  AssignmentOutlined,
  TimelapseOutlined,
  MessageOutlined,
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
  variant?: 'permanent' | 'persistent' | 'temporary';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  roles: ('admin' | 'employee' | 'client')[];
  children?: MenuItem[];
}

// Define menu structure based on user roles
const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardOutlined />,
    path: '/dashboard',
    roles: ['admin', 'employee', 'client'],
  },
  
  // Admin-only sections
  {
    id: 'user-management',
    label: 'User Management',
    icon: <PeopleOutlined />,
    roles: ['admin'],
    children: [
      {
        id: 'users',
        label: 'All Users',
        icon: <PersonOutlined />,
        path: '/admin/users',
        roles: ['admin'],
      },
      {
        id: 'clients',
        label: 'Clients',
        icon: <GroupOutlined />,
        path: '/admin/clients',
        roles: ['admin'],
      },
      {
        id: 'employees',
        label: 'Employees',
        icon: <PersonOutlined />,
        path: '/admin/employees',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'schedule-management',
    label: 'Schedule Management',
    icon: <CalendarTodayOutlined />,
    roles: ['admin'],
    children: [
      {
        id: 'calendar',
        label: 'Calendar View',
        icon: <CalendarTodayOutlined />,
        path: '/admin/calendar',
        roles: ['admin'],
      },
      {
        id: 'sessions',
        label: 'Sessions',
        icon: <EventNoteOutlined />,
        path: '/admin/sessions',
        roles: ['admin'],
      },
      {
        id: 'time-off-requests',
        label: 'Time-off Requests',
        icon: <TimelapseOutlined />,
        path: '/admin/time-off',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'notifications-admin',
    label: 'Notifications',
    icon: <NotificationsOutlined />,
    roles: ['admin'],
    children: [
      {
        id: 'notification-center',
        label: 'Notification Center',
        icon: <NotificationsOutlined />,
        path: '/admin/notifications',
        roles: ['admin'],
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: <MessageOutlined />,
        path: '/admin/notification-templates',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: <BarChartOutlined />,
    roles: ['admin'],
    children: [
      {
        id: 'analytics',
        label: 'Analytics Dashboard',
        icon: <BarChartOutlined />,
        path: '/admin/analytics',
        roles: ['admin'],
      },
      {
        id: 'reports',
        label: 'Custom Reports',
        icon: <AssignmentOutlined />,
        path: '/admin/reports',
        roles: ['admin'],
      },
    ],
  },
  
  // Employee sections
  {
    id: 'my-schedule',
    label: 'My Schedule',
    icon: <CalendarTodayOutlined />,
    path: '/employee/schedule',
    roles: ['employee'],
  },
  {
    id: 'time-off',
    label: 'Time Off',
    icon: <TimelapseOutlined />,
    path: '/employee/time-off',
    roles: ['employee'],
  },
  
  // Client sections
  {
    id: 'child-schedule',
    label: "Child's Schedule",
    icon: <CalendarTodayOutlined />,
    path: '/client/schedule',
    roles: ['client'],
  },
  {
    id: 'session-management',
    label: 'Session Management',
    icon: <EventNoteOutlined />,
    roles: ['client'],
    children: [
      {
        id: 'cancel-session',
        label: 'Cancel Session',
        icon: <EventNoteOutlined />,
        path: '/client/cancel-session',
        roles: ['client'],
      },
      {
        id: 'request-session',
        label: 'Request Session',
        icon: <EventNoteOutlined />,
        path: '/client/request-session',
        roles: ['client'],
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: <MessageOutlined />,
    path: '/client/messages',
    roles: ['client'],
  },
  
  // Common sections
  {
    id: 'settings',
    label: 'Settings',
    icon: <SettingsOutlined />,
    path: '/settings',
    roles: ['admin', 'employee', 'client'],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  variant = 'permanent',
  collapsed = false,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user } = useSelector((state: RootState) => state.auth);
  
  // State for expanded menu items
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Filter menu items based on user role
  const getFilteredMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (!user) return [];
    
    return items.filter(item => {
      if (!item.roles.includes(user.role)) return false;
      
      if (item.children) {
        const filteredChildren = getFilteredMenuItems(item.children);
        return filteredChildren.length > 0;
      }
      
      return true;
    }).map(item => ({
      ...item,
      children: item.children ? getFilteredMenuItems(item.children) : undefined,
    }));
  };

  const filteredMenuItems = getFilteredMenuItems(menuItems);

  // Handle menu item click
  const handleItemClick = (item: MenuItem) => {
    if (item.path) {
      navigate(item.path);
      if (isMobile && onClose) {
        onClose();
      }
    } else if (item.children) {
      handleToggleExpand(item.id);
    }
  };

  // Handle expand/collapse of menu items
  const handleToggleExpand = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Check if item is active
  const isItemActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    }
    
    if (item.children) {
      return item.children.some(child => isItemActive(child));
    }
    
    return false;
  };

  // Render menu item
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Tooltip 
            title={collapsed ? item.label : ''} 
            placement="right"
            disableHoverListener={!collapsed}
          >
            <ListItemButton
              onClick={() => handleItemClick(item)}
              sx={{
                minHeight: 48,
                justifyContent: collapsed ? 'center' : 'initial',
                px: collapsed ? 1.5 : 2.5,
                pl: collapsed ? 1.5 : 2.5 + (level * 2),
                backgroundColor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? 'primary.contrastText' : 'text.primary',
                '&:hover': {
                  backgroundColor: isActive 
                    ? 'primary.dark' 
                    : 'action.hover',
                },
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: collapsed ? 0 : 3,
                  justifyContent: 'center',
                  color: isActive ? 'primary.contrastText' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              
              {!collapsed && (
                <>
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  />
                  
                  {hasChildren && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(item.id);
                      }}
                      sx={{ 
                        color: isActive ? 'primary.contrastText' : 'text.secondary',
                        p: 0.5,
                      }}
                    >
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  )}
                </>
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {/* Render children */}
        {hasChildren && !collapsed && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  // Drawer content
  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: collapsed ? 1 : 2, 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
          borderBottom: 1,
          borderColor: 'grey.200',
        }}
      >
        {!collapsed && (
          <Typography variant="h6" fontWeight={600} color="primary.main">
            ABA Scheduler
          </Typography>
        )}
        
        {!isMobile && onToggleCollapse && (
          <IconButton 
            onClick={onToggleCollapse}
            size="small"
            sx={{ 
              color: 'text.secondary',
              ml: collapsed ? 0 : 1,
            }}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        )}
      </Box>

      {/* User info - only show when not collapsed */}
      {!collapsed && user && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'grey.200' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500} noWrap>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <List>
          {filteredMenuItems.map(item => renderMenuItem(item))}
        </List>
      </Box>
    </Box>
  );

  // Determine drawer width
  const drawerWidth = collapsed ? 64 : 280;

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
        },
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
    >
      {drawerContent}
    </Drawer>
  );
};