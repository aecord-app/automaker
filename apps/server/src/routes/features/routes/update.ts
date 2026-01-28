/**
 * POST /update endpoint - Update a feature
 */

import type { Request, Response } from 'express';
import { FeatureLoader } from '../../../services/feature-loader.js';
import type { EventEmitter } from '../../../lib/events.js';
import type { Feature, FeatureStatus } from '@automaker/types';
import { getErrorMessage, logError } from '../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('features/update');

// Statuses that should trigger syncing to app_spec.txt
const SYNC_TRIGGER_STATUSES: FeatureStatus[] = ['verified', 'completed'];

export function createUpdateHandler(featureLoader: FeatureLoader, events?: EventEmitter) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        projectPath,
        featureId,
        updates,
        descriptionHistorySource,
        enhancementMode,
        preEnhancementDescription,
        expectedVersion,
      } = req.body as {
        projectPath: string;
        featureId: string;
        updates: Partial<Feature>;
        descriptionHistorySource?: 'enhance' | 'edit';
        enhancementMode?: 'improve' | 'technical' | 'simplify' | 'acceptance' | 'ux-reviewer';
        preEnhancementDescription?: string;
        expectedVersion?: number;
      };

      if (!projectPath || !featureId || !updates) {
        res.status(400).json({
          success: false,
          error: 'projectPath, featureId, and updates are required',
        });
        return;
      }

      // Check for duplicate title if title is being updated
      if (updates.title && updates.title.trim()) {
        const duplicate = await featureLoader.findDuplicateTitle(
          projectPath,
          updates.title,
          featureId // Exclude the current feature from duplicate check
        );
        if (duplicate) {
          res.status(409).json({
            success: false,
            error: `A feature with title "${updates.title}" already exists`,
            duplicateFeatureId: duplicate.id,
          });
          return;
        }
      }

      // Get the current feature to detect status changes
      const currentFeature = await featureLoader.get(projectPath, featureId);
      const previousStatus = currentFeature?.status as FeatureStatus | undefined;
      const newStatus = updates.status as FeatureStatus | undefined;

      let updated: Feature;
      try {
        updated = await featureLoader.update(
          projectPath,
          featureId,
          updates,
          descriptionHistorySource,
          enhancementMode,
          preEnhancementDescription,
          expectedVersion
        );
      } catch (updateError: unknown) {
        // Handle version conflict error
        if (
          updateError &&
          typeof updateError === 'object' &&
          'code' in updateError &&
          (updateError as { code: string }).code === 'VERSION_CONFLICT'
        ) {
          const conflictError = updateError as {
            code: string;
            currentFeature: Feature;
            message: string;
          };
          res.status(409).json({
            success: false,
            error: conflictError.message,
            code: 'VERSION_CONFLICT',
            currentFeature: conflictError.currentFeature,
          });
          return;
        }
        throw updateError;
      }

      // Trigger sync to app_spec.txt when status changes to verified or completed
      if (newStatus && SYNC_TRIGGER_STATUSES.includes(newStatus) && previousStatus !== newStatus) {
        try {
          const synced = await featureLoader.syncFeatureToAppSpec(projectPath, updated);
          if (synced) {
            logger.info(
              `Synced feature "${updated.title || updated.id}" to app_spec.txt on status change to ${newStatus}`
            );
          }
        } catch (syncError) {
          // Log the sync error but don't fail the update operation
          logger.error(`Failed to sync feature to app_spec.txt:`, syncError);
        }
      }

      // Emit feature_updated event for real-time sync
      // Include full feature data so clients can update cache directly without refetching
      if (events) {
        events.emit('feature:updated', {
          featureId: updated.id,
          featureName: updated.title || updated.name,
          projectPath,
          feature: updated,
        });
      }

      res.json({ success: true, feature: updated });
    } catch (error) {
      logError(error, 'Update feature failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
