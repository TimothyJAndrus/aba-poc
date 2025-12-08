import type { AuthResponse, LoginCredentials } from '../types';

// Base API configuration for the application
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';

// Custom error classes for better error handling
export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: unknown;

  constructor(
    status: number,
    statusText: string,
    message: string,
    data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(401, 'Unauthorized', message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends ApiError {
  validationErrors?: Record<string, string[]>;

  constructor(message: string, validationErrors?: Record<string, string[]>) {
    super(400, 'Bad Request', message);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(403, 'Forbidden', message);
    this.name = 'AuthorizationError';
  }
}

// Request/Response interceptor types
export type RequestInterceptor = (
  config: RequestInit
) => RequestInit | Promise<RequestInit>;

export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;

export type ErrorInterceptor = (error: Error) => Error | Promise<Error>;

export class ApiService {
  private readonly baseURL: string;
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];
  private readonly errorInterceptors: ErrorInterceptor[] = [];

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Interceptor management
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  // Token management
  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  private removeAuthToken(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // Refresh token logic
  private async refreshAuthToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseURL}${API_VERSION}/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (!response.ok) {
        this.removeAuthToken();
        return null;
      }

      const data: AuthResponse = await response.json();
      this.setAuthToken(data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.removeAuthToken();
      return null;
    }
  }

  // Helper method to handle HTTP errors
  private handleHttpError(
    status: number,
    errorData: { message?: string; validationErrors?: Record<string, string[]> }
  ): never {
    switch (status) {
      case 400:
        throw new ValidationError(
          errorData.message || 'Validation failed',
          errorData.validationErrors
        );
      case 401:
        this.removeAuthToken();
        throw new AuthenticationError(
          errorData.message || 'Authentication failed'
        );
      case 403:
        throw new AuthorizationError(errorData.message || 'Access denied');
      case 404:
        throw new ApiError(
          404,
          'Not Found',
          errorData.message || 'Resource not found'
        );
      case 409:
        throw new ApiError(
          409,
          'Conflict',
          errorData.message || 'Resource conflict'
        );
      case 422:
        throw new ValidationError(
          errorData.message || 'Unprocessable entity',
          errorData.validationErrors
        );
      case 429:
        throw new ApiError(429, 'Too Many Requests', 'Rate limit exceeded');
      case 500:
        throw new ApiError(
          500,
          'Internal Server Error',
          'Server error occurred'
        );
      case 502:
        throw new ApiError(
          502,
          'Bad Gateway',
          'Service temporarily unavailable'
        );
      case 503:
        throw new ApiError(
          503,
          'Service Unavailable',
          'Service temporarily unavailable'
        );
      default:
        throw new ApiError(
          status,
          'Unknown Error',
          errorData.message || `HTTP error! status: ${status}`,
          errorData
        );
    }
  }

  // Helper method to prepare request config
  private async prepareRequestConfig(
    options: RequestInit,
    token: string | null
  ): Promise<RequestInit> {
    let config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    // Add auth token if available
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    return config;
  }

  // Core request method with comprehensive error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${API_VERSION}${endpoint}`;
    const token = this.getAuthToken();
    const config = await this.prepareRequestConfig(options, token);

    try {
      let response = await fetch(url, config);

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      // Handle 401 with token refresh
      if (response.status === 401 && token) {
        const newToken = await this.refreshAuthToken();
        if (newToken) {
          // Retry request with new token
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${newToken}`,
          };
          response = await fetch(url, config);
        }
      }

      // Handle different error types
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleHttpError(response.status, errorData);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Apply error interceptors
      let processedError = error as Error;
      for (const interceptor of this.errorInterceptors) {
        processedError = await interceptor(processedError);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network connection failed');
      }

      throw processedError;
    }
  }

  // HTTP method helpers
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(
          Object.entries(params).reduce(
            (acc, [key, value]) => {
              acc[key] = String(value);
              return acc;
            },
            {} as Record<string, string>
          )
        ).toString()}`
      : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // File upload helper
  async uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, unknown>
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        formData.append(key, String(value));
      }
    }

    const token = this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>('/auth/login', credentials);
    this.setAuthToken(response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.post('/auth/logout');
    } finally {
      this.removeAuthToken();
    }
  }

  async refreshToken(): Promise<AuthResponse | null> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await this.post<AuthResponse>('/auth/refresh', {
        refreshToken,
      });
      this.setAuthToken(response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.removeAuthToken();
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> {
    return this.get('/health');
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  getCurrentToken(): string | null {
    return this.getAuthToken();
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Add default error interceptor for logging
apiService.addErrorInterceptor(async (error: Error) => {
  if (import.meta.env.DEV) {
    console.error('API Error:', error);
  }
  return error;
});

// Add request interceptor for request logging in development
if (import.meta.env.DEV) {
  apiService.addRequestInterceptor(async (config: RequestInit) => {
    console.log('API Request:', config);
    return config;
  });
}
