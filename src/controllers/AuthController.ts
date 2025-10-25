import { Request, Response } from 'express';
import { AuthenticationService } from '../services/AuthenticationService';
import { logger } from '../utils/logger';

export class AuthController {
  private authService: AuthenticationService;

  constructor() {
    this.authService = new AuthenticationService();
  }

  /**
   * User login
   * POST /api/auth/login
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const result = await this.authService.login({ email, password });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('Login error', { error: error.message, email: req.body?.email });
      
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed'
      });
    }
  };

  /**
   * User registration
   * POST /api/auth/register
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, firstName, lastName, phone, role, password } = req.body;

      // Validate required fields
      if (!email || !firstName || !lastName || !phone || !role || !password) {
        res.status(400).json({
          success: false,
          message: 'All fields are required: email, firstName, lastName, phone, role, password'
        });
        return;
      }

      const user = await this.authService.register({
        email,
        firstName,
        lastName,
        phone,
        role,
        password
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Registration error', { error: error.message, email: req.body?.email });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      const result = await this.authService.refreshToken({ refreshToken });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Token refresh error', { error: error.message });
      
      res.status(401).json({
        success: false,
        message: error.message || 'Token refresh failed'
      });
    }
  };

  /**
   * Initiate password reset
   * POST /api/auth/forgot-password
   */
  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      await this.authService.initiatePasswordReset({ email });

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      logger.error('Password reset initiation error', { error: error.message, email: req.body?.email });
      
      // Still return success for security
      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }
  };

  /**
   * Complete password reset
   * POST /api/auth/reset-password
   */
  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
        return;
      }

      await this.authService.confirmPasswordReset({ token, newPassword });

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Password reset error', { error: error.message });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Password reset failed'
      });
    }
  };

  /**
   * Change password (authenticated user)
   * POST /api/auth/change-password
   */
  public changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user?.userId; // Set by auth middleware

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await this.authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change error', { error: error.message, userId: (req as any).user?.userId });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Password change failed'
      });
    }
  };

  /**
   * Verify token (for client-side token validation)
   * POST /api/auth/verify
   */
  public verifyToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const payload = await this.authService.verifyToken(token);

      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: { payload }
      });
    } catch (error) {
      logger.error('Token verification error', { error: error.message });
      
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid token'
      });
    }
  };

  /**
   * Logout (client-side token invalidation)
   * POST /api/auth/logout
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // For JWT tokens, logout is typically handled client-side by removing the token
      // In a more sophisticated setup, you might maintain a blacklist of tokens
      
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  };
}