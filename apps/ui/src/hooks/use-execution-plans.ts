/**
 * AECORD Execution Plans Hook
 *
 * Provides access to execution plans for task approval workflow.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import type { ExecutionPlan } from '@automaker/types';
import { useAuthStore } from '@/store/auth-store';

const QUERY_KEY = ['execution-plans'];

/**
 * Get headers for API requests including auth token
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
 * Fetch a specific execution plan by ID
 */
export function useExecutionPlan(planId: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'detail', planId],
    queryFn: async () => {
      if (!planId) return null;

      const response = await fetch(`${getServerUrlSync()}/api/plans/${planId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch execution plan');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    enabled: !!token && !!planId,
  });
}

/**
 * Fetch execution plan for a feature
 */
export function useFeatureExecutionPlan(projectPath: string | null, featureId: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'feature', projectPath, featureId],
    queryFn: async () => {
      if (!projectPath || !featureId) return null;

      const params = new URLSearchParams({ projectPath });
      const response = await fetch(
        `${getServerUrlSync()}/api/plans/feature/${featureId}?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch execution plan for feature');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    enabled: !!token && !!projectPath && !!featureId,
  });
}

/**
 * Fetch all pending execution plans
 */
export function usePendingPlans() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'pending'],
    queryFn: async () => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/pending`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending plans');
      }

      const data = await response.json();
      return data.plans as ExecutionPlan[];
    },
    enabled: !!token,
  });
}

/**
 * Generate an execution plan for a feature
 */
export function useGeneratePlan() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ projectPath, featureId }: { projectPath: string; featureId: string }) => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/generate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, featureId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate plan');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Submit a plan for approval
 */
export function useSubmitPlanForApproval() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/${planId}/submit`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit plan');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Approve an execution plan (admin only)
 */
export function useApprovePlan() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ planId, editedPlan }: { planId: string; editedPlan?: string }) => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/${planId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ editedPlan }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve plan');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Reject an execution plan (admin only)
 */
export function useRejectPlan() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ planId, reason }: { planId: string; reason: string }) => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/${planId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject plan');
      }

      const data = await response.json();
      return data.plan as ExecutionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Delete an execution plan
 */
export function useDeletePlan() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/plans/${planId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete plan');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Hook to get plan status color
 */
export function usePlanStatusColor(status: ExecutionPlan['status']): string {
  const colors: Record<ExecutionPlan['status'], string> = {
    draft: 'text-gray-500',
    pending_approval: 'text-amber-500',
    approved: 'text-green-500',
    rejected: 'text-red-500',
  };
  return colors[status] || 'text-gray-500';
}

/**
 * Hook to get risk level color
 */
export function useRiskLevelColor(riskLevel: ExecutionPlan['riskLevel']): string {
  const colors: Record<ExecutionPlan['riskLevel'], string> = {
    low: 'text-green-500',
    medium: 'text-amber-500',
    high: 'text-red-500',
  };
  return colors[riskLevel] || 'text-gray-500';
}

/**
 * Format cost as currency
 */
export function formatCost(costUSD: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costUSD);
}

/**
 * Format token count with K/M suffix
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
