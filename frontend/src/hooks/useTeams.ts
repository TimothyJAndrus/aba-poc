import { useApiQuery, useApiMutation, useInvalidateQueries, queryKeys } from './useApi';
import { teamService } from '../services/teamService';
import {
  Team,
  CreateTeamRequest,
  UpdateTeamRequest,
  TeamHistory,
  TeamAssignment,
  RBT,
  ContinuityScore,
} from '../types';

// Team CRUD hooks
export function useTeam(teamId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: () => teamService.getTeam(teamId),
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: CreateTeamRequest) => teamService.createTeam(data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

export function useUpdateTeam() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: UpdateTeamRequest }) =>
      teamService.updateTeam(teamId, data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

export function useEndTeam() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ teamId, data }: {
      teamId: string;
      data: {
        endDate: Date;
        reason?: string;
        updatedBy: string;
      };
    }) => teamService.endTeam(teamId, data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

// Team member management hooks
export function useAddRBTToTeam() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ teamId, data }: {
      teamId: string;
      data: {
        rbtId: string;
        addedBy: string;
      };
    }) => teamService.addRBTToTeam(teamId, data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

export function useRemoveRBTFromTeam() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ teamId, rbtId, data }: {
      teamId: string;
      rbtId: string;
      data: {
        reason?: string;
        removedBy: string;
      };
    }) => teamService.removeRBTFromTeam(teamId, rbtId, data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

export function useChangePrimaryRBT() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ teamId, data }: {
      teamId: string;
      data: {
        newPrimaryRbtId: string;
        reason?: string;
        changedBy: string;
      };
    }) => teamService.changePrimaryRBT(teamId, data),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

// Team query hooks
export function useClientTeamHistory(clientId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.history(clientId),
    queryFn: () => teamService.getClientTeamHistory(clientId),
    enabled: !!clientId,
  });
}

export function useRBTTeams(rbtId: string, params?: {
  includeInactive?: boolean;
}) {
  return useApiQuery({
    queryKey: queryKeys.teams.byRBT(rbtId),
    queryFn: () => teamService.getRBTTeams(rbtId, params),
    enabled: !!rbtId,
  });
}

export function useTeamsByPrimaryRBT(rbtId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ primaryRbtId: rbtId }),
    queryFn: () => teamService.getTeamsByPrimaryRBT(rbtId),
    enabled: !!rbtId,
  });
}

// Team recommendations and availability hooks
export function useAvailableRBTs(params?: {
  clientId?: string;
  qualifications?: string[];
  excludeRbtIds?: string[];
}) {
  return useApiQuery({
    queryKey: queryKeys.teams.availableRBTs(params || {}),
    queryFn: () => teamService.getAvailableRBTs(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - availability changes frequently
  });
}

export function useTeamsNeedingRBTs() {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ needingRBTs: true }),
    queryFn: () => teamService.getTeamsNeedingRBTs(),
    staleTime: 5 * 60 * 1000, // 5 minutes - this data doesn't change frequently
  });
}

// Team assignments and continuity hooks
export function useTeamAssignments(teamId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ teamId, assignments: true }),
    queryFn: () => teamService.getTeamAssignments(teamId),
    enabled: !!teamId,
  });
}

export function useContinuityScores(params?: {
  clientId?: string;
  rbtId?: string;
  teamId?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.teams.continuity(params || {}),
    queryFn: () => teamService.getContinuityScores(params),
    staleTime: 10 * 60 * 1000, // 10 minutes - continuity scores don't change frequently
  });
}

// Team performance metrics hooks
export function useTeamMetrics(teamId: string, params?: {
  startDate?: string;
  endDate?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ teamId, metrics: true, ...params }),
    queryFn: () => teamService.getTeamMetrics(teamId, params),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes - metrics don't change frequently
  });
}

// Team recommendations hooks
export function useTeamRecommendations(clientId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ clientId, recommendations: true }),
    queryFn: () => teamService.getTeamRecommendations(clientId),
    enabled: !!clientId,
    staleTime: 15 * 60 * 1000, // 15 minutes - recommendations don't change frequently
  });
}

// Bulk operations hooks
export function useBulkUpdateTeams() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (updates: {
      teamId: string;
      updates: UpdateTeamRequest;
    }[]) => teamService.bulkUpdateTeams(updates),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

export function useBulkAssignRBTs() {
  const { invalidateTeams } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (assignments: {
      teamId: string;
      rbtId: string;
      isPrimary?: boolean;
    }[]) => teamService.bulkAssignRBTs(assignments),
    onSuccess: () => {
      invalidateTeams();
    },
  });
}

// Utility hooks for dashboard data
export function useClientTeams(clientId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.byClient(clientId),
    queryFn: async () => {
      const history = await teamService.getClientTeamHistory(clientId);
      return history.changes
        .filter(change => change.changeType === 'team_created')
        .map(change => ({
          teamId: history.teamId,
          clientId: history.clientId,
          createdAt: change.changeDate,
          createdBy: change.changedBy,
        }));
    },
    enabled: !!clientId,
  });
}

export function useRBTWorkload(rbtId: string) {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ rbtId, workload: true }),
    queryFn: async () => {
      const teams = await teamService.getRBTTeams(rbtId);
      const activeTeams = teams.filter(team => team.isActive);
      
      return {
        totalTeams: teams.length,
        activeTeams: activeTeams.length,
        primaryTeams: activeTeams.filter(team => team.primaryRbtId === rbtId).length,
        secondaryTeams: activeTeams.filter(team => team.primaryRbtId !== rbtId).length,
      };
    },
    enabled: !!rbtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTeamStats() {
  return useApiQuery({
    queryKey: queryKeys.teams.list({ stats: true }),
    queryFn: async () => {
      const [teamsNeedingRBTs, availableRBTs] = await Promise.all([
        teamService.getTeamsNeedingRBTs(),
        teamService.getAvailableRBTs(),
      ]);

      return {
        teamsNeedingRBTs: teamsNeedingRBTs.length,
        availableRBTs: availableRBTs.length,
        urgentTeams: teamsNeedingRBTs.filter(team => team.urgency === 'high').length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}