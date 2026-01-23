/**
 * OpenCode Usage Service
 *
 * Fetches usage data from OpenCode's server API.
 * Based on CodexBar reference implementation.
 *
 * Note: OpenCode usage tracking is limited as they use a proprietary
 * server function API that requires browser cookies for authentication.
 * This service provides basic status checking based on local config.
 *
 * API Endpoints (require browser cookies):
 * - POST https://opencode.ai/_server - Server functions
 *   - workspaces: Get workspace info
 *   - subscription.get: Get usage data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '@automaker/utils';
import type { OpenCodeProviderUsage, UsageWindow } from '@automaker/types';

const logger = createLogger('OpenCodeUsage');

// OpenCode config locations
const OPENCODE_CONFIG_PATHS = [
  path.join(os.homedir(), '.opencode', 'config.json'),
  path.join(os.homedir(), '.config', 'opencode', 'config.json'),
];

interface OpenCodeConfig {
  workspaceId?: string;
  email?: string;
  authenticated?: boolean;
}

interface OpenCodeUsageData {
  rollingUsage?: {
    usagePercent: number;
    resetInSec: number;
  };
  weeklyUsage?: {
    usagePercent: number;
    resetInSec: number;
  };
}

export class OpenCodeUsageService {
  private cachedConfig: OpenCodeConfig | null = null;

  /**
   * Check if OpenCode is available
   */
  async isAvailable(): Promise<boolean> {
    const config = this.getConfig();
    return !!config?.authenticated;
  }

  /**
   * Get OpenCode config from disk
   */
  private getConfig(): OpenCodeConfig | null {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Check environment variable for workspace ID
    if (process.env.OPENCODE_WORKSPACE_ID) {
      this.cachedConfig = {
        workspaceId: process.env.OPENCODE_WORKSPACE_ID,
        authenticated: true,
      };
      return this.cachedConfig;
    }

    // Check config files
    for (const configPath of OPENCODE_CONFIG_PATHS) {
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(content) as OpenCodeConfig;
          this.cachedConfig = config;
          return this.cachedConfig;
        }
      } catch (error) {
        logger.debug(`Failed to read OpenCode config from ${configPath}:`, error);
      }
    }

    return null;
  }

  /**
   * Fetch usage data from OpenCode
   *
   * Note: OpenCode's usage API requires browser cookies which we don't have access to.
   * This implementation returns basic availability status.
   * For full usage tracking, users should check the OpenCode dashboard.
   */
  async fetchUsageData(): Promise<OpenCodeProviderUsage> {
    logger.info('[fetchUsageData] Starting OpenCode usage fetch...');

    const baseUsage: OpenCodeProviderUsage = {
      providerId: 'opencode',
      providerName: 'OpenCode',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    const config = this.getConfig();
    if (!config) {
      baseUsage.error = 'OpenCode not configured';
      return baseUsage;
    }

    if (!config.authenticated) {
      baseUsage.error = 'OpenCode not authenticated';
      return baseUsage;
    }

    // OpenCode is available but we can't get detailed usage without browser cookies
    baseUsage.available = true;
    baseUsage.workspaceId = config.workspaceId;

    // Note: Full usage tracking requires browser cookie authentication
    // which is not available in a server-side context.
    // Users should check the OpenCode dashboard for detailed usage.
    baseUsage.error =
      'Usage details require browser authentication. Check opencode.ai for details.';

    logger.info(
      `[fetchUsageData] OpenCode available, workspace: ${config.workspaceId || 'unknown'}`
    );

    return baseUsage;
  }

  /**
   * Clear cached config
   */
  clearCache(): void {
    this.cachedConfig = null;
  }
}
