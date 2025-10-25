import { Request, Response } from 'express';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthenticationService } from '../services/AuthenticationService';
import { validateCreateUserRequest, validateUpdateUserRequest } from '../models/User';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

export class UserController {
  private userRepository: UserRepository;
  private authService: AuthenticationService;

  constructor() {
    this.userRepository = new UserRepository();
    this.authService = new AuthenticationService();
  }

  /**
   * Get all users (with filtering and pagination)
   * GET /api/users
   */
  public getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        role, 
        active, 
        search, 
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        limit: Number(limit),
        offset,
        orderBy: String(sortBy),
        orderDirection: sortOrder as 'asc' | 'desc'
      };

      let users;

      if (search) {
        users = await this.userRepository.search(String(search), options);
      } else if (role && active !== undefined) {
        const isActive = active === 'true';
        if (isActive) {
          users = await this.userRepository.findActiveByRole(role as UserRole, options);
        } else {
          users = await this.userRepository.findByRole(role as UserRole, options);
        }
      } else if (role) {
        users = await this.userRepository.findByRole(role as UserRole, options);
      } else if (active !== undefined) {
        const isActive = active === 'true';
        if (isActive) {
          users = await this.userRepository.findActive(options);
        } else {
          users = await this.userRepository.findAll(options);
        }
      } else {
        users = await this.userRepository.findAll(options);
      }

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: users.length
          }
        }
      });
    } catch (error) {
      logger.error('Get users error', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  };

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  public getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Get user by ID error', { error: error.message, userId: req.params.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user'
      });
    }
  };

  /**
   * Get current user profile
   * GET /api/users/me
   */
  public getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const user = await this.userRepository.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Get current user error', { error: error.message, userId: req.user?.userId });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user profile'
      });
    }
  };

  /**
   * Create new user
   * POST /api/users
   */
  public createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, firstName, lastName, phone, role, password } = req.body;

      // Validate required fields
      const userData = { email, firstName, lastName, phone, role, password };
      const validationErrors = validateCreateUserRequest(userData);

      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
        return;
      }

      const user = await this.authService.register(userData);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Create user error', { error: error.message, email: req.body?.email });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create user'
      });
    }
  };

  /**
   * Update user
   * PUT /api/users/:id
   */
  public updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone, isActive } = req.body;

      // Validate input
      const updateData = { firstName, lastName, phone, isActive };
      const validationErrors = validateUpdateUserRequest(updateData);

      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
        return;
      }

      const user = await this.userRepository.update(id, updateData);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Update user error', { error: error.message, userId: req.params.id });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  };

  /**
   * Update current user profile
   * PUT /api/users/me
   */
  public updateCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { firstName, lastName, phone } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Users can only update their own basic profile info (not isActive)
      const updateData = { firstName, lastName, phone };
      const validationErrors = validateUpdateUserRequest(updateData);

      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
        return;
      }

      const user = await this.userRepository.update(userId, updateData);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Update current user error', { error: error.message, userId: req.user?.userId });
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update profile'
      });
    }
  };

  /**
   * Deactivate user
   * DELETE /api/users/:id
   */
  public deactivateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Prevent self-deactivation
      if (req.user?.userId === id) {
        res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
        return;
      }

      const user = await this.userRepository.deactivate(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Deactivate user error', { error: error.message, userId: req.params.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user'
      });
    }
  };

  /**
   * Reactivate user
   * POST /api/users/:id/reactivate
   */
  public reactivateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.reactivate(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User reactivated successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Reactivate user error', { error: error.message, userId: req.params.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to reactivate user'
      });
    }
  };

  /**
   * Get users by role
   * GET /api/users/role/:role
   */
  public getUsersByRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      const { active = 'true', page = 1, limit = 20 } = req.query;

      const isActive = active === 'true';
      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        limit: Number(limit),
        offset,
        orderBy: 'firstName',
        orderDirection: 'asc' as const
      };

      let users;
      if (isActive) {
        users = await this.userRepository.findActiveByRole(role as UserRole, options);
      } else {
        users = await this.userRepository.findByRole(role as UserRole, options);
      }

      res.status(200).json({
        success: true,
        message: `${role} users retrieved successfully`,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: users.length
          }
        }
      });
    } catch (error) {
      logger.error('Get users by role error', { error: error.message, role: req.params.role });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  };
}