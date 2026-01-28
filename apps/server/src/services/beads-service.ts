/**
 * Beads CLI Bridge Service
 *
 * Thin wrapper that shells out to `bd` commands to mirror automaker
 * feature lifecycle events into the beads git-backed task tracker.
 * Degrades gracefully if `bd` is not installed.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '@automaker/utils';

const execFileAsync = promisify(execFile);
const logger = createLogger('BeadsService');

/**
 * Find the directory containing .beads/ by walking up from cwd
 */
function findBeadsRoot(): string | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (existsSync(path.join(dir, '.beads'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export interface BeadIssue {
  id: string;
  title: string;
  status: string;
  priority: number;
  labels: string[];
  created: string;
  closed?: string;
  comments?: BeadComment[];
  [key: string]: unknown;
}

export interface BeadComment {
  id: string;
  body: string;
  created: string;
}

export interface BeadsStatus {
  available: boolean;
  version?: string;
  beadsDir?: boolean;
}

class BeadsService {
  private available: boolean | null = null;
  private repoRoot: string | null = null;

  /**
   * Get the beads root directory (cached)
   */
  private getBeadsRoot(): string | null {
    if (this.repoRoot === null) {
      this.repoRoot = findBeadsRoot() || '';
    }
    return this.repoRoot || null;
  }

  /**
   * Execute a bd CLI command with JSON output, from repo root
   */
  private async exec(args: string[]): Promise<unknown> {
    if (!(await this.isAvailable())) {
      return null;
    }

    const cwd = this.getBeadsRoot();
    try {
      const { stdout } = await execFileAsync('bd', args, {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        ...(cwd ? { cwd } : {}),
      });
      try {
        return JSON.parse(stdout);
      } catch {
        // Some commands may not return JSON
        return stdout.trim();
      }
    } catch (error: any) {
      logger.warn(`bd command failed: bd ${args.join(' ')}`, error.message);
      return null;
    }
  }

  /**
   * Check if bd CLI is installed and .beads/ directory exists in repo root
   */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    try {
      const { stdout } = await execFileAsync('bd', ['version'], { timeout: 5000 });
      const root = this.getBeadsRoot();
      this.available = !!stdout && !!root;

      if (!this.available) {
        logger.info(`Beads not available: bd=${!!stdout}, beadsRoot=${root}`);
      }
    } catch {
      this.available = false;
      logger.info('Beads CLI (bd) not found — beads integration disabled');
    }

    return this.available;
  }

  /**
   * Get status info about beads availability
   */
  async getStatus(): Promise<BeadsStatus> {
    try {
      const { stdout } = await execFileAsync('bd', ['version'], { timeout: 5000 });
      const root = this.getBeadsRoot();
      return {
        available: !!stdout && !!root,
        version: stdout.trim(),
        beadsDir: !!root,
      };
    } catch {
      return { available: false };
    }
  }

  /**
   * Create a new beads issue
   */
  async createIssue(
    title: string,
    priority?: number,
    labels?: string[]
  ): Promise<BeadIssue | null> {
    const args = ['create', title, '--json'];
    if (priority !== undefined) {
      args.push('-p', String(priority));
    }
    if (labels?.length) {
      for (const label of labels) {
        args.push('--label', label);
      }
    }

    const result = await this.exec(args);
    return result as BeadIssue | null;
  }

  /**
   * Close a beads issue
   */
  async closeIssue(beadId: string): Promise<unknown> {
    return this.exec(['close', beadId, '--json']);
  }

  /**
   * Add a comment to a beads issue
   */
  async updateProgress(beadId: string, comment: string): Promise<unknown> {
    return this.exec(['comments', 'add', beadId, comment, '--json']);
  }

  /**
   * List ready issues
   */
  async listReady(): Promise<BeadIssue[]> {
    const result = await this.exec(['ready', '--json']);
    if (Array.isArray(result)) return result;
    return [];
  }

  /**
   * List all issues
   */
  async listAll(): Promise<BeadIssue[]> {
    const result = await this.exec(['list', '--json']);
    if (Array.isArray(result)) return result;
    return [];
  }

  /**
   * Show a specific issue
   */
  async showIssue(beadId: string): Promise<BeadIssue | null> {
    const result = await this.exec(['show', beadId, '--json']);
    return result as BeadIssue | null;
  }

  /**
   * Sync beads (git commit .beads changes)
   */
  async sync(): Promise<unknown> {
    return this.exec(['sync']);
  }

  /**
   * Reset availability cache (useful after installing bd)
   */
  resetCache(): void {
    this.available = null;
  }
}

// Singleton
let beadsService: BeadsService | null = null;

export function getBeadsService(): BeadsService {
  if (!beadsService) {
    beadsService = new BeadsService();
  }
  return beadsService;
}
