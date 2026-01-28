/**
 * AECORD Team Members Hook
 *
 * Manages team member CRUD operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import { useAuthStore } from '@/store/auth-store';

export interface TeamMember {
  id: string;
  username: string;
  email: string;
  role: string;
  serviceAreas: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface TeamMembersResponse {
  success: boolean;
  members: TeamMember[];
}

const QUERY_KEY = ['team-members'];

function getAuthHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function useTeamMembers() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TeamMembersResponse> => {
      const response = await fetch(`${getServerUrlSync()}/api/team-members`, {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        return { success: false, members: [] };
      }

      return response.json();
    },
    enabled: !!token,
    staleTime: 30 * 1000,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (member: {
      username: string;
      email: string;
      password: string;
      role: string;
      serviceAreas?: string[];
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-members`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(member),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      role?: string;
      serviceAreas?: string[];
      isActive?: boolean;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-members/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-members/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-members/${id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      return response.json();
    },
  });

  const members = data?.members || [];
  const isAdmin = user?.role === 'admin';

  return {
    members,
    isLoading,
    error,
    isAdmin,
    addMember: addMemberMutation.mutateAsync,
    updateMember: updateMemberMutation.mutate,
    deleteMember: deleteMemberMutation.mutate,
    resetPassword: resetPasswordMutation.mutateAsync,
    isAddingMember: addMemberMutation.isPending,
    isDeletingMember: deleteMemberMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
  };
}
