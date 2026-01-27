/**
 * POST /delete endpoint - Delete a feature
 */

import type { Request, Response } from 'express';
import { FeatureLoader } from '../../../services/feature-loader.js';
import type { EventEmitter } from '../../../lib/events.js';
import { getErrorMessage, logError } from '../common.js';

export function createDeleteHandler(featureLoader: FeatureLoader, events?: EventEmitter) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res.status(400).json({
          success: false,
          error: 'projectPath and featureId are required',
        });
        return;
      }

      const success = await featureLoader.delete(projectPath, featureId);

      // Emit feature_deleted event for real-time sync
      if (success && events) {
        events.emit('feature:deleted', { featureId, projectPath });
      }

      res.json({ success });
    } catch (error) {
      logError(error, 'Delete feature failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
