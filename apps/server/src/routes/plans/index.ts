/**
 * AECORD Execution Plan Routes
 *
 * API endpoints for managing execution plans.
 * Plans must be approved by admin before task execution can begin.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { PlanService } from '../../services/plan-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';
import { requireAdmin, requireDeveloper } from '../../middleware/require-role.js';
import { validatePathParams } from '../../middleware/validate-paths.js';

const logger = createLogger('PlansRoutes');

export function createPlansRoutes(planService: PlanService, jwtService: JWTService): Router {
  const router = Router();

  // All routes require JWT authentication
  const requireJWT = createRequireJWTMiddleware(jwtService);
  router.use(requireJWT);

  /**
   * POST /api/plans/generate
   * Generate an execution plan for a feature
   *
   * Body: { projectPath, featureId }
   */
  router.post('/generate', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body;

      if (!projectPath || !featureId) {
        return res.status(400).json({
          error: 'projectPath and featureId are required',
        });
      }

      const createdBy = req.user?.userId || 'unknown';
      const plan = await planService.generatePlan(projectPath, featureId, createdBy);

      logger.info(`User ${req.user?.username} generated plan for feature ${featureId}`);
      res.status(201).json({ plan });
    } catch (error) {
      logger.error('Failed to generate plan:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate plan',
      });
    }
  });

  /**
   * GET /api/plans/pending
   * Get all plans pending approval (admin sees all, developers see own)
   */
  router.get('/pending', requireDeveloper, async (req: Request, res: Response) => {
    try {
      let plans = planService.getPendingPlans();

      // Non-admin users only see their own plans
      if (req.user?.role !== 'admin') {
        plans = plans.filter((p) => p.createdBy === req.user?.userId);
      }

      res.json({ plans });
    } catch (error) {
      logger.error('Failed to get pending plans:', error);
      res.status(500).json({ error: 'Failed to get pending plans' });
    }
  });

  /**
   * GET /api/plans/:planId
   * Get a specific plan by ID
   */
  router.get('/:planId', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const plan = planService.getPlan(planId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      // Non-admin users can only see their own plans
      if (req.user?.role !== 'admin' && plan.createdBy !== req.user?.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ plan });
    } catch (error) {
      logger.error('Failed to get plan:', error);
      res.status(500).json({ error: 'Failed to get plan' });
    }
  });

  /**
   * GET /api/plans/feature/:featureId
   * Get the plan for a specific feature
   *
   * Query: projectPath (required)
   */
  router.get(
    '/feature/:featureId',
    requireDeveloper,
    validatePathParams('projectPath'),
    async (req: Request, res: Response) => {
      try {
        const { featureId } = req.params;
        const { projectPath } = req.query as { projectPath: string };

        const plan = await planService.getPlanForFeature(projectPath, featureId);

        if (!plan) {
          return res.status(404).json({ error: 'Plan not found for feature' });
        }

        // Non-admin users can only see their own plans
        if (req.user?.role !== 'admin' && plan.createdBy !== req.user?.userId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ plan });
      } catch (error) {
        logger.error('Failed to get plan for feature:', error);
        res.status(500).json({ error: 'Failed to get plan for feature' });
      }
    }
  );

  /**
   * POST /api/plans/:planId/submit
   * Submit a plan for approval
   */
  router.post('/:planId/submit', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;

      // Verify ownership
      const existingPlan = planService.getPlan(planId);
      if (!existingPlan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      if (req.user?.role !== 'admin' && existingPlan.createdBy !== req.user?.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const plan = await planService.submitForApproval(planId);

      logger.info(`User ${req.user?.username} submitted plan ${planId} for approval`);
      res.json({ plan });
    } catch (error) {
      logger.error('Failed to submit plan:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to submit plan',
      });
    }
  });

  /**
   * POST /api/plans/:planId/approve
   * Approve a plan (admin only)
   *
   * Body: { editedPlan?: string } - Optional edited plan content
   */
  router.post('/:planId/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const { editedPlan } = req.body;

      const approvedBy = req.user?.userId || 'unknown';
      const plan = await planService.approvePlan(planId, approvedBy, editedPlan);

      logger.info(`Admin ${req.user?.username} approved plan ${planId}`);
      res.json({ plan });
    } catch (error) {
      logger.error('Failed to approve plan:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to approve plan',
      });
    }
  });

  /**
   * POST /api/plans/:planId/reject
   * Reject a plan (admin only)
   *
   * Body: { reason: string }
   */
  router.post('/:planId/reject', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const rejectedBy = req.user?.userId || 'unknown';
      const plan = await planService.rejectPlan(planId, rejectedBy, reason);

      logger.info(`Admin ${req.user?.username} rejected plan ${planId}: ${reason}`);
      res.json({ plan });
    } catch (error) {
      logger.error('Failed to reject plan:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reject plan',
      });
    }
  });

  /**
   * DELETE /api/plans/:planId
   * Delete a plan
   */
  router.delete('/:planId', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;

      // Verify ownership or admin
      const existingPlan = planService.getPlan(planId);
      if (!existingPlan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      if (req.user?.role !== 'admin' && existingPlan.createdBy !== req.user?.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Only draft plans can be deleted
      if (existingPlan.status !== 'draft' && req.user?.role !== 'admin') {
        return res.status(400).json({ error: 'Only draft plans can be deleted' });
      }

      const deleted = await planService.deletePlan(planId);

      if (!deleted) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      logger.info(`User ${req.user?.username} deleted plan ${planId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete plan:', error);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });

  return router;
}
