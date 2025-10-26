import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApiError, NetworkError, AuthenticationError } from '../services/api';

// Create a client with custom configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global query defaults
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount: number, error: Error) => {
        // Don't retry on authentication/authorization errors
        if (error instanceof AuthenticationError) {
          return false;
        }
        // Don't retry on 4xx errors (except 408, 429)
        if (error instanceof ApiError) {
          const status = error.status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return false;
          }
        }
        // Retry network errors up to 3 times
        if (error instanceof NetworkError) {
          return failureCount < 3;
        }
        // Default retry logic for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex: number) => {
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        const jitter = Math.random() * 0.1 * baseDelay;
        return baseDelay + jitter;
      },
      // Network mode configuration
      networkMode: 'online',
      // Refetch configuration
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      // Global mutation defaults
      retry: (failureCount: number, error: Error) => {
        // Don't retry mutations on client errors
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry network errors once
        if (error instanceof NetworkError) {
          return failureCount < 1;
        }
        // Don't retry other errors for mutations
        return false;
      },
      networkMode: 'online',
    },
  },
});

// Global error handler using query cache events
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'observerResultsUpdated') {
    const { query } = event;
    if (query.state.error) {
      const error = query.state.error as Error;

      if (import.meta.env.DEV) {
        console.error('Query error:', error);
      }

      // Handle authentication errors globally
      if (error instanceof AuthenticationError) {
        // Clear all queries
        queryClient.clear();
      }
    }
  }
});

// Global mutation error handler using mutation cache events
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'updated') {
    const { mutation } = event;
    if (mutation.state.error) {
      const error = mutation.state.error as Error;

      if (import.meta.env.DEV) {
        console.error('Mutation error:', error);
      }

      // Handle authentication errors globally
      if (error instanceof AuthenticationError) {
        // Clear all queries and redirect to login
        queryClient.clear();
        // You might want to dispatch a logout action here
        // or use a global state management solution
      }
    }
  }
});

// Performance monitoring using query cache events
if (import.meta.env.DEV) {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'observerResultsUpdated') {
      const { query } = event;
      const queryKey = query.queryKey.join('.');

      if (query.state.data && !query.state.error) {
        console.log(`Query ${queryKey} succeeded:`, query.state.data);
      }

      if (query.state.error) {
        console.error(`Query ${queryKey} failed:`, query.state.error);
      }
    }
  });
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// Export the query client for use in other parts of the app
export { queryClient };

// Utility functions for manual cache management
export const cacheUtils = {
  // Clear all cache
  clearAll: () => queryClient.clear(),

  // Clear specific query patterns
  clearUsers: () => queryClient.removeQueries({ queryKey: ['users'] }),
  clearSessions: () => queryClient.removeQueries({ queryKey: ['sessions'] }),
  clearTeams: () => queryClient.removeQueries({ queryKey: ['teams'] }),
  clearNotifications: () => queryClient.removeQueries({ queryKey: ['notifications'] }),
  clearMonitoring: () => queryClient.removeQueries({ queryKey: ['monitoring'] }),

  // Invalidate specific query patterns
  invalidateUsers: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  invalidateSessions: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  invalidateTeams: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  invalidateMonitoring: () => queryClient.invalidateQueries({ queryKey: ['monitoring'] }),

  // Prefetch data
  prefetchQuery: (queryKey: unknown[], queryFn: () => Promise<any>) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 5 * 60 * 1000,
    });
  },

  // Set query data manually
  setQueryData: (queryKey: unknown[], data: any) => {
    queryClient.setQueryData(queryKey, data);
  },

  // Get query data
  getQueryData: (queryKey: unknown[]) => {
    return queryClient.getQueryData(queryKey);
  },

  // Check if query exists
  hasQuery: (queryKey: unknown[]) => {
    return queryClient.getQueryCache().find({ queryKey }) !== undefined;
  },

  // Get query state
  getQueryState: (queryKey: unknown[]) => {
    return queryClient.getQueryState(queryKey);
  },
};

// Hook for accessing cache utils
export function useCacheUtils() {
  return cacheUtils;
}