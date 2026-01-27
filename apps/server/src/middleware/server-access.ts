/**
 * Server Access Middleware
 *
 * Checks if non-admin users are allowed to access the server.
 * Admin users can toggle this setting to lock out all non-admin users.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@automaker/utils';
import { getTeamProjectsService } from '../services/team-projects-service.js';

const logger = createLogger('ServerAccessMiddleware');

/**
 * Create middleware that checks if non-admin users can access the server
 *
 * This middleware should be applied after JWT authentication.
 * It allows admins to completely disable access for non-admin users.
 */
export function createServerAccessMiddleware(dataDir: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If no user is authenticated, let other middleware handle it
    if (!req.user) {
      next();
      return;
    }

    // Admins always have access
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if non-admin access is allowed
    try {
      const teamProjectsService = getTeamProjectsService(dataDir);
      const canAccess = teamProjectsService.canAccessServer(req.user.role);

      if (!canAccess) {
        logger.warn(
          `Server access denied for user ${req.user.username} (${req.user.role}) - non-admin access disabled`
        );
        res.status(403).json({
          success: false,
          error: 'Server access disabled',
          message:
            'Server access has been temporarily disabled by the administrator. Please contact your admin for assistance.',
          code: 'SERVER_ACCESS_DISABLED',
        });
        return;
      }

      next();
    } catch (error) {
      // If we can't check permissions, allow access (fail open for backwards compatibility)
      logger.error('Error checking server access permissions:', error);
      next();
    }
  };
}
