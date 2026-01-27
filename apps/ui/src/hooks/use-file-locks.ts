/**
 * AECORD File Locks Hook
 *
 * Provides access to file locking and conflict detection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';
import type { FileLock, ConflictCheckResult, AcquireLocksResult, LockType } from '@automaker/types';
import { useAuthStore } from '@/store/auth-store';

const QUERY_KEY = ['file-locks'];

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
 * Check for file conflicts
 */
export function useCheckConflicts() {
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      files,
    }: {
      projectPath: string;
      featureId: string;
      files: string[];
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/check`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, featureId, files }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check conflicts');
      }

      return response.json() as Promise<ConflictCheckResult>;
    },
  });
}

/**
 * Acquire file locks
 */
export function useAcquireLocks() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      files,
      lockType = 'exclusive',
      durationMinutes,
    }: {
      projectPath: string;
      featureId: string;
      files: string[];
      lockType?: LockType;
      durationMinutes?: number;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/acquire`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ projectPath, featureId, files, lockType, durationMinutes }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to acquire locks');
      }

      return data as AcquireLocksResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Release all locks for a feature
 */
export function useReleaseLocks() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (featureId: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/release/${featureId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to release locks');
      }

      return response.json() as Promise<{ success: boolean; releasedCount: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Release a specific lock
 */
export function useReleaseLock() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (lockId: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/release-lock/${lockId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to release lock');
      }

      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Extend a lock's expiration
 */
export function useExtendLock() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async ({
      lockId,
      additionalMinutes,
    }: {
      lockId: string;
      additionalMinutes: number;
    }) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/extend/${lockId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify({ additionalMinutes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extend lock');
      }

      const data = await response.json();
      return data.lock as FileLock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Force release a lock (admin only)
 */
export function useForceReleaseLock() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async (lockId: string) => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/force-release/${lockId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to force release lock');
      }

      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Fetch all locks (filtered by params)
 */
export function useFileLocks(options?: { projectPath?: string; featureId?: string }) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'list', options?.projectPath, options?.featureId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.projectPath) {
        params.set('projectPath', options.projectPath);
      }
      if (options?.featureId) {
        params.set('featureId', options.featureId);
      }

      const response = await fetch(
        `${getServerUrlSync()}/api/conflicts/locks?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch locks');
      }

      const data = await response.json();
      return data.locks as FileLock[];
    },
    enabled: !!token,
  });
}

/**
 * Fetch locks for a specific feature
 */
export function useFeatureLocks(featureId: string | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: [...QUERY_KEY, 'feature', featureId],
    queryFn: async () => {
      if (!featureId) return [];

      const params = new URLSearchParams({ featureId });
      const response = await fetch(
        `${getServerUrlSync()}/api/conflicts/locks?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(token),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch feature locks');
      }

      const data = await response.json();
      return data.locks as FileLock[];
    },
    enabled: !!token && !!featureId,
  });
}

/**
 * Fetch lock statistics (admin only)
 */
export function useLockStats() {
  const token = useAuthStore((state) => state.token);
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  return useQuery({
    queryKey: [...QUERY_KEY, 'stats'],
    queryFn: async () => {
      const response = await fetch(`${getServerUrlSync()}/api/conflicts/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lock stats');
      }

      return response.json() as Promise<{
        totalLocks: number;
        byProject: Record<string, number>;
        byUser: Record<string, number>;
      }>;
    },
    enabled: !!token && isAdmin,
  });
}

/**
 * Hook to check if a lock is expiring soon (within 5 minutes)
 */
export function useIsLockExpiringSoon(lock: FileLock | null): boolean {
  if (!lock) return false;

  const expiresAt = new Date(lock.expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  return expiresAt.getTime() - now.getTime() < fiveMinutes;
}

/**
 * Format lock duration remaining
 */
export function formatLockTimeRemaining(lock: FileLock): string {
  const expiresAt = new Date(lock.expiresAt);
  const now = new Date();
  const remaining = expiresAt.getTime() - now.getTime();

  if (remaining <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(remaining / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m remaining`;
  }

  return `${minutes}m remaining`;
}

/**
 * Get lock status color
 */
export function getLockStatusColor(lock: FileLock): string {
  const expiresAt = new Date(lock.expiresAt);
  const now = new Date();
  const remaining = expiresAt.getTime() - now.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  const fifteenMinutes = 15 * 60 * 1000;

  if (remaining <= 0) {
    return 'text-gray-500';
  }

  if (remaining < fiveMinutes) {
    return 'text-red-500';
  }

  if (remaining < fifteenMinutes) {
    return 'text-amber-500';
  }

  return 'text-green-500';
}
