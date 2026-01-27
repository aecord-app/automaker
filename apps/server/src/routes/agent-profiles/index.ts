/**
 * AECORD Agent Profiles API Routes
 *
 * Endpoints for managing agent profiles (specialized AI configurations).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AgentSpecialist, TaskType } from '@automaker/types';
import { createLogger } from '@automaker/utils';
import { AgentProfileService } from '../../services/agent-profile-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';
import { requireAdmin, requireDeveloper } from '../../middleware/require-role.js';

const logger = createLogger('AgentProfileRoutes');

export function createAgentProfileRoutes(
  agentProfileService: AgentProfileService,
  jwtService: JWTService
): Router {
  const router = Router();

  // All routes require JWT authentication
  const requireJWT = createRequireJWTMiddleware(jwtService);
  router.use(requireJWT);

  /**
   * GET /api/agent-profiles
   * Get all agent profiles (developers can view, admins can manage)
   */
  router.get('/', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { active, specialist, taskType } = req.query;

      let profiles = agentProfileService.getAll();

      // Filter by active status
      if (active === 'true') {
        profiles = profiles.filter((p) => p.isActive);
      } else if (active === 'false') {
        profiles = profiles.filter((p) => !p.isActive);
      }

      // Filter by specialist type
      if (specialist && typeof specialist === 'string') {
        profiles = profiles.filter((p) => p.specialist === specialist);
      }

      // Filter by task type
      if (taskType && typeof taskType === 'string') {
        profiles = profiles.filter((p) => p.applicableTaskTypes.includes(taskType as TaskType));
      }

      res.json({ profiles });
    } catch (error) {
      logger.error('Failed to get agent profiles:', error);
      res.status(500).json({ error: 'Failed to get agent profiles' });
    }
  });

  /**
   * GET /api/agent-profiles/stats
   * Get profile statistics
   */
  router.get('/stats', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const stats = agentProfileService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get profile stats:', error);
      res.status(500).json({ error: 'Failed to get profile statistics' });
    }
  });

  /**
   * GET /api/agent-profiles/recommend
   * Get recommended profile for a task type and service area
   */
  router.get('/recommend', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { taskType, serviceArea } = req.query;

      if (!taskType || typeof taskType !== 'string') {
        return res.status(400).json({ error: 'taskType query parameter is required' });
      }

      const profile = agentProfileService.getRecommended(
        taskType as TaskType,
        serviceArea as string | undefined
      );

      if (!profile) {
        return res.status(404).json({ error: 'No suitable profile found' });
      }

      res.json({ profile });
    } catch (error) {
      logger.error('Failed to get recommended profile:', error);
      res.status(500).json({ error: 'Failed to get recommended profile' });
    }
  });

  /**
   * GET /api/agent-profiles/:id
   * Get a specific profile by ID
   */
  router.get('/:id', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const profile = agentProfileService.getById(id);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json({ profile });
    } catch (error) {
      logger.error('Failed to get profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  /**
   * GET /api/agent-profiles/:id/prompt
   * Get the built system prompt for a profile
   */
  router.get('/:id/prompt', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const prompt = agentProfileService.buildPrompt(id);

      if (!prompt) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json({ prompt });
    } catch (error) {
      logger.error('Failed to build prompt:', error);
      res.status(500).json({ error: 'Failed to build prompt' });
    }
  });

  /**
   * POST /api/agent-profiles
   * Create a new profile (admin only)
   */
  router.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        name,
        specialist,
        description,
        model,
        thinkingLevel,
        reasoningEffort,
        planningMode,
        requirePlanApproval,
        autoVerify,
        maxRetries,
        timeoutMinutes,
        systemPromptTemplate,
        contextInstructions,
        applicableTaskTypes,
        serviceAreas,
      } = req.body;

      // Validate required fields
      if (!name || !specialist || !model || !planningMode || !systemPromptTemplate) {
        return res.status(400).json({
          error:
            'Missing required fields: name, specialist, model, planningMode, systemPromptTemplate',
        });
      }

      const profile = await agentProfileService.create({
        name,
        specialist: specialist as AgentSpecialist,
        description: description || '',
        model,
        thinkingLevel,
        reasoningEffort,
        planningMode,
        requirePlanApproval: requirePlanApproval ?? true,
        autoVerify: autoVerify ?? false,
        maxRetries: maxRetries ?? 3,
        timeoutMinutes: timeoutMinutes ?? 30,
        systemPromptTemplate,
        contextInstructions,
        applicableTaskTypes: applicableTaskTypes || [],
        serviceAreas: serviceAreas || [],
        isDefault: false,
        isActive: true,
      });

      logger.info(`Admin ${req.user?.username} created profile: ${profile.name}`);
      res.status(201).json({ profile });
    } catch (error) {
      logger.error('Failed to create profile:', error);
      res.status(500).json({ error: 'Failed to create profile' });
    }
  });

  /**
   * PUT /api/agent-profiles/:id
   * Update a profile (admin only)
   */
  router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated
      delete updates.id;
      delete updates.createdAt;
      delete updates.isDefault; // Can't change default status

      const profile = await agentProfileService.update(id, updates);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      logger.info(`Admin ${req.user?.username} updated profile: ${profile.name}`);
      res.json({ profile });
    } catch (error) {
      logger.error('Failed to update profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * POST /api/agent-profiles/:id/clone
   * Clone a profile (admin only)
   */
  router.post('/:id/clone', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const profile = await agentProfileService.clone(id, name);

      if (!profile) {
        return res.status(404).json({ error: 'Source profile not found' });
      }

      logger.info(`Admin ${req.user?.username} cloned profile as: ${profile.name}`);
      res.status(201).json({ profile });
    } catch (error) {
      logger.error('Failed to clone profile:', error);
      res.status(500).json({ error: 'Failed to clone profile' });
    }
  });

  /**
   * POST /api/agent-profiles/:id/activate
   * Activate a profile (admin only)
   */
  router.post('/:id/activate', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const profile = await agentProfileService.activate(id);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      logger.info(`Admin ${req.user?.username} activated profile: ${profile.name}`);
      res.json({ profile });
    } catch (error) {
      logger.error('Failed to activate profile:', error);
      res.status(500).json({ error: 'Failed to activate profile' });
    }
  });

  /**
   * POST /api/agent-profiles/:id/deactivate
   * Deactivate a profile (admin only)
   */
  router.post('/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const profile = await agentProfileService.deactivate(id);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      logger.info(`Admin ${req.user?.username} deactivated profile: ${profile.name}`);
      res.json({ profile });
    } catch (error) {
      logger.error('Failed to deactivate profile:', error);
      res.status(500).json({ error: 'Failed to deactivate profile' });
    }
  });

  /**
   * DELETE /api/agent-profiles/:id
   * Delete a profile (admin only, soft delete by default)
   */
  router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { hard } = req.query;

      const success = await agentProfileService.delete(id, hard === 'true');

      if (!success) {
        return res.status(404).json({ error: 'Profile not found or cannot be deleted' });
      }

      logger.info(`Admin ${req.user?.username} deleted profile: ${id}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete profile:', error);
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  });

  /**
   * POST /api/agent-profiles/reset
   * Reset all profiles to defaults (admin only)
   */
  router.post('/reset', requireAdmin, async (req: Request, res: Response) => {
    try {
      await agentProfileService.resetToDefaults();
      const profiles = agentProfileService.getAll();

      logger.info(`Admin ${req.user?.username} reset profiles to defaults`);
      res.json({ profiles });
    } catch (error) {
      logger.error('Failed to reset profiles:', error);
      res.status(500).json({ error: 'Failed to reset profiles' });
    }
  });

  return router;
}
