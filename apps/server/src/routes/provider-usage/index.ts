/**
 * Provider Usage Routes
 *
 * API endpoints for fetching usage data from all AI providers.
 *
 * Endpoints:
 * - GET /api/provider-usage - Get usage for all enabled providers
 * - GET /api/provider-usage/:providerId - Get usage for a specific provider
 * - GET /api/provider-usage/availability - Check availability of all providers
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { UsageProviderId } from '@automaker/types';
import { ProviderUsageTracker } from '../../services/provider-usage-tracker.js';

const logger = createLogger('ProviderUsageRoutes');

// Valid provider IDs
const VALID_PROVIDER_IDS: UsageProviderId[] = [
  'claude',
  'codex',
  'cursor',
  'gemini',
  'copilot',
  'opencode',
  'minimax',
  'glm',
];

export function createProviderUsageRoutes(tracker: ProviderUsageTracker): Router {
  const router = Router();

  /**
   * GET /api/provider-usage
   * Fetch usage for all enabled providers
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const usage = await tracker.fetchAllUsage(forceRefresh);
      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching all provider usage:', error);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/provider-usage/availability
   * Check which providers are available
   */
  router.get('/availability', async (_req: Request, res: Response) => {
    try {
      const availability = await tracker.checkAvailability();
      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking provider availability:', error);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/provider-usage/:providerId
   * Fetch usage for a specific provider
   */
  router.get('/:providerId', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.providerId as UsageProviderId;

      // Validate provider ID
      if (!VALID_PROVIDER_IDS.includes(providerId)) {
        res.status(400).json({
          success: false,
          error: `Invalid provider ID: ${providerId}. Valid providers: ${VALID_PROVIDER_IDS.join(', ')}`,
        });
        return;
      }

      // Check if provider is enabled
      if (!tracker.isProviderEnabled(providerId)) {
        res.status(200).json({
          success: true,
          data: {
            providerId,
            providerName: providerId,
            available: false,
            lastUpdated: new Date().toISOString(),
            error: 'Provider is disabled',
          },
        });
        return;
      }

      const forceRefresh = req.query.refresh === 'true';
      const usage = await tracker.fetchProviderUsage(providerId, forceRefresh);

      if (!usage) {
        res.status(200).json({
          success: true,
          data: {
            providerId,
            providerName: providerId,
            available: false,
            lastUpdated: new Date().toISOString(),
            error: 'Failed to fetch usage data',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching usage for ${req.params.providerId}:`, error);

      // Return 200 with error in data to avoid triggering logout
      res.status(200).json({
        success: false,
        error: message,
      });
    }
  });

  return router;
}
