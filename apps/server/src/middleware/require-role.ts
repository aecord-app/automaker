/**
 * Role-Based Authorization Middleware for AECORD multi-developer team
 *
 * Restricts access to routes based on user roles.
 * Must be used after JWT authentication middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@automaker/utils';
import type { UserRole, Permission } from '@automaker/types';
import { hasPermission } from '@automaker/types';

const logger = createLogger('RequireRoleMiddleware');

/**
 * Middleware factory that requires one of the specified roles
 *
 * @example
 * // Require admin role
 * router.use(requireRole('admin'));
 *
 * // Require admin OR devops role
 * router.use(requireRole('admin', 'devops'));
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated via JWT
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    // Check if user has one of the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Access denied for user ${req.user.username} (${req.user.role}). ` +
          `Required roles: ${allowedRoles.join(', ')}`
      );

      res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires a specific permission
 *
 * @example
 * // Require approve_tasks permission
 * router.use(requirePermission('approve_tasks'));
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated via JWT
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    // Check if user's role has the required permission
    if (!hasPermission(req.user.role, permission)) {
      logger.warn(
        `Permission denied for user ${req.user.username} (${req.user.role}). ` +
          `Required permission: ${permission}`
      );

      res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: `This action requires the "${permission}" permission`,
        requiredPermission: permission,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

// Convenience exports for common role requirements
export const requireAdmin = requireRole('admin');
export const requireDeveloper = requireRole('admin', 'backend-dev', 'frontend-dev', 'devops');
export const requireDevOps = requireRole('admin', 'devops');

// Convenience exports for common permission requirements
export const requireApprovePermission = requirePermission('approve_tasks');
export const requireManageUsersPermission = requirePermission('manage_users');
