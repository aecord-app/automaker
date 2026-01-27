/**
 * AECORD Conflict Detection Service
 *
 * Manages file locks to prevent concurrent modifications to the same files
 * by multiple developers or tasks.
 */

import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import type {
  FileLock,
  FileConflict,
  ConflictCheckResult,
  AcquireLocksResult,
  FileLocksStorage,
  LockType,
} from '@automaker/types';
import {
  DEFAULT_LOCK_DURATION_MINUTES,
  MAX_LOCK_DURATION_MINUTES,
  FILE_LOCKS_VERSION,
} from '@automaker/types';
import { createLogger, atomicWriteJson, DEFAULT_BACKUP_COUNT } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';
import type { FeatureLoader } from './feature-loader.js';
import type { UserService } from './user-service.js';

const logger = createLogger('ConflictService');

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

export class ConflictService extends EventEmitter {
  private dataDir: string;
  private featureLoader: FeatureLoader;
  private userService: UserService;
  private locks: Map<string, FileLock> = new Map(); // keyed by lock ID
  private fileIndex: Map<string, Set<string>> = new Map(); // filePath -> Set of lock IDs
  private initialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(dataDir: string, featureLoader: FeatureLoader, userService: UserService) {
    super();
    this.dataDir = dataDir;
    this.featureLoader = featureLoader;
    this.userService = userService;
  }

  /**
   * Initialize the service - load locks from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const filePath = this.getLocksFilePath();
    const stored = await readJsonFile<FileLocksStorage>(filePath, {
      version: FILE_LOCKS_VERSION,
      locks: [],
    });

    // Load locks and build index
    const now = new Date();
    for (const lock of stored.locks) {
      // Skip expired locks
      if (new Date(lock.expiresAt) <= now) {
        continue;
      }

      this.locks.set(lock.id, lock);
      this.indexLock(lock);
    }

    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredLocks();
      },
      5 * 60 * 1000
    );

    logger.info(`Loaded ${this.locks.size} active file locks`);
    this.initialized = true;
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check for conflicts before starting a task
   */
  async checkConflicts(
    projectPath: string,
    featureId: string,
    files: string[]
  ): Promise<ConflictCheckResult> {
    const conflicts: FileConflict[] = [];
    const availableFiles: string[] = [];

    for (const filePath of files) {
      const normalizedPath = this.normalizePath(projectPath, filePath);
      const lockIds = this.fileIndex.get(normalizedPath);

      if (!lockIds || lockIds.size === 0) {
        availableFiles.push(filePath);
        continue;
      }

      // Check each lock on this file
      let hasConflict = false;
      for (const lockId of lockIds) {
        const lock = this.locks.get(lockId);
        if (!lock) continue;

        // Same feature can access its own locks
        if (lock.featureId === featureId) {
          continue;
        }

        // Expired locks don't count
        if (new Date(lock.expiresAt) <= new Date()) {
          continue;
        }

        // Found a conflict
        hasConflict = true;

        // Get feature title
        let featureTitle: string | undefined;
        try {
          const feature = await this.featureLoader.get(lock.projectPath, lock.featureId);
          featureTitle = feature?.title || feature?.description?.slice(0, 50);
        } catch {
          // Ignore errors fetching feature
        }

        conflicts.push({
          filePath,
          lockedByFeatureId: lock.featureId,
          lockedByFeatureTitle: featureTitle,
          lockedByUserId: lock.lockedBy,
          lockedByUsername: lock.lockedByUsername,
          lockedAt: lock.acquiredAt,
          expiresAt: lock.expiresAt,
        });
        break; // One conflict per file is enough
      }

      if (!hasConflict) {
        availableFiles.push(filePath);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      availableFiles,
    };
  }

  /**
   * Acquire locks for files
   */
  async acquireLocks(
    projectPath: string,
    featureId: string,
    userId: string,
    files: string[],
    lockType: LockType = 'exclusive',
    durationMinutes: number = DEFAULT_LOCK_DURATION_MINUTES
  ): Promise<AcquireLocksResult> {
    // Validate duration
    const duration = Math.min(Math.max(1, durationMinutes), MAX_LOCK_DURATION_MINUTES);

    // Check for conflicts first
    const conflictCheck = await this.checkConflicts(projectPath, featureId, files);

    if (conflictCheck.hasConflicts && lockType === 'exclusive') {
      return {
        success: false,
        acquiredLocks: [],
        conflicts: conflictCheck.conflicts,
      };
    }

    // Get user info
    const user = await this.userService.getById(userId);
    const username = user?.username || 'Unknown';

    // Acquire locks for available files
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 60 * 1000);
    const acquiredLocks: FileLock[] = [];

    for (const filePath of conflictCheck.availableFiles) {
      const normalizedPath = this.normalizePath(projectPath, filePath);

      // Check if we already have a lock on this file
      const existingLockId = this.findExistingLock(normalizedPath, featureId);
      if (existingLockId) {
        // Extend existing lock
        const existingLock = this.locks.get(existingLockId);
        if (existingLock) {
          existingLock.expiresAt = expiresAt.toISOString();
          acquiredLocks.push(existingLock);
          continue;
        }
      }

      // Create new lock
      const lock: FileLock = {
        id: `lock-${crypto.randomUUID()}`,
        filePath: normalizedPath,
        featureId,
        lockedBy: userId,
        lockedByUsername: username,
        lockType,
        acquiredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        projectPath,
      };

      this.locks.set(lock.id, lock);
      this.indexLock(lock);
      acquiredLocks.push(lock);
    }

    // Save to disk
    await this.saveLocks();

    logger.info(
      `Acquired ${acquiredLocks.length} locks for feature ${featureId} by user ${username}`
    );
    this.emit('locks:acquired', { featureId, locks: acquiredLocks });

    return {
      success: conflictCheck.conflicts.length === 0,
      acquiredLocks,
      conflicts: conflictCheck.conflicts,
    };
  }

  /**
   * Release all locks for a feature
   */
  async releaseLocks(featureId: string): Promise<number> {
    const releasedLocks: FileLock[] = [];

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.featureId === featureId) {
        this.locks.delete(lockId);
        this.removeFromIndex(lock);
        releasedLocks.push(lock);
      }
    }

    if (releasedLocks.length > 0) {
      await this.saveLocks();
      logger.info(`Released ${releasedLocks.length} locks for feature ${featureId}`);
      this.emit('locks:released', { featureId, count: releasedLocks.length });
    }

    return releasedLocks.length;
  }

  /**
   * Release a specific lock
   */
  async releaseLock(lockId: string, userId: string): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }

    // Only the lock owner or admin can release
    const user = await this.userService.getById(userId);
    if (lock.lockedBy !== userId && user?.role !== 'admin') {
      throw new Error('Only the lock owner or admin can release this lock');
    }

    this.locks.delete(lockId);
    this.removeFromIndex(lock);
    await this.saveLocks();

    logger.info(`Released lock ${lockId} for file ${lock.filePath}`);
    this.emit('lock:released', { lock });

    return true;
  }

  /**
   * Get all locks for a feature
   */
  getLocksForFeature(featureId: string): FileLock[] {
    return Array.from(this.locks.values()).filter((lock) => lock.featureId === featureId);
  }

  /**
   * Get all locks for a project
   */
  getLocksForProject(projectPath: string): FileLock[] {
    return Array.from(this.locks.values()).filter((lock) => lock.projectPath === projectPath);
  }

  /**
   * Get all active locks
   */
  getAllLocks(): FileLock[] {
    return Array.from(this.locks.values());
  }

  /**
   * Get lock statistics
   */
  getStats(): {
    totalLocks: number;
    byProject: Record<string, number>;
    byUser: Record<string, number>;
  } {
    const byProject: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const lock of this.locks.values()) {
      byProject[lock.projectPath] = (byProject[lock.projectPath] || 0) + 1;
      byUser[lock.lockedByUsername] = (byUser[lock.lockedByUsername] || 0) + 1;
    }

    return {
      totalLocks: this.locks.size,
      byProject,
      byUser,
    };
  }

  /**
   * Extend lock expiration
   */
  async extendLock(
    lockId: string,
    userId: string,
    additionalMinutes: number
  ): Promise<FileLock | null> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return null;
    }

    // Only the lock owner can extend
    if (lock.lockedBy !== userId) {
      throw new Error('Only the lock owner can extend this lock');
    }

    // Calculate new expiration
    const currentExpires = new Date(lock.expiresAt);
    const newExpires = new Date(currentExpires.getTime() + additionalMinutes * 60 * 1000);

    // Enforce maximum duration from original acquisition
    const acquiredAt = new Date(lock.acquiredAt);
    const maxExpires = new Date(acquiredAt.getTime() + MAX_LOCK_DURATION_MINUTES * 60 * 1000);

    lock.expiresAt = (newExpires < maxExpires ? newExpires : maxExpires).toISOString();
    await this.saveLocks();

    logger.info(`Extended lock ${lockId} to ${lock.expiresAt}`);
    this.emit('lock:extended', { lock });

    return lock;
  }

  /**
   * Force release a lock (admin only)
   */
  async forceReleaseLock(lockId: string): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }

    this.locks.delete(lockId);
    this.removeFromIndex(lock);
    await this.saveLocks();

    logger.info(`Force released lock ${lockId} for file ${lock.filePath}`);
    this.emit('lock:force-released', { lock });

    return true;
  }

  /**
   * Cleanup expired locks
   */
  private async cleanupExpiredLocks(): Promise<void> {
    const now = new Date();
    const expiredLocks: FileLock[] = [];

    for (const [lockId, lock] of this.locks.entries()) {
      if (new Date(lock.expiresAt) <= now) {
        this.locks.delete(lockId);
        this.removeFromIndex(lock);
        expiredLocks.push(lock);
      }
    }

    if (expiredLocks.length > 0) {
      await this.saveLocks();
      logger.info(`Cleaned up ${expiredLocks.length} expired locks`);
      this.emit('locks:expired', { locks: expiredLocks });
    }
  }

  /**
   * Normalize file path for consistent comparison
   */
  private normalizePath(projectPath: string, filePath: string): string {
    // Remove project path prefix if present
    let normalized = filePath;
    if (filePath.startsWith(projectPath)) {
      normalized = filePath.slice(projectPath.length);
    }

    // Normalize separators and remove leading slash
    normalized = normalized.replace(/\\/g, '/');
    if (normalized.startsWith('/')) {
      normalized = normalized.slice(1);
    }

    return `${projectPath}:${normalized}`;
  }

  /**
   * Add lock to file index
   */
  private indexLock(lock: FileLock): void {
    let lockIds = this.fileIndex.get(lock.filePath);
    if (!lockIds) {
      lockIds = new Set();
      this.fileIndex.set(lock.filePath, lockIds);
    }
    lockIds.add(lock.id);
  }

  /**
   * Remove lock from file index
   */
  private removeFromIndex(lock: FileLock): void {
    const lockIds = this.fileIndex.get(lock.filePath);
    if (lockIds) {
      lockIds.delete(lock.id);
      if (lockIds.size === 0) {
        this.fileIndex.delete(lock.filePath);
      }
    }
  }

  /**
   * Find existing lock for a file by feature
   */
  private findExistingLock(filePath: string, featureId: string): string | null {
    const lockIds = this.fileIndex.get(filePath);
    if (!lockIds) return null;

    for (const lockId of lockIds) {
      const lock = this.locks.get(lockId);
      if (lock && lock.featureId === featureId) {
        return lockId;
      }
    }

    return null;
  }

  /**
   * Save locks to disk
   */
  private async saveLocks(): Promise<void> {
    const storage: FileLocksStorage = {
      version: FILE_LOCKS_VERSION,
      locks: Array.from(this.locks.values()),
    };

    await writeJsonFile(this.getLocksFilePath(), storage);
  }

  /**
   * Get the locks file path
   */
  private getLocksFilePath(): string {
    return path.join(this.dataDir, 'file-locks.json');
  }
}
