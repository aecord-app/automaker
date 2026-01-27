/**
 * AECORD Role-Based Feature Permissions
 *
 * Defines which features each role can access.
 * Admins can customize these settings.
 */

import type { UserRole } from './user.js';

/**
 * All features that can be controlled via permissions
 */
export type FeatureId =
  // Project section
  | 'board'
  | 'graph'
  | 'agent'
  | 'terminal'
  // Tools section
  | 'ideation'
  | 'spec'
  | 'context'
  | 'memory'
  // GitHub section
  | 'github-issues'
  | 'github-prs'
  // Other
  | 'notifications'
  | 'project-settings'
  | 'global-settings'
  | 'running-agents';

/**
 * Feature metadata for display in admin UI
 */
export interface FeatureInfo {
  id: FeatureId;
  label: string;
  description: string;
  section: 'project' | 'tools' | 'github' | 'other';
  /** If true, this feature cannot be disabled (e.g., board for all users) */
  required?: boolean;
}

/**
 * All available features with metadata
 */
export const FEATURES: FeatureInfo[] = [
  // Project section
  {
    id: 'board',
    label: 'Kanban Board',
    description: 'View and manage tasks on the Kanban board',
    section: 'project',
    required: true, // Everyone needs access to the board
  },
  {
    id: 'graph',
    label: 'Graph View',
    description: 'Visualize task dependencies and relationships',
    section: 'project',
  },
  {
    id: 'agent',
    label: 'Agent Runner',
    description: 'Run AI agents to execute tasks',
    section: 'project',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Access the integrated terminal',
    section: 'project',
  },
  // Tools section
  {
    id: 'ideation',
    label: 'Ideation',
    description: 'Brainstorm and generate ideas with AI',
    section: 'tools',
  },
  {
    id: 'spec',
    label: 'Spec Editor',
    description: 'Edit and manage feature specifications',
    section: 'tools',
  },
  {
    id: 'context',
    label: 'Context',
    description: 'Manage project context for AI',
    section: 'tools',
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'View and manage AI memory',
    section: 'tools',
  },
  // GitHub section
  {
    id: 'github-issues',
    label: 'GitHub Issues',
    description: 'View and manage GitHub issues',
    section: 'github',
  },
  {
    id: 'github-prs',
    label: 'Pull Requests',
    description: 'View and manage pull requests',
    section: 'github',
  },
  // Other
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'View system notifications',
    section: 'other',
  },
  {
    id: 'project-settings',
    label: 'Project Settings',
    description: 'Configure project-specific settings',
    section: 'other',
  },
  {
    id: 'global-settings',
    label: 'Global Settings',
    description: 'Configure application settings',
    section: 'other',
  },
  {
    id: 'running-agents',
    label: 'Running Agents',
    description: 'View currently running AI agents',
    section: 'other',
  },
];

/**
 * Role permissions configuration
 */
export type RolePermissions = Record<FeatureId, boolean>;

/**
 * All roles' permissions configuration
 */
export type RolePermissionsConfig = Record<UserRole, RolePermissions>;

/**
 * Default permissions for each role
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsConfig = {
  admin: {
    // Admin has access to everything
    board: true,
    graph: true,
    agent: true,
    terminal: true,
    ideation: true,
    spec: true,
    context: true,
    memory: true,
    'github-issues': true,
    'github-prs': true,
    notifications: true,
    'project-settings': true,
    'global-settings': true,
    'running-agents': true,
  },
  'backend-dev': {
    // Backend developers - focused on code execution
    board: true,
    graph: false,
    agent: true,
    terminal: true,
    ideation: false,
    spec: true,
    context: true,
    memory: false,
    'github-issues': true,
    'github-prs': true,
    notifications: true,
    'project-settings': false,
    'global-settings': false,
    'running-agents': true,
  },
  'frontend-dev': {
    // Frontend developers - similar to backend
    board: true,
    graph: false,
    agent: true,
    terminal: true,
    ideation: false,
    spec: true,
    context: true,
    memory: false,
    'github-issues': true,
    'github-prs': true,
    notifications: true,
    'project-settings': false,
    'global-settings': false,
    'running-agents': true,
  },
  devops: {
    // DevOps - terminal and settings focused
    board: true,
    graph: false,
    agent: true,
    terminal: true,
    ideation: false,
    spec: false,
    context: true,
    memory: false,
    'github-issues': true,
    'github-prs': true,
    notifications: true,
    'project-settings': true,
    'global-settings': false,
    'running-agents': true,
  },
};

/**
 * Storage format for role permissions
 */
export interface RolePermissionsStorage {
  version: number;
  permissions: RolePermissionsConfig;
}

export const ROLE_PERMISSIONS_VERSION = 1;

export const DEFAULT_ROLE_PERMISSIONS_STORAGE: RolePermissionsStorage = {
  version: ROLE_PERMISSIONS_VERSION,
  permissions: DEFAULT_ROLE_PERMISSIONS,
};

/**
 * Check if a role has access to a feature
 */
export function hasFeatureAccess(
  role: UserRole,
  featureId: FeatureId,
  permissions: RolePermissionsConfig = DEFAULT_ROLE_PERMISSIONS
): boolean {
  return permissions[role]?.[featureId] ?? false;
}

/**
 * Get all accessible features for a role
 */
export function getAccessibleFeatures(
  role: UserRole,
  permissions: RolePermissionsConfig = DEFAULT_ROLE_PERMISSIONS
): FeatureId[] {
  const rolePerms = permissions[role];
  if (!rolePerms) return [];

  return (Object.keys(rolePerms) as FeatureId[]).filter((featureId) => rolePerms[featureId]);
}
