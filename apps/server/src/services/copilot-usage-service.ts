/**
 * GitHub Copilot Usage Service
 *
 * Fetches usage data from GitHub's Copilot API using GitHub OAuth.
 * Based on CodexBar reference implementation.
 *
 * Authentication methods:
 * 1. GitHub CLI token (~/.config/gh/hosts.yml)
 * 2. GitHub OAuth device flow (stored in config)
 *
 * API Endpoints:
 * - GET https://api.github.com/copilot_internal/user - Quota and plan info
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { createLogger } from '@automaker/utils';
import type { CopilotProviderUsage, UsageWindow } from '@automaker/types';

const logger = createLogger('CopilotUsage');

// GitHub API endpoint for Copilot
const COPILOT_USER_ENDPOINT = 'https://api.github.com/copilot_internal/user';

interface CopilotQuotaSnapshot {
  percentageUsed?: number;
  percentageRemaining?: number;
  limit?: number;
  used?: number;
}

interface CopilotUserResponse {
  copilotPlan?: string;
  copilot_plan?: string;
  quotaSnapshots?: {
    premiumInteractions?: CopilotQuotaSnapshot;
    chat?: CopilotQuotaSnapshot;
  };
  plan?: string;
}

export class CopilotUsageService {
  private cachedToken: string | null = null;

  /**
   * Check if GitHub Copilot credentials are available
   */
  async isAvailable(): Promise<boolean> {
    const token = await this.getGitHubToken();
    return !!token;
  }

  /**
   * Get GitHub token from various sources
   */
  private async getGitHubToken(): Promise<string | null> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    // 1. Check environment variable
    if (process.env.GITHUB_TOKEN) {
      this.cachedToken = process.env.GITHUB_TOKEN;
      return this.cachedToken;
    }

    // 2. Check GH_TOKEN (GitHub CLI uses this)
    if (process.env.GH_TOKEN) {
      this.cachedToken = process.env.GH_TOKEN;
      return this.cachedToken;
    }

    // 3. Try to get token from GitHub CLI
    try {
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (token) {
        this.cachedToken = token;
        return this.cachedToken;
      }
    } catch {
      logger.debug('Failed to get token from gh CLI');
    }

    // 4. Check GitHub CLI hosts.yml file
    const ghHostsPath = path.join(os.homedir(), '.config', 'gh', 'hosts.yml');
    if (fs.existsSync(ghHostsPath)) {
      try {
        const content = fs.readFileSync(ghHostsPath, 'utf8');
        // Simple YAML parsing for oauth_token
        const match = content.match(/oauth_token:\s*(.+)/);
        if (match) {
          this.cachedToken = match[1].trim();
          return this.cachedToken;
        }
      } catch (error) {
        logger.debug('Failed to read gh hosts.yml:', error);
      }
    }

    // 5. Check CodexBar config (for users who also use CodexBar)
    const codexbarConfigPath = path.join(os.homedir(), '.codexbar', 'config.json');
    if (fs.existsSync(codexbarConfigPath)) {
      try {
        const content = fs.readFileSync(codexbarConfigPath, 'utf8');
        const config = JSON.parse(content);
        if (config.github?.oauth_token) {
          this.cachedToken = config.github.oauth_token;
          return this.cachedToken;
        }
      } catch (error) {
        logger.debug('Failed to read CodexBar config:', error);
      }
    }

    return null;
  }

  /**
   * Make an authenticated request to GitHub Copilot API
   */
  private async makeRequest<T>(url: string): Promise<T | null> {
    const token = await this.getGitHubToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/json',
          'User-Agent': 'automaker/1.0',
          // Copilot-specific headers (from CodexBar reference)
          'Editor-Version': 'vscode/1.96.2',
          'Editor-Plugin-Version': 'copilot-chat/0.26.7',
          'X-Github-Api-Version': '2025-04-01',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Clear cached token on auth failure
          this.cachedToken = null;
          logger.warn('GitHub Copilot API authentication failed');
          return null;
        }
        if (response.status === 404) {
          // User may not have Copilot access
          logger.info('GitHub Copilot not available for this user');
          return null;
        }
        logger.error(`GitHub Copilot API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error('Failed to fetch from GitHub Copilot API:', error);
      return null;
    }
  }

  /**
   * Fetch usage data from GitHub Copilot
   */
  async fetchUsageData(): Promise<CopilotProviderUsage> {
    logger.info('[fetchUsageData] Starting GitHub Copilot usage fetch...');

    const baseUsage: CopilotProviderUsage = {
      providerId: 'copilot',
      providerName: 'GitHub Copilot',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    // Check if token is available
    const hasToken = await this.getGitHubToken();
    if (!hasToken) {
      baseUsage.error = 'GitHub authentication not available';
      return baseUsage;
    }

    // Fetch Copilot user data
    const userResponse = await this.makeRequest<CopilotUserResponse>(COPILOT_USER_ENDPOINT);
    if (!userResponse) {
      baseUsage.error = 'Failed to fetch GitHub Copilot usage data';
      return baseUsage;
    }

    baseUsage.available = true;

    // Parse quota snapshots
    const quotas = userResponse.quotaSnapshots;
    if (quotas) {
      // Premium interactions quota
      if (quotas.premiumInteractions) {
        const premium = quotas.premiumInteractions;
        const usedPercent =
          premium.percentageUsed !== undefined
            ? premium.percentageUsed
            : premium.percentageRemaining !== undefined
              ? 100 - premium.percentageRemaining
              : 0;

        const premiumWindow: UsageWindow = {
          name: 'Premium Interactions',
          usedPercent,
          resetsAt: '', // GitHub doesn't provide reset time
          resetText: 'Resets monthly',
          limit: premium.limit,
          used: premium.used,
        };

        baseUsage.primary = premiumWindow;
        baseUsage.premiumInteractions = premiumWindow;
      }

      // Chat quota
      if (quotas.chat) {
        const chat = quotas.chat;
        const usedPercent =
          chat.percentageUsed !== undefined
            ? chat.percentageUsed
            : chat.percentageRemaining !== undefined
              ? 100 - chat.percentageRemaining
              : 0;

        const chatWindow: UsageWindow = {
          name: 'Chat',
          usedPercent,
          resetsAt: '',
          resetText: 'Resets monthly',
          limit: chat.limit,
          used: chat.used,
        };

        baseUsage.secondary = chatWindow;
        baseUsage.chatQuota = chatWindow;
      }
    }

    // Parse plan type
    const planType = userResponse.copilotPlan || userResponse.copilot_plan || userResponse.plan;
    if (planType) {
      baseUsage.copilotPlan = planType;
      baseUsage.plan = {
        type: planType,
        displayName: this.formatPlanName(planType),
        isPaid: planType.toLowerCase() !== 'free',
      };
    }

    logger.info(
      `[fetchUsageData] ✓ GitHub Copilot usage: Premium=${baseUsage.premiumInteractions?.usedPercent || 0}%, ` +
        `Chat=${baseUsage.chatQuota?.usedPercent || 0}%, Plan=${planType || 'unknown'}`
    );

    return baseUsage;
  }

  /**
   * Format plan name for display
   */
  private formatPlanName(plan: string): string {
    const planMap: Record<string, string> = {
      free: 'Free',
      individual: 'Individual',
      business: 'Business',
      enterprise: 'Enterprise',
    };
    return planMap[plan.toLowerCase()] || plan;
  }

  /**
   * Clear cached token
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}
