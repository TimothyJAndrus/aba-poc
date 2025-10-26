import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  Box,
} from '@mui/material';
import { NavigateNext } from '@mui/icons-material';

interface BreadcrumbItem {
  label: string;
  path?: string;
  isActive?: boolean;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ customItems }) => {
  const location = useLocation();
  
  const breadcrumbItems = customItems || generateBreadcrumbsFromPath(location.pathname);

  if (breadcrumbItems.length <= 1) {
    return null; // Don't show breadcrumbs for single-level pages
  }

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNext fontSize="small" />}
        aria-label="breadcrumb"
      >
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          if (isLast || !item.path) {
            return (
              <Typography
                key={item.label}
                color="text.primary"
                variant="body2"
                sx={{ fontWeight: isLast ? 600 : 400 }}
              >
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.label}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              variant="body2"
            >
              {item.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

/**
 * Generate breadcrumb items from the current path
 */
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Add home/dashboard as first item
  if (pathSegments.length > 0) {
    const role = pathSegments[0];
    breadcrumbs.push({
      label: getHomeLabel(role),
      path: `/${role}/dashboard`,
    });
  }

  // Build breadcrumbs from path segments
  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip the first segment (role) as it's already added as home
    if (index === 0) return;
    
    // Skip 'dashboard' segment as it's part of home
    if (segment === 'dashboard') return;

    const label = formatSegmentLabel(segment);
    const isLast = index === pathSegments.length - 1;
    
    breadcrumbs.push({
      label,
      path: isLast ? undefined : currentPath,
      isActive: isLast,
    });
  });

  return breadcrumbs;
}

/**
 * Get appropriate home label based on role
 */
function getHomeLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin Dashboard';
    case 'employee':
      return 'Employee Dashboard';
    case 'client':
      return 'Client Dashboard';
    default:
      return 'Dashboard';
  }
}

/**
 * Format path segment into readable label
 */
function formatSegmentLabel(segment: string): string {
  // Handle common segments
  const segmentMap: Record<string, string> = {
    'users': 'User Management',
    'schedules': 'Schedule Management',
    'reports': 'Reports & Analytics',
    'settings': 'Settings',
    'profile': 'Profile',
    'timeoff': 'Time Off',
    'sessions': 'Sessions',
    'notifications': 'Notifications',
    'calendar': 'Calendar',
    'analytics': 'Analytics',
  };

  if (segmentMap[segment]) {
    return segmentMap[segment];
  }

  // Convert kebab-case or snake_case to title case
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Hook for programmatic breadcrumb management
export const useBreadcrumbs = () => {
  const [customBreadcrumbs, setCustomBreadcrumbs] = React.useState<BreadcrumbItem[]>();

  const setBreadcrumbs = React.useCallback((items: BreadcrumbItem[]) => {
    setCustomBreadcrumbs(items);
  }, []);

  const clearBreadcrumbs = React.useCallback(() => {
    setCustomBreadcrumbs(undefined);
  }, []);

  return {
    customBreadcrumbs,
    setBreadcrumbs,
    clearBreadcrumbs,
  };
};