import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../auth';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UserRole } from '../../types';

// Mock dependencies
jest.mock('../../services/AuthenticationService');

const MockedAuthenticationService = AuthenticationService as jest.MockedClass<typeof AuthenticationService>;

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AuthenticationService mock
    mockAuthService = new MockedAuthenticationService() as jest.Mocked<AuthenticationService>;
    MockedAuthenticationService.mockImplementation(() => mockAuthService);

    authMiddleware = new AuthMiddleware();

    // Setup Express mocks
    mockRequest = {
      headers: {},
      user: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      const tokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockAuthService.verifyToken.mockResolvedValue(tokenPayload);

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual({
        userId: tokenPayload.userId,
        email: tokenPayload.email,
        role: tokenPayload.role
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization header required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization header required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'coordinator' as const
      };
    });

    it('should authorize user with required role', () => {
      mockAuthService.hasRole.mockReturnValue(true);

      const middleware = authMiddleware.authorize(['admin', 'coordinator']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.hasRole).toHaveBeenCalledWith('coordinator', ['admin', 'coordinator']);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      mockAuthService.hasRole.mockReturnValue(false);

      const middleware = authMiddleware.authorize(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.hasRole).toHaveBeenCalledWith('coordinator', ['admin']);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request without authenticated user', () => {
      mockRequest.user = undefined;

      const middleware = authMiddleware.authorize(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.hasRole).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call authorize with admin role', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin' as const
      };

      mockAuthService.hasRole.mockReturnValue(true);

      authMiddleware.requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.hasRole).toHaveBeenCalledWith('admin', ['admin']);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireManager', () => {
    it('should call authorize with admin and coordinator roles', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'coordinator' as const
      };

      mockAuthService.hasRole.mockReturnValue(true);

      authMiddleware.requireManager(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.hasRole).toHaveBeenCalledWith('coordinator', ['admin', 'coordinator']);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRBT', () => {
    it('should call authorize with RBT role', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'rbt' as const
      };

      mockAuthService.hasRole.mockReturnValue(true);

      authMiddleware.requireRBT(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.hasRole).toHaveBeenCalledWith('rbt', ['rbt']);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireOwnershipOrManager', () => {
    beforeEach(() => {
      mockRequest.params = { id: 'user-123' };
    });

    it('should allow access for resource owner', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'rbt' as const
      };

      mockAuthService.canManageUsers.mockReturnValue(false);

      const middleware = authMiddleware.requireOwnershipOrManager();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for manager', () => {
      mockRequest.user = {
        userId: 'different-user',
        email: 'admin@example.com',
        role: 'admin'
      };

      mockAuthService.canManageUsers.mockReturnValue(true);

      const middleware = authMiddleware.requireOwnershipOrManager();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.canManageUsers).toHaveBeenCalledWith('admin');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject non-owner non-manager', () => {
      mockRequest.user = {
        userId: 'different-user',
        email: 'rbt@example.com',
        role: 'rbt' as const
      };

      mockAuthService.canManageUsers.mockReturnValue(false);

      const middleware = authMiddleware.requireOwnershipOrManager();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom parameter name', () => {
      mockRequest.params = { userId: 'user-123' };
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'rbt' as const
      };

      mockAuthService.canManageUsers.mockReturnValue(false);

      const middleware = authMiddleware.requireOwnershipOrManager('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authenticated user', () => {
      mockRequest.user = undefined;

      const middleware = authMiddleware.requireOwnershipOrManager();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user data for valid token', async () => {
      const tokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockAuthService.verifyToken.mockResolvedValue(tokenPayload);

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual({
        userId: tokenPayload.userId,
        email: tokenPayload.email,
        role: tokenPayload.role
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user data for invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user data when no token provided', async () => {
      mockRequest.headers = {};

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});