/**
 * AECORD Conflict Detection Routes
 *
 * API endpoints for file locking and conflict detection.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { LockType } from '@automaker/types';
import type { ConflictService } from '../../services/conflict-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';
import { requireAdmin, requireDeveloper } from '../../middleware/require-role.js';
import { validatePathParams } from '../../middleware/validate-paths.js';

const logger = createLogger('ConflictsRoutes');

export function createConflictsRoutes(
  conflictService: ConflictService,
  jwtService: JWTService
): Router {
  const router = Router();

  // All routes require JWT authentication
  const requireJWT = createRequireJWTMiddleware(jwtService);
  router.use(requireJWT);

  /**
   * POST /api/conflicts/check
   * Check for file conflicts before starting a task
   *
   * Body: { projectPath, featureId, files: string[] }
   */
  router.post('/check', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, files } = req.body;

      if (!projectPath || !featureId || !Array.isArray(files)) {
        return res.status(400).json({
          error: 'projectPath, featureId, and files array are required',
        });
      }

      const result = await conflictService.checkConflicts(projectPath, featureId, files);

      res.json(result);
    } catch (error) {
      logger.error('Failed to check conflicts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check conflicts',
      });
    }
  });

  /**
   * POST /api/conflicts/acquire
   * Acquire locks for files
   *
   * Body: { projectPath, featureId, files: string[], lockType?, durationMinutes? }
   */
  router.post('/acquire', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, files, lockType, durationMinutes } = req.body;

      if (!projectPath || !featureId || !Array.isArray(files)) {
        return res.status(400).json({
          error: 'projectPath, featureId, and files array are required',
        });
      }

      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const result = await conflictService.acquireLocks(
        projectPath,
        featureId,
        userId,
        files,
        (lockType as LockType) || 'exclusive',
        durationMinutes
      );

      if (!result.success) {
        return res.status(409).json({
          error: 'Could not acquire all locks',
          ...result,
        });
      }

      logger.info(`User ${req.user?.username} acquired ${result.acquiredLocks.length} locks`);
      res.json(result);
    } catch (error) {
      logger.error('Failed to acquire locks:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to acquire locks',
      });
    }
  });

  /**
   * POST /api/conflicts/release/:featureId
   * Release all locks for a feature
   */
  router.post('/release/:featureId', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { featureId } = req.params;

      // Check ownership - get locks and verify user owns them
      const locks = conflictService.getLocksForFeature(featureId);
      if (locks.length > 0 && req.user?.role !== 'admin') {
        const userOwnsAllLocks = locks.every((lock) => lock.lockedBy === req.user?.userId);
        if (!userOwnsAllLocks) {
          return res.status(403).json({
            error: 'You can only release your own locks',
          });
        }
      }

      const count = await conflictService.releaseLocks(featureId);

      logger.info(`User ${req.user?.username} released ${count} locks for feature ${featureId}`);
      res.json({ success: true, releasedCount: count });
    } catch (error) {
      logger.error('Failed to release locks:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to release locks',
      });
    }
  });

  /**
   * POST /api/conflicts/release-lock/:lockId
   * Release a specific lock
   */
  router.post('/release-lock/:lockId', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { lockId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const released = await conflictService.releaseLock(lockId, userId);

      if (!released) {
        return res.status(404).json({ error: 'Lock not found' });
      }

      logger.info(`User ${req.user?.username} released lock ${lockId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to release lock:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to release lock',
      });
    }
  });

  /**
   * POST /api/conflicts/extend/:lockId
   * Extend a lock's expiration
   *
   * Body: { additionalMinutes: number }
   */
  router.post('/extend/:lockId', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { lockId } = req.params;
      const { additionalMinutes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (typeof additionalMinutes !== 'number' || additionalMinutes <= 0) {
        return res.status(400).json({
          error: 'additionalMinutes must be a positive number',
        });
      }

      const lock = await conflictService.extendLock(lockId, userId, additionalMinutes);

      if (!lock) {
        return res.status(404).json({ error: 'Lock not found' });
      }

      logger.info(`User ${req.user?.username} extended lock ${lockId}`);
      res.json({ lock });
    } catch (error) {
      logger.error('Failed to extend lock:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to extend lock',
      });
    }
  });

  /**
   * GET /api/conflicts/locks
   * Get all active locks (filtered by query params)
   *
   * Query: projectPath?, featureId?
   */
  router.get('/locks', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.query;

      let locks;
      if (featureId && typeof featureId === 'string') {
        locks = conflictService.getLocksForFeature(featureId);
      } else if (projectPath && typeof projectPath === 'string') {
        locks = conflictService.getLocksForProject(projectPath);
      } else {
        // Admin can see all locks, others see only their own
        if (req.user?.role === 'admin') {
          locks = conflictService.getAllLocks();
        } else {
          locks = conflictService
            .getAllLocks()
            .filter((lock) => lock.lockedBy === req.user?.userId);
        }
      }

      res.json({ locks });
    } catch (error) {
      logger.error('Failed to get locks:', error);
      res.status(500).json({ error: 'Failed to get locks' });
    }
  });

  /**
   * GET /api/conflicts/stats
   * Get lock statistics (admin only)
   */
  router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = conflictService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get lock stats:', error);
      res.status(500).json({ error: 'Failed to get lock statistics' });
    }
  });

  /**
   * POST /api/conflicts/force-release/:lockId
   * Force release a lock (admin only)
   */
  router.post('/force-release/:lockId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { lockId } = req.params;

      const released = await conflictService.forceReleaseLock(lockId);

      if (!released) {
        return res.status(404).json({ error: 'Lock not found' });
      }

      logger.info(`Admin ${req.user?.username} force released lock ${lockId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to force release lock:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to force release lock',
      });
    }
  });

  return router;
}
