import { apiService } from './api';
import type {
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

export class UserService {
  // Current user operations
  async getCurrentUser(): Promise<User> {
    return apiService.get<User>('/users/me');
  }

  async updateCurrentUser(data: UpdateUserRequest): Promise<User> {
    return apiService.put<User>('/users/me', data);
  }

  // User management operations (admin/coordinator only)
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: UserRole;
    search?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<User>> {
    return apiService.get<PaginatedResponse<User>>('/users', params);
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    return apiService.post<User>('/users', data);
  }

  async getUserById(id: string): Promise<User> {
    return apiService.get<User>(`/users/${id}`);
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    return apiService.put<User>(`/users/${id}`, data);
  }

  async deactivateUser(id: string): Promise<void> {
    return apiService.delete<void>(`/users/${id}`);
  }

  async reactivateUser(id: string): Promise<User> {
    return apiService.post<User>(`/users/${id}/reactivate`);
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return apiService.get<User[]>(`/users/role/${role}`);
  }

  // RBT-specific operations
  async getRBTs(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<RBT>> {
    return apiService.get<PaginatedResponse<RBT>>('/users/role/rbt', params);
  }

  async createRBT(data: CreateRBTRequest): Promise<RBT> {
    return apiService.post<RBT>('/users', { ...data, role: 'rbt' });
  }

  async updateRBT(id: string, data: UpdateRBTRequest): Promise<RBT> {
    return apiService.put<RBT>(`/users/${id}`, data);
  }

  async getRBTById(id: string): Promise<RBT> {
    return apiService.get<RBT>(`/users/${id}`);
  }

  // Client-specific operations
  async getClients(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<Client>> {
    return apiService.get<PaginatedResponse<Client>>(
      '/users/role/client_family',
      params
    );
  }

  async createClient(data: CreateClientRequest): Promise<Client> {
    return apiService.post<Client>('/users', {
      ...data,
      role: 'client_family',
    });
  }

  async updateClient(id: string, data: UpdateClientRequest): Promise<Client> {
    return apiService.put<Client>(`/users/${id}`, data);
  }

  async getClientById(id: string): Promise<Client> {
    return apiService.get<Client>(`/users/${id}`);
  }

  // Search operations
  async searchUsers(
    query: string,
    filters?: {
      role?: UserRole;
      isActive?: boolean;
    }
  ): Promise<User[]> {
    return apiService.get<User[]>('/users', { search: query, ...filters });
  }
}

export const userService = new UserService();
