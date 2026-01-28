/**
 * AECORD Team Members Routes
 *
 * API endpoints for managing team member accounts.
 * All endpoints require admin role.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { createLogger } from '@automaker/utils';
import { requireAdmin } from '../../middleware/require-role.js';
import type { JWTService } from '../../services/jwt-service.js';
import type { UserService } from '../../services/user-service.js';

const logger = createLogger('TeamMembersRoutes');

export function createTeamMembersRoutes(
  _dataDir: string,
  _jwtService: JWTService,
  userService: UserService
): Router {
  const router = Router();

  /**
   * GET /api/team-members
   * List all users (SafeUser[])
   */
  router.get('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const members = await userService.getAll();
      res.json({ success: true, members });
    } catch (error) {
      logger.error('Error listing team members:', error);
      res.status(500).json({ success: false, error: 'Failed to list team members' });
    }
  });

  /**
   * POST /api/team-members
   * Create a new user
   */
  router.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, email, password, role, serviceAreas } = req.body;

      if (!username || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: 'Username, email, password, and role are required',
        });
      }

      const member = await userService.create({
        username,
        email,
        password,
        role,
        serviceAreas: serviceAreas || [],
      });

      logger.info(`Team member created by ${req.user?.username}: ${username} (${role})`);

      res.json({ success: true, member });
    } catch (error) {
      logger.error('Error creating team member:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create team member',
      });
    }
  });

  /**
   * PUT /api/team-members/:id
   * Update user (role, serviceAreas, isActive)
   */
  router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role, serviceAreas, isActive } = req.body;

      const member = await userService.update(id, { role, serviceAreas, isActive });

      logger.info(`Team member updated by ${req.user?.username}: ${member.username}`);

      res.json({ success: true, member });
    } catch (error) {
      logger.error('Error updating team member:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update team member',
      });
    }
  });

  /**
   * DELETE /api/team-members/:id
   * Delete user (prevents deleting last admin)
   */
  router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if (req.user?.userId === id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete your own account',
        });
      }

      const deleted = await userService.delete(id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      logger.info(`Team member deleted by ${req.user?.username}: ${id}`);

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting team member:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete team member',
      });
    }
  });

  /**
   * POST /api/team-members/:id/reset-password
   * Reset password, return temporary password
   */
  router.post('/:id/reset-password', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Generate a temporary password
      const tempPassword =
        crypto.randomBytes(4).toString('hex').toUpperCase() +
        '!' +
        crypto.randomBytes(4).toString('hex');

      const result = await userService.adminResetPassword(id, tempPassword);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.errors?.join(', ') || 'Failed to reset password',
        });
      }

      const user = await userService.getSafeById(id);

      logger.info(`Password reset by ${req.user?.username} for user: ${user?.username || id}`);

      res.json({
        success: true,
        tempPassword,
        username: user?.username,
      });
    } catch (error) {
      logger.error('Error resetting password:', error);
      res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
  });

  return router;
}
