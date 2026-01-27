/**
 * Users Admin Routes - User management for AECORD multi-developer team
 *
 * Provides CRUD endpoints for user management.
 * All routes require admin role (except GET current user).
 *
 * Mounted at /api/users in the main server (AFTER auth middleware).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { UserService } from '../../services/user-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';
import { requireAdmin } from '../../middleware/require-role.js';
import type { CreateUserInput, UpdateUserInput, UserRole } from '@automaker/types';

const logger = createLogger('UsersRoutes');

// Valid roles for validation
const VALID_ROLES: UserRole[] = ['admin', 'backend-dev', 'frontend-dev', 'devops'];

/**
 * Validate role input
 */
function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

/**
 * Create users routes
 *
 * @param userService - User service for user management
 * @param jwtService - JWT service for token operations
 * @returns Express Router with user management endpoints
 */
export function createUsersRoutes(userService: UserService, jwtService: JWTService): Router {
  const router = Router();

  // All routes require JWT authentication
  const requireJWT = createRequireJWTMiddleware(jwtService);
  router.use(requireJWT);

  /**
   * GET /api/users
   *
   * Returns all users (admin only).
   * Query params: role (optional) - filter by role
   */
  router.get('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { role } = req.query as { role?: string };

      let users;
      if (role && isValidRole(role)) {
        users = await userService.getUsersByRole(role);
      } else {
        users = await userService.getAll();
      }

      res.json({
        success: true,
        users,
        count: users.length,
      });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred while fetching users.',
      });
    }
  });

  /**
   * GET /api/users/:id
   *
   * Returns a specific user (admin only).
   */
  router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await userService.getSafeById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found.',
        });
        return;
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred.',
      });
    }
  });

  /**
   * POST /api/users
   *
   * Creates a new user (admin only).
   * Body: { username, email, password, role, serviceAreas? }
   */
  router.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, email, password, role, serviceAreas } = req.body as CreateUserInput;

      // Validate required fields
      if (!username || !email || !password || !role) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: username, email, password, role',
        });
        return;
      }

      // Validate role
      if (!isValidRole(role)) {
        res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email format.',
        });
        return;
      }

      // Validate password strength
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long.',
        });
        return;
      }

      const user = await userService.create({
        username,
        email,
        password,
        role,
        serviceAreas,
      });

      logger.info(`User created by ${req.user?.username}: ${user.username} (${user.role})`);

      res.status(201).json({
        success: true,
        message: 'User created successfully.',
        user,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      logger.error('Create user error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred while creating user.',
      });
    }
  });

  /**
   * PUT /api/users/:id
   *
   * Updates a user (admin only).
   * Body: { username?, email?, password?, role?, serviceAreas?, isActive? }
   */
  router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body as UpdateUserInput;

      // Check if user exists
      const existingUser = await userService.getSafeById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          error: 'User not found.',
        });
        return;
      }

      // Validate role if provided
      if (updates.role && !isValidRole(updates.role)) {
        res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        });
        return;
      }

      // Validate email format if provided
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          res.status(400).json({
            success: false,
            error: 'Invalid email format.',
          });
          return;
        }
      }

      // Validate password strength if provided
      if (updates.password && updates.password.length < 8) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long.',
        });
        return;
      }

      // Prevent admin from demoting themselves
      if (
        req.user?.userId === id &&
        existingUser.role === 'admin' &&
        updates.role &&
        updates.role !== 'admin'
      ) {
        res.status(400).json({
          success: false,
          error: 'You cannot demote yourself from admin.',
        });
        return;
      }

      // Prevent admin from deactivating themselves
      if (req.user?.userId === id && updates.isActive === false) {
        res.status(400).json({
          success: false,
          error: 'You cannot deactivate your own account.',
        });
        return;
      }

      const user = await userService.update(id, updates);

      logger.info(`User updated by ${req.user?.username}: ${user.username}`);

      res.json({
        success: true,
        message: 'User updated successfully.',
        user,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('Cannot delete the last')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred while updating user.',
      });
    }
  });

  /**
   * DELETE /api/users/:id
   *
   * Deletes a user (admin only).
   */
  router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (req.user?.userId === id) {
        res.status(400).json({
          success: false,
          error: 'You cannot delete your own account.',
        });
        return;
      }

      // Check if user exists
      const existingUser = await userService.getSafeById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          error: 'User not found.',
        });
        return;
      }

      const deleted = await userService.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'User not found.',
        });
        return;
      }

      logger.info(`User deleted by ${req.user?.username}: ${existingUser.username}`);

      res.json({
        success: true,
        message: 'User deleted successfully.',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete the last')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred while deleting user.',
      });
    }
  });

  /**
   * GET /api/users/roles/list
   *
   * Returns available roles and their permissions (admin only).
   */
  router.get('/roles/list', requireAdmin, (_req: Request, res: Response) => {
    const { ROLE_PERMISSIONS } = require('@automaker/types');

    res.json({
      success: true,
      roles: VALID_ROLES,
      permissions: ROLE_PERMISSIONS,
    });
  });

  return router;
}
