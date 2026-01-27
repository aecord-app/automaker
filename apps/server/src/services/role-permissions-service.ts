/**
 * AECORD Role Permissions Service
 *
 * Manages role-based feature permissions storage and retrieval.
 */

import path from 'path';
import { createLogger } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';
import type { RolePermissionsConfig, RolePermissionsStorage } from '@automaker/types';
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS_STORAGE,
  ROLE_PERMISSIONS_VERSION,
} from '@automaker/types';

const logger = createLogger('RolePermissionsService');

export class RolePermissionsService {
  private dataDir: string;
  private permissionsFile: string;
  private permissions: RolePermissionsConfig;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.permissionsFile = path.join(dataDir, 'role-permissions.json');
    this.permissions = DEFAULT_ROLE_PERMISSIONS;
    this.loadPermissions();
  }

  /**
   * Load permissions from file
   */
  private loadPermissions(): void {
    try {
      if (secureFs.existsSync(this.permissionsFile)) {
        const data = secureFs.readFileSync(this.permissionsFile, 'utf-8') as string;
        const storage = JSON.parse(data) as RolePermissionsStorage;

        // Handle version migrations if needed
        if (storage.version === ROLE_PERMISSIONS_VERSION) {
          this.permissions = storage.permissions;
          logger.info('Loaded role permissions from file');
        } else {
          logger.warn(
            `Role permissions version mismatch (${storage.version} vs ${ROLE_PERMISSIONS_VERSION}), using defaults`
          );
          this.permissions = DEFAULT_ROLE_PERMISSIONS;
        }
      } else {
        logger.info('No role permissions file found, using defaults');
        this.permissions = DEFAULT_ROLE_PERMISSIONS;
        // Save defaults to file
        this.savePermissions();
      }
    } catch (error) {
      logger.error('Error loading role permissions:', error);
      this.permissions = DEFAULT_ROLE_PERMISSIONS;
    }
  }

  /**
   * Save permissions to file
   */
  private async savePermissions(): Promise<void> {
    try {
      await secureFs.mkdir(this.dataDir, { recursive: true });
      const storage: RolePermissionsStorage = {
        version: ROLE_PERMISSIONS_VERSION,
        permissions: this.permissions,
      };
      await secureFs.writeFile(this.permissionsFile, JSON.stringify(storage, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
      logger.info('Saved role permissions to file');
    } catch (error) {
      logger.error('Error saving role permissions:', error);
      throw error;
    }
  }

  /**
   * Get all role permissions
   */
  getPermissions(): RolePermissionsConfig {
    return this.permissions;
  }

  /**
   * Update role permissions
   */
  async updatePermissions(newPermissions: RolePermissionsConfig): Promise<RolePermissionsConfig> {
    // Ensure admin always has full access
    newPermissions.admin = DEFAULT_ROLE_PERMISSIONS.admin;

    this.permissions = newPermissions;
    await this.savePermissions();
    return this.permissions;
  }

  /**
   * Reset permissions to defaults
   */
  async resetPermissions(): Promise<RolePermissionsConfig> {
    this.permissions = DEFAULT_ROLE_PERMISSIONS;
    await this.savePermissions();
    return this.permissions;
  }
}

// Singleton instance
let rolePermissionsService: RolePermissionsService | null = null;

export function getRolePermissionsService(dataDir?: string): RolePermissionsService {
  if (!rolePermissionsService) {
    rolePermissionsService = new RolePermissionsService(dataDir);
  }
  return rolePermissionsService;
}
