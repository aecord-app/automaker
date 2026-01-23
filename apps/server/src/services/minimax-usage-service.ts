/**
 * MiniMax Usage Service
 *
 * Fetches usage data from MiniMax's coding plan API.
 * Based on CodexBar reference implementation.
 *
 * Authentication methods:
 * 1. API Token (MINIMAX_API_KEY environment variable or provider config)
 * 2. Cookie-based authentication (from platform login)
 *
 * API Endpoints:
 * - GET https://api.minimax.io/v1/coding_plan/remains - Token-based usage
 * - GET https://platform.minimax.io/v1/api/openplatform/coding_plan/remains - Fallback
 *
 * For China mainland: platform.minimaxi.com
 */

import { createLogger } from '@automaker/utils';
import type { MiniMaxProviderUsage, UsageWindow, ClaudeCompatibleProvider } from '@automaker/types';

const logger = createLogger('MiniMaxUsage');

// MiniMax API endpoints
const MINIMAX_API_BASE = 'https://api.minimax.io';
const MINIMAX_PLATFORM_BASE = 'https://platform.minimax.io';
const MINIMAX_CHINA_BASE = 'https://platform.minimaxi.com';

const CODING_PLAN_ENDPOINT = '/v1/coding_plan/remains';
const PLATFORM_CODING_PLAN_ENDPOINT = '/v1/api/openplatform/coding_plan/remains';

interface MiniMaxCodingPlanResponse {
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  model_remains?: Array<{
    model: string;
    used: number;
    total: number;
  }>;
  remains_time?: number; // Seconds until reset
  start_time?: string;
  end_time?: string;
}

export class MiniMaxUsageService {
  private providerConfig: ClaudeCompatibleProvider | null = null;
  private cachedApiKey: string | null = null;

  /**
   * Set the provider config (called from settings)
   */
  setProviderConfig(config: ClaudeCompatibleProvider | null): void {
    this.providerConfig = config;
    this.cachedApiKey = null; // Clear cache when config changes
  }

  /**
   * Check if MiniMax is available
   */
  async isAvailable(): Promise<boolean> {
    const apiKey = this.getApiKey();
    return !!apiKey;
  }

  /**
   * Get API key from various sources
   */
  private getApiKey(): string | null {
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }

    // 1. Check environment variable
    if (process.env.MINIMAX_API_KEY) {
      this.cachedApiKey = process.env.MINIMAX_API_KEY;
      return this.cachedApiKey;
    }

    // 2. Check provider config
    if (this.providerConfig?.apiKey) {
      this.cachedApiKey = this.providerConfig.apiKey;
      return this.cachedApiKey;
    }

    return null;
  }

  /**
   * Determine if we should use China endpoint
   */
  private isChina(): boolean {
    if (this.providerConfig?.baseUrl) {
      return this.providerConfig.baseUrl.includes('minimaxi.com');
    }
    return false;
  }

  /**
   * Make an authenticated request to MiniMax API
   */
  private async makeRequest<T>(url: string): Promise<T | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.cachedApiKey = null;
          logger.warn('MiniMax API authentication failed');
          return null;
        }
        logger.error(`MiniMax API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error('Failed to fetch from MiniMax API:', error);
      return null;
    }
  }

  /**
   * Fetch usage data from MiniMax
   */
  async fetchUsageData(): Promise<MiniMaxProviderUsage> {
    logger.info('[fetchUsageData] Starting MiniMax usage fetch...');

    const baseUsage: MiniMaxProviderUsage = {
      providerId: 'minimax',
      providerName: 'MiniMax',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    const apiKey = this.getApiKey();
    if (!apiKey) {
      baseUsage.error = 'MiniMax API key not available';
      return baseUsage;
    }

    // Determine the correct endpoint
    const isChina = this.isChina();
    const baseUrl = isChina ? MINIMAX_CHINA_BASE : MINIMAX_API_BASE;
    const endpoint = `${baseUrl}${CODING_PLAN_ENDPOINT}`;

    // Fetch coding plan data
    let codingPlan = await this.makeRequest<MiniMaxCodingPlanResponse>(endpoint);

    // Try fallback endpoint if primary fails
    if (!codingPlan) {
      const platformBase = isChina ? MINIMAX_CHINA_BASE : MINIMAX_PLATFORM_BASE;
      const fallbackEndpoint = `${platformBase}${PLATFORM_CODING_PLAN_ENDPOINT}`;
      codingPlan = await this.makeRequest<MiniMaxCodingPlanResponse>(fallbackEndpoint);
    }

    if (!codingPlan) {
      baseUsage.error = 'Failed to fetch MiniMax usage data';
      return baseUsage;
    }

    // Check for error response
    if (codingPlan.base_resp?.status_code && codingPlan.base_resp.status_code !== 0) {
      baseUsage.error = codingPlan.base_resp.status_msg || 'MiniMax API error';
      return baseUsage;
    }

    baseUsage.available = true;

    // Parse model remains
    if (codingPlan.model_remains && codingPlan.model_remains.length > 0) {
      let totalUsed = 0;
      let totalLimit = 0;

      for (const model of codingPlan.model_remains) {
        totalUsed += model.used;
        totalLimit += model.total;
      }

      const usedPercent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

      // Calculate reset time
      const resetsAt = codingPlan.remains_time
        ? new Date(Date.now() + codingPlan.remains_time * 1000).toISOString()
        : codingPlan.end_time || '';

      const usageWindow: UsageWindow = {
        name: 'Coding Plan',
        usedPercent,
        resetsAt,
        resetText: resetsAt ? this.formatResetTime(resetsAt) : '',
        used: totalUsed,
        limit: totalLimit,
      };

      baseUsage.primary = usageWindow;
      baseUsage.tokenRemains = totalLimit - totalUsed;
      baseUsage.totalTokens = totalLimit;
    }

    // Parse plan times
    if (codingPlan.start_time) {
      baseUsage.planStartTime = codingPlan.start_time;
    }
    if (codingPlan.end_time) {
      baseUsage.planEndTime = codingPlan.end_time;
    }

    logger.info(
      `[fetchUsageData] ✓ MiniMax usage: ${baseUsage.primary?.usedPercent || 0}% used, ` +
        `${baseUsage.tokenRemains || 0} tokens remaining`
    );

    return baseUsage;
  }

  /**
   * Format reset time as human-readable string
   */
  private formatResetTime(resetAt: string): string {
    try {
      const date = new Date(resetAt);
      const now = new Date();
      const diff = date.getTime() - now.getTime();

      if (diff < 0) return 'Expired';

      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `Resets in ${days}d`;
      }
      if (hours > 0) {
        return `Resets in ${hours}h`;
      }
      return 'Resets soon';
    } catch {
      return '';
    }
  }

  /**
   * Clear cached credentials
   */
  clearCache(): void {
    this.cachedApiKey = null;
  }
}
