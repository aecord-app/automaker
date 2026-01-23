/**
 * GLM (z.AI) Usage Service
 *
 * Fetches usage data from z.AI's API.
 * GLM is a Claude-compatible provider offered by z.AI.
 *
 * Authentication:
 * - API Token from provider config or GLM_API_KEY environment variable
 *
 * Note: z.AI's API may not expose a dedicated usage endpoint.
 * This service checks for API availability and reports basic status.
 */

import { createLogger } from '@automaker/utils';
import type { GLMProviderUsage, ClaudeCompatibleProvider } from '@automaker/types';

const logger = createLogger('GLMUsage');

// GLM API base (z.AI)
const GLM_API_BASE = 'https://api.z.ai';

export class GLMUsageService {
  private providerConfig: ClaudeCompatibleProvider | null = null;
  private cachedApiKey: string | null = null;

  /**
   * Set the provider config (called from settings)
   */
  setProviderConfig(config: ClaudeCompatibleProvider | null): void {
    this.providerConfig = config;
    this.cachedApiKey = null;
  }

  /**
   * Check if GLM is available
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
    if (process.env.GLM_API_KEY) {
      this.cachedApiKey = process.env.GLM_API_KEY;
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
   * Fetch usage data from GLM
   *
   * Note: z.AI may not have a public usage API.
   * This returns basic availability status.
   */
  async fetchUsageData(): Promise<GLMProviderUsage> {
    logger.info('[fetchUsageData] Starting GLM usage fetch...');

    const baseUsage: GLMProviderUsage = {
      providerId: 'glm',
      providerName: 'z.AI GLM',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    const apiKey = this.getApiKey();
    if (!apiKey) {
      baseUsage.error = 'GLM API key not available';
      return baseUsage;
    }

    // GLM/z.AI is available if we have an API key
    // z.AI doesn't appear to have a public usage endpoint
    baseUsage.available = true;

    // Check if API key is valid by making a simple request
    try {
      const baseUrl = this.providerConfig?.baseUrl || GLM_API_BASE;
      const response = await fetch(`${baseUrl}/api/anthropic/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'GLM-4.7',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      // We just want to check if auth works, not actually make a request
      // A 400 with invalid request is fine - it means auth worked
      if (response.status === 401 || response.status === 403) {
        baseUsage.available = false;
        baseUsage.error = 'GLM API authentication failed';
      }
    } catch (error) {
      // Network error or other issue - still mark as available since we have the key
      logger.debug('GLM API check failed (may be fine):', error);
    }

    // Note: z.AI doesn't appear to expose usage metrics via API
    // Users should check their z.AI dashboard for detailed usage
    if (baseUsage.available) {
      baseUsage.plan = {
        type: 'api',
        displayName: 'API Access',
        isPaid: true,
      };
    }

    logger.info(`[fetchUsageData] GLM available: ${baseUsage.available}`);

    return baseUsage;
  }

  /**
   * Clear cached credentials
   */
  clearCache(): void {
    this.cachedApiKey = null;
  }
}
