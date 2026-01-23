/**
 * Cursor Usage Service
 *
 * Fetches usage data from Cursor's API using session cookies or access token.
 * Based on CodexBar reference implementation.
 *
 * Authentication methods (in priority order):
 * 1. Cached session cookie from browser import
 * 2. Access token from credentials file
 *
 * API Endpoints:
 * - GET https://cursor.com/api/usage-summary - Plan usage, on-demand, billing dates
 * - GET https://cursor.com/api/auth/me - User email and name
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '@automaker/utils';
import type { CursorProviderUsage, UsageWindow } from '@automaker/types';

const logger = createLogger('CursorUsage');

// Cursor API endpoints
const CURSOR_API_BASE = 'https://cursor.com/api';
const USAGE_SUMMARY_ENDPOINT = `${CURSOR_API_BASE}/usage-summary`;
const AUTH_ME_ENDPOINT = `${CURSOR_API_BASE}/auth/me`;

// Session cookie names used by Cursor
const SESSION_COOKIE_NAMES = [
  'WorkosCursorSessionToken',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

interface CursorUsageSummary {
  planUsage?: {
    percent: number;
    resetAt?: string;
  };
  onDemandUsage?: {
    percent: number;
    costUsd?: number;
  };
  billingCycleEnd?: string;
  plan?: string;
}

interface CursorAuthMe {
  email?: string;
  name?: string;
  plan?: string;
}

export class CursorUsageService {
  private cachedSessionCookie: string | null = null;
  private cachedAccessToken: string | null = null;

  /**
   * Check if Cursor credentials are available
   */
  async isAvailable(): Promise<boolean> {
    return await this.hasValidCredentials();
  }

  /**
   * Check if we have valid Cursor credentials
   */
  private async hasValidCredentials(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Get access token from credentials file
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken) {
      return this.cachedAccessToken;
    }

    // Check environment variable first
    if (process.env.CURSOR_ACCESS_TOKEN) {
      this.cachedAccessToken = process.env.CURSOR_ACCESS_TOKEN;
      return this.cachedAccessToken;
    }

    // Check credentials files
    const credentialPaths = [
      path.join(os.homedir(), '.cursor', 'credentials.json'),
      path.join(os.homedir(), '.config', 'cursor', 'credentials.json'),
    ];

    for (const credPath of credentialPaths) {
      try {
        if (fs.existsSync(credPath)) {
          const content = fs.readFileSync(credPath, 'utf8');
          const creds = JSON.parse(content);
          if (creds.accessToken) {
            this.cachedAccessToken = creds.accessToken;
            return this.cachedAccessToken;
          }
          if (creds.token) {
            this.cachedAccessToken = creds.token;
            return this.cachedAccessToken;
          }
        }
      } catch (error) {
        logger.debug(`Failed to read credentials from ${credPath}:`, error);
      }
    }

    return null;
  }

  /**
   * Get session cookie for API calls
   * Returns a cookie string like "WorkosCursorSessionToken=xxx"
   */
  private async getSessionCookie(): Promise<string | null> {
    if (this.cachedSessionCookie) {
      return this.cachedSessionCookie;
    }

    // Check for cookie in environment
    if (process.env.CURSOR_SESSION_COOKIE) {
      this.cachedSessionCookie = process.env.CURSOR_SESSION_COOKIE;
      return this.cachedSessionCookie;
    }

    // Check for saved session file
    const sessionPath = path.join(os.homedir(), '.cursor', 'session.json');
    try {
      if (fs.existsSync(sessionPath)) {
        const content = fs.readFileSync(sessionPath, 'utf8');
        const session = JSON.parse(content);
        for (const cookieName of SESSION_COOKIE_NAMES) {
          if (session[cookieName]) {
            this.cachedSessionCookie = `${cookieName}=${session[cookieName]}`;
            return this.cachedSessionCookie;
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to read session file:', error);
    }

    return null;
  }

  /**
   * Make an authenticated request to Cursor API
   */
  private async makeRequest<T>(url: string): Promise<T | null> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    // Try access token first
    const accessToken = await this.getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Try session cookie as fallback
    const sessionCookie = await this.getSessionCookie();
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    if (!accessToken && !sessionCookie) {
      logger.warn('No Cursor credentials available for API request');
      return null;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Clear cached credentials on auth failure
          this.cachedAccessToken = null;
          this.cachedSessionCookie = null;
          logger.warn('Cursor API authentication failed');
          return null;
        }
        logger.error(`Cursor API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error('Failed to fetch from Cursor API:', error);
      return null;
    }
  }

  /**
   * Fetch usage data from Cursor
   */
  async fetchUsageData(): Promise<CursorProviderUsage> {
    logger.info('[fetchUsageData] Starting Cursor usage fetch...');

    const baseUsage: CursorProviderUsage = {
      providerId: 'cursor',
      providerName: 'Cursor',
      available: false,
      lastUpdated: new Date().toISOString(),
    };

    // Check if credentials are available
    const hasCredentials = await this.hasValidCredentials();
    if (!hasCredentials) {
      baseUsage.error = 'Cursor credentials not available';
      return baseUsage;
    }

    // Fetch usage summary
    const usageSummary = await this.makeRequest<CursorUsageSummary>(USAGE_SUMMARY_ENDPOINT);
    if (!usageSummary) {
      baseUsage.error = 'Failed to fetch Cursor usage data';
      return baseUsage;
    }

    baseUsage.available = true;

    // Parse plan usage
    if (usageSummary.planUsage) {
      const planWindow: UsageWindow = {
        name: 'Plan Usage',
        usedPercent: usageSummary.planUsage.percent || 0,
        resetsAt: usageSummary.planUsage.resetAt || '',
        resetText: usageSummary.planUsage.resetAt
          ? this.formatResetTime(usageSummary.planUsage.resetAt)
          : '',
      };
      baseUsage.primary = planWindow;
      baseUsage.planUsage = planWindow;
    }

    // Parse on-demand usage
    if (usageSummary.onDemandUsage) {
      const onDemandWindow: UsageWindow = {
        name: 'On-Demand Usage',
        usedPercent: usageSummary.onDemandUsage.percent || 0,
        resetsAt: usageSummary.billingCycleEnd || '',
        resetText: usageSummary.billingCycleEnd
          ? this.formatResetTime(usageSummary.billingCycleEnd)
          : '',
      };
      baseUsage.secondary = onDemandWindow;
      baseUsage.onDemandUsage = onDemandWindow;

      if (usageSummary.onDemandUsage.costUsd !== undefined) {
        baseUsage.onDemandCostUsd = usageSummary.onDemandUsage.costUsd;
      }
    }

    // Parse billing cycle end
    if (usageSummary.billingCycleEnd) {
      baseUsage.billingCycleEnd = usageSummary.billingCycleEnd;
    }

    // Parse plan type
    if (usageSummary.plan) {
      baseUsage.plan = {
        type: usageSummary.plan,
        displayName: this.formatPlanName(usageSummary.plan),
        isPaid: usageSummary.plan.toLowerCase() !== 'free',
      };
    }

    logger.info(
      `[fetchUsageData] ✓ Cursor usage: Plan=${baseUsage.planUsage?.usedPercent || 0}%, ` +
        `OnDemand=${baseUsage.onDemandUsage?.usedPercent || 0}%`
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
   * Format plan name for display
   */
  private formatPlanName(plan: string): string {
    const planMap: Record<string, string> = {
      free: 'Free',
      pro: 'Pro',
      business: 'Business',
      enterprise: 'Enterprise',
    };
    return planMap[plan.toLowerCase()] || plan;
  }

  /**
   * Clear cached credentials (useful for logout)
   */
  clearCache(): void {
    this.cachedAccessToken = null;
    this.cachedSessionCookie = null;
  }
}
