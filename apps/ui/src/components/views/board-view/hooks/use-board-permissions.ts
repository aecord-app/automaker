/**
 * AECORD Board Permissions Hook
 *
 * Provides permission checks for Kanban board operations
 */

import { useCallback } from 'react';
import { useAuthStore, useIsAdmin } from '@/store/auth-store';
import { requiresAdminForTransition, getAllowedTransitions } from '../constants';
import type { Feature } from '@/store/app-store';
import type { FeatureStatusWithPipeline } from '@automaker/types';

export interface BoardPermissions {
  /** Whether current user can move a feature between statuses */
  canMoveFeature: (
    feature: Feature,
    fromStatus: FeatureStatusWithPipeline,
    toStatus: FeatureStatusWithPipeline
  ) => boolean;
  /** Whether current user can approve features */
  canApprove: boolean;
  /** Whether current user can reject features */
  canReject: boolean;
  /** Whether current user is admin */
  isAdmin: boolean;
  /** Whether current user can view a feature */
  canViewFeature: (feature: Feature) => boolean;
  /** Whether current user can start implementation on a feature */
  canStartImplementation: (feature: Feature) => boolean;
  /** Get allowed target statuses for a feature */
  getAllowedTargets: (feature: Feature) => FeatureStatusWithPipeline[];
}

/**
 * Hook for board-level permission checks
 */
export function useBoardPermissions(): BoardPermissions {
  const isAdmin = useIsAdmin();
  const user = useAuthStore((state) => state.user);
  const checkPermission = useAuthStore((state) => state.checkPermission);

  const canApprove = checkPermission('approve_tasks');
  const canReject = checkPermission('reject_tasks');

  /**
   * Check if user can move a feature between statuses
   */
  const canMoveFeature = useCallback(
    (
      feature: Feature,
      fromStatus: FeatureStatusWithPipeline,
      toStatus: FeatureStatusWithPipeline
    ): boolean => {
      // Admin can do anything
      if (isAdmin) return true;

      // Check if transition requires admin
      if (requiresAdminForTransition(fromStatus, toStatus)) {
        return false;
      }

      // Check if user can work on this feature (assigned or in their service area)
      if (!canViewFeature(feature)) {
        return false;
      }

      // Developers can move their own assigned features
      if (feature.assignedTo && feature.assignedTo === user?.id) {
        return true;
      }

      // Allow moving unassigned features in user's service area
      if (!feature.assignedTo && canViewFeature(feature)) {
        return true;
      }

      return false;
    },
    [isAdmin, user]
  );

  /**
   * Check if user can view a feature
   */
  const canViewFeature = useCallback(
    (feature: Feature): boolean => {
      if (!user) return false;

      // Admin sees everything
      if (isAdmin) return true;

      // User can see their assigned features
      if (feature.assignedTo === user.id) return true;

      // User can see features in their service area
      const featureServiceArea = feature.serviceArea as string | undefined;
      if (featureServiceArea && user.serviceAreas?.includes(featureServiceArea)) {
        return true;
      }

      // User can see unassigned features
      if (!feature.assignedTo && !feature.serviceArea) {
        return true;
      }

      return false;
    },
    [user, isAdmin]
  );

  /**
   * Check if user can start implementation
   */
  const canStartImplementation = useCallback(
    (feature: Feature): boolean => {
      if (!user) return false;

      // Feature must be approved or in backlog (depending on workflow mode)
      const validStartStatuses = ['approved', 'backlog'];
      if (!validStartStatuses.includes(feature.status)) {
        return false;
      }

      // Admin can start any approved feature
      if (isAdmin) return true;

      // Check if feature is assigned to this user
      if (feature.assignedTo === user.id) return true;

      // Check if unassigned and user can claim it
      if (!feature.assignedTo && canViewFeature(feature)) return true;

      return false;
    },
    [user, isAdmin, canViewFeature]
  );

  /**
   * Get allowed target statuses for a feature based on workflow and permissions
   */
  const getAllowedTargets = useCallback(
    (feature: Feature): FeatureStatusWithPipeline[] => {
      const baseTransitions = getAllowedTransitions(feature.status as FeatureStatusWithPipeline);

      if (isAdmin) {
        return baseTransitions;
      }

      // Filter out transitions that require admin
      return baseTransitions.filter(
        (target) => !requiresAdminForTransition(feature.status, target)
      );
    },
    [isAdmin]
  );

  return {
    canMoveFeature,
    canApprove,
    canReject,
    isAdmin,
    canViewFeature,
    canStartImplementation,
    getAllowedTargets,
  };
}
