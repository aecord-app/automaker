/**
 * Beads Tracker Hook
 *
 * React Query hook for interacting with the beads task tracker API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import { useAuthStore } from '@/store/auth-store';

export interface BeadIssue {
  id: string;
  title: string;
  status: string;
  priority: number;
  labels: string[];
  created: string;
  closed?: string;
  [key: string]: unknown;
}

export interface BeadsStatus {
  available: boolean;
  version?: string;
  beadsDir?: boolean;
}

const BEADS_KEY = ['beads'];
const BEADS_STATUS_KEY = ['beads', 'status'];
const BEADS_READY_KEY = ['beads', 'ready'];
const BEADS_LIST_KEY = ['beads', 'list'];

function getAuthHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function useBeads() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  // Check beads availability
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: BEADS_STATUS_KEY,
    queryFn: async (): Promise<BeadsStatus & { success: boolean }> => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/status`, {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });
      if (!res.ok) return { success: false, available: false };
      return res.json();
    },
    enabled: !!token,
    staleTime: 60 * 1000,
  });

  const available = statusData?.available ?? false;

  // List ready issues
  const { data: readyData, isLoading: isReadyLoading } = useQuery({
    queryKey: BEADS_READY_KEY,
    queryFn: async () => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/ready`, {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });
      if (!res.ok) return { success: false, issues: [] };
      return res.json();
    },
    enabled: !!token && available,
    staleTime: 30 * 1000,
  });

  // List all issues
  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: BEADS_LIST_KEY,
    queryFn: async () => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/list`, {
        headers: getAuthHeaders(token),
        credentials: 'include',
      });
      if (!res.ok) return { success: false, issues: [] };
      return res.json();
    },
    enabled: !!token && available,
    staleTime: 30 * 1000,
  });

  // Create issue mutation
  const createMutation = useMutation({
    mutationFn: async (params: { title: string; priority?: number; labels?: string[] }) => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/create`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to create beads issue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEADS_KEY });
    },
  });

  // Close issue mutation
  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/${id}/close`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to close beads issue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEADS_KEY });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getServerUrlSync()}/api/beads/sync`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to sync beads');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEADS_KEY });
    },
  });

  return {
    available,
    version: statusData?.version,
    isStatusLoading,
    readyIssues: (readyData?.issues ?? []) as BeadIssue[],
    isReadyLoading,
    allIssues: (listData?.issues ?? []) as BeadIssue[],
    isListLoading,
    createIssue: createMutation.mutate,
    isCreating: createMutation.isPending,
    closeIssue: closeMutation.mutate,
    isClosing: closeMutation.isPending,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
