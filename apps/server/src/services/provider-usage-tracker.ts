/**
 * Provider Usage Tracker
 *
 * Unified service that aggregates usage data from all supported AI providers.
 * Manages caching, polling, and coordination of individual usage services.
 *
 * Supported providers:
 * - Claude (via ClaudeUsageService)
 * - Codex (via CodexUsageService)
 * - Cursor (via CursorUsageService)
 * - Gemini (via GeminiUsageService)
 * - GitHub Copilot (via CopilotUsageService)
 * - OpenCode (via OpenCodeUsageService)
 * - MiniMax (via MiniMaxUsageService)
 * - GLM (via GLMUsageService)
 */

import { createLogger } from '@automaker/utils';
import type {
  UsageProviderId,
  ProviderUsage,
  AllProvidersUsage,
  ClaudeProviderUsage,
  CodexProviderUsage,
  ClaudeCompatibleProvider,
} from '@automaker/types';
import { ClaudeUsageService } from './claude-usage-service.js';
import { CodexUsageService, type CodexUsageData } from './codex-usage-service.js';
import { CursorUsageService } from './cursor-usage-service.js';
import { GeminiUsageService } from './gemini-usage-service.js';
import { CopilotUsageService } from './copilot-usage-service.js';
import { OpenCodeUsageService } from './opencode-usage-service.js';
import { MiniMaxUsageService } from './minimax-usage-service.js';
import { GLMUsageService } from './glm-usage-service.js';
import type { ClaudeUsage } from '../routes/claude/types.js';

const logger = createLogger('ProviderUsageTracker');

// Cache TTL in milliseconds (1 minute)
const CACHE_TTL_MS = 60 * 1000;

interface CachedUsage {
  data: ProviderUsage;
  fetchedAt: number;
}

export class ProviderUsageTracker {
  private claudeService: ClaudeUsageService;
  private codexService: CodexUsageService;
  private cursorService: CursorUsageService;
  private geminiService: GeminiUsageService;
  private copilotService: CopilotUsageService;
  private opencodeService: OpenCodeUsageService;
  private minimaxService: MiniMaxUsageService;
  private glmService: GLMUsageService;

  private cache: Map<UsageProviderId, CachedUsage> = new Map();
  private enabledProviders: Set<UsageProviderId> = new Set([
    'claude',
    'codex',
    'cursor',
    'gemini',
    'copilot',
    'opencode',
    'minimax',
    'glm',
  ]);

  constructor(codexService?: CodexUsageService) {
    this.claudeService = new ClaudeUsageService();
    this.codexService = codexService || new CodexUsageService();
    this.cursorService = new CursorUsageService();
    this.geminiService = new GeminiUsageService();
    this.copilotService = new CopilotUsageService();
    this.opencodeService = new OpenCodeUsageService();
    this.minimaxService = new MiniMaxUsageService();
    this.glmService = new GLMUsageService();
  }

  /**
   * Set enabled providers (called when settings change)
   */
  setEnabledProviders(providers: UsageProviderId[]): void {
    this.enabledProviders = new Set(providers);
  }

  /**
   * Update custom provider configs (MiniMax, GLM)
   */
  updateCustomProviderConfigs(providers: ClaudeCompatibleProvider[]): void {
    const minimaxConfig = providers.find(
      (p) => p.providerType === 'minimax' && p.enabled !== false
    );
    const glmConfig = providers.find((p) => p.providerType === 'glm' && p.enabled !== false);

    this.minimaxService.setProviderConfig(minimaxConfig || null);
    this.glmService.setProviderConfig(glmConfig || null);
  }

  /**
   * Check if a provider is enabled
   */
  isProviderEnabled(providerId: UsageProviderId): boolean {
    return this.enabledProviders.has(providerId);
  }

  /**
   * Check if cached data is still fresh
   */
  private isCacheFresh(providerId: UsageProviderId): boolean {
    const cached = this.cache.get(providerId);
    if (!cached) return false;
    return Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  }

  /**
   * Get cached data for a provider
   */
  private getCached(providerId: UsageProviderId): ProviderUsage | null {
    const cached = this.cache.get(providerId);
    return cached?.data || null;
  }

  /**
   * Set cached data for a provider
   */
  private setCached(providerId: UsageProviderId, data: ProviderUsage): void {
    this.cache.set(providerId, {
      data,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Convert Claude usage to unified format
   */
  private convertClaudeUsage(usage: ClaudeUsage): ClaudeProviderUsage {
    return {
      providerId: 'claude',
      providerName: 'Claude',
      available: true,
      lastUpdated: usage.lastUpdated,
      userTimezone: usage.userTimezone,
      primary: {
        name: 'Session (5-hour)',
        usedPercent: usage.sessionPercentage,
        resetsAt: usage.sessionResetTime,
        resetText: usage.sessionResetText,
      },
      secondary: {
        name: 'Weekly (All Models)',
        usedPercent: usage.weeklyPercentage,
        resetsAt: usage.weeklyResetTime,
        resetText: usage.weeklyResetText,
      },
      sessionWindow: {
        name: 'Session (5-hour)',
        usedPercent: usage.sessionPercentage,
        resetsAt: usage.sessionResetTime,
        resetText: usage.sessionResetText,
      },
      weeklyWindow: {
        name: 'Weekly (All Models)',
        usedPercent: usage.weeklyPercentage,
        resetsAt: usage.weeklyResetTime,
        resetText: usage.weeklyResetText,
      },
      sonnetWindow: {
        name: 'Weekly (Sonnet)',
        usedPercent: usage.sonnetWeeklyPercentage,
        resetsAt: usage.weeklyResetTime,
        resetText: usage.sonnetResetText,
      },
      cost:
        usage.costUsed !== null
          ? {
              used: usage.costUsed,
              limit: usage.costLimit,
              currency: usage.costCurrency || 'USD',
            }
          : undefined,
    };
  }

  /**
   * Convert Codex usage to unified format
   */
  private convertCodexUsage(usage: CodexUsageData): CodexProviderUsage {
    const result: CodexProviderUsage = {
      providerId: 'codex',
      providerName: 'Codex',
      available: true,
      lastUpdated: usage.lastUpdated,
      planType: usage.rateLimits?.planType,
    };

    if (usage.rateLimits?.primary) {
      result.primary = {
        name: `${usage.rateLimits.primary.windowDurationMins}min Window`,
        usedPercent: usage.rateLimits.primary.usedPercent,
        resetsAt: new Date(usage.rateLimits.primary.resetsAt * 1000).toISOString(),
        resetText: this.formatResetTime(usage.rateLimits.primary.resetsAt * 1000),
        windowDurationMins: usage.rateLimits.primary.windowDurationMins,
      };
    }

    if (usage.rateLimits?.secondary) {
      result.secondary = {
        name: `${usage.rateLimits.secondary.windowDurationMins}min Window`,
        usedPercent: usage.rateLimits.secondary.usedPercent,
        resetsAt: new Date(usage.rateLimits.secondary.resetsAt * 1000).toISOString(),
        resetText: this.formatResetTime(usage.rateLimits.secondary.resetsAt * 1000),
        windowDurationMins: usage.rateLimits.secondary.windowDurationMins,
      };
    }

    if (usage.rateLimits?.planType) {
      result.plan = {
        type: usage.rateLimits.planType,
        displayName:
          usage.rateLimits.planType.charAt(0).toUpperCase() + usage.rateLimits.planType.slice(1),
        isPaid: usage.rateLimits.planType !== 'free',
      };
    }

    return result;
  }

  /**
   * Format reset time as human-readable string
   */
  private formatResetTime(resetAtMs: number): string {
    const diff = resetAtMs - Date.now();
    if (diff < 0) return 'Expired';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Resets in ${days}d ${hours % 24}h`;
    if (hours > 0) return `Resets in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `Resets in ${minutes}m`;
    return 'Resets soon';
  }

  /**
   * Fetch usage for a specific provider
   */
  async fetchProviderUsage(
    providerId: UsageProviderId,
    forceRefresh = false
  ): Promise<ProviderUsage | null> {
    // Check cache first
    if (!forceRefresh && this.isCacheFresh(providerId)) {
      return this.getCached(providerId);
    }

    try {
      let usage: ProviderUsage | null = null;

      switch (providerId) {
        case 'claude': {
          if (await this.claudeService.isAvailable()) {
            const claudeUsage = await this.claudeService.fetchUsageData();
            usage = this.convertClaudeUsage(claudeUsage);
          } else {
            usage = {
              providerId: 'claude',
              providerName: 'Claude',
              available: false,
              lastUpdated: new Date().toISOString(),
              error: 'Claude CLI not available',
            };
          }
          break;
        }

        case 'codex': {
          if (await this.codexService.isAvailable()) {
            const codexUsage = await this.codexService.fetchUsageData();
            usage = this.convertCodexUsage(codexUsage);
          } else {
            usage = {
              providerId: 'codex',
              providerName: 'Codex',
              available: false,
              lastUpdated: new Date().toISOString(),
              error: 'Codex CLI not available',
            };
          }
          break;
        }

        case 'cursor': {
          usage = await this.cursorService.fetchUsageData();
          break;
        }

        case 'gemini': {
          usage = await this.geminiService.fetchUsageData();
          break;
        }

        case 'copilot': {
          usage = await this.copilotService.fetchUsageData();
          break;
        }

        case 'opencode': {
          usage = await this.opencodeService.fetchUsageData();
          break;
        }

        case 'minimax': {
          usage = await this.minimaxService.fetchUsageData();
          break;
        }

        case 'glm': {
          usage = await this.glmService.fetchUsageData();
          break;
        }
      }

      if (usage) {
        this.setCached(providerId, usage);
      }

      return usage;
    } catch (error) {
      logger.error(`Failed to fetch usage for ${providerId}:`, error);
      return {
        providerId,
        providerName: this.getProviderName(providerId),
        available: false,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ProviderUsage;
    }
  }

  /**
   * Get provider display name
   */
  private getProviderName(providerId: UsageProviderId): string {
    const names: Record<UsageProviderId, string> = {
      claude: 'Claude',
      codex: 'Codex',
      cursor: 'Cursor',
      gemini: 'Gemini',
      copilot: 'GitHub Copilot',
      opencode: 'OpenCode',
      minimax: 'MiniMax',
      glm: 'z.AI GLM',
    };
    return names[providerId] || providerId;
  }

  /**
   * Fetch usage for all enabled providers
   */
  async fetchAllUsage(forceRefresh = false): Promise<AllProvidersUsage> {
    const providers: Partial<Record<UsageProviderId, ProviderUsage>> = {};
    const errors: Array<{ providerId: UsageProviderId; message: string }> = [];

    // Fetch all enabled providers in parallel
    const enabledList = Array.from(this.enabledProviders);
    const results = await Promise.allSettled(
      enabledList.map((providerId) => this.fetchProviderUsage(providerId, forceRefresh))
    );

    results.forEach((result, index) => {
      const providerId = enabledList[index];

      if (result.status === 'fulfilled' && result.value) {
        providers[providerId] = result.value;
        if (result.value.error) {
          errors.push({
            providerId,
            message: result.value.error,
          });
        }
      } else if (result.status === 'rejected') {
        errors.push({
          providerId,
          message: result.reason?.message || 'Unknown error',
        });
      }
    });

    return {
      providers,
      lastUpdated: new Date().toISOString(),
      errors,
    };
  }

  /**
   * Check availability for all providers
   */
  async checkAvailability(): Promise<Record<UsageProviderId, boolean>> {
    const availability: Record<string, boolean> = {};

    const checks = await Promise.allSettled([
      this.claudeService.isAvailable(),
      this.codexService.isAvailable(),
      this.cursorService.isAvailable(),
      this.geminiService.isAvailable(),
      this.copilotService.isAvailable(),
      this.opencodeService.isAvailable(),
      this.minimaxService.isAvailable(),
      this.glmService.isAvailable(),
    ]);

    const providerIds: UsageProviderId[] = [
      'claude',
      'codex',
      'cursor',
      'gemini',
      'copilot',
      'opencode',
      'minimax',
      'glm',
    ];

    checks.forEach((result, index) => {
      availability[providerIds[index]] =
        result.status === 'fulfilled' ? result.value : false;
    });

    return availability as Record<UsageProviderId, boolean>;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.claudeService = new ClaudeUsageService(); // Reset Claude service
    this.cursorService.clearCache();
    this.geminiService.clearCache();
    this.copilotService.clearCache();
    this.opencodeService.clearCache();
    this.minimaxService.clearCache();
    this.glmService.clearCache();
  }
}
