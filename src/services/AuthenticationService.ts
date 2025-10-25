import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserRepository } from '../database/repositories/UserRepository';
import { User, CreateUserRequest, UserWithAuth } from '../models/User';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export class AuthenticationService {
  private userRepository: UserRepository;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  private saltRounds: number;

  constructor() {
    this.userRepository = new UserRepository();
    
    // JWT configuration - in production these should come from environment variables
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

    if (process.env.NODE_ENV === 'production' && 
        (this.jwtSecret === 'your-secret-key' || this.jwtRefreshSecret === 'your-refresh-secret-key')) {
      throw new Error('JWT secrets must be configured in production environment');
    }
  }

  /**
   * Register a new user with password
   */
  public async register(userData: CreateUserRequest): Promise<User> {
    try {
      // Hash the password
      const salt = await bcrypt.genSalt(this.saltRounds);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      // Create user with authentication data
      const userWithAuth = await this.userRepository.createWithAuth(
        userData,
        { passwordHash, salt }
      );

      // Return user without sensitive data
      const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpiry: ____, ...user } = userWithAuth;
      
      logger.info(`User registered successfully: ${user.email}`, { userId: user.id });
      return user as User;
    } catch (error) {
      logger.error('User registration failed', { email: userData.email, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Authenticate user and return tokens
   */
  public async login(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      // Find user with authentication data
      const userWithAuth = await this.userRepository.findWithAuthByEmail(loginData.email);
      
      if (!userWithAuth) {
        throw new Error('Invalid email or password');
      }

      if (!userWithAuth.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, userWithAuth.passwordHash);
      
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login timestamp
      await this.userRepository.updateLastLogin(userWithAuth.id);

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: userWithAuth.id,
        email: userWithAuth.email,
        role: userWithAuth.role
      };

      const accessToken = this.generateAccessToken(tokenPayload);
      const refreshToken = this.generateRefreshToken(tokenPayload);

      // Return user without sensitive data
      const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpiry: ____, ...user } = userWithAuth;

      logger.info(`User logged in successfully: ${user.email}`, { userId: user.id });

      return {
        user: user as User,
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Login failed', { email: loginData.email, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(refreshData: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshData.refreshToken, this.jwtRefreshSecret) as TokenPayload;
      
      // Verify user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = this.generateAccessToken(tokenPayload);
      const refreshToken = this.generateRefreshToken(tokenPayload);

      logger.info(`Token refreshed successfully: ${user.email}`, { userId: user.id });

      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify and decode access token
   */
  public async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // Verify user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new Error('Invalid token');
      }

      return decoded;
    } catch (error) {
      logger.error('Token verification failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid token');
    }
  }

  /**
   * Initiate password reset process
   */
  public async initiatePasswordReset(resetData: PasswordResetRequest): Promise<void> {
    try {
      const user = await this.userRepository.findByEmail(resetData.email);
      
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.warn(`Password reset attempted for non-existent email: ${resetData.email}`);
        return;
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'password_reset' },
        this.jwtSecret,
        { expiresIn: '1h' }
      );

      const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store reset token in database
      await this.userRepository.setResetToken(user.email, resetToken, expiryDate);

      logger.info(`Password reset initiated: ${user.email}`, { userId: user.id });

      // TODO: Send reset email (will be implemented in notification service)
      // For now, just log the token (remove this in production)
      logger.info(`Password reset token: ${resetToken}`, { userId: user.id });
    } catch (error) {
      logger.error('Password reset initiation failed', { email: resetData.email, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Complete password reset with token
   */
  public async confirmPasswordReset(resetData: PasswordResetConfirmRequest): Promise<void> {
    try {
      // Verify reset token
      const decoded = jwt.verify(resetData.token, this.jwtSecret) as any;
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      // Find user and verify reset token
      const userWithAuth = await this.userRepository.findWithAuthByEmail(decoded.email);
      
      if (!userWithAuth || userWithAuth.resetToken !== resetData.token) {
        throw new Error('Invalid or expired reset token');
      }

      if (userWithAuth.resetTokenExpiry && userWithAuth.resetTokenExpiry < new Date()) {
        throw new Error('Reset token has expired');
      }

      // Validate new password
      if (!resetData.newPassword || resetData.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(this.saltRounds);
      const passwordHash = await bcrypt.hash(resetData.newPassword, salt);

      // Update password and clear reset token
      await this.userRepository.updatePassword(userWithAuth.id, passwordHash, salt);
      await this.userRepository.clearResetToken(userWithAuth.id);

      logger.info(`Password reset completed: ${userWithAuth.email}`, { userId: userWithAuth.id });
    } catch (error) {
      logger.error('Password reset confirmation failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Change user password (authenticated user)
   */
  public async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<void> {
    try {
      // Find user with authentication data
      const userWithAuth = await this.userRepository.findById(userId) as UserWithAuth;
      
      if (!userWithAuth) {
        throw new Error('User not found');
      }

      // Get full auth data
      const fullUserAuth = await this.userRepository.findWithAuthByEmail(userWithAuth.email);
      
      if (!fullUserAuth) {
        throw new Error('Authentication data not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, fullUserAuth.passwordHash);
      
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(this.saltRounds);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      // Update password
      await this.userRepository.updatePassword(userId, passwordHash, salt);

      logger.info(`Password changed successfully: ${userWithAuth.email}`, { userId });
    } catch (error) {
      logger.error('Password change failed', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Check if user has required role
   */
  public hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * Check if user has admin privileges
   */
  public isAdmin(userRole: UserRole): boolean {
    return userRole === 'admin';
  }

  /**
   * Check if user can manage other users
   */
  public canManageUsers(userRole: UserRole): boolean {
    return ['admin', 'coordinator'].includes(userRole);
  }

  /**
   * Generate access token
   */
  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.accessTokenExpiry } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtRefreshSecret, { expiresIn: this.refreshTokenExpiry } as jwt.SignOptions);
  }
}