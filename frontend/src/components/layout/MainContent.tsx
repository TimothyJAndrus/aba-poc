import React, { Suspense } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Skeleton,
  Alert,
  AlertTitle,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { Breadcrumbs } from './Breadcrumbs';

interface BreadcrumbItem {
  label: string;
  path?: string;
  isActive?: boolean;
}

interface MainContentProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  loading?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePadding?: boolean;
  className?: string;
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// Error fallback component
const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => (
  <Box sx={{ p: 3 }}>
    <Alert 
      severity="error" 
      action={
        <Button color="inherit" size="small" onClick={resetErrorBoundary}>
          Try Again
        </Button>
      }
    >
      <AlertTitle>Something went wrong</AlertTitle>
      {error.message || 'An unexpected error occurred. Please try again.'}
    </Alert>
  </Box>
);

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="40%" height={24} sx={{ mb: 3 }} />
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Skeleton variant="rectangular" height={200} />
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Skeleton variant="rectangular" height={200} />
        </Paper>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={300} />
      </Paper>
    </Box>
  </Box>
);

// Main content header component
interface ContentHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

const ContentHeader: React.FC<ContentHeaderProps> = ({ 
  title, 
  subtitle, 
  actions, 
  breadcrumbs 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs customItems={breadcrumbs} />
      
      {/* Title and actions */}
      {(title || actions) && (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: subtitle ? 1 : 0,
          }}
        >
          {title && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="h1" 
                component="h1"
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.25rem' },
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 0,
                }}
              >
                {title}
              </Typography>
            </Box>
          )}
          
          {actions && (
            <Box 
              sx={{ 
                display: 'flex', 
                gap: 1,
                flexWrap: 'wrap',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {actions}
            </Box>
          )}
        </Box>
      )}
      
      {/* Subtitle */}
      {subtitle && (
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

// Responsive grid container component using flexbox
interface ResponsiveGridProps {
  children: React.ReactNode;
  spacing?: number;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({ 
  children, 
  spacing = 3,
  className 
}) => (
  <Box 
    className={className}
    sx={{ 
      display: 'flex',
      flexWrap: 'wrap',
      gap: spacing,
      '& > *': {
        minWidth: 0, // Prevent flex items from overflowing
      }
    }}
  >
    {children}
  </Box>
);

// Grid item component with responsive breakpoints using flexbox
interface GridItemProps {
  children: React.ReactNode;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  className?: string;
}

export const GridItem: React.FC<GridItemProps> = ({ 
  children, 
  xs = 12,
  sm,
  md,
  lg,
  xl,
  className 
}) => {
  // Calculate flex basis based on breakpoints
  const getFlexBasis = () => {
    const breakpoints = { xs, sm, md, lg, xl };
    const flexBasisMap: Record<string, string> = {};
    
    Object.entries(breakpoints).forEach(([key, value]) => {
      if (value) {
        const percentage = (value / 12) * 100;
        flexBasisMap[key] = `${percentage}%`;
      }
    });
    
    return {
      flexBasis: flexBasisMap.xs || '100%',
      maxWidth: flexBasisMap.xs || '100%',
      ...(sm && {
        '@media (min-width: 600px)': {
          flexBasis: `${(sm / 12) * 100}%`,
          maxWidth: `${(sm / 12) * 100}%`,
        }
      }),
      ...(md && {
        '@media (min-width: 900px)': {
          flexBasis: `${(md / 12) * 100}%`,
          maxWidth: `${(md / 12) * 100}%`,
        }
      }),
      ...(lg && {
        '@media (min-width: 1200px)': {
          flexBasis: `${(lg / 12) * 100}%`,
          maxWidth: `${(lg / 12) * 100}%`,
        }
      }),
      ...(xl && {
        '@media (min-width: 1536px)': {
          flexBasis: `${(xl / 12) * 100}%`,
          maxWidth: `${(xl / 12) * 100}%`,
        }
      }),
    };
  };

  return (
    <Box 
      className={className}
      sx={{
        ...getFlexBasis(),
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
};

// Content section component
interface ContentSectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  elevation?: number;
  sx?: object;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  children,
  title,
  subtitle,
  actions,
  elevation = 1,
  sx = {},
}) => (
  <Paper 
    elevation={elevation}
    sx={{
      p: 3,
      borderRadius: 2,
      ...sx,
    }}
  >
    {(title || subtitle || actions) && (
      <Box sx={{ mb: title || subtitle ? 2 : 0 }}>
        {(title || actions) && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mb: subtitle ? 1 : 0,
            }}
          >
            {title && (
              <Typography variant="h4" component="h2" fontWeight={600}>
                {title}
              </Typography>
            )}
            {actions && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {actions}
              </Box>
            )}
          </Box>
        )}
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    )}
    
    {children}
  </Paper>
);

// Main content component
export const MainContent: React.FC<MainContentProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  loading = false,
  maxWidth = 'xl',
  disablePadding = false,
  className,
}) => {
  const theme = useTheme();

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        minHeight: '100vh',
        backgroundColor: 'background.default',
        pt: disablePadding ? 0 : { xs: 2, sm: 3 },
        pb: disablePadding ? 0 : { xs: 2, sm: 3 },
      }}
      className={className}
    >
      <Container 
        maxWidth={maxWidth}
        sx={{
          px: disablePadding ? 0 : { xs: 2, sm: 3 },
        }}
      >
        {/* Content header */}
        <ContentHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          breadcrumbs={breadcrumbs}
        />

        {/* Main content area with error boundary and loading states */}
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => window.location.reload()}
        >
          <Suspense fallback={<LoadingSkeleton />}>
            {loading ? <LoadingSkeleton /> : children}
          </Suspense>
        </ErrorBoundary>
      </Container>
    </Box>
  );
};

// Layout wrapper component that combines header, sidebar, and main content
interface AppLayoutProps {
  children: React.ReactNode;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  sidebarOpen = true,
  sidebarCollapsed = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Main content area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          ml: !isMobile && sidebarOpen ? (sidebarCollapsed ? 8 : 35) : 0,
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// Hook for managing main content state
export const useMainContent = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startLoading = React.useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const stopLoading = React.useCallback(() => {
    setLoading(false);
  }, []);

  const setErrorState = React.useCallback((errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setErrorState,
    clearError,
  };
};