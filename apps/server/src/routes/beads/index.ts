/**
 * Beads Tracker API Routes
 *
 * Exposes beads CLI functionality through HTTP endpoints.
 */

import { Router, type Request, type Response } from 'express';
import { requireDeveloper } from '../../middleware/require-role.js';
import { getBeadsService } from '../../services/beads-service.js';

export function createBeadsRoutes(): Router {
  const router = Router();
  const beadsService = getBeadsService();

  // GET /api/beads/status — Check if bd is available
  router.get('/status', requireDeveloper, async (_req: Request, res: Response) => {
    try {
      const status = await beadsService.getStatus();
      res.json({ success: true, ...status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/beads/ready — List ready issues
  router.get('/ready', requireDeveloper, async (_req: Request, res: Response) => {
    try {
      const issues = await beadsService.listReady();
      res.json({ success: true, issues });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/beads/list — List all issues
  router.get('/list', requireDeveloper, async (_req: Request, res: Response) => {
    try {
      const issues = await beadsService.listAll();
      res.json({ success: true, issues });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/beads/:id — Show issue details
  router.get('/:id', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const issue = await beadsService.showIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ success: false, error: 'Issue not found' });
      }
      res.json({ success: true, issue });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/beads/create — Create issue
  router.post('/create', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const { title, priority, labels } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, error: 'Title is required' });
      }
      const issue = await beadsService.createIssue(title, priority, labels);
      res.json({ success: true, issue });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/beads/:id/close — Close issue
  router.post('/:id/close', requireDeveloper, async (req: Request, res: Response) => {
    try {
      const result = await beadsService.closeIssue(req.params.id);
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/beads/sync — Run bd sync
  router.post('/sync', requireDeveloper, async (_req: Request, res: Response) => {
    try {
      const result = await beadsService.sync();
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
