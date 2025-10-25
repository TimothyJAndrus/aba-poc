import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { AuthenticationService } from '../../services/AuthenticationService';
import { User } from '../../models/User';

// Mock dependencies
jest.mock('../../services/AuthenticationService');

const MockedAuthenticationService = AuthenticationService as jest.MockedClass<typeof AuthenticationService>;

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1-555-123-4567',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AuthenticationService mock
    mockAuthService = new MockedAuthenticationService() as jest.Mocked<AuthenticationService>;
    MockedAuthenticationService.mockImplementation(() => mockAuthService);

    authController = new AuthController();

    // Setup Express mocks
    mockRequest = {
      body: {},
      headers: {},
      user: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'securePassword123'
    };

    it('should successfully login user', async () => {
      const loginResponse = {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      mockRequest.body = loginData;
      mockAuthService.login.mockResolvedValue(loginResponse);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: loginResponse
      });
    });

    it('should return 400 for missing email', async () => {
      mockRequest.body = { password: 'password' };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email and password are required'
      });
    });

    it('should return 400 for missing password', async () => {
      mockRequest.body = { email: 'test@example.com' };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email and password are required'
      });
    });

    it('should return 401 for authentication failure', async () => {
      mockRequest.body = loginData;
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials'
      });
    });
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1-555-123-4567',
      role: 'admin',
      password: 'securePassword123'
    };

    it('should successfully register user', async () => {
      mockRequest.body = registerData;
      mockAuthService.register.mockResolvedValue(mockUser);

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: { user: mockUser }
      });
    });

    it('should return 400 for missing required fields', async () => {
      mockRequest.body = { email: 'test@example.com' }; // Missing other fields

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'All fields are required: email, firstName, lastName, phone, role, password'
      });
    });

    it('should return 400 for registration failure', async () => {
      mockRequest.body = registerData;
      mockAuthService.register.mockRejectedValue(new Error('Email already exists'));

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });
  });

  describe('refreshToken', () => {
    const refreshData = {
      refreshToken: 'valid-refresh-token'
    };

    it('should successfully refresh token', async () => {
      const refreshResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      mockRequest.body = refreshData;
      mockAuthService.refreshToken.mockResolvedValue(refreshResponse);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: refreshResponse
      });
    });

    it('should return 400 for missing refresh token', async () => {
      mockRequest.body = {};

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refresh token is required'
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      mockRequest.body = refreshData;
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshData);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid refresh token'
      });
    });
  });

  describe('changePassword', () => {
    const changePasswordData = {
      currentPassword: 'currentPassword',
      newPassword: 'newSecurePassword123'
    };

    beforeEach(() => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin'
      };
    });

    it('should successfully change password', async () => {
      mockRequest.body = changePasswordData;
      mockAuthService.changePassword.mockResolvedValue();

      await authController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'user-123',
        changePasswordData.currentPassword,
        changePasswordData.newPassword
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should return 400 for missing current password', async () => {
      mockRequest.body = { newPassword: 'newPassword' };

      await authController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password and new password are required'
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockRequest.user = undefined;
      mockRequest.body = changePasswordData;

      await authController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });

    it('should return 400 for password change failure', async () => {
      mockRequest.body = changePasswordData;
      mockAuthService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

      await authController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'user-123',
        changePasswordData.currentPassword,
        changePasswordData.newPassword
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify token', async () => {
      const tokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin' as const
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      mockAuthService.verifyToken.mockResolvedValue(tokenPayload);

      await authController.verifyToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token is valid',
        data: { payload: tokenPayload }
      });
    });

    it('should return 401 for missing authorization header', async () => {
      mockRequest.headers = {};

      await authController.verifyToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization header required'
      });
    });

    it('should return 401 for invalid token format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      await authController.verifyToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization header required'
      });
    });

    it('should return 401 for invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await authController.verifyToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });
  });

  describe('forgotPassword', () => {
    it('should initiate password reset', async () => {
      mockRequest.body = { email: 'test@example.com' };
      mockAuthService.initiatePasswordReset.mockResolvedValue();

      await authController.forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.initiatePasswordReset).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    });

    it('should return 400 for missing email', async () => {
      mockRequest.body = {};

      await authController.forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.initiatePasswordReset).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    it('should return success even on service error (security)', async () => {
      mockRequest.body = { email: 'test@example.com' };
      mockAuthService.initiatePasswordReset.mockRejectedValue(new Error('Service error'));

      await authController.forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.initiatePasswordReset).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    });
  });

  describe('resetPassword', () => {
    const resetData = {
      token: 'valid-reset-token',
      newPassword: 'newSecurePassword123'
    };

    it('should successfully reset password', async () => {
      mockRequest.body = resetData;
      mockAuthService.confirmPasswordReset.mockResolvedValue();

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(resetData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    it('should return 400 for missing token', async () => {
      mockRequest.body = { newPassword: 'newPassword' };

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmPasswordReset).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token and new password are required'
      });
    });

    it('should return 400 for password reset failure', async () => {
      mockRequest.body = resetData;
      mockAuthService.confirmPasswordReset.mockRejectedValue(new Error('Invalid token'));

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(resetData);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});