/**
 * AECORD Approvals Hook
 *
 * Provides access to the approval queue for task workflow.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import { useAuthStore } from '@/store/auth-store';

const QUERY_KEY = ['approvals'];

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
 * Fetch approval queue with stats
 */
export function useApprovalQueue(projectPath: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'queue', projectPath],
    queryFn: async () => {
      if (!projectPath) return { features: [], stats: null };

      const params = new URLSearchParams({ projectPath });
      const response = await fetch(`${getServerUrlSync()}/api/approvals/queue?${params}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch approval queue');
      }

      return response.json() as Promise<{
        features: any[];
        count: number;
        stats: {
          total: number;
          byType: Record<string, number>;
          byPriority: Record<string, number>;
        };
      }>;
    },
    enabled: !!token && !!projectPath,
  });
}

/**
 * Approve a feature
 */
export function useApproveFeature() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      feedback,
    }: {
      projectPath: string;
      featureId: string;
      feedback?: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/approvals/${featureId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, feedback }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve feature');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Reject a feature
 */
export function useRejectFeature() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      reason,
    }: {
      projectPath: string;
      featureId: string;
      reason: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/approvals/${featureId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject feature');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Batch approve features
 */
export function useBatchApprove() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureIds,
      feedback,
    }: {
      projectPath: string;
      featureIds: string[];
      feedback?: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/approvals/batch/approve`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, featureIds, feedback }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to batch approve');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Batch reject features
 */
export function useBatchReject() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureIds,
      reason,
    }: {
      projectPath: string;
      featureIds: string[];
      reason: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/approvals/batch/reject`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, featureIds, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to batch reject');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Assign a feature to a user
 */
export function useAssignFeature() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      assigneeUserId,
    }: {
      projectPath: string;
      featureId: string;
      assigneeUserId: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/approvals/${featureId}/assign`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, assigneeUserId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign feature');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
