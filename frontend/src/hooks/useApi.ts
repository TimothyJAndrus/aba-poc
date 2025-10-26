import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ApiError, NetworkError, AuthenticationError, ValidationError } from '../services/api';

// Query key factory for consistent cache management
export const queryKeys = {
  // User queries
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.users.lists(), { filters }] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
    byRole: (role: string) => [...queryKeys.users.all, 'role', role] as const,
  },
  
  // Session queries
  sessions: {
    all: ['sessions'] as const,
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.sessions.lists(), { filters }] as const,
    details: () => [...queryKeys.sessions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sessions.details(), id] as const,
    byClient: (clientId: string) => [...queryKeys.sessions.all, 'client', clientId] as const,
    byRBT: (rbtId: string) => [...queryKeys.sessions.all, 'rbt', rbtId] as const,
    calendar: (params: Record<string, any>) => [...queryKeys.sessions.all, 'calendar', params] as const,
    stats: (params: Record<string, any>) => [...queryKeys.sessions.all, 'stats', params] as const,
    conflicts: (params: Record<string, any>) => [...queryKeys.sessions.all, 'conflicts', params] as const,
    alternatives: (params: Record<string, any>) => [...queryKeys.sessions.all, 'alternatives', params] as const,
  },
  
  // Team queries
  teams: {
    all: ['teams'] as const,
    lists: () => [...queryKeys.teams.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.teams.lists(), { filters }] as const,
    details: () => [...queryKeys.teams.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.teams.details(), id] as const,
    byClient: (clientId: string) => [...queryKeys.teams.all, 'client', clientId] as const,
    byRBT: (rbtId: string) => [...queryKeys.teams.all, 'rbt', rbtId] as const,
    history: (clientId: string) => [...queryKeys.teams.all, 'history', clientId] as const,
    availableRBTs: (params: Record<string, any>) => [...queryKeys.teams.all, 'available-rbts', params] as const,
    continuity: (params: Record<string, any>) => [...queryKeys.teams.all, 'continuity', params] as const,
  },
  
  // Notification queries
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.notifications.lists(), { filters }] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notifications.details(), id] as const,
    byRecipient: (recipientId: string) => [...queryKeys.notifications.all, 'recipient', recipientId] as const,
    templates: () => [...queryKeys.notifications.all, 'templates'] as const,
    template: (type: string, channel: string) => [...queryKeys.notifications.templates(), type, channel] as const,
    stats: (params: Record<string, any>) => [...queryKeys.notifications.all, 'stats', params] as const,
    scheduled: (params: Record<string, any>) => [...queryKeys.notifications.all, 'scheduled', params] as const,
  },
  
  // Monitoring queries
  monitoring: {
    all: ['monitoring'] as const,
    health: () => [...queryKeys.monitoring.all, 'health'] as const,
    systemMetrics: (params: Record<string, any>) => [...queryKeys.monitoring.all, 'system-metrics', params] as const,
    appMetrics: (params: Record<string, any>) => [...queryKeys.monitoring.all, 'app-metrics', params] as const,
    alerts: {
      all: () => [...queryKeys.monitoring.all, 'alerts'] as const,
      active: () => [...queryKeys.monitoring.alerts.all(), 'active'] as const,
      list: (params: Record<string, any>) => [...queryKeys.monitoring.alerts.all(), 'list', params] as const,
    },
    dashboard: () => [...queryKeys.monitoring.all, 'dashboard'] as const,
    performance: (params: Record<string, any>) => [...queryKeys.monitoring.all, 'performance', params] as const,
  },
} as const;

// Default query options
export const defaultQueryOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  retry: (failureCount: number, error: Error) => {
    // Don't retry on authentication/authorization errors
    if (error instanceof AuthenticationError || error instanceof AuthenticationError) {
      return false;
    }
    // Don't retry on validation errors
    if (error instanceof ValidationError) {
      return false;
    }
    // Retry network errors up to 3 times
    if (error instanceof NetworkError) {
      return failureCount < 3;
    }
    // Retry other API errors up to 2 times
    if (error instanceof ApiError) {
      return failureCount < 2;
    }
    // Default retry logic
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
} as const;

// Enhanced useQuery hook with error handling
export function useApiQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError> & {
    queryKey: readonly unknown[];
    queryFn: () => Promise<TData>;
  }
) {
  return useQuery({
    ...defaultQueryOptions,
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        // Log errors in development
        if (import.meta.env.DEV) {
          console.error('Query error:', error);
        }
        throw error;
      }
    },
  });
}

// Enhanced useMutation hook with error handling and optimistic updates
export function useApiMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    mutationFn: (variables: TVariables) => Promise<TData>;
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      try {
        return await options.mutationFn(variables);
      } catch (error) {
        // Log errors in development
        if (import.meta.env.DEV) {
          console.error('Mutation error:', error);
        }
        throw error;
      }
    },
    onSuccess: (data, variables, context) => {
      // Call the original onSuccess if provided
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      // Handle specific error types
      if (error instanceof AuthenticationError) {
        // Redirect to login or refresh token
        queryClient.clear();
      } else if (error instanceof ValidationError) {
        // Handle validation errors (usually handled by the component)
      } else if (error instanceof NetworkError) {
        // Show network error message
      }

      // Call the original onError if provided
      options.onError?.(error, variables, context);
    },
  });
}

// Utility hook for invalidating queries
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateUsers: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    invalidateSessions: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all }),
    invalidateTeams: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
    invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    invalidateMonitoring: () => queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.all }),
    invalidateAll: () => queryClient.invalidateQueries(),
    clear: () => queryClient.clear(),
  };
}

// Utility hook for prefetching data
export function usePrefetchQueries() {
  const queryClient = useQueryClient();

  return {
    prefetchUser: (id: string, queryFn: () => Promise<any>) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.users.detail(id),
        queryFn,
        ...defaultQueryOptions,
      }),
    prefetchSession: (id: string, queryFn: () => Promise<any>) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.sessions.detail(id),
        queryFn,
        ...defaultQueryOptions,
      }),
    prefetchTeam: (id: string, queryFn: () => Promise<any>) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.teams.detail(id),
        queryFn,
        ...defaultQueryOptions,
      }),
  };
}

// Error boundary helper
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

// Query status helpers
export function useQueryStatus() {
  return {
    isLoading: (query: { isLoading: boolean; isFetching: boolean }) => 
      query.isLoading || query.isFetching,
    hasError: (query: { error: unknown }) => !!query.error,
    isEmpty: (query: { data: unknown }) => 
      !query.data || (Array.isArray(query.data) && query.data.length === 0),
  };
}