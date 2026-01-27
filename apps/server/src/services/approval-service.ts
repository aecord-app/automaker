/**
 * ApprovalService - Manages task approval workflow for AECORD multi-developer team
 *
 * Handles:
 * - Task submission for approval
 * - Admin approval/rejection
 * - Task assignment to developers
 * - Approval queue management
 */

import { createLogger } from '@automaker/utils';
import type { EventEmitter } from '../lib/events.js';
import type { FeatureLoader } from './feature-loader.js';
import type { UserService } from './user-service.js';
import type { Feature, ApprovalStatus, TaskType, TaskPriority, SafeUser } from '@automaker/types';
import { hasPermission } from '@automaker/types';

const logger = createLogger('ApprovalService');

/**
 * Result of an approval action
 */
export interface ApprovalResult {
  success: boolean;
  feature?: Feature;
  error?: string;
}

/**
 * Filter options for querying features
 */
export interface ApprovalQueryOptions {
  approvalStatus?: ApprovalStatus | ApprovalStatus[];
  assignedTo?: string;
  taskType?: TaskType | TaskType[];
  taskPriority?: TaskPriority | TaskPriority[];
  serviceArea?: string;
}

/**
 * ApprovalService - Manages task approval workflow
 */
export class ApprovalService {
  private featureLoader: FeatureLoader;
  private userService: UserService;
  private events: EventEmitter;

  constructor(featureLoader: FeatureLoader, userService: UserService, events: EventEmitter) {
    this.featureLoader = featureLoader;
    this.userService = userService;
    this.events = events;
  }

  /**
   * Get all features pending approval
   */
  async getPendingApprovals(projectPath: string): Promise<Feature[]> {
    const features = await this.featureLoader.getAll(projectPath);
    return features.filter((f) => f.approvalStatus === 'pending');
  }

  /**
   * Get features by approval status
   */
  async getByApprovalStatus(
    projectPath: string,
    status: ApprovalStatus | ApprovalStatus[]
  ): Promise<Feature[]> {
    const features = await this.featureLoader.getAll(projectPath);
    const statuses = Array.isArray(status) ? status : [status];
    return features.filter((f) => f.approvalStatus && statuses.includes(f.approvalStatus));
  }

  /**
   * Get features assigned to a specific user
   */
  async getAssignedTo(projectPath: string, userId: string): Promise<Feature[]> {
    const features = await this.featureLoader.getAll(projectPath);
    return features.filter((f) => f.assignedTo === userId);
  }

  /**
   * Get features visible to a user based on their role and service areas
   */
  async getVisibleFeatures(
    projectPath: string,
    user: SafeUser,
    options?: ApprovalQueryOptions
  ): Promise<Feature[]> {
    const features = await this.featureLoader.getAll(projectPath);

    return features.filter((feature) => {
      // Admin sees all features
      if (user.role === 'admin') {
        return this.matchesOptions(feature, options);
      }

      // Non-admin users see:
      // 1. Features assigned to them
      // 2. Features in their service areas
      // 3. Features with no service area restriction

      const isAssigned = feature.assignedTo === user.id;
      const hasWildcardAccess = user.serviceAreas?.includes('*');
      const inServiceArea =
        !feature.serviceArea ||
        hasWildcardAccess ||
        user.serviceAreas?.includes(feature.serviceArea);

      if (!isAssigned && !inServiceArea) {
        return false;
      }

      return this.matchesOptions(feature, options);
    });
  }

  /**
   * Check if a feature matches the query options
   */
  private matchesOptions(feature: Feature, options?: ApprovalQueryOptions): boolean {
    if (!options) return true;

    if (options.approvalStatus) {
      const statuses = Array.isArray(options.approvalStatus)
        ? options.approvalStatus
        : [options.approvalStatus];
      if (!feature.approvalStatus || !statuses.includes(feature.approvalStatus)) {
        return false;
      }
    }

    if (options.assignedTo && feature.assignedTo !== options.assignedTo) {
      return false;
    }

    if (options.taskType) {
      const types = Array.isArray(options.taskType) ? options.taskType : [options.taskType];
      if (!feature.taskType || !types.includes(feature.taskType)) {
        return false;
      }
    }

    if (options.taskPriority) {
      const priorities = Array.isArray(options.taskPriority)
        ? options.taskPriority
        : [options.taskPriority];
      if (!feature.taskPriority || !priorities.includes(feature.taskPriority)) {
        return false;
      }
    }

    if (options.serviceArea && feature.serviceArea !== options.serviceArea) {
      return false;
    }

    return true;
  }

  /**
   * Submit a feature for approval
   */
  async submitForApproval(
    projectPath: string,
    featureId: string,
    userId: string
  ): Promise<ApprovalResult> {
    try {
      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Check if already pending or approved
      if (feature.approvalStatus === 'pending') {
        return { success: false, error: 'Feature is already pending approval' };
      }

      if (feature.approvalStatus === 'approved') {
        return { success: false, error: 'Feature is already approved' };
      }

      // Update feature
      const updatedFeature = await this.featureLoader.update(projectPath, featureId, {
        approvalStatus: 'pending',
        // Reset any previous rejection
        rejectionReason: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
      });

      // Emit event
      this.events.emit('feature:submitted_for_approval', {
        projectPath,
        featureId,
        userId,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} submitted for approval by user ${userId}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error submitting for approval:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve a feature (admin only)
   */
  async approveFeature(
    projectPath: string,
    featureId: string,
    adminUserId: string,
    feedback?: string
  ): Promise<ApprovalResult> {
    try {
      // Verify admin has permission
      const admin = await this.userService.getSafeById(adminUserId);
      if (!admin || !hasPermission(admin.role, 'approve_tasks')) {
        return { success: false, error: 'Permission denied: requires approve_tasks permission' };
      }

      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Can only approve pending features
      if (feature.approvalStatus !== 'pending') {
        return {
          success: false,
          error: `Cannot approve feature with status: ${feature.approvalStatus || 'none'}`,
        };
      }

      // Update feature
      const now = new Date().toISOString();
      const updates: Partial<Feature> = {
        approvalStatus: 'approved',
        approvedBy: adminUserId,
        approvedAt: now,
        rejectionReason: undefined,
      };

      // If feature has an execution plan, approve it too
      if (feature.executionPlan && feature.executionPlan.status === 'pending_approval') {
        updates.executionPlan = {
          ...feature.executionPlan,
          status: 'approved',
          approvedBy: adminUserId,
          approvedAt: now,
        };
      }

      const updatedFeature = await this.featureLoader.update(projectPath, featureId, updates);

      // Emit event
      this.events.emit('feature:approved', {
        projectPath,
        featureId,
        adminUserId,
        feedback,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} approved by admin ${adminUserId}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error approving feature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reject a feature (admin only)
   */
  async rejectFeature(
    projectPath: string,
    featureId: string,
    adminUserId: string,
    reason: string
  ): Promise<ApprovalResult> {
    try {
      // Verify admin has permission
      const admin = await this.userService.getSafeById(adminUserId);
      if (!admin || !hasPermission(admin.role, 'reject_tasks')) {
        return { success: false, error: 'Permission denied: requires reject_tasks permission' };
      }

      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Can only reject pending features
      if (feature.approvalStatus !== 'pending') {
        return {
          success: false,
          error: `Cannot reject feature with status: ${feature.approvalStatus || 'none'}`,
        };
      }

      if (!reason || reason.trim().length === 0) {
        return { success: false, error: 'Rejection reason is required' };
      }

      // Update feature
      const now = new Date().toISOString();
      const updates: Partial<Feature> = {
        approvalStatus: 'rejected',
        approvedBy: adminUserId,
        approvedAt: now,
        rejectionReason: reason.trim(),
      };

      // If feature has an execution plan, reject it too
      if (feature.executionPlan && feature.executionPlan.status === 'pending_approval') {
        updates.executionPlan = {
          ...feature.executionPlan,
          status: 'rejected',
          approvedBy: adminUserId,
          approvedAt: now,
          rejectionReason: reason.trim(),
        };
      }

      const updatedFeature = await this.featureLoader.update(projectPath, featureId, updates);

      // Emit event
      this.events.emit('feature:rejected', {
        projectPath,
        featureId,
        adminUserId,
        reason,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} rejected by admin ${adminUserId}: ${reason}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error rejecting feature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Assign a feature to a user
   */
  async assignFeature(
    projectPath: string,
    featureId: string,
    assigneeUserId: string,
    assignerUserId: string
  ): Promise<ApprovalResult> {
    try {
      // Verify assigner has permission
      const assigner = await this.userService.getSafeById(assignerUserId);
      if (!assigner || !hasPermission(assigner.role, 'assign_tasks')) {
        return { success: false, error: 'Permission denied: requires assign_tasks permission' };
      }

      // Verify assignee exists and is active
      const assignee = await this.userService.getSafeById(assigneeUserId);
      if (!assignee) {
        return { success: false, error: 'Assignee user not found' };
      }

      if (!assignee.isActive) {
        return { success: false, error: 'Cannot assign to inactive user' };
      }

      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Check if assignee can work on this service area
      if (
        feature.serviceArea &&
        !this.userService.canAccessServiceArea(assignee, feature.serviceArea)
      ) {
        return {
          success: false,
          error: `User ${assignee.username} does not have access to service area: ${feature.serviceArea}`,
        };
      }

      // Update feature
      const updatedFeature = await this.featureLoader.update(projectPath, featureId, {
        assignedTo: assigneeUserId,
        assignedAt: new Date().toISOString(),
      });

      // Emit event
      this.events.emit('feature:assigned', {
        projectPath,
        featureId,
        assigneeUserId,
        assignerUserId,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} assigned to ${assignee.username} by ${assigner.username}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error assigning feature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unassign a feature
   */
  async unassignFeature(
    projectPath: string,
    featureId: string,
    userId: string
  ): Promise<ApprovalResult> {
    try {
      // Verify user has permission (admin or the assigned user)
      const user = await this.userService.getSafeById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Only admin or the assigned user can unassign
      const isAdmin = hasPermission(user.role, 'assign_tasks');
      const isAssignedUser = feature.assignedTo === userId;

      if (!isAdmin && !isAssignedUser) {
        return { success: false, error: 'Permission denied' };
      }

      // Update feature
      const updatedFeature = await this.featureLoader.update(projectPath, featureId, {
        assignedTo: undefined,
        assignedAt: undefined,
      });

      // Emit event
      this.events.emit('feature:unassigned', {
        projectPath,
        featureId,
        userId,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} unassigned by ${user.username}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error unassigning feature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update task classification (type, priority, service area)
   */
  async updateClassification(
    projectPath: string,
    featureId: string,
    userId: string,
    updates: {
      taskType?: TaskType;
      taskPriority?: TaskPriority;
      serviceArea?: string;
    }
  ): Promise<ApprovalResult> {
    try {
      const user = await this.userService.getSafeById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const feature = await this.featureLoader.get(projectPath, featureId);

      if (!feature) {
        return { success: false, error: 'Feature not found' };
      }

      // Check permission - admin can update anything, others can only update their assigned tasks
      const isAdmin = user.role === 'admin';
      const isAssignedUser = feature.assignedTo === userId;

      if (!isAdmin && !isAssignedUser) {
        return { success: false, error: 'Permission denied' };
      }

      const updatedFeature = await this.featureLoader.update(projectPath, featureId, updates);

      // Emit event
      this.events.emit('feature:classification_updated', {
        projectPath,
        featureId,
        userId,
        updates,
        feature: updatedFeature,
      });

      logger.info(`Feature ${featureId} classification updated by ${user.username}`);

      return { success: true, feature: updatedFeature };
    } catch (error) {
      logger.error('Error updating classification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get approval statistics for a project
   */
  async getApprovalStats(projectPath: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byType: Record<TaskType, number>;
    byPriority: Record<TaskPriority, number>;
  }> {
    const features = await this.featureLoader.getAll(projectPath);

    const stats = {
      total: features.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      byType: {
        feature: 0,
        bug: 0,
        enhancement: 0,
        issue: 0,
      } as Record<TaskType, number>,
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      } as Record<TaskPriority, number>,
    };

    for (const feature of features) {
      // Count by approval status
      if (feature.approvalStatus === 'pending') stats.pending++;
      else if (feature.approvalStatus === 'approved') stats.approved++;
      else if (feature.approvalStatus === 'rejected') stats.rejected++;

      // Count by type
      if (feature.taskType && stats.byType[feature.taskType] !== undefined) {
        stats.byType[feature.taskType]++;
      }

      // Count by priority
      if (feature.taskPriority && stats.byPriority[feature.taskPriority] !== undefined) {
        stats.byPriority[feature.taskPriority]++;
      }
    }

    return stats;
  }
}
