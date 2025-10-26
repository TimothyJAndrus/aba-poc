// Core API services
export { ApiService, apiService } from './api';
export { authService } from './authService';
export { websocketService } from './websocketService';
export { searchService } from './searchService';
export type {
  SearchResult,
  SearchResponse,
  SearchQuery,
  SearchFilters,
  SavedSearch,
  SearchHistory,
} from './searchService';

// Backend integration services
export { userService } from './userService';
export { sessionService } from './sessionService';
export { teamService } from './teamService';
export { notificationApiService } from './notificationApiService';
export { monitoringService } from './monitoringService';

// API error classes
export {
  ApiError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from './api';
