/**
 * Pipeline types for AutoMaker custom workflow steps
 */

export interface PipelineStep {
  id: string;
  name: string;
  order: number;
  instructions: string;
  colorClass: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineConfig {
  version: 1;
  steps: PipelineStep[];
}

export type PipelineStatus = `pipeline_${string}`;

/**
 * Feature status with pipeline support
 *
 * AECORD Workflow:
 * backlog → pending_approval → approved → in_progress → [pipeline steps] → waiting_review → verified → completed
 *
 * - pending_approval: Task submitted for admin approval
 * - approved: Admin approved, ready for execution
 * - rejected: Admin rejected, needs revision (returns to backlog)
 * - waiting_review: Implementation complete, awaiting final review
 */
export type FeatureStatusWithPipeline =
  | 'backlog'
  | 'pending_approval' // AECORD: Awaiting admin approval
  | 'approved' // AECORD: Admin approved, ready to start
  | 'rejected' // AECORD: Admin rejected, needs revision
  | 'in_progress'
  | 'waiting_approval' // Legacy: renamed to waiting_review conceptually
  | 'waiting_review' // AECORD: Implementation complete, needs review
  | 'verified'
  | 'completed'
  | PipelineStatus;

/**
 * Kanban column configuration for AECORD workflow
 */
export interface KanbanColumnConfig {
  id: FeatureStatusWithPipeline;
  title: string;
  colorClass: string;
  description?: string;
  icon?: string;
  requiresAdminAction?: boolean; // Only admin can move items to/from this column
  allowedTransitionsFrom?: FeatureStatusWithPipeline[]; // Which columns can items come from
}

/**
 * Default AECORD Kanban columns configuration
 */
export const AECORD_KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    colorClass: 'bg-slate-500',
    description: 'Ideas and tasks waiting to be started',
    icon: 'Inbox',
  },
  {
    id: 'pending_approval',
    title: 'Pending Approval',
    colorClass: 'bg-amber-500',
    description: 'Tasks submitted for admin review',
    icon: 'Clock',
    allowedTransitionsFrom: ['backlog', 'approved', 'rejected'],
  },
  {
    id: 'approved',
    title: 'Approved',
    colorClass: 'bg-emerald-500',
    description: 'Admin approved, ready for implementation',
    icon: 'CheckCircle',
    requiresAdminAction: true,
    allowedTransitionsFrom: ['pending_approval'],
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    colorClass: 'bg-blue-500',
    description: 'Currently being implemented',
    icon: 'Play',
    allowedTransitionsFrom: ['approved', 'backlog'],
  },
  {
    id: 'waiting_review',
    title: 'Waiting Review',
    colorClass: 'bg-purple-500',
    description: 'Implementation complete, needs final review',
    icon: 'Eye',
    allowedTransitionsFrom: ['in_progress'],
  },
  {
    id: 'verified',
    title: 'Verified',
    colorClass: 'bg-green-500',
    description: 'Reviewed and verified as complete',
    icon: 'CheckCheck',
    allowedTransitionsFrom: ['waiting_review'],
  },
];
