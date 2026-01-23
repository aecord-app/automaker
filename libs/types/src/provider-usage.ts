/**
 * Provider Usage Types
 *
 * Unified type definitions for tracking usage across all AI providers.
 * Each provider can have different usage metrics, but all share a common
 * structure for display in the UI.
 */

/**
 * Common usage window structure - represents a time-bounded usage period
 * Used by Claude (session/weekly), Codex (rate limits), Cursor, Gemini, etc.
 */
export interface UsageWindow {
  /** Display name for this window (e.g., "5-hour Session", "Weekly Limit") */
  name: string;
  /** Percentage of quota used (0-100) */
  usedPercent: number;
  /** When this window resets (ISO date string) */
  resetsAt: string;
  /** Human-readable reset text (e.g., "Resets in 2h 15m") */
  resetText: string;
  /** Window duration in minutes (if applicable) */
  windowDurationMins?: number;
  /** Raw limit value (if available) */
  limit?: number;
  /** Raw used value (if available) */
  used?: number;
  /** Raw remaining value (if available) */
  remaining?: number;
}

/**
 * Plan/tier information for a provider
 */
export interface ProviderPlan {
  /** Plan type identifier (e.g., "free", "pro", "max", "team", "enterprise") */
  type: string;
  /** Display name for the plan */
  displayName: string;
  /** Whether this is a paid plan */
  isPaid?: boolean;
}

/**
 * Cost/billing information (for pay-per-use providers)
 */
export interface UsageCost {
  /** Amount used in current billing period */
  used: number;
  /** Limit for current billing period (null if unlimited) */
  limit: number | null;
  /** Currency code (e.g., "USD") */
  currency: string;
}

/**
 * Provider identifiers for usage tracking
 */
export type UsageProviderId =
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'gemini'
  | 'copilot'
  | 'opencode'
  | 'minimax'
  | 'glm';

/**
 * Base interface for all provider usage data
 */
export interface BaseProviderUsage {
  /** Provider identifier */
  providerId: UsageProviderId;
  /** Provider display name */
  providerName: string;
  /** Whether this provider is available and authenticated */
  available: boolean;
  /** Primary usage window (most important metric) */
  primary?: UsageWindow;
  /** Secondary usage window (if applicable) */
  secondary?: UsageWindow;
  /** Additional usage windows (for providers with more than 2) */
  additional?: UsageWindow[];
  /** Plan/tier information */
  plan?: ProviderPlan;
  /** Cost/billing information */
  cost?: UsageCost;
  /** Last time usage was fetched (ISO date string) */
  lastUpdated: string;
  /** Error message if fetching failed */
  error?: string;
}

/**
 * Claude-specific usage data
 */
export interface ClaudeProviderUsage extends BaseProviderUsage {
  providerId: 'claude';
  /** Session (5-hour) usage window */
  sessionWindow?: UsageWindow;
  /** Weekly (all models) usage window */
  weeklyWindow?: UsageWindow;
  /** Sonnet-specific weekly usage window */
  sonnetWindow?: UsageWindow;
  /** User's timezone */
  userTimezone?: string;
}

/**
 * Codex-specific usage data
 */
export interface CodexProviderUsage extends BaseProviderUsage {
  providerId: 'codex';
  /** Plan type (free, plus, pro, team, enterprise, edu) */
  planType?: string;
}

/**
 * Cursor-specific usage data
 */
export interface CursorProviderUsage extends BaseProviderUsage {
  providerId: 'cursor';
  /** Included plan usage (fast requests) */
  planUsage?: UsageWindow;
  /** On-demand/overage usage */
  onDemandUsage?: UsageWindow;
  /** On-demand cost in USD */
  onDemandCostUsd?: number;
  /** Billing cycle end date */
  billingCycleEnd?: string;
}

/**
 * Gemini-specific usage data
 */
export interface GeminiProviderUsage extends BaseProviderUsage {
  providerId: 'gemini';
  /** Quota remaining fraction (0-1) */
  remainingFraction?: number;
  /** Model ID for quota */
  modelId?: string;
  /** Tier type (standard, free, workspace, legacy) */
  tierType?: string;
}

/**
 * GitHub Copilot-specific usage data
 */
export interface CopilotProviderUsage extends BaseProviderUsage {
  providerId: 'copilot';
  /** Premium interactions quota */
  premiumInteractions?: UsageWindow;
  /** Chat quota */
  chatQuota?: UsageWindow;
  /** Copilot plan type */
  copilotPlan?: string;
}

/**
 * OpenCode-specific usage data
 */
export interface OpenCodeProviderUsage extends BaseProviderUsage {
  providerId: 'opencode';
  /** Rolling 5-hour usage window */
  rollingWindow?: UsageWindow;
  /** Weekly usage window */
  weeklyWindow?: UsageWindow;
  /** Workspace ID */
  workspaceId?: string;
}

/**
 * MiniMax-specific usage data
 */
export interface MiniMaxProviderUsage extends BaseProviderUsage {
  providerId: 'minimax';
  /** Coding plan token remains */
  tokenRemains?: number;
  /** Total tokens in plan */
  totalTokens?: number;
  /** Plan start time */
  planStartTime?: string;
  /** Plan end time */
  planEndTime?: string;
}

/**
 * GLM (z.AI)-specific usage data
 */
export interface GLMProviderUsage extends BaseProviderUsage {
  providerId: 'glm';
  /** Coding plan usage similar to MiniMax */
  tokenRemains?: number;
  totalTokens?: number;
  planStartTime?: string;
  planEndTime?: string;
}

/**
 * Union type of all provider usage types
 */
export type ProviderUsage =
  | ClaudeProviderUsage
  | CodexProviderUsage
  | CursorProviderUsage
  | GeminiProviderUsage
  | CopilotProviderUsage
  | OpenCodeProviderUsage
  | MiniMaxProviderUsage
  | GLMProviderUsage;

/**
 * Aggregated usage data from all providers
 */
export interface AllProvidersUsage {
  /** Usage data by provider ID */
  providers: Partial<Record<UsageProviderId, ProviderUsage>>;
  /** Last time any usage was fetched */
  lastUpdated: string;
  /** List of providers that are enabled but had errors */
  errors: Array<{ providerId: UsageProviderId; message: string }>;
}

/**
 * Response type for the unified usage endpoint
 */
export interface ProviderUsageResponse {
  success: boolean;
  data?: AllProvidersUsage;
  error?: string;
}

/**
 * Request options for fetching provider usage
 */
export interface ProviderUsageOptions {
  /** Which providers to fetch usage for (empty = all enabled) */
  providers?: UsageProviderId[];
  /** Force refresh even if cached data is fresh */
  forceRefresh?: boolean;
}

/**
 * Provider display information for UI
 */
export interface ProviderDisplayInfo {
  id: UsageProviderId;
  name: string;
  icon: string;
  color: string;
  statusUrl?: string;
  dashboardUrl?: string;
}

/**
 * Provider display metadata
 */
export const PROVIDER_DISPLAY_INFO: Record<UsageProviderId, ProviderDisplayInfo> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    icon: 'anthropic',
    color: '#D97706',
    statusUrl: 'https://status.claude.com',
    dashboardUrl: 'https://console.anthropic.com',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    icon: 'openai',
    color: '#10A37F',
    statusUrl: 'https://status.openai.com',
    dashboardUrl: 'https://platform.openai.com/usage',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    icon: 'cursor',
    color: '#6366F1',
    dashboardUrl: 'https://cursor.com/settings',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    icon: 'google',
    color: '#4285F4',
    dashboardUrl: 'https://aistudio.google.com',
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: 'github',
    color: '#24292E',
    dashboardUrl: 'https://github.com/settings/copilot',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    icon: 'opencode',
    color: '#FF6B6B',
    dashboardUrl: 'https://opencode.ai',
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    icon: 'minimax',
    color: '#FF4081',
    dashboardUrl: 'https://platform.minimax.io/user-center/payment/coding-plan',
  },
  glm: {
    id: 'glm',
    name: 'z.AI GLM',
    icon: 'glm',
    color: '#00BFA5',
    dashboardUrl: 'https://z.ai/account',
  },
};

/**
 * Helper to calculate the maximum usage percentage across all windows
 */
export function getMaxUsagePercent(usage: ProviderUsage): number {
  let max = 0;
  if (usage.primary?.usedPercent !== undefined) {
    max = Math.max(max, usage.primary.usedPercent);
  }
  if (usage.secondary?.usedPercent !== undefined) {
    max = Math.max(max, usage.secondary.usedPercent);
  }
  if (usage.additional) {
    for (const window of usage.additional) {
      if (window.usedPercent !== undefined) {
        max = Math.max(max, window.usedPercent);
      }
    }
  }
  return max;
}

/**
 * Helper to get usage status color based on percentage
 */
export function getUsageStatusColor(percent: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (percent >= 90) return 'red';
  if (percent >= 75) return 'orange';
  if (percent >= 50) return 'yellow';
  return 'green';
}

/**
 * Helper to format reset time as human-readable string
 */
export function formatResetTime(resetAt: string | Date): string {
  const date = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `Resets in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `Resets in ${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `Resets in ${minutes}m`;
  }
  return 'Resets soon';
}
