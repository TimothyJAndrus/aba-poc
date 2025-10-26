import { apiService } from './api';
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

export class SessionService {
  // Session CRUD operations
  async createSession(data: CreateSessionRequest): Promise<SchedulingResult> {
    return apiService.post<SchedulingResult>('/schedule/session', data);
  }

  async getSession(id: string): Promise<Session> {
    return apiService.get<Session>(`/schedule/session/${id}`);
  }

  async updateSession(id: string, data: UpdateSessionRequest): Promise<Session> {
    return apiService.put<Session>(`/schedule/session/${id}`, data);
  }

  async deleteSession(id: string): Promise<void> {
    return apiService.delete<void>(`/schedule/session/${id}`);
  }

  // Session querying
  async getSessions(params?: {
    page?: number;
    limit?: number;
    clientId?: string;
    rbtId?: string;
    status?: SessionStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Session>> {
    return apiService.get<PaginatedResponse<Session>>('/schedule/sessions', params);
  }

  async getSessionsByClient(clientId: string, params?: {
    page?: number;
    limit?: number;
    status?: SessionStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Session>> {
    return apiService.get<PaginatedResponse<Session>>(`/schedule/sessions/client/${clientId}`, params);
  }

  async getSessionsByRBT(rbtId: string, params?: {
    page?: number;
    limit?: number;
    status?: SessionStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Session>> {
    return apiService.get<PaginatedResponse<Session>>(`/schedule/sessions/rbt/${rbtId}`, params);
  }

  // Scheduling operations
  async bulkScheduleSessions(data: {
    sessions: CreateSessionRequest[];
    validateOnly?: boolean;
  }): Promise<SchedulingResult[]> {
    return apiService.post<SchedulingResult[]>('/schedule/bulk', data);
  }

  async findAlternatives(params: {
    clientId: string;
    preferredDate: string;
    daysToSearch?: number;
  }): Promise<AlternativeOption[]> {
    return apiService.get<AlternativeOption[]>('/schedule/alternatives', params);
  }

  async rescheduleSession(sessionId: string, data: {
    newStartTime: Date;
    newEndTime: Date;
    reason: string;
    updatedBy: string;
  }): Promise<SchedulingResult> {
    return apiService.put<SchedulingResult>(`/schedule/session/${sessionId}/reschedule`, data);
  }

  // Conflict detection
  async checkConflicts(params: {
    startDate: string;
    endDate: string;
    rbtId?: string;
    clientId?: string;
  }): Promise<SchedulingConflict[]> {
    return apiService.get<SchedulingConflict[]>('/schedule/conflicts', params);
  }

  // Session summaries and statistics
  async getSessionSummaries(params?: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    rbtId?: string;
  }): Promise<SessionSummary[]> {
    return apiService.get<SessionSummary[]>('/schedule/summaries', params);
  }

  async getSessionStats(params?: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    rbtId?: string;
  }): Promise<{
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    noShowSessions: number;
    completionRate: number;
    cancellationRate: number;
  }> {
    return apiService.get('/schedule/stats', params);
  }

  // Session status updates
  async markSessionCompleted(sessionId: string, data: {
    completionNotes?: string;
    updatedBy: string;
  }): Promise<Session> {
    return apiService.patch<Session>(`/schedule/session/${sessionId}/complete`, data);
  }

  async markSessionNoShow(sessionId: string, data: {
    notes?: string;
    updatedBy: string;
  }): Promise<Session> {
    return apiService.patch<Session>(`/schedule/session/${sessionId}/no-show`, data);
  }

  async cancelSession(sessionId: string, data: {
    cancellationReason: string;
    updatedBy: string;
  }): Promise<Session> {
    return apiService.patch<Session>(`/schedule/session/${sessionId}/cancel`, data);
  }

  // Calendar integration
  async getCalendarEvents(params: {
    startDate: string;
    endDate: string;
    userId?: string;
    includeTimeOff?: boolean;
  }): Promise<{
    id: string;
    title: string;
    start: string;
    end: string;
    type: 'session' | 'time-off';
    status: SessionStatus;
    clientName?: string;
    rbtName?: string;
    location?: string;
  }[]> {
    return apiService.get('/schedule/calendar-events', params);
  }

  // Generate optimized schedules
  async generateSchedule(data: {
    clientIds: string[];
    startDate: string;
    endDate: string;
    constraints?: {
      maxSessionsPerDay?: number;
      preferredTimeSlots?: string[];
      excludeWeekends?: boolean;
    };
  }): Promise<SchedulingResult[]> {
    return apiService.post<SchedulingResult[]>('/schedule/generate', data);
  }
}

export const sessionService = new SessionService();