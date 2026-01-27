/**
 * Approval Routes - Task approval workflow for AECORD multi-developer team
 *
 * Provides endpoints for:
 * - Getting pending approvals
 * - Approving/rejecting tasks (admin only)
 * - Submitting tasks for approval
 * - Assigning tasks to developers
 *
 * Mounted at /api/approvals in the main server.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { ApprovalService } from '../../services/approval-service.js';
import type { UserService } from '../../services/user-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';
import { requireAdmin, requirePermission } from '../../middleware/require-role.js';
import { validatePathParams } from '../../middleware/validate-paths.js';
import type { ApprovalStatus, TaskType, TaskPriority } from '@automaker/types';

const logger = createLogger('ApprovalsRoutes');

/**
 * Create approval routes
 *
 * @param approvalService - Approval service for workflow management
 * @param userService - User service for user lookups
 * @param jwtService - JWT service for authentication
 * @returns Express Router with approval endpoints
 */
export function createApprovalsRoutes(
  approvalService: ApprovalService,
  userService: UserService,
  jwtService: JWTService
): Router {
  const router = Router();

  // All routes require JWT authentication
  const requireJWT = createRequireJWTMiddleware(jwtService);
  router.use(requireJWT);

  /**
   * GET /api/approvals/pending
   *
   * Get all features pending approval.
   * Query params:
   * - projectPath: Required - Path to the project
   *
   * Admin sees all pending features.
   * Non-admin users see only their assigned features or features in their service areas.
   */
  router.get('/pending', validatePathParams('projectPath'), async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.query as { projectPath: string };

      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const user = await userService.getSafeById(req.user.userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const features = await approvalService.getVisibleFeatures(projectPath, user, {
        approvalStatus: 'pending',
      });

      res.json({
        success: true,
        features,
        count: features.length,
      });
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending approvals',
      });
    }
  });

  /**
   * GET /api/approvals/queue
   *
   * Get the full approval queue with statistics.
   * Query params:
   * - projectPath: Required - Path to the project
   * - status: Optional - Filter by approval status (pending, approved, rejected)
   * - type: Optional - Filter by task type
   * - priority: Optional - Filter by priority
   */
  router.get('/queue', validatePathParams('projectPath'), async (req: Request, res: Response) => {
    try {
      const { projectPath, status, type, priority } = req.query as {
        projectPath: string;
        status?: ApprovalStatus;
        type?: TaskType;
        priority?: TaskPriority;
      };

      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const user = await userService.getSafeById(req.user.userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const features = await approvalService.getVisibleFeatures(projectPath, user, {
        approvalStatus: status,
        taskType: type,
        taskPriority: priority,
      });

      const stats = await approvalService.getApprovalStats(projectPath);

      res.json({
        success: true,
        features,
        count: features.length,
        stats,
      });
    } catch (error) {
      logger.error('Error getting approval queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get approval queue',
      });
    }
  });

  /**
   * GET /api/approvals/stats
   *
   * Get approval statistics for a project.
   * Query params:
   * - projectPath: Required - Path to the project
   */
  router.get('/stats', validatePathParams('projectPath'), async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.query as { projectPath: string };

      const stats = await approvalService.getApprovalStats(projectPath);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Error getting approval stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get approval stats',
      });
    }
  });

  /**
   * POST /api/approvals/:featureId/submit
   *
   * Submit a feature for approval.
   * Body: { projectPath: string }
   */
  router.post('/:featureId/submit', async (req: Request, res: Response) => {
    try {
      const { featureId } = req.params;
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath is required' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const result = await approvalService.submitForApproval(
        projectPath,
        featureId,
        req.user.userId
      );

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Feature submitted for approval',
        feature: result.feature,
      });
    } catch (error) {
      logger.error('Error submitting for approval:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit for approval',
      });
    }
  });

  /**
   * POST /api/approvals/:featureId/approve
   *
   * Approve a feature (admin only).
   * Body: { projectPath: string, feedback?: string }
   */
  router.post(
    '/:featureId/approve',
    requirePermission('approve_tasks'),
    async (req: Request, res: Response) => {
      try {
        const { featureId } = req.params;
        const { projectPath, feedback } = req.body as {
          projectPath: string;
          feedback?: string;
        };

        if (!projectPath) {
          res.status(400).json({ success: false, error: 'projectPath is required' });
          return;
        }

        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required' });
          return;
        }

        const result = await approvalService.approveFeature(
          projectPath,
          featureId,
          req.user.userId,
          feedback
        );

        if (!result.success) {
          res.status(400).json({ success: false, error: result.error });
          return;
        }

        res.json({
          success: true,
          message: 'Feature approved',
          feature: result.feature,
        });
      } catch (error) {
        logger.error('Error approving feature:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to approve feature',
        });
      }
    }
  );

  /**
   * POST /api/approvals/:featureId/reject
   *
   * Reject a feature (admin only).
   * Body: { projectPath: string, reason: string }
   */
  router.post(
    '/:featureId/reject',
    requirePermission('reject_tasks'),
    async (req: Request, res: Response) => {
      try {
        const { featureId } = req.params;
        const { projectPath, reason } = req.body as {
          projectPath: string;
          reason: string;
        };

        if (!projectPath) {
          res.status(400).json({ success: false, error: 'projectPath is required' });
          return;
        }

        if (!reason || reason.trim().length === 0) {
          res.status(400).json({ success: false, error: 'Rejection reason is required' });
          return;
        }

        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required' });
          return;
        }

        const result = await approvalService.rejectFeature(
          projectPath,
          featureId,
          req.user.userId,
          reason
        );

        if (!result.success) {
          res.status(400).json({ success: false, error: result.error });
          return;
        }

        res.json({
          success: true,
          message: 'Feature rejected',
          feature: result.feature,
        });
      } catch (error) {
        logger.error('Error rejecting feature:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to reject feature',
        });
      }
    }
  );

  /**
   * POST /api/approvals/:featureId/assign
   *
   * Assign a feature to a user (admin only).
   * Body: { projectPath: string, assigneeUserId: string }
   */
  router.post(
    '/:featureId/assign',
    requirePermission('assign_tasks'),
    async (req: Request, res: Response) => {
      try {
        const { featureId } = req.params;
        const { projectPath, assigneeUserId } = req.body as {
          projectPath: string;
          assigneeUserId: string;
        };

        if (!projectPath) {
          res.status(400).json({ success: false, error: 'projectPath is required' });
          return;
        }

        if (!assigneeUserId) {
          res.status(400).json({ success: false, error: 'assigneeUserId is required' });
          return;
        }

        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required' });
          return;
        }

        const result = await approvalService.assignFeature(
          projectPath,
          featureId,
          assigneeUserId,
          req.user.userId
        );

        if (!result.success) {
          res.status(400).json({ success: false, error: result.error });
          return;
        }

        res.json({
          success: true,
          message: 'Feature assigned',
          feature: result.feature,
        });
      } catch (error) {
        logger.error('Error assigning feature:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to assign feature',
        });
      }
    }
  );

  /**
   * POST /api/approvals/:featureId/unassign
   *
   * Unassign a feature.
   * Body: { projectPath: string }
   *
   * Admin can unassign any feature. Users can only unassign their own assigned features.
   */
  router.post('/:featureId/unassign', async (req: Request, res: Response) => {
    try {
      const { featureId } = req.params;
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath is required' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const result = await approvalService.unassignFeature(projectPath, featureId, req.user.userId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Feature unassigned',
        feature: result.feature,
      });
    } catch (error) {
      logger.error('Error unassigning feature:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unassign feature',
      });
    }
  });

  /**
   * PUT /api/approvals/:featureId/classification
   *
   * Update task classification (type, priority, service area).
   * Body: { projectPath: string, taskType?: string, taskPriority?: string, serviceArea?: string }
   */
  router.put('/:featureId/classification', async (req: Request, res: Response) => {
    try {
      const { featureId } = req.params;
      const { projectPath, taskType, taskPriority, serviceArea } = req.body as {
        projectPath: string;
        taskType?: TaskType;
        taskPriority?: TaskPriority;
        serviceArea?: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath is required' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Validate taskType if provided
      const validTypes: TaskType[] = ['feature', 'bug', 'enhancement', 'issue'];
      if (taskType && !validTypes.includes(taskType)) {
        res.status(400).json({
          success: false,
          error: `Invalid taskType. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      // Validate taskPriority if provided
      const validPriorities: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
      if (taskPriority && !validPriorities.includes(taskPriority)) {
        res.status(400).json({
          success: false,
          error: `Invalid taskPriority. Must be one of: ${validPriorities.join(', ')}`,
        });
        return;
      }

      const result = await approvalService.updateClassification(
        projectPath,
        featureId,
        req.user.userId,
        { taskType, taskPriority, serviceArea }
      );

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Classification updated',
        feature: result.feature,
      });
    } catch (error) {
      logger.error('Error updating classification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update classification',
      });
    }
  });

  /**
   * POST /api/approvals/batch/approve
   *
   * Batch approve multiple features (admin only).
   * Body: { projectPath: string, featureIds: string[], feedback?: string }
   */
  router.post(
    '/batch/approve',
    requirePermission('approve_tasks'),
    async (req: Request, res: Response) => {
      try {
        const { projectPath, featureIds, feedback } = req.body as {
          projectPath: string;
          featureIds: string[];
          feedback?: string;
        };

        if (!projectPath) {
          res.status(400).json({ success: false, error: 'projectPath is required' });
          return;
        }

        if (!featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
          res.status(400).json({ success: false, error: 'featureIds array is required' });
          return;
        }

        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required' });
          return;
        }

        const results: Array<{ featureId: string; success: boolean; error?: string }> = [];

        for (const featureId of featureIds) {
          const result = await approvalService.approveFeature(
            projectPath,
            featureId,
            req.user.userId,
            feedback
          );
          results.push({
            featureId,
            success: result.success,
            error: result.error,
          });
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        res.json({
          success: failCount === 0,
          message: `Approved ${successCount} features, ${failCount} failed`,
          results,
        });
      } catch (error) {
        logger.error('Error batch approving features:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to batch approve features',
        });
      }
    }
  );

  /**
   * POST /api/approvals/batch/reject
   *
   * Batch reject multiple features (admin only).
   * Body: { projectPath: string, featureIds: string[], reason: string }
   */
  router.post(
    '/batch/reject',
    requirePermission('reject_tasks'),
    async (req: Request, res: Response) => {
      try {
        const { projectPath, featureIds, reason } = req.body as {
          projectPath: string;
          featureIds: string[];
          reason: string;
        };

        if (!projectPath) {
          res.status(400).json({ success: false, error: 'projectPath is required' });
          return;
        }

        if (!featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
          res.status(400).json({ success: false, error: 'featureIds array is required' });
          return;
        }

        if (!reason || reason.trim().length === 0) {
          res.status(400).json({ success: false, error: 'Rejection reason is required' });
          return;
        }

        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required' });
          return;
        }

        const results: Array<{ featureId: string; success: boolean; error?: string }> = [];

        for (const featureId of featureIds) {
          const result = await approvalService.rejectFeature(
            projectPath,
            featureId,
            req.user.userId,
            reason
          );
          results.push({
            featureId,
            success: result.success,
            error: result.error,
          });
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        res.json({
          success: failCount === 0,
          message: `Rejected ${successCount} features, ${failCount} failed`,
          results,
        });
      } catch (error) {
        logger.error('Error batch rejecting features:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to batch reject features',
        });
      }
    }
  );

  return router;
}
