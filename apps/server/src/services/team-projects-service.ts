/**
 * AECORD Team Projects Service
 *
 * Manages centralized project configuration for team members.
 * Admin configures allowed projects, non-admins can only access those.
 */

import path from 'path';
import { createLogger, atomicWriteJson, DEFAULT_BACKUP_COUNT } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';

const logger = createLogger('TeamProjectsService');

export interface TeamProject {
  id: string;
  name: string;
  path: string;
  description?: string;
  allowedRoles: string[]; // Empty array means all roles can access
  createdAt: string;
  createdBy: string;
}

export interface TeamProjectsConfig {
  version: number;
  projects: TeamProject[];
  settings: {
    allowNonAdminBrowse: boolean; // If false, non-admins can't browse filesystem
    allowNonAdminAccess: boolean; // If false, non-admins can't access the server at all
    defaultProjectId?: string; // Default project for new users
  };
}

const DEFAULT_CONFIG: TeamProjectsConfig = {
  version: 1,
  projects: [],
  settings: {
    allowNonAdminBrowse: false,
    allowNonAdminAccess: true, // Default to allowing access
    defaultProjectId: undefined,
  },
};

export class TeamProjectsService {
  private dataDir: string;
  private configPath: string;
  private config: TeamProjectsConfig;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'team-projects.json');
    this.config = DEFAULT_CONFIG;
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (secureFs.existsSync(this.configPath)) {
        const data = secureFs.readFileSync(this.configPath, 'utf-8') as string;
        this.config = JSON.parse(data) as TeamProjectsConfig;
        logger.info(`Loaded ${this.config.projects.length} team projects`);
      } else {
        logger.info('No team projects config found, using defaults');
      }
    } catch (error) {
      logger.error('Error loading team projects config:', error);
      this.config = DEFAULT_CONFIG;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await secureFs.mkdir(this.dataDir, { recursive: true });
      await atomicWriteJson(this.configPath, this.config, { backupCount: DEFAULT_BACKUP_COUNT });
      logger.info('Saved team projects config');
    } catch (error) {
      logger.error('Error saving team projects config:', error);
      throw error;
    }
  }

  /**
   * Get all team projects (admin sees all, others see filtered by role)
   */
  getProjects(userRole?: string): TeamProject[] {
    if (userRole === 'admin') {
      return this.config.projects;
    }

    // Filter by allowed roles
    return this.config.projects.filter((project) => {
      if (project.allowedRoles.length === 0) {
        return true; // Empty means all roles
      }
      return userRole && project.allowedRoles.includes(userRole);
    });
  }

  /**
   * Get a specific project by ID
   */
  getProjectById(projectId: string): TeamProject | null {
    return this.config.projects.find((p) => p.id === projectId) || null;
  }

  /**
   * Get a project by path
   */
  getProjectByPath(projectPath: string): TeamProject | null {
    return this.config.projects.find((p) => p.path === projectPath) || null;
  }

  /**
   * Add a new team project (admin only)
   */
  async addProject(project: Omit<TeamProject, 'id' | 'createdAt'>): Promise<TeamProject> {
    // Check if path already exists
    if (this.config.projects.some((p) => p.path === project.path)) {
      throw new Error('A project with this path already exists');
    }

    const newProject: TeamProject = {
      ...project,
      id: `team-project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    this.config.projects.push(newProject);
    await this.saveConfig();

    logger.info(`Added team project: ${newProject.name} (${newProject.path})`);
    return newProject;
  }

  /**
   * Update a team project (admin only)
   */
  async updateProject(
    projectId: string,
    updates: Partial<Omit<TeamProject, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<TeamProject> {
    const index = this.config.projects.findIndex((p) => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    // Check for duplicate path if updating path
    if (updates.path && updates.path !== this.config.projects[index].path) {
      if (this.config.projects.some((p) => p.path === updates.path)) {
        throw new Error('A project with this path already exists');
      }
    }

    this.config.projects[index] = {
      ...this.config.projects[index],
      ...updates,
    };

    await this.saveConfig();
    logger.info(`Updated team project: ${this.config.projects[index].name}`);
    return this.config.projects[index];
  }

  /**
   * Remove a team project (admin only)
   */
  async removeProject(projectId: string): Promise<boolean> {
    const index = this.config.projects.findIndex((p) => p.id === projectId);
    if (index === -1) {
      return false;
    }

    const removed = this.config.projects.splice(index, 1)[0];
    await this.saveConfig();

    logger.info(`Removed team project: ${removed.name}`);
    return true;
  }

  /**
   * Get settings
   */
  getSettings(): TeamProjectsConfig['settings'] {
    return this.config.settings;
  }

  /**
   * Update settings (admin only)
   */
  async updateSettings(
    settings: Partial<TeamProjectsConfig['settings']>
  ): Promise<TeamProjectsConfig['settings']> {
    this.config.settings = {
      ...this.config.settings,
      ...settings,
    };
    await this.saveConfig();
    return this.config.settings;
  }

  /**
   * Check if user can browse filesystem
   */
  canBrowseFilesystem(userRole?: string): boolean {
    if (userRole === 'admin') {
      return true;
    }
    return this.config.settings.allowNonAdminBrowse;
  }

  /**
   * Check if non-admin users can access the server
   */
  isNonAdminAccessAllowed(): boolean {
    return this.config.settings.allowNonAdminAccess !== false; // Default to true for backwards compatibility
  }

  /**
   * Check if user can access the server
   */
  canAccessServer(userRole?: string): boolean {
    if (userRole === 'admin') {
      return true;
    }
    return this.isNonAdminAccessAllowed();
  }

  /**
   * Check if user can access a specific path
   */
  canAccessPath(projectPath: string, userRole?: string): boolean {
    if (userRole === 'admin') {
      return true;
    }

    // Check if path is in allowed projects
    const project = this.getProjectByPath(projectPath);
    if (!project) {
      return this.config.settings.allowNonAdminBrowse;
    }

    // Check role access
    if (project.allowedRoles.length === 0) {
      return true;
    }
    return userRole ? project.allowedRoles.includes(userRole) : false;
  }
}

// Singleton instance
let teamProjectsService: TeamProjectsService | null = null;

export function getTeamProjectsService(dataDir?: string): TeamProjectsService {
  if (!teamProjectsService && dataDir) {
    teamProjectsService = new TeamProjectsService(dataDir);
  }
  if (!teamProjectsService) {
    throw new Error('TeamProjectsService not initialized');
  }
  return teamProjectsService;
}
