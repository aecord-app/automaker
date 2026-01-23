/**
 * Provider Usage Bar
 *
 * A compact usage bar that displays usage statistics for all enabled AI providers.
 * Shows a unified view with individual provider usage indicators.
 */

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
  AnthropicIcon,
  OpenAIIcon,
  CursorIcon,
  GeminiIcon,
  OpenCodeIcon,
  MiniMaxIcon,
  GlmIcon,
} from '@/components/ui/provider-icon';
import { useAllProvidersUsage } from '@/hooks/queries';
import type { UsageProviderId, ProviderUsage } from '@automaker/types';
import { getMaxUsagePercent } from '@automaker/types';

// GitHub icon component
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('inline-block', className)} fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// Provider icon mapping
const PROVIDER_ICONS: Record<UsageProviderId, React.FC<{ className?: string }>> = {
  claude: AnthropicIcon,
  codex: OpenAIIcon,
  cursor: CursorIcon,
  gemini: GeminiIcon,
  copilot: GitHubIcon,
  opencode: OpenCodeIcon,
  minimax: MiniMaxIcon,
  glm: GlmIcon,
};

// Provider dashboard URLs
const PROVIDER_DASHBOARD_URLS: Record<UsageProviderId, string | undefined> = {
  claude: 'https://status.claude.com',
  codex: 'https://platform.openai.com/usage',
  cursor: 'https://cursor.com/settings',
  gemini: 'https://aistudio.google.com',
  copilot: 'https://github.com/settings/copilot',
  opencode: 'https://opencode.ai',
  minimax: 'https://platform.minimax.io/user-center/payment/coding-plan',
  glm: 'https://z.ai/account',
};

// Helper to get status color based on percentage
function getStatusInfo(percentage: number) {
  if (percentage >= 90) return { color: 'text-red-500', icon: XCircle, bg: 'bg-red-500' };
  if (percentage >= 75) return { color: 'text-orange-500', icon: AlertTriangle, bg: 'bg-orange-500' };
  if (percentage >= 50) return { color: 'text-yellow-500', icon: AlertTriangle, bg: 'bg-yellow-500' };
  return { color: 'text-green-500', icon: CheckCircle, bg: 'bg-green-500' };
}

// Progress bar component
function ProgressBar({ percentage, colorClass }: { percentage: number; colorClass: string }) {
  return (
    <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
      <div
        className={cn('h-full transition-all duration-500', colorClass)}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

// Usage card component
function UsageCard({
  title,
  subtitle,
  percentage,
  resetText,
  isPrimary = false,
  stale = false,
}: {
  title: string;
  subtitle: string;
  percentage: number;
  resetText?: string;
  isPrimary?: boolean;
  stale?: boolean;
}) {
  const isValidPercentage =
    typeof percentage === 'number' && !isNaN(percentage) && isFinite(percentage);
  const safePercentage = isValidPercentage ? percentage : 0;

  const status = getStatusInfo(safePercentage);
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/50 p-3 transition-opacity',
        isPrimary ? 'border-border/60 shadow-sm' : 'border-border/40',
        (stale || !isValidPercentage) && 'opacity-50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className={cn('font-semibold', isPrimary ? 'text-sm' : 'text-xs')}>{title}</h4>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
        {isValidPercentage ? (
          <div className="flex items-center gap-1.5">
            <StatusIcon className={cn('w-3.5 h-3.5', status.color)} />
            <span
              className={cn(
                'font-mono font-bold',
                status.color,
                isPrimary ? 'text-base' : 'text-sm'
              )}
            >
              {Math.round(safePercentage)}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        )}
      </div>
      <ProgressBar
        percentage={safePercentage}
        colorClass={isValidPercentage ? status.bg : 'bg-muted-foreground/30'}
      />
      {resetText && (
        <div className="mt-1.5 flex justify-end">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {resetText}
          </p>
        </div>
      )}
    </div>
  );
}

// Provider usage panel component
function ProviderUsagePanel({
  providerId,
  usage,
  isStale,
}: {
  providerId: UsageProviderId;
  usage: ProviderUsage;
  isStale: boolean;
}) {
  const ProviderIcon = PROVIDER_ICONS[providerId];
  const dashboardUrl = PROVIDER_DASHBOARD_URLS[providerId];

  if (!usage.available) {
    return (
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ProviderIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{usage.providerName}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
          <AlertTriangle className="w-6 h-6 text-yellow-500/80" />
          <p className="text-xs text-muted-foreground">
            {usage.error || 'Not available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProviderIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{usage.providerName}</span>
        </div>
        {usage.plan && (
          <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
            {usage.plan.displayName}
          </span>
        )}
      </div>

      {usage.primary && (
        <UsageCard
          title={usage.primary.name}
          subtitle={usage.primary.windowDurationMins ? `${usage.primary.windowDurationMins}min window` : 'Usage quota'}
          percentage={usage.primary.usedPercent}
          resetText={usage.primary.resetText}
          isPrimary={true}
          stale={isStale}
        />
      )}

      {usage.secondary && (
        <UsageCard
          title={usage.secondary.name}
          subtitle={usage.secondary.windowDurationMins ? `${usage.secondary.windowDurationMins}min window` : 'Usage quota'}
          percentage={usage.secondary.usedPercent}
          resetText={usage.secondary.resetText}
          stale={isStale}
        />
      )}

      {!usage.primary && !usage.secondary && (
        <div className="text-xs text-muted-foreground text-center py-2">
          {dashboardUrl ? (
            <>
              Check{' '}
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                dashboard
              </a>{' '}
              for details
            </>
          ) : (
            'No usage data available'
          )}
        </div>
      )}
    </div>
  );
}

export function ProviderUsageBar() {
  const [open, setOpen] = useState(false);

  const {
    data: allUsage,
    isLoading,
    error,
    dataUpdatedAt,
    refetch,
  } = useAllProvidersUsage(open);

  // Calculate overall max usage percentage
  const { maxPercent, maxProviderId, availableCount } = useMemo(() => {
    if (!allUsage?.providers) {
      return { maxPercent: 0, maxProviderId: null as UsageProviderId | null, availableCount: 0 };
    }

    let max = 0;
    let maxId: UsageProviderId | null = null;
    let count = 0;

    for (const [id, usage] of Object.entries(allUsage.providers)) {
      if (usage?.available) {
        count++;
        const percent = getMaxUsagePercent(usage);
        if (percent > max) {
          max = percent;
          maxId = id as UsageProviderId;
        }
      }
    }

    return { maxPercent: max, maxProviderId: maxId, availableCount: count };
  }, [allUsage]);

  // Check if data is stale (older than 2 minutes)
  const isStale = !dataUpdatedAt || Date.now() - dataUpdatedAt > 2 * 60 * 1000;

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get the icon for the provider with highest usage
  const MaxProviderIcon = maxProviderId ? PROVIDER_ICONS[maxProviderId] : AnthropicIcon;
  const statusColor = getStatusInfo(maxPercent).color;

  // Get list of available providers for the dropdown
  const availableProviders = useMemo(() => {
    if (!allUsage?.providers) return [];
    return Object.entries(allUsage.providers)
      .filter(([_, usage]) => usage?.available)
      .map(([id, usage]) => ({ id: id as UsageProviderId, usage: usage! }));
  }, [allUsage]);

  const trigger = (
    <Button variant="ghost" size="sm" className="h-9 gap-2 bg-secondary border border-border px-3">
      {availableCount > 0 && <MaxProviderIcon className={cn('w-4 h-4', statusColor)} />}
      <span className="text-sm font-medium">Usage</span>
      {availableCount > 0 && (
        <div
          className={cn(
            'h-1.5 w-16 bg-muted-foreground/20 rounded-full overflow-hidden transition-opacity',
            isStale && 'opacity-60'
          )}
        >
          <div
            className={cn('h-full transition-all duration-500', getProgressBarColor(maxPercent))}
            style={{ width: `${Math.min(maxPercent, 100)}%` }}
          />
        </div>
      )}
      {availableCount > 1 && (
        <span className="text-[10px] text-muted-foreground">+{availableCount - 1}</span>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border shadow-2xl max-h-[80vh] overflow-y-auto"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/10 sticky top-0 z-10">
          <span className="text-sm font-semibold">Provider Usage</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', isLoading && 'animate-spin')}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="divide-y divide-border/50">
          {isLoading && !allUsage ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <Spinner size="lg" />
              <p className="text-xs text-muted-foreground">Loading usage data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 px-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500/80" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Failed to load usage</p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          ) : availableProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 px-4">
              <AlertTriangle className="w-8 h-8 text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No providers available</p>
                <p className="text-xs text-muted-foreground">
                  Configure providers in Settings to track usage
                </p>
              </div>
            </div>
          ) : (
            availableProviders.map(({ id, usage }) => (
              <ProviderUsagePanel
                key={id}
                providerId={id}
                usage={usage}
                isStale={isStale}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/10 border-t border-border/50 sticky bottom-0">
          <span className="text-[10px] text-muted-foreground">
            {availableCount} provider{availableCount !== 1 ? 's' : ''} active
          </span>
          <span className="text-[10px] text-muted-foreground">Updates every minute</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
