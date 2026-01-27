/**
 * AECORD Agent Profiles Hook
 *
 * Provides access to agent profiles for task execution configuration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import type { AgentProfile, TaskType } from '@automaker/types';
import { useAuthStore } from '@/store/auth-store';

const QUERY_KEY = ['agent-profiles'];

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
 * Fetch all agent profiles
 */
export function useAgentProfiles(options?: { active?: boolean }) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'list', options?.active],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.active !== undefined) {
        params.set('active', String(options.active));
      }

      const response = await fetch(
        `${getServerUrlSync()}/api/agent-profiles?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch agent profiles');
      }

      const data = await response.json();
      return data.profiles as AgentProfile[];
    },
    enabled: !!token,
  });
}

/**
 * Fetch a single agent profile by ID
 */
export function useAgentProfile(profileId: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'detail', profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${profileId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agent profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    enabled: !!token && !!profileId,
  });
}

/**
 * Fetch recommended profile for a task type and service area
 */
export function useRecommendedProfile(taskType: TaskType | null, serviceArea?: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'recommend', taskType, serviceArea],
    queryFn: async () => {
      if (!taskType) return null;

      const params = new URLSearchParams({ taskType });
      if (serviceArea) {
        params.set('serviceArea', serviceArea);
      }

      const response = await fetch(
        `${getServerUrlSync()}/api/agent-profiles/recommend?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch recommended profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    enabled: !!token && !!taskType,
  });
}

/**
 * Fetch profile statistics
 */
export function useAgentProfileStats() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'stats'],
    queryFn: async () => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile stats');
      }

      return response.json();
    },
    enabled: !!token,
  });
}

/**
 * Build system prompt for a profile
 */
export function useProfilePrompt(profileId: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'prompt', profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${profileId}/prompt`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to build profile prompt');
      }

      const data = await response.json();
      return data.prompt as string;
    },
    enabled: !!token && !!profileId,
  });
}

/**
 * Create a new agent profile (admin only)
 */
export function useCreateAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (input: Partial<AgentProfile>) => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Update an agent profile (admin only)
 */
export function useUpdateAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgentProfile> & { id: string }) => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Clone a profile (admin only)
 */
export function useCloneAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${id}/clone`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clone profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Activate a profile (admin only)
 */
export function useActivateAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${id}/activate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to activate profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Deactivate a profile (admin only)
 */
export function useDeactivateAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${id}/deactivate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deactivate profile');
      }

      const data = await response.json();
      return data.profile as AgentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Delete a profile (admin only)
 */
export function useDeleteAgentProfile() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({ id, hard = false }: { id: string; hard?: boolean }) => {
      const params = hard ? '?hard=true' : '';
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/${id}${params}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete profile');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Reset profiles to defaults (admin only)
 */
export function useResetAgentProfiles() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${getServerUrlSync()}/api/agent-profiles/reset`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset profiles');
      }

      const data = await response.json();
      return data.profiles as AgentProfile[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
