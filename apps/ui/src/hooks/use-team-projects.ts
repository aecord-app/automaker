/**
 * AECORD Team Projects Hook
 *
 * Manages team projects for centralized project configuration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import { useAuthStore } from '@/store/auth-store';

export interface TeamProject {
  id: string;
  name: string;
  path: string;
  description?: string;
  allowedRoles: string[];
  createdAt: string;
  createdBy: string;
}

export interface TeamProjectsSettings {
  canBrowseFilesystem: boolean;
  allowNonAdminBrowse: boolean; // Raw setting value (not computed per-role)
  allowNonAdminAccess: boolean;
  defaultProjectId?: string;
}

interface TeamProjectsResponse {
  success: boolean;
  projects: TeamProject[];
  settings: TeamProjectsSettings;
}

const QUERY_KEY = ['team-projects'];

function getAuthHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function useTeamProjects() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // Fetch team projects
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TeamProjectsResponse> => {
      const response = await fetch(`${getServerUrlSync()}/api/team-projects`, {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        // Return empty if not available
        return {
          success: false,
          projects: [],
          settings: {
            canBrowseFilesystem: true,
            allowNonAdminBrowse: false,
            allowNonAdminAccess: true,
          },
        };
      }

      return response.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  // Add project mutation
  const addProjectMutation = useMutation({
    mutationFn: async (project: {
      name: string;
      path: string;
      description?: string;
      allowedRoles?: string[];
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-projects`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add project');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      path?: string;
      description?: string;
      allowedRoles?: string[];
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-projects/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update project');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Remove project mutation
  const removeProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove project');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      allowNonAdminBrowse?: boolean;
      allowNonAdminAccess?: boolean;
      defaultProjectId?: string;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/team-projects/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const projects = data?.projects || [];
  const settings = data?.settings || {
    canBrowseFilesystem: true,
    allowNonAdminBrowse: false,
    allowNonAdminAccess: true,
  };
  const isAdmin = user?.role === 'admin';
  const canBrowseFilesystem = isAdmin || settings.canBrowseFilesystem;
  const isServerAccessEnabled = isAdmin || settings.allowNonAdminAccess !== false;

  return {
    projects,
    settings,
    isLoading,
    error,
    isAdmin,
    canBrowseFilesystem,
    isServerAccessEnabled,
    addProject: addProjectMutation.mutate,
    updateProject: updateProjectMutation.mutate,
    removeProject: removeProjectMutation.mutate,
    updateSettings: updateSettingsMutation.mutate,
    isAddingProject: addProjectMutation.isPending,
    isUpdatingProject: updateProjectMutation.isPending,
    isRemovingProject: removeProjectMutation.isPending,
  };
}
