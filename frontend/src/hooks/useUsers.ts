import { useApiQuery, useApiMutation, useInvalidateQueries, queryKeys } from './useApi';
import { userService } from '../services/userService';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  RBT,
  CreateRBTRequest,
  UpdateRBTRequest,
  Client,
  CreateClientRequest,
  UpdateClientRequest,
  PaginatedResponse,
  UserRole,
} from '../types';

// Current user hooks
export function useCurrentUser() {
  return useApiQuery({
    queryKey: queryKeys.users.current(),
    queryFn: () => userService.getCurrentUser(),
    staleTime: 1 * 60 * 1000, // 1 minute - user data changes less frequently
  });
}

export function useUpdateCurrentUser() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: UpdateUserRequest) => userService.updateCurrentUser(data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

// User management hooks
export function useUsers(params?: {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
  isActive?: boolean;
}) {
  return useApiQuery({
    queryKey: queryKeys.users.list(params || {}),
    queryFn: () => userService.getUsers(params),
    enabled: !!params, // Only fetch when params are provided
  });
}

export function useUser(id: string) {
  return useApiQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => userService.getUserById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: CreateUserRequest) => userService.createUser(data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useUpdateUser() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      userService.updateUser(id, data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useDeactivateUser() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (id: string) => userService.deactivateUser(id),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useReactivateUser() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (id: string) => userService.reactivateUser(id),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useUsersByRole(role: UserRole) {
  return useApiQuery({
    queryKey: queryKeys.users.byRole(role),
    queryFn: () => userService.getUsersByRole(role),
    enabled: !!role,
  });
}

// RBT-specific hooks
export function useRBTs(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.users.list({ ...params, role: 'rbt' }),
    queryFn: () => userService.getRBTs(params),
  });
}

export function useRBT(id: string) {
  return useApiQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => userService.getRBTById(id),
    enabled: !!id,
  });
}

export function useCreateRBT() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: CreateRBTRequest) => userService.createRBT(data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useUpdateRBT() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRBTRequest }) =>
      userService.updateRBT(id, data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

// Client-specific hooks
export function useClients(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  return useApiQuery({
    queryKey: queryKeys.users.list({ ...params, role: 'client_family' }),
    queryFn: () => userService.getClients(params),
  });
}

export function useClient(id: string) {
  return useApiQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => userService.getClientById(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: (data: CreateClientRequest) => userService.createClient(data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useUpdateClient() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientRequest }) =>
      userService.updateClient(id, data),
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

// Search hooks
export function useSearchUsers(query: string, filters?: {
  role?: UserRole;
  isActive?: boolean;
}) {
  return useApiQuery({
    queryKey: queryKeys.users.list({ search: query, ...filters }),
    queryFn: () => userService.searchUsers(query, filters),
    enabled: query.length >= 2, // Only search when query is at least 2 characters
    staleTime: 30 * 1000, // 30 seconds - search results change frequently
  });
}

// Bulk operations hooks
export function useBulkUpdateUsers() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: async (updates: { id: string; data: UpdateUserRequest }[]) => {
      const results = await Promise.allSettled(
        updates.map(({ id, data }) => userService.updateUser(id, data))
      );
      return results;
    },
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useBulkDeactivateUsers() {
  const { invalidateUsers } = useInvalidateQueries();

  return useApiMutation({
    mutationFn: async (userIds: string[]) => {
      const results = await Promise.allSettled(
        userIds.map(id => userService.deactivateUser(id))
      );
      return results;
    },
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

// Utility hooks
export function useUserStats() {
  return useApiQuery({
    queryKey: queryKeys.users.list({ stats: true }),
    queryFn: async () => {
      const [users, rbts, clients] = await Promise.all([
        userService.getUsers({ limit: 1 }),
        userService.getRBTs({ limit: 1 }),
        userService.getClients({ limit: 1 }),
      ]);

      return {
        totalUsers: users.total,
        totalRBTs: rbts.total,
        totalClients: clients.total,
        activeUsers: users.data.filter(u => u.isActive).length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
  });
}