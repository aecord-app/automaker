/**
 * AECORD Role Permissions Routes
 *
 * API endpoints for managing role-based feature permissions.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import { getRolePermissionsService } from '../../services/role-permissions-service.js';
import { requireAdmin, requireDeveloper } from '../../middleware/require-role.js';
import type { JWTService } from '../../services/jwt-service.js';
import type { RolePermissionsConfig } from '@automaker/types';

const logger = createLogger('RolePermissionsRoutes');

export function createRolePermissionsRoutes(dataDir: string, _jwtService: JWTService): Router {
  const router = Router();
  const rolePermissionsService = getRolePermissionsService(dataDir);

  // Note: JWT authentication is handled by the global middleware in index.ts
  // Individual routes use requireAdmin/requireDeveloper which check req.user

  /**
   * GET /api/role-permissions
   * Get current role permissions configuration
   * Any authenticated user can view permissions
   */
  router.get('/', requireDeveloper, (req: Request, res: Response) => {
    try {
      const permissions = rolePermissionsService.getPermissions();
      res.json({
        success: true,
        permissions,
      });
    } catch (error) {
      logger.error('Error getting role permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get role permissions',
      });
    }
  });

  /**
   * PUT /api/role-permissions
   * Update role permissions (admin only)
   */
  router.put('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { permissions } = req.body as { permissions: RolePermissionsConfig };

      if (!permissions) {
        return res.status(400).json({
          success: false,
          error: 'Missing permissions in request body',
        });
      }

      const updatedPermissions = await rolePermissionsService.updatePermissions(permissions);

      logger.info(`Role permissions updated by ${req.user?.username}`);

      res.json({
        success: true,
        permissions: updatedPermissions,
      });
    } catch (error) {
      logger.error('Error updating role permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update role permissions',
      });
    }
  });

  /**
   * POST /api/role-permissions/reset
   * Reset permissions to defaults (admin only)
   */
  router.post('/reset', requireAdmin, async (req: Request, res: Response) => {
    try {
      const permissions = await rolePermissionsService.resetPermissions();

      logger.info(`Role permissions reset to defaults by ${req.user?.username}`);

      res.json({
        success: true,
        permissions,
      });
    } catch (error) {
      logger.error('Error resetting role permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset role permissions',
      });
    }
  });

  return router;
}
