/**
 * AECORD Role Permissions Manager
 *
 * Admin UI for configuring which features each role can access.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useRolePermissions } from '@/hooks/use-role-permissions';
import {
  Shield,
  Server,
  Palette,
  Code,
  Check,
  X,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Users,
  Info,
  Loader2,
} from 'lucide-react';
import type { UserRole, FeatureId, RolePermissionsConfig, FeatureInfo } from '@automaker/types';
import { FEATURES, DEFAULT_ROLE_PERMISSIONS } from '@automaker/types';

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  admin: {
    label: 'Administrator',
    icon: Shield,
    color: 'text-amber-500',
    description: 'Full access to all features and settings',
  },
  'backend-dev': {
    label: 'Backend Developer',
    icon: Server,
    color: 'text-blue-500',
    description: 'Focus on API, database, and server-side code',
  },
  'frontend-dev': {
    label: 'Frontend Developer',
    icon: Palette,
    color: 'text-purple-500',
    description: 'Focus on UI, components, and client-side code',
  },
  devops: {
    label: 'DevOps Engineer',
    icon: Code,
    color: 'text-green-500',
    description: 'Focus on deployment, CI/CD, and infrastructure',
  },
};

const SECTION_LABELS: Record<string, string> = {
  project: 'Project',
  tools: 'Tools',
  github: 'GitHub',
  other: 'Other',
};

interface RolePermissionsManagerProps {
  className?: string;
}

export function RolePermissionsManager({ className }: RolePermissionsManagerProps) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAdmin = user?.role === 'admin';
  const hasToken = !!token;

  // Use the role permissions hook to fetch/update from server
  const {
    permissions: serverPermissions,
    isLoading,
    updatePermissions,
    isUpdating,
    updateError,
    hasToken: hookHasToken,
  } = useRolePermissions();

  // Use token status from hook or local check
  const effectiveHasToken = hasToken || hookHasToken;

  // Local state for editing
  const [localPermissions, setLocalPermissions] =
    useState<RolePermissionsConfig>(DEFAULT_ROLE_PERMISSIONS);
  const [expandedRoles, setExpandedRoles] = useState<Set<UserRole>>(new Set(['backend-dev']));
  const [hasChanges, setHasChanges] = useState(false);

  // Sync server permissions to local state when loaded
  useEffect(() => {
    if (serverPermissions) {
      setLocalPermissions(serverPermissions);
      setHasChanges(false);
    }
  }, [serverPermissions]);

  // Group features by section
  const featuresBySection = FEATURES.reduce(
    (acc, feature) => {
      if (!acc[feature.section]) {
        acc[feature.section] = [];
      }
      acc[feature.section].push(feature);
      return acc;
    },
    {} as Record<string, FeatureInfo[]>
  );

  const toggleRole = (role: UserRole) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const togglePermission = (role: UserRole, featureId: FeatureId) => {
    // Admin permissions can't be changed
    if (role === 'admin') return;

    // Required features can't be disabled
    const feature = FEATURES.find((f) => f.id === featureId);
    if (feature?.required) return;

    setLocalPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [featureId]: !prev[role][featureId],
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updatePermissions(localPermissions);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalPermissions(serverPermissions || DEFAULT_ROLE_PERMISSIONS);
    setHasChanges(false);
  };

  if (!isAdmin) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
        <p className="text-muted-foreground">Only administrators can manage role permissions.</p>
      </div>
    );
  }

  if (!effectiveHasToken) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Team Login Required</h3>
        <p className="text-muted-foreground">
          Please log in via the Team Login widget in the sidebar to manage role permissions.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
        <p className="text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Role Permissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which features each team role can access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
              'border border-border',
              'hover:bg-accent transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-brand-500 text-white',
              'hover:bg-brand-600 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {updateError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-500">Failed to save permissions</p>
            <p className="text-muted-foreground mt-1">{updateError.message}</p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-500">How permissions work</p>
          <p className="text-muted-foreground mt-1">
            Each role has access to specific features. Disabled features won't appear in the sidebar
            for users with that role. Admin always has full access.
          </p>
        </div>
      </div>

      {/* Role cards */}
      <div className="space-y-4">
        {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
          const config = ROLE_CONFIG[role];
          const Icon = config.icon;
          const isExpanded = expandedRoles.has(role);
          const isAdminRole = role === 'admin';

          // Count enabled features for this role
          const enabledCount = Object.values(localPermissions[role] || {}).filter(Boolean).length;
          const totalCount = Object.keys(localPermissions[role] || {}).length;

          return (
            <div
              key={role}
              className={cn(
                'rounded-xl border transition-all duration-200',
                isExpanded ? 'border-border bg-card' : 'border-border/50 bg-card/50'
              )}
            >
              {/* Role header */}
              <button
                onClick={() => toggleRole(role)}
                className={cn(
                  'flex items-center w-full p-4 text-left',
                  'hover:bg-accent/30 transition-colors rounded-xl'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg',
                    'bg-gradient-to-br from-muted to-muted/50',
                    'border border-border/50'
                  )}
                >
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{config.label}</span>
                    {isAdminRole && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500">
                        Full Access
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {enabledCount}/{totalCount} features
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded permissions */}
              {isExpanded && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="border-t border-border/50 pt-4">
                    {Object.entries(featuresBySection).map(([section, features]) => (
                      <div key={section} className="mb-4 last:mb-0">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {SECTION_LABELS[section] || section}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {features.map((feature) => {
                            const isEnabled = localPermissions[role]?.[feature.id] ?? false;
                            const isRequired = feature.required;
                            const canToggle = !isAdminRole && !isRequired;

                            return (
                              <button
                                key={feature.id}
                                onClick={() => togglePermission(role, feature.id)}
                                disabled={!canToggle}
                                className={cn(
                                  'flex items-center gap-2 p-2 rounded-lg text-left text-sm',
                                  'border transition-all duration-200',
                                  isEnabled
                                    ? 'bg-brand-500/10 border-brand-500/30 text-foreground'
                                    : 'bg-muted/30 border-border/50 text-muted-foreground',
                                  canToggle && 'hover:border-brand-500/50 cursor-pointer',
                                  !canToggle && 'cursor-not-allowed opacity-70'
                                )}
                                title={feature.description}
                              >
                                <div
                                  className={cn(
                                    'flex items-center justify-center w-5 h-5 rounded',
                                    isEnabled
                                      ? 'bg-brand-500 text-white'
                                      : 'bg-muted border border-border'
                                  )}
                                >
                                  {isEnabled ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <X className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="truncate">{feature.label}</span>
                                {isRequired && (
                                  <span className="text-[10px] text-muted-foreground">(req)</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
