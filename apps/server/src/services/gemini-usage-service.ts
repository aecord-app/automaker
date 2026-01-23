/**
 * Gemini Usage Service
 *
 * Fetches usage data from Google's Gemini/Cloud Code API using OAuth credentials.
 * Based on CodexBar reference implementation.
 *
 * Authentication methods:
 * 1. OAuth credentials from ~/.gemini/oauth_creds.json
 * 2. API key (limited - only supports API calls, not quota info)
 *
 * API Endpoints:
 * - POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota - Quota info
 * - POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist - Tier detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '@automaker/utils';
import type { GeminiProviderUsage, UsageWindow } from '@automaker/types';

const logger = createLogger('GeminiUsage');

// Gemini API endpoints
const QUOTA_ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota';
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist';
const TOKEN_REFRESH_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Gemini CLI client credentials (from Gemini CLI installation)
// These are embedded in the Gemini CLI and are public
const GEMINI_CLIENT_ID =
  '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const GEMINI_CLIENT_SECRET = 'd-FL95Q19q7MQmFpd7hHD0Ty';

interface GeminiOAuthCreds {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expiry_date: number;
}

interface GeminiQuotaResponse {
  quotas?: Array<{
    remainingFraction: number;
    resetTime: string;
    modelId?: string;
  }>;
}

interface GeminiCodeAssistResponse {
  tier?: string;
  claims?: {
    hd?: string;
  };
}

export class GeminiUsageService {
  private cachedCreds: GeminiOAuthCreds | null = null;
  private settingsPath = path.join(os.homedir(), '.gemini', 'settings.json');
  private credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');

  /**
   * Check if Gemini credentials are available
   */
  async isAvailable(): Promise<boolean> {
    const creds = await this.getOAuthCreds();
    return !!creds;
  }

  /**
   * Get authentication type from settings
   */
  private getAuthType(): string | null {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf8');
        const settings = JSON.parse(content);
        return settings.auth_type || settings.authType || null;
      }
    } catch (error) {
      logger.debug('Failed to read Gemini settings:', error);
    }
    return null;
  }

  /**
   * Get OAuth credentials from file
   */
  private async getOAuthCreds(): Promise<GeminiOAuthCreds | null> {
    // Check auth type - only oauth-personal supports quota API
    const authType = this.getAuthType();
    if (authType && authType !== 'oauth-personal') {
      logger.debug(`Gemini auth type is ${authType}, not oauth-personal - quota API not available`);
      return null;
    }

    // Check cached credentials
    if (this.cachedCreds) {
      // Check if expired
      if (this.cachedCreds.expiry_date > Date.now()) {
        return this.cachedCreds;
      }
      // Try to refresh
      const refreshed = await this.refreshToken(this.cachedCreds.refresh_token);
      if (refreshed) {
        this.cachedCreds = refreshed;
        return this.cachedCreds;
      }
    }

    // Load from file
    try {
      if (fs.existsSync(this.credsPath)) {
        const content = fs.readFileSync(this.credsPath, 'utf8');
        const creds = JSON.parse(content) as GeminiOAuthCreds;

        // Check if expired
        if (creds.expiry_date && creds.expiry_date <= Date.now()) {
          // Try to refresh
          if (creds.refresh_token) {
            const refreshed = await this.refreshToken(creds.refresh_token);
            if (refreshed) {
              this.cachedCreds = refreshed;
              // Save refreshed credentials
              this.saveCreds(refreshed);
              return this.cachedCreds;
            }
          }
          logger.warn('Gemini OAuth token expired and refresh failed');
          return null;
        }

        this.cachedCreds = creds;
        return this.cachedCreds;
      }
    } catch (error) {
      logger.debug('Failed to read Gemini OAuth credentials:', error);
    }

    return null;
  }

  /**
   * Refresh OAuth token
   */
  private async refreshToken(refreshToken: string): Promise<GeminiOAuthCreds | null> {
    try {
      const response = await fetch(TOKEN_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GEMINI_CLIENT_ID,
          client_secret: GEMINI_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        logger.error(`Token refresh failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
        id_token?: string;
      };

      return {
        access_token: data.access_token,
        refresh_token: refreshToken,
        id_token: data.id_token,
        expiry_date: Date.now() + data.expires_in * 1000,
      };
    } catch (error) {
      logger.error('Failed to refresh Gemini token:', error);
      return null;
    }
  }

  /**
   * Save credentials to file
   */
  private saveCreds(creds: GeminiOAuthCreds): void {
    try {
      const dir = path.dirname(this.credsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.credsPath, JSON.stringify(creds, null, 2));
    } catch (error) {
      logger.warn('Failed to save Gemini credentials:', error);
    }
  }

  /**
   * Make an authenticated request to Gemini API
   */
  private async makeRequest<T>(url: string, body?: unknown): Promise<T | null> {
    const creds = await this.getOAuthCreds();
    if (!creds) {
      return null;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Clear cached credentials on auth failure
          this.cachedCreds = null;
          logger.warn('Gemini API authentication failed');
          return null;
        }
        logger.error(`Gemini API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error('Failed to fetch from Gemini API:', error);
      return null;
    }
  }

  /**
   * Fetch usage data from Gemini
   */
  async fetchUsageData(): Promise<GeminiProviderUsage> {
    logger.info('[fetchUsageData] Starting Gemini usage fetch...');

    const baseUsage: GeminiProviderUsage = {
      providerId: 'gemini',
      providerName: 'Gemini',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    // Check if credentials are available
    const creds = await this.getOAuthCreds();
    if (!creds) {
      baseUsage.error = 'Gemini OAuth credentials not available';
      return baseUsage;
    }

    // Fetch quota information
    const quotaResponse = await this.makeRequest<GeminiQuotaResponse>(QUOTA_ENDPOINT, {
      projectId: '-', // Use default project
    });

    if (quotaResponse?.quotas && quotaResponse.quotas.length > 0) {
      baseUsage.available = true;

      const primaryQuota = quotaResponse.quotas[0];

      // Convert remaining fraction to used percent
      const usedPercent = Math.round((1 - (primaryQuota.remainingFraction || 0)) * 100);

      const quotaWindow: UsageWindow = {
        name: 'Quota',
        usedPercent,
        resetsAt: primaryQuota.resetTime || '',
        resetText: primaryQuota.resetTime ? this.formatResetTime(primaryQuota.resetTime) : '',
      };

      baseUsage.primary = quotaWindow;
      baseUsage.remainingFraction = primaryQuota.remainingFraction;
      baseUsage.modelId = primaryQuota.modelId;
    }

    // Fetch tier information
    const codeAssistResponse = await this.makeRequest<GeminiCodeAssistResponse>(
      CODE_ASSIST_ENDPOINT,
      {
        metadata: {
          ide: 'automaker',
        },
      }
    );

    if (codeAssistResponse?.tier) {
      baseUsage.tierType = codeAssistResponse.tier;

      // Determine plan info from tier
      const tierMap: Record<string, { type: string; displayName: string; isPaid: boolean }> = {
        'standard-tier': { type: 'paid', displayName: 'Paid', isPaid: true },
        'free-tier': {
          type: codeAssistResponse.claims?.hd ? 'workspace' : 'free',
          displayName: codeAssistResponse.claims?.hd ? 'Workspace' : 'Free',
          isPaid: false,
        },
        'legacy-tier': { type: 'legacy', displayName: 'Legacy', isPaid: false },
      };

      const tierInfo = tierMap[codeAssistResponse.tier] || {
        type: codeAssistResponse.tier,
        displayName: codeAssistResponse.tier,
        isPaid: false,
      };

      baseUsage.plan = tierInfo;
    }

    if (baseUsage.available) {
      logger.info(
        `[fetchUsageData] ✓ Gemini usage: ${baseUsage.primary?.usedPercent || 0}% used, ` +
          `tier=${baseUsage.tierType || 'unknown'}`
      );
    } else {
      baseUsage.error = 'Failed to fetch Gemini quota data';
    }

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
    } catch {
      return '';
    }
  }

  /**
   * Clear cached credentials
   */
  clearCache(): void {
    this.cachedCreds = null;
  }
}
