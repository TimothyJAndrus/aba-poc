import { apiService } from './api';
import {
  Team,
  CreateTeamRequest,
  UpdateTeamRequest,
  TeamHistory,
  TeamAssignment,
  RBT,
  ContinuityScore,
} from '../types';

export class TeamService {
  // Team CRUD operations
  async createTeam(data: CreateTeamRequest): Promise<Team> {
    return apiService.post<Team>('/teams', data);
  }

  async getTeam(teamId: string): Promise<Team> {
    return apiService.get<Team>(`/teams/${teamId}`);
  }

  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    return apiService.put<Team>(`/teams/${teamId}`, data);
  }

  async endTeam(teamId: string, data: {
    endDate: Date;
    reason?: string;
    updatedBy: string;
  }): Promise<Team> {
    return apiService.put<Team>(`/teams/${teamId}/end`, data);
  }

  // Team member management
  async addRBTToTeam(teamId: string, data: {
    rbtId: string;
    addedBy: string;
  }): Promise<Team> {
    return apiService.post<Team>(`/teams/${teamId}/rbts`, data);
  }

  async removeRBTFromTeam(teamId: string, rbtId: string, data: {
    reason?: string;
    removedBy: string;
  }): Promise<Team> {
    return apiService.delete<Team>(`/teams/${teamId}/rbts/${rbtId}`, data);
  }

  async changePrimaryRBT(teamId: string, data: {
    newPrimaryRbtId: string;
    reason?: string;
    changedBy: string;
  }): Promise<Team> {
    return apiService.put<Team>(`/teams/${teamId}/primary-rbt`, data);
  }

  // Team queries
  async getClientTeamHistory(clientId: string): Promise<TeamHistory> {
    return apiService.get<TeamHistory>(`/teams/client/${clientId}/history`);
  }

  async getRBTTeams(rbtId: string, params?: {
    includeInactive?: boolean;
  }): Promise<Team[]> {
    return apiService.get<Team[]>(`/teams/rbt/${rbtId}`, params);
  }

  async getTeamsByPrimaryRBT(rbtId: string): Promise<Team[]> {
    return apiService.get<Team[]>(`/teams/primary-rbt/${rbtId}`);
  }

  // Team recommendations and availability
  async getAvailableRBTs(params?: {
    clientId?: string;
    qualifications?: string[];
    excludeRbtIds?: string[];
  }): Promise<RBT[]> {
    return apiService.get<RBT[]>('/teams/available-rbts', params);
  }

  async getTeamsNeedingRBTs(): Promise<{
    teamId: string;
    clientId: string;
    clientName: string;
    currentRBTCount: number;
    recommendedRBTCount: number;
    urgency: 'low' | 'medium' | 'high';
  }[]> {
    return apiService.get('/teams/needing-rbts');
  }

  // Team assignments and continuity
  async getTeamAssignments(teamId: string): Promise<TeamAssignment[]> {
    return apiService.get<TeamAssignment[]>(`/teams/${teamId}/assignments`);
  }

  async getContinuityScores(params?: {
    clientId?: string;
    rbtId?: string;
    teamId?: string;
  }): Promise<ContinuityScore[]> {
    return apiService.get<ContinuityScore[]>('/teams/continuity-scores', params);
  }

  // Team performance metrics
  async getTeamMetrics(teamId: string, params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    teamId: string;
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    averageContinuityScore: number;
    rbtUtilization: {
      rbtId: string;
      rbtName: string;
      scheduledHours: number;
      completedHours: number;
      utilizationRate: number;
    }[];
  }> {
    return apiService.get(`/teams/${teamId}/metrics`, params);
  }

  // Team recommendations
  async getTeamRecommendations(clientId: string): Promise<{
    recommendedRBTs: {
      rbtId: string;
      rbtName: string;
      qualificationMatch: number;
      availabilityScore: number;
      continuityPotential: number;
      overallScore: number;
    }[];
    currentTeamAnalysis: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
  }> {
    return apiService.get(`/teams/recommendations/client/${clientId}`);
  }

  // Bulk operations
  async bulkUpdateTeams(updates: {
    teamId: string;
    updates: UpdateTeamRequest;
  }[]): Promise<Team[]> {
    return apiService.post<Team[]>('/teams/bulk-update', { updates });
  }

  async bulkAssignRBTs(assignments: {
    teamId: string;
    rbtId: string;
    isPrimary?: boolean;
  }[]): Promise<Team[]> {
    return apiService.post<Team[]>('/teams/bulk-assign', { assignments });
  }
}

export const teamService = new TeamService();