/**
 * AECORD Agent Profile Service
 *
 * Manages agent profiles for specialized AI configurations.
 * Profiles determine model, planning mode, system prompt, and other settings
 * based on task type and service area.
 */

import path from 'path';
import { EventEmitter } from 'events';
import type {
  AgentProfile,
  AgentProfilesStorage,
  AgentSpecialist,
  TaskType,
} from '@automaker/types';
import {
  DEFAULT_AGENT_PROFILES,
  AGENT_PROFILES_VERSION,
  getRecommendedProfile,
  buildSystemPrompt,
} from '@automaker/types';
import { createLogger, atomicWriteJson, DEFAULT_BACKUP_COUNT } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';

const logger = createLogger('AgentProfileService');

/**
 * Read JSON file with fallback to default value
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = (await secureFs.readFile(filePath, 'utf-8')) as string;
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    logger.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Write JSON file atomically with backup support
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await atomicWriteJson(filePath, data, { backupCount: DEFAULT_BACKUP_COUNT });
}

export class AgentProfileService extends EventEmitter {
  private dataDir: string;
  private profiles: AgentProfile[] = [];
  private initialized = false;

  constructor(dataDir: string) {
    super();
    this.dataDir = dataDir;
  }

  /**
   * Initialize the service - load profiles from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const filePath = this.getProfilesFilePath();
    const defaultStorage: AgentProfilesStorage = {
      version: 1,
      profiles: [],
    };
    const stored = await readJsonFile<AgentProfilesStorage>(filePath, defaultStorage);

    if (stored && stored.version === AGENT_PROFILES_VERSION && stored.profiles.length > 0) {
      this.profiles = stored.profiles;
      logger.info(`Loaded ${this.profiles.length} agent profiles`);
    } else {
      // Initialize with defaults
      this.profiles = [...DEFAULT_AGENT_PROFILES];
      await this.saveProfiles();
      logger.info('Initialized agent profiles with defaults');
    }

    this.initialized = true;
  }

  /**
   * Get all profiles
   */
  getAll(): AgentProfile[] {
    return [...this.profiles];
  }

  /**
   * Get active profiles only
   */
  getActive(): AgentProfile[] {
    return this.profiles.filter((p) => p.isActive);
  }

  /**
   * Get a profile by ID
   */
  getById(id: string): AgentProfile | null {
    return this.profiles.find((p) => p.id === id) || null;
  }

  /**
   * Get profiles by specialist type
   */
  getBySpecialist(specialist: AgentSpecialist): AgentProfile[] {
    return this.profiles.filter((p) => p.specialist === specialist);
  }

  /**
   * Get the recommended profile for a task
   */
  getRecommended(taskType: TaskType, serviceArea?: string): AgentProfile | null {
    return getRecommendedProfile(taskType, serviceArea, this.profiles);
  }

  /**
   * Build the system prompt for a profile
   */
  buildPrompt(profileId: string): string | null {
    const profile = this.getById(profileId);
    if (!profile) return null;
    return buildSystemPrompt(profile);
  }

  /**
   * Create a new profile
   */
  async create(input: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentProfile> {
    const now = new Date().toISOString();
    const profile: AgentProfile = {
      ...input,
      id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.push(profile);
    await this.saveProfiles();

    logger.info(`Created agent profile: ${profile.name} (${profile.id})`);
    this.emit('profile:created', profile);

    return profile;
  }

  /**
   * Update a profile
   */
  async update(
    id: string,
    updates: Partial<Omit<AgentProfile, 'id' | 'createdAt'>>
  ): Promise<AgentProfile | null> {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const profile = this.profiles[index];
    const updated: AgentProfile = {
      ...profile,
      ...updates,
      id: profile.id,
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.profiles[index] = updated;
    await this.saveProfiles();

    logger.info(`Updated agent profile: ${updated.name} (${updated.id})`);
    this.emit('profile:updated', updated);

    return updated;
  }

  /**
   * Delete a profile (soft delete by deactivating, or hard delete)
   */
  async delete(id: string, hard = false): Promise<boolean> {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return false;

    const profile = this.profiles[index];

    // Don't allow deleting default profiles (only deactivate)
    if (profile.isDefault && hard) {
      logger.warn(`Cannot hard delete default profile: ${profile.name}`);
      return false;
    }

    if (hard) {
      this.profiles.splice(index, 1);
      logger.info(`Hard deleted agent profile: ${profile.name} (${id})`);
    } else {
      this.profiles[index] = {
        ...profile,
        isActive: false,
        updatedAt: new Date().toISOString(),
      };
      logger.info(`Deactivated agent profile: ${profile.name} (${id})`);
    }

    await this.saveProfiles();
    this.emit('profile:deleted', { id, hard });

    return true;
  }

  /**
   * Activate a profile
   */
  async activate(id: string): Promise<AgentProfile | null> {
    return this.update(id, { isActive: true });
  }

  /**
   * Deactivate a profile
   */
  async deactivate(id: string): Promise<AgentProfile | null> {
    return this.update(id, { isActive: false });
  }

  /**
   * Reset to default profiles
   */
  async resetToDefaults(): Promise<void> {
    this.profiles = [...DEFAULT_AGENT_PROFILES];
    await this.saveProfiles();
    logger.info('Reset agent profiles to defaults');
    this.emit('profiles:reset');
  }

  /**
   * Get profile statistics
   */
  getStats(): {
    total: number;
    active: number;
    bySpecialist: Record<AgentSpecialist, number>;
    byTaskType: Record<TaskType, number>;
  } {
    const bySpecialist: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};

    for (const profile of this.profiles) {
      bySpecialist[profile.specialist] = (bySpecialist[profile.specialist] || 0) + 1;
      for (const taskType of profile.applicableTaskTypes) {
        byTaskType[taskType] = (byTaskType[taskType] || 0) + 1;
      }
    }

    return {
      total: this.profiles.length,
      active: this.profiles.filter((p) => p.isActive).length,
      bySpecialist: bySpecialist as Record<AgentSpecialist, number>,
      byTaskType: byTaskType as Record<TaskType, number>,
    };
  }

  /**
   * Clone a profile with a new name
   */
  async clone(id: string, newName: string): Promise<AgentProfile | null> {
    const source = this.getById(id);
    if (!source) return null;

    const cloned = await this.create({
      ...source,
      name: newName,
      isDefault: false,
    });

    logger.info(`Cloned profile ${source.name} as ${newName}`);
    return cloned;
  }

  /**
   * Save profiles to disk
   */
  private async saveProfiles(): Promise<void> {
    const storage: AgentProfilesStorage = {
      version: AGENT_PROFILES_VERSION,
      profiles: this.profiles,
    };

    await writeJsonFile(this.getProfilesFilePath(), storage);
  }

  /**
   * Get the profiles file path
   */
  private getProfilesFilePath(): string {
    return path.join(this.dataDir, 'agent-profiles.json');
  }
}
