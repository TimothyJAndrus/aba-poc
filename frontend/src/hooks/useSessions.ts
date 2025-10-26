import { useApiQuery, useApiMutation, useInvalidateQueries, queryKeys } from './useApi';
import { sessionService } from '../services/sessionService';
import {
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
  SchedulingResult,
  SchedulingConflict,
  AlternativeOption,
  SessionSummary,
  PaginatedResponse,
  SessionStatus,
} from '../types';

// Session CRUD hooks
export function useSession(id: string) {
  return useApiQuery({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: () => sessionService.getSession(id),
    enabled: !!id,
  });
}

export function useSessions(params?: {
  page?: number;
  limit?: number;
  clientId?: string;
  rbtId?: string;
  status?: SessionStatus;
  startDate?: string;
  endDate?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.list(params || {}),
    queryFn: () => sessionService.getSessions(params),
  });
}

export function useCreateSession() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: CreateSessionRequest) => sessionService.createSession(data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useUpdateSession() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionRequest }) =>
      sessionService.updateSession(id, data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useDeleteSession() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (id: string) => sessionService.deleteSession(id),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

// Session querying hooks
export function useSessionsByClient(clientId: string, params?: {
  page?: number;
  limit?: number;
  status?: SessionStatus;
  startDate?: string;
  endDate?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.byClient(clientId),
    queryFn: () => sessionService.getSessionsByClient(clientId, params),
    enabled: !!clientId,
  });
}

export function useSessionsByRBT(rbtId: string, params?: {
  page?: number;
  limit?: number;
  status?: SessionStatus;
  startDate?: string;
  endDate?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.byRBT(rbtId),
    queryFn: () => sessionService.getSessionsByRBT(rbtId, params),
    enabled: !!rbtId,
  });
}

// Scheduling hooks
export function useBulkScheduleSessions() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: {
      sessions: CreateSessionRequest[];
      validateOnly?: boolean;
    }) => sessionService.bulkScheduleSessions(data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useFindAlternatives(params: {
  clientId: string;
  preferredDate: string;
  daysToSearch?: number;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.alternatives(params),
    queryFn: () => sessionService.findAlternatives(params),
    enabled: !!(params.clientId && params.preferredDate),
    staleTime: 1 * 60 * 1000, // 1 minute - alternatives change frequently
  });
}

export function useRescheduleSession() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string;
      data: {
        newStartTime: Date;
        newEndTime: Date;
        reason: string;
        updatedBy: string;
      };
    }) => sessionService.rescheduleSession(sessionId, data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

// Conflict detection hooks
export function useCheckConflicts(params: {
  startDate: string;
  endDate: string;
  rbtId?: string;
  clientId?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.conflicts(params),
    queryFn: () => sessionService.checkConflicts(params),
    enabled: !!(params.startDate && params.endDate),
    staleTime: 30 * 1000, // 30 seconds - conflicts change frequently
  });
}

// Session summaries and statistics hooks
export function useSessionSummaries(params?: {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  rbtId?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.list({ ...params, type: 'summaries' }),
    queryFn: () => sessionService.getSessionSummaries(params),
  });
}

export function useSessionStats(params?: {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  rbtId?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.stats(params || {}),
    queryFn: () => sessionService.getSessionStats(params),
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
  });
}

// Session status update hooks
export function useMarkSessionCompleted() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string;
      data: {
        completionNotes?: string;
        updatedBy: string;
      };
    }) => sessionService.markSessionCompleted(sessionId, data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useMarkSessionNoShow() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string;
      data: {
        notes?: string;
        updatedBy: string;
      };
    }) => sessionService.markSessionNoShow(sessionId, data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useCancelSession() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string;
      data: {
        cancellationReason: string;
        updatedBy: string;
      };
    }) => sessionService.cancelSession(sessionId, data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

// Calendar integration hooks
export function useCalendarEvents(params: {
  startDate: string;
  endDate: string;
  userId?: string;
  includeTimeOff?: boolean;
}) {
  return useApiQuery({
    queryKey: queryKeys.sessions.calendar(params),
    queryFn: () => sessionService.getCalendarEvents(params),
    enabled: !!(params.startDate && params.endDate),
    staleTime: 1 * 60 * 1000, // 1 minute - calendar events change frequently
  });
}

// Schedule generation hooks
export function useGenerateSchedule() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: {
      clientIds: string[];
      startDate: string;
      endDate: string;
      constraints?: {
        maxSessionsPerDay?: number;
        preferredTimeSlots?: string[];
        excludeWeekends?: boolean;
      };
    }) => sessionService.generateSchedule(data),
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

// Utility hooks for dashboard data
export function useUpcomingSessions(userId?: string, limit: number = 5) {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return useApiQuery({
    queryKey: queryKeys.sessions.list({
      userId,
      startDate: today.toISOString(),
      endDate: nextWeek.toISOString(),
      limit,
      status: 'scheduled',
    }),
    queryFn: () => sessionService.getSessions({
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      limit,
      ...(userId && { rbtId: userId }),
    }),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - upcoming sessions change frequently
  });
}

export function useTodaysSessions(userId?: string) {
  const today = new Date().toISOString().split('T')[0];

  return useApiQuery({
    queryKey: queryKeys.sessions.list({
      userId,
      startDate: today,
      endDate: today,
      status: 'scheduled',
    }),
    queryFn: () => sessionService.getSessions({
      startDate: today,
      endDate: today,
      ...(userId && { rbtId: userId }),
    }),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute - today's sessions change frequently
  });
}

// Bulk operations hooks
export function useBulkUpdateSessions() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: async (updates: { id: string; data: UpdateSessionRequest }[]) => {
      const results = await Promise.allSettled(
        updates.map(({ id, data }) => sessionService.updateSession(id, data))
      );
      return results;
    },
    onSuccess: () => {
      invalidateSessions();
    },
  });
}

export function useBulkCancelSessions() {
  const { invalidateSessions } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: async (cancellations: {
      sessionId: string;
      cancellationReason: string;
      updatedBy: string;
    }[]) => {
      const results = await Promise.allSettled(
        cancellations.map(({ sessionId, ...data }) => 
          sessionService.cancelSession(sessionId, data)
        )
      );
      return results;
    },
    onSuccess: () => {
      invalidateSessions();
    },
  });
}