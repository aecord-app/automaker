/**
 * AECORD Team Projects Routes
 *
 * API endpoints for managing centralized project configuration.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import { getTeamProjectsService } from '../../services/team-projects-service.js';
import { requireAdmin, requireDeveloper } from '../../middleware/require-role.js';
import type { JWTService } from '../../services/jwt-service.js';

const logger = createLogger('TeamProjectsRoutes');

export function createTeamProjectsRoutes(dataDir: string, _jwtService: JWTService): Router {
  const router = Router();
  const teamProjectsService = getTeamProjectsService(dataDir);

  /**
   * GET /api/team-projects
   * Get team projects (filtered by role for non-admins)
   */
  router.get('/', requireDeveloper, (req: Request, res: Response) => {
    try {
      const projects = teamProjectsService.getProjects(req.user?.role);
      const settings = teamProjectsService.getSettings();
      const canBrowse = teamProjectsService.canBrowseFilesystem(req.user?.role);

      res.json({
        success: true,
        projects,
        settings: {
          canBrowseFilesystem: canBrowse,
          allowNonAdminAccess: settings.allowNonAdminAccess !== false, // Default to true
          defaultProjectId: settings.defaultProjectId,
        },
      });
    } catch (error) {
      logger.error('Error getting team projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get team projects',
      });
    }
  });

  /**
   * GET /api/team-projects/settings
   * Get team projects settings (admin only)
   */
  router.get('/settings', requireAdmin, (req: Request, res: Response) => {
    try {
      const settings = teamProjectsService.getSettings();
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Error getting team projects settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settings',
      });
    }
  });

  /**
   * PUT /api/team-projects/settings
   * Update team projects settings (admin only)
   */
  router.put('/settings', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowNonAdminBrowse, allowNonAdminAccess, defaultProjectId } = req.body;

      const settings = await teamProjectsService.updateSettings({
        allowNonAdminBrowse,
        allowNonAdminAccess,
        defaultProjectId,
      });

      logger.info(`Team projects settings updated by ${req.user?.username}`);

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Error updating team projects settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settings',
      });
    }
  });

  /**
   * POST /api/team-projects
   * Add a new team project (admin only)
   */
  router.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, path, description, allowedRoles } = req.body;

      if (!name || !path) {
        return res.status(400).json({
          success: false,
          error: 'Name and path are required',
        });
      }

      const project = await teamProjectsService.addProject({
        name,
        path,
        description: description || '',
        allowedRoles: allowedRoles || [],
        createdBy: req.user?.username || 'unknown',
      });

      logger.info(`Team project added by ${req.user?.username}: ${name}`);

      res.json({
        success: true,
        project,
      });
    } catch (error) {
      logger.error('Error adding team project:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project',
      });
    }
  });

  /**
   * PUT /api/team-projects/:id
   * Update a team project (admin only)
   */
  router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, path, description, allowedRoles } = req.body;

      const project = await teamProjectsService.updateProject(id, {
        name,
        path,
        description,
        allowedRoles,
      });

      logger.info(`Team project updated by ${req.user?.username}: ${project.name}`);

      res.json({
        success: true,
        project,
      });
    } catch (error) {
      logger.error('Error updating team project:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project',
      });
    }
  });

  /**
   * DELETE /api/team-projects/:id
   * Remove a team project (admin only)
   */
  router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const removed = await teamProjectsService.removeProject(id);

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      logger.info(`Team project removed by ${req.user?.username}: ${id}`);

      res.json({
        success: true,
      });
    } catch (error) {
      logger.error('Error removing team project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove project',
      });
    }
  });

  /**
   * POST /api/team-projects/check-access
   * Check if user can access a specific path
   */
  router.post('/check-access', requireDeveloper, (req: Request, res: Response) => {
    try {
      const { path } = req.body;

      if (!path) {
        return res.status(400).json({
          success: false,
          error: 'Path is required',
        });
      }

      const canAccess = teamProjectsService.canAccessPath(path, req.user?.role);
      const canBrowse = teamProjectsService.canBrowseFilesystem(req.user?.role);

      res.json({
        success: true,
        canAccess,
        canBrowseFilesystem: canBrowse,
      });
    } catch (error) {
      logger.error('Error checking access:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check access',
      });
    }
  });

  return router;
}
