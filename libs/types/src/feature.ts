/**
 * Feature types for AutoMaker feature management
 */

import type { PlanningMode, ThinkingLevel } from './settings.js';
import type { ReasoningEffort } from './provider.js';

// ============================================================================
// AECORD Task Classification Types
// ============================================================================

/**
 * Task type determines which agent profile and workflow to use
 * - feature: New functionality (Backend/Frontend Specialist, spec planning, manual review)
 * - bug: Bug fix (Debug Specialist, lite planning, auto-verify if tests pass)
 * - enhancement: Improvement to existing code (Optimization Specialist, lite planning, manual review)
 * - issue: General issue/triage (Triage Specialist, skip planning, auto-verify if low-risk)
 */
export type TaskType = 'feature' | 'bug' | 'enhancement' | 'issue';

/**
 * Task priority for ordering and urgency
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Approval workflow status
 * - pending: Awaiting admin approval
 * - approved: Admin approved, ready for execution
 * - rejected: Admin rejected with feedback
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Risk level for execution plans
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * A single phase in an execution plan
 */
export interface ExecutionPhase {
  id: string;
  name: string;
  description: string;
  estimatedTokens: number;
  estimatedFilesModified: number;
  filesToModify: string[];
  dependencies: string[]; // Phase IDs this depends on
}

/**
 * Execution plan for a task - generated before admin approval
 */
export interface ExecutionPlan {
  id: string;
  featureId: string;
  createdAt: string; // ISO timestamp
  createdBy: string; // User ID or 'system'

  // Plan details
  phases: ExecutionPhase[];
  totalEstimatedTokens: number;
  totalEstimatedFiles: number;
  estimatedCostUSD: number;

  // Risk assessment
  riskLevel: RiskLevel;
  riskFactors: string[];

  // Acceptance criteria
  acceptanceCriteria: string[];

  // Approval tracking
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string; // Admin user ID
  approvedAt?: string; // ISO timestamp
  rejectionReason?: string;
  editedPlan?: string; // Admin-edited plan content
}

/**
 * Task type configuration - maps task types to agent profiles and settings
 */
export interface TaskTypeConfig {
  type: TaskType;
  label: string;
  description: string;
  color: string;
  icon: string;
  defaultModel: string;
  defaultPlanningMode: PlanningMode;
  autoVerify: boolean; // Whether to auto-verify if tests pass
}

/**
 * Default task type configurations for AECORD
 */
export const TASK_TYPE_CONFIGS: Record<TaskType, TaskTypeConfig> = {
  feature: {
    type: 'feature',
    label: 'Feature',
    description: 'New functionality implementation',
    color: 'bg-blue-500',
    icon: 'Sparkles',
    defaultModel: 'claude-sonnet',
    defaultPlanningMode: 'spec',
    autoVerify: false,
  },
  bug: {
    type: 'bug',
    label: 'Bug',
    description: 'Bug fix or defect resolution',
    color: 'bg-red-500',
    icon: 'Bug',
    defaultModel: 'claude-haiku',
    defaultPlanningMode: 'lite',
    autoVerify: true,
  },
  enhancement: {
    type: 'enhancement',
    label: 'Enhancement',
    description: 'Improvement to existing functionality',
    color: 'bg-purple-500',
    icon: 'TrendingUp',
    defaultModel: 'claude-sonnet',
    defaultPlanningMode: 'lite',
    autoVerify: false,
  },
  issue: {
    type: 'issue',
    label: 'Issue',
    description: 'General issue or triage item',
    color: 'bg-orange-500',
    icon: 'AlertTriangle',
    defaultModel: 'claude-haiku',
    defaultPlanningMode: 'skip',
    autoVerify: true,
  },
};

/**
 * Priority configuration
 */
export interface TaskPriorityConfig {
  priority: TaskPriority;
  label: string;
  color: string;
  sortOrder: number;
}

/**
 * Default priority configurations
 */
export const TASK_PRIORITY_CONFIGS: Record<TaskPriority, TaskPriorityConfig> = {
  critical: {
    priority: 'critical',
    label: 'Critical',
    color: 'bg-red-600',
    sortOrder: 0,
  },
  high: {
    priority: 'high',
    label: 'High',
    color: 'bg-orange-500',
    sortOrder: 1,
  },
  medium: {
    priority: 'medium',
    label: 'Medium',
    color: 'bg-yellow-500',
    sortOrder: 2,
  },
  low: {
    priority: 'low',
    label: 'Low',
    color: 'bg-green-500',
    sortOrder: 3,
  },
};

// ============================================================================
// Original Feature Types
// ============================================================================

/**
 * A single entry in the description history
 */
export interface DescriptionHistoryEntry {
  description: string;
  timestamp: string; // ISO date string
  source: 'initial' | 'enhance' | 'edit'; // What triggered this version
  enhancementMode?: 'improve' | 'technical' | 'simplify' | 'acceptance' | 'ux-reviewer'; // Only for 'enhance' source
}

export interface FeatureImagePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  [key: string]: unknown;
}

export interface FeatureTextFilePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  content: string; // Text content of the file
  [key: string]: unknown;
}

export interface Feature {
  id: string;
  title?: string;
  titleGenerating?: boolean;
  category: string;
  description: string;
  passes?: boolean;
  priority?: number;
  status?: string;
  dependencies?: string[];
  spec?: string;
  model?: string;
  imagePaths?: Array<string | FeatureImagePath | { path: string; [key: string]: unknown }>;
  textFilePaths?: FeatureTextFilePath[];
  // Branch info - worktree path is derived at runtime from branchName
  branchName?: string; // Name of the feature branch (undefined = use current worktree)
  skipTests?: boolean;
  thinkingLevel?: ThinkingLevel;
  reasoningEffort?: ReasoningEffort;
  planningMode?: PlanningMode;
  requirePlanApproval?: boolean;
  planSpec?: {
    status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected';
    content?: string;
    version: number;
    generatedAt?: string;
    approvedAt?: string;
    reviewedByUser: boolean;
    tasksCompleted?: number;
    tasksTotal?: number;
  };
  error?: string;
  summary?: string;
  startedAt?: string;
  descriptionHistory?: DescriptionHistoryEntry[]; // History of description changes

  // ============================================================================
  // AECORD Task Classification Fields
  // ============================================================================

  /**
   * Task type determines agent profile and workflow
   */
  taskType?: TaskType;

  /**
   * Task priority (critical > high > medium > low)
   * Note: This is separate from the numeric `priority` field which is for ordering
   */
  taskPriority?: TaskPriority;

  /**
   * Approval workflow status
   * - pending: Awaiting admin approval
   * - approved: Admin approved, ready for execution
   * - rejected: Admin rejected with feedback
   */
  approvalStatus?: ApprovalStatus;

  /**
   * User ID of the assigned developer
   */
  assignedTo?: string;

  /**
   * ISO timestamp when the task was assigned
   */
  assignedAt?: string;

  /**
   * Admin user ID who approved/rejected the task
   */
  approvedBy?: string;

  /**
   * ISO timestamp when the task was approved
   */
  approvedAt?: string;

  /**
   * Reason for rejection (if approvalStatus is 'rejected')
   */
  rejectionReason?: string;

  /**
   * Execution plan for the task (generated before admin approval)
   */
  executionPlan?: ExecutionPlan;

  /**
   * Service area this task belongs to (e.g., 'aecord-api', 'aecord-web')
   * Used for filtering tasks by developer's service areas
   */
  serviceArea?: string;

  /**
   * ISO timestamp when the feature was created
   */
  createdAt?: string;

  /**
   * User ID or username of who created/submitted the feature
   */
  createdBy?: string;

  /**
   * Resolution status when a feature is marked as resolved
   */
  resolution?: 'fixed' | 'wontfix' | 'duplicate' | 'auto-resolved';

  /**
   * Who resolved the feature
   */
  resolvedBy?: string;

  /**
   * ISO timestamp when the feature was resolved
   */
  resolvedAt?: string;

  /**
   * Development log entries tracking key status changes
   */
  developmentLog?: DevelopmentLogEntry[];

  [key: string]: unknown; // Keep catch-all for extensibility
}

export interface DevelopmentLogEntry {
  action: string;
  timestamp: string;
  user?: string;
  details?: string;
}

export type FeatureStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verified';
