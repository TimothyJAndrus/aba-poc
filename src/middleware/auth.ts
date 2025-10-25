import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../services/AuthenticationService';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthenticationService;

  constructor() {
    this.authService = new AuthenticationService();
  }

  /**
   * Middleware to authenticate requests using JWT tokens
   */
  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Add user data to request object
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      };

      next();
    } catch (error) {
      logger.error('Authentication failed', { error: error.message });
      
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  };

  /**
   * Middleware to authorize requests based on user roles
   */
  public authorize = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        const hasPermission = this.authService.hasRole(req.user.role, allowedRoles);

        if (!hasPermission) {
          logger.warn('Authorization failed', { 
            userId: req.user.userId, 
            userRole: req.user.role, 
            requiredRoles: allowedRoles 
          });

          res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Authorization error', { error: error.message });
        
        res.status(500).json({
          success: false,
          message: 'Authorization failed'
        });
      }
    };
  };

  /**
   * Middleware to require admin role
   */
  public requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    this.authorize(['admin'])(req, res, next);
  };

  /**
   * Middleware to require admin or coordinator role
   */
  public requireManager = (req: Request, res: Response, next: NextFunction): void => {
    this.authorize(['admin', 'coordinator'])(req, res, next);
  };

  /**
   * Middleware to require RBT role (for RBT-specific endpoints)
   */
  public requireRBT = (req: Request, res: Response, next: NextFunction): void => {
    this.authorize(['rbt'])(req, res, next);
  };

  /**
   * Middleware to allow access to own resources or admin/coordinator
   */
  public requireOwnershipOrManager = (userIdParam: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        const targetUserId = req.params[userIdParam];
        const isOwner = req.user.userId === targetUserId;
        const isManager = this.authService.canManageUsers(req.user.role);

        if (!isOwner && !isManager) {
          logger.warn('Ownership/management authorization failed', { 
            userId: req.user.userId, 
            targetUserId, 
            userRole: req.user.role 
          });

          res.status(403).json({
            success: false,
            message: 'Access denied: insufficient permissions'
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Ownership authorization error', { error: error.message });
        
        res.status(500).json({
          success: false,
          message: 'Authorization failed'
        });
      }
    };
  };

  /**
   * Optional authentication middleware (doesn't fail if no token provided)
   */
  public optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.authService.verifyToken(token);

        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role
        };
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens
      logger.debug('Optional authentication failed', { error: error.message });
      next();
    }
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();

// Export commonly used methods
export const authenticateToken = authMiddleware.authenticate;
export const requireRole = authMiddleware.requireRole;
export const requireOwnership = authMiddleware.requireOwnership;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;