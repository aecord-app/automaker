/**
 * Board Features Hook
 *
 * React Query-based hook for managing features on the board view.
 * Handles feature loading, categories, and auto-mode event notifications.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import { getHttpApiClient } from '@/lib/http-api-client';
import { toast } from 'sonner';
import { createLogger } from '@automaker/utils/logger';
import { useFeatures } from '@/hooks/queries';
import { queryKeys } from '@/lib/query-keys';
import type { Feature } from '@automaker/types';

const logger = createLogger('BoardFeatures');

interface UseBoardFeaturesProps {
  currentProject: { path: string; id: string } | null;
}

export function useBoardFeatures({ currentProject }: UseBoardFeaturesProps) {
  const queryClient = useQueryClient();
  const [persistedCategories, setPersistedCategories] = useState<string[]>([]);

  // Use React Query for features
  const {
    data: features = [],
    isLoading,
    refetch: loadFeatures,
  } = useFeatures(currentProject?.path);

  // Load persisted categories from file
  const loadCategories = useCallback(async () => {
    if (!currentProject) return;

    try {
      const api = getElectronAPI();
      const result = await api.readFile(`${currentProject.path}/.automaker/categories.json`);

      if (result.success && result.content) {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed)) {
          setPersistedCategories(parsed);
        }
      } else {
        setPersistedCategories([]);
      }
    } catch {
      setPersistedCategories([]);
    }
  }, [currentProject, loadFeatures]);

  // Save a new category to the persisted categories file
  const saveCategory = useCallback(
    async (category: string) => {
      if (!currentProject || !category.trim()) return;

      try {
        const api = getElectronAPI();
        let categories: string[] = [...persistedCategories];

        if (!categories.includes(category)) {
          categories.push(category);
          categories.sort();

          await api.writeFile(
            `${currentProject.path}/.automaker/categories.json`,
            JSON.stringify(categories, null, 2)
          );

          setPersistedCategories(categories);
        }
      } catch (error) {
        logger.error('Failed to save category:', error);
      }
    },
    [currentProject, persistedCategories]
  );

  // Subscribe to auto mode events for notifications (ding sound, toasts)
  // Note: Query invalidation is handled by useAutoModeQueryInvalidation in the root
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.autoMode || !currentProject) return;

    const { removeRunningTask } = useAppStore.getState();
    const projectId = currentProject.id;
    const projectPath = currentProject.path;

    const unsubscribe = api.autoMode.onEvent((event) => {
      // Check if event is for the current project by matching projectPath
      const eventProjectPath = ('projectPath' in event && event.projectPath) as string | undefined;
      if (eventProjectPath && eventProjectPath !== projectPath) {
        // Event is for a different project, ignore it
        logger.debug(
          `Ignoring auto mode event for different project: ${eventProjectPath} (current: ${projectPath})`
        );
        return;
      }

      // Use event's projectPath or projectId if available, otherwise use current project
      // Board view only reacts to events for the currently selected project
      const eventProjectId = ('projectId' in event && event.projectId) || projectId;

      if (event.type === 'auto_mode_feature_start') {
        // Reload features when a feature starts to ensure status update (backlog -> in_progress) is reflected
        logger.info(
          `[BoardFeatures] Feature ${event.featureId} started for project ${projectPath}, reloading features to update status...`
        );
        loadFeatures();
      } else if (event.type === 'auto_mode_feature_complete') {
        // Reload features when a feature is completed
        logger.info('Feature completed, reloading features...');
        loadFeatures();
        // Play ding sound when feature is done (unless muted)
        const { muteDoneSound } = useAppStore.getState();
        if (!muteDoneSound) {
          const audio = new Audio('/sounds/ding.mp3');
          audio.play().catch((err) => logger.warn('Could not play ding sound:', err));
        }
      } else if (event.type === 'auto_mode_error') {
        // Remove from running tasks
        if (event.featureId) {
          const eventBranchName =
            'branchName' in event && event.branchName !== undefined ? event.branchName : null;
          removeRunningTask(eventProjectId, eventBranchName, event.featureId);
        }

        // Show error toast
        const isAuthError =
          event.errorType === 'authentication' ||
          (event.error &&
            (event.error.includes('Authentication failed') ||
              event.error.includes('Invalid API key')));

        if (isAuthError) {
          toast.error('Authentication Failed', {
            description:
              "Your API key is invalid or expired. Please check Settings or run 'claude login' in terminal.",
            duration: 10000,
          });
        } else {
          toast.error('Agent encountered an error', {
            description: event.error || 'Check the logs for details',
          });
        }
      }
    });

    return unsubscribe;
  }, [currentProject]);

  // Subscribe to WebSocket feature events for multi-user real-time sync
  useEffect(() => {
    if (!currentProject) return;

    const api = getHttpApiClient();
    const projectPath = currentProject.path;

    const unsubs = [
      api.features.onFeatureCreated((payload: any) => {
        if (payload.projectPath === projectPath) {
          logger.info('[BoardFeatures] Feature created by another user');
          // If event includes full feature data, add directly to cache
          if (payload.feature) {
            queryClient.setQueryData<Feature[]>(queryKeys.features.all(projectPath), (old) =>
              old ? [...old, payload.feature] : [payload.feature]
            );
          } else {
            // Fallback to invalidation if no feature data
            queryClient.invalidateQueries({ queryKey: queryKeys.features.all(projectPath) });
          }
        }
      }),
      api.features.onFeatureUpdated((payload: any) => {
        if (payload.projectPath === projectPath) {
          logger.info('[BoardFeatures] Feature updated by another user');
          // If event includes full feature data, update cache directly
          if (payload.feature) {
            queryClient.setQueryData<Feature[]>(queryKeys.features.all(projectPath), (old) =>
              old ? old.map((f) => (f.id === payload.featureId ? payload.feature : f)) : []
            );
          } else {
            // Fallback to invalidation if no feature data
            queryClient.invalidateQueries({ queryKey: queryKeys.features.all(projectPath) });
          }
        }
      }),
      api.features.onFeatureDeleted((payload: any) => {
        if (payload.projectPath === projectPath) {
          logger.info('[BoardFeatures] Feature deleted by another user');
          // Remove feature directly from cache
          queryClient.setQueryData<Feature[]>(queryKeys.features.all(projectPath), (old) =>
            old ? old.filter((f) => f.id !== payload.featureId) : []
          );
        }
      }),
      api.features.onFeatureBulkUpdated((payload: any) => {
        if (payload.projectPath === projectPath) {
          logger.info('[BoardFeatures] Features bulk-updated');
          // If event includes full features data, update cache directly
          if (payload.features && Array.isArray(payload.features)) {
            const updatesMap = new Map<string, Feature>(
              payload.features.map((f: Feature) => [f.id, f])
            );
            queryClient.setQueryData<Feature[]>(queryKeys.features.all(projectPath), (old) =>
              old ? old.map((f) => updatesMap.get(f.id) ?? f) : []
            );
          } else {
            // Fallback to invalidation if no features data
            queryClient.invalidateQueries({ queryKey: queryKeys.features.all(projectPath) });
          }
        }
      }),
      api.features.onFeatureBulkDeleted((payload: any) => {
        if (payload.projectPath === projectPath) {
          logger.info('[BoardFeatures] Features bulk-deleted');
          // If event includes feature IDs, remove directly from cache
          if (payload.featureIds && Array.isArray(payload.featureIds)) {
            const idsSet = new Set(payload.featureIds);
            queryClient.setQueryData<Feature[]>(queryKeys.features.all(projectPath), (old) =>
              old ? old.filter((f) => !idsSet.has(f.id)) : []
            );
          } else {
            // Fallback to invalidation if no IDs
            queryClient.invalidateQueries({ queryKey: queryKeys.features.all(projectPath) });
          }
        }
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [currentProject, queryClient]);

  // Check for interrupted features on mount
  useEffect(() => {
    if (!currentProject) return;

    const checkInterrupted = async () => {
      const api = getElectronAPI();
      if (api.autoMode?.resumeInterrupted) {
        try {
          await api.autoMode.resumeInterrupted(currentProject.path);
          logger.info('Checked for interrupted features');
        } catch (error) {
          logger.warn('Failed to check for interrupted features:', error);
        }
      }
    };

    checkInterrupted();
  }, [currentProject]);

  // Load persisted categories on mount/project change
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Clear categories when project changes
  useEffect(() => {
    setPersistedCategories([]);
  }, [currentProject?.path]);

  return {
    features,
    isLoading,
    persistedCategories,
    loadFeatures: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.features.all(currentProject?.path ?? ''),
      });
    },
    loadCategories,
    saveCategory,
  };
}
