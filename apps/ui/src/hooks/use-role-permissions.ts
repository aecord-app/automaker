/**
 * AECORD Role Permissions Hook
 *
 * Provides role-based feature access control.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import { useAuthStore } from '@/store/auth-store';
import type { FeatureId, RolePermissionsConfig, UserRole } from '@automaker/types';
import { DEFAULT_ROLE_PERMISSIONS, hasFeatureAccess as checkFeatureAccess } from '@automaker/types';

const QUERY_KEY = ['role-permissions'];

/**
 * Get headers for API requests
 */
function getAuthHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Hook to manage role permissions
 */
export function useRolePermissions() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // Fetch permissions from server (for admin to see/edit all roles)
  const { data: permissions, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await fetch(`${getServerUrlSync()}/api/role-permissions`, {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        });

        if (!response.ok) {
          // If endpoint doesn't exist yet, return defaults
          return DEFAULT_ROLE_PERMISSIONS;
        }

        const data = await response.json();
        return data.permissions as RolePermissionsConfig;
      } catch {
        // Return defaults on error
        return DEFAULT_ROLE_PERMISSIONS;
      }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update permissions (admin only)
  const updatePermissionsMutation = useMutation({
    mutationFn: async (newPermissions: RolePermissionsConfig) => {
      // Debug logging
      console.log('[RolePermissions] Attempting to update permissions');
      console.log('[RolePermissions] Token present:', !!token);
      console.log('[RolePermissions] Token (first 20 chars):', token?.substring(0, 20));

      if (!token) {
        throw new Error(
          'Please log in via Team Login to update permissions. Click the Team Login widget in the sidebar.'
        );
      }

      const url = `${getServerUrlSync()}/api/role-permissions`;
      const headers = getAuthHeaders(token);
      console.log('[RolePermissions] Request URL:', url);
      console.log('[RolePermissions] Headers:', JSON.stringify(headers));

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ permissions: newPermissions }),
      });

      console.log('[RolePermissions] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('[RolePermissions] Error response:', errorData);
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Failed to update permissions (${response.status})`
        );
      }

      return response.json();
    },
    onSuccess: () => {
      console.log('[RolePermissions] Update successful');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      console.error('[RolePermissions] Update failed:', error);
    },
  });

  // Get effective permissions (use fetched or defaults)
  const effectivePermissions = permissions ?? DEFAULT_ROLE_PERMISSIONS;

  // Check if current user has access to a feature
  const hasFeatureAccess = useCallback(
    (featureId: FeatureId): boolean => {
      if (!user?.role) return false;
      return checkFeatureAccess(user.role, featureId, effectivePermissions);
    },
    [user?.role, effectivePermissions]
  );

  // Check if a specific role has access to a feature
  const roleHasFeatureAccess = useCallback(
    (role: UserRole, featureId: FeatureId): boolean => {
      return checkFeatureAccess(role, featureId, effectivePermissions);
    },
    [effectivePermissions]
  );

  // Get all accessible features for current user
  const accessibleFeatures = useMemo((): FeatureId[] => {
    if (!user?.role) return [];
    const rolePerms = effectivePermissions[user.role];
    if (!rolePerms) return [];

    return (Object.keys(rolePerms) as FeatureId[]).filter((featureId) => rolePerms[featureId]);
  }, [user?.role, effectivePermissions]);

  return {
    permissions: effectivePermissions,
    isLoading,
    hasFeatureAccess,
    roleHasFeatureAccess,
    accessibleFeatures,
    updatePermissions: updatePermissionsMutation.mutate,
    isUpdating: updatePermissionsMutation.isPending,
    updateError: updatePermissionsMutation.error as Error | null,
    isAdmin: user?.role === 'admin',
    hasToken: !!token,
  };
}

/**
 * Simple hook to check a single feature access
 */
export function useCanAccessFeature(featureId: FeatureId): boolean {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    if (!user?.role) return false;
    // Use defaults for simplicity - could fetch from server for real-time updates
    return checkFeatureAccess(user.role, featureId, DEFAULT_ROLE_PERMISSIONS);
  }, [user?.role, featureId]);
}
