import type { NavigateOptions } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { formatShortcut } from '@/store/app-store';
import { Activity, Settings, Power } from 'lucide-react';
import { TeamLoginWidget } from './team-login-widget';
import { useAuthStore } from '@/store/auth-store';
import { useRolePermissions } from '@/hooks/use-role-permissions';
import { useTeamProjects } from '@/hooks/use-team-projects';

interface SidebarFooterProps {
  sidebarOpen: boolean;
  isActiveRoute: (id: string) => boolean;
  navigate: (opts: NavigateOptions) => void;
  hideRunningAgents: boolean;
  runningAgentsCount: number;
  shortcuts: {
    settings: string;
  };
}

export function SidebarFooter({
  sidebarOpen,
  isActiveRoute,
  navigate,
  hideRunningAgents,
  runningAgentsCount,
  shortcuts,
}: SidebarFooterProps) {
  // Get user role for permission checks
  const user = useAuthStore((state) => state.user);
  const { hasFeatureAccess } = useRolePermissions();
  const canAccessRunningAgents = user?.role && hasFeatureAccess('running-agents');
  const canAccessGlobalSettings = user?.role && hasFeatureAccess('global-settings');
  const isAdmin = user?.role === 'admin';

  // Server access control (admin only)
  const { settings, updateSettings } = useTeamProjects();
  const isServerAccessEnabled = settings.allowNonAdminAccess !== false;

  const handleToggleServerAccess = () => {
    updateSettings({ allowNonAdminAccess: !isServerAccessEnabled });
  };

  return (
    <div
      className={cn(
        'shrink-0',
        // Top border with gradient fade
        'border-t border-border/40',
        // Elevated background for visual separation
        'bg-gradient-to-t from-background/10 via-sidebar/50 to-transparent'
      )}
    >
      {/* AECORD Team Login */}
      <TeamLoginWidget sidebarOpen={sidebarOpen} />

      {/* Server Access Power Button - admin only */}
      {isAdmin && (
        <div className="px-2 pt-2">
          <button
            onClick={handleToggleServerAccess}
            className={cn(
              'group flex items-center w-full px-3 py-2.5 rounded-xl relative overflow-hidden titlebar-no-drag',
              'transition-all duration-200 ease-out',
              isServerAccessEnabled
                ? [
                    'bg-green-500/10 text-green-600 dark:text-green-400',
                    'border border-green-500/30',
                    'hover:bg-green-500/20',
                  ]
                : [
                    'bg-destructive/10 text-destructive',
                    'border border-destructive/30',
                    'hover:bg-destructive/20',
                  ],
              sidebarOpen ? 'justify-start' : 'justify-center',
              'hover:scale-[1.02] active:scale-[0.97]'
            )}
            title={
              !sidebarOpen
                ? isServerAccessEnabled
                  ? 'Server: ON (click to disable)'
                  : 'Server: OFF (click to enable)'
                : undefined
            }
            data-testid="server-access-toggle"
          >
            <Power
              className={cn(
                'w-[18px] h-[18px] shrink-0 transition-all duration-200',
                isServerAccessEnabled
                  ? 'text-green-500 drop-shadow-sm'
                  : 'text-destructive drop-shadow-sm'
              )}
            />
            <span
              className={cn(
                'ml-3 font-medium text-sm flex-1 text-left',
                sidebarOpen ? 'block' : 'hidden'
              )}
            >
              Server Access
            </span>
            {sidebarOpen && (
              <span
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                  isServerAccessEnabled
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                    : 'bg-destructive/20 text-destructive'
                )}
              >
                {isServerAccessEnabled ? 'ON' : 'OFF'}
              </span>
            )}
            {/* Status dot for collapsed state */}
            {!sidebarOpen && (
              <>
                <span
                  className={cn(
                    'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
                    isServerAccessEnabled ? 'bg-green-500' : 'bg-destructive',
                    'shadow-sm'
                  )}
                />
                <span
                  className={cn(
                    'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
                    'bg-popover text-popover-foreground text-xs font-medium',
                    'border border-border shadow-lg',
                    'opacity-0 group-hover:opacity-100',
                    'transition-all duration-200 whitespace-nowrap z-50',
                    'translate-x-1 group-hover:translate-x-0'
                  )}
                >
                  Server Access: {isServerAccessEnabled ? 'ON' : 'OFF'}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Running Agents Link - hidden by setting or permission */}
      {!hideRunningAgents && canAccessRunningAgents && (
        <div className="p-2 pb-0">
          <button
            onClick={() => navigate({ to: '/running-agents' })}
            className={cn(
              'group flex items-center w-full px-3 py-2.5 rounded-xl relative overflow-hidden titlebar-no-drag',
              'transition-all duration-200 ease-out',
              isActiveRoute('running-agents')
                ? [
                    'bg-gradient-to-r from-brand-500/20 via-brand-500/15 to-brand-600/10',
                    'text-foreground font-medium',
                    'border border-brand-500/30',
                    'shadow-md shadow-brand-500/10',
                  ]
                : [
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-accent/50',
                    'border border-transparent hover:border-border/40',
                    'hover:shadow-sm',
                  ],
              sidebarOpen ? 'justify-start' : 'justify-center',
              'hover:scale-[1.02] active:scale-[0.97]'
            )}
            title={!sidebarOpen ? 'Running Agents' : undefined}
            data-testid="running-agents-link"
          >
            <div className="relative">
              <Activity
                className={cn(
                  'w-[18px] h-[18px] shrink-0 transition-all duration-200',
                  isActiveRoute('running-agents')
                    ? 'text-brand-500 drop-shadow-sm'
                    : 'group-hover:text-brand-400 group-hover:scale-110'
                )}
              />
              {/* Running agents count badge - shown in collapsed state */}
              {!sidebarOpen && runningAgentsCount > 0 && (
                <span
                  className={cn(
                    'absolute -top-1.5 -right-1.5 flex items-center justify-center',
                    'min-w-4 h-4 px-1 text-[9px] font-bold rounded-full',
                    'bg-brand-500 text-white shadow-sm',
                    'animate-in fade-in zoom-in duration-200'
                  )}
                  data-testid="running-agents-count-collapsed"
                >
                  {runningAgentsCount > 99 ? '99' : runningAgentsCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                'ml-3 font-medium text-sm flex-1 text-left',
                sidebarOpen ? 'block' : 'hidden'
              )}
            >
              Running Agents
            </span>
            {/* Running agents count badge - shown in expanded state */}
            {sidebarOpen && runningAgentsCount > 0 && (
              <span
                className={cn(
                  'flex items-center justify-center',
                  'min-w-6 h-6 px-1.5 text-xs font-semibold rounded-full',
                  'bg-brand-500 text-white shadow-sm',
                  'animate-in fade-in zoom-in duration-200',
                  isActiveRoute('running-agents') && 'bg-brand-600'
                )}
                data-testid="running-agents-count"
              >
                {runningAgentsCount > 99 ? '99' : runningAgentsCount}
              </span>
            )}
            {!sidebarOpen && (
              <span
                className={cn(
                  'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
                  'bg-popover text-popover-foreground text-xs font-medium',
                  'border border-border shadow-lg',
                  'opacity-0 group-hover:opacity-100',
                  'transition-all duration-200 whitespace-nowrap z-50',
                  'translate-x-1 group-hover:translate-x-0'
                )}
              >
                Running Agents
                {runningAgentsCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-brand-500 text-white rounded-full text-[10px] font-semibold">
                    {runningAgentsCount}
                  </span>
                )}
              </span>
            )}
          </button>
        </div>
      )}
      {/* Settings Link - only visible to users with permission */}
      {canAccessGlobalSettings && (
        <div className="p-2">
          <button
            onClick={() => navigate({ to: '/settings' })}
            className={cn(
              'group flex items-center w-full px-3 py-2.5 rounded-xl relative overflow-hidden titlebar-no-drag',
              'transition-all duration-200 ease-out',
              isActiveRoute('settings')
                ? [
                    'bg-gradient-to-r from-brand-500/20 via-brand-500/15 to-brand-600/10',
                    'text-foreground font-medium',
                    'border border-brand-500/30',
                    'shadow-md shadow-brand-500/10',
                  ]
                : [
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-accent/50',
                    'border border-transparent hover:border-border/40',
                    'hover:shadow-sm',
                  ],
              sidebarOpen ? 'justify-start' : 'justify-center',
              'hover:scale-[1.02] active:scale-[0.97]'
            )}
            title={!sidebarOpen ? 'Global Settings' : undefined}
            data-testid="settings-button"
          >
            <Settings
              className={cn(
                'w-[18px] h-[18px] shrink-0 transition-all duration-200',
                isActiveRoute('settings')
                  ? 'text-brand-500 drop-shadow-sm'
                  : 'group-hover:text-brand-400 group-hover:rotate-90 group-hover:scale-110'
              )}
            />
            <span
              className={cn(
                'ml-3 font-medium text-sm flex-1 text-left',
                sidebarOpen ? 'block' : 'hidden'
              )}
            >
              Global Settings
            </span>
            {sidebarOpen && (
              <span
                className={cn(
                  'flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-mono rounded-md transition-all duration-200',
                  isActiveRoute('settings')
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'bg-muted text-muted-foreground group-hover:bg-accent'
                )}
                data-testid="shortcut-settings"
              >
                {formatShortcut(shortcuts.settings, true)}
              </span>
            )}
            {!sidebarOpen && (
              <span
                className={cn(
                  'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
                  'bg-popover text-popover-foreground text-xs font-medium',
                  'border border-border shadow-lg',
                  'opacity-0 group-hover:opacity-100',
                  'transition-all duration-200 whitespace-nowrap z-50',
                  'translate-x-1 group-hover:translate-x-0'
                )}
              >
                Global Settings
                <span className="ml-2 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                  {formatShortcut(shortcuts.settings, true)}
                </span>
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
