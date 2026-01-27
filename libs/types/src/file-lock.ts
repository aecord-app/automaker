/**
 * AECORD File Lock Types
 *
 * Types for file locking and conflict detection in multi-developer workflows.
 */

/**
 * Type of file lock
 */
export type LockType = 'exclusive' | 'shared';

/**
 * A single file lock
 */
export interface FileLock {
  /** Unique lock ID */
  id: string;
  /** Path to the locked file (relative to project root) */
  filePath: string;
  /** Feature ID that holds the lock */
  featureId: string;
  /** User ID who acquired the lock */
  lockedBy: string;
  /** Username for display */
  lockedByUsername: string;
  /** Type of lock */
  lockType: LockType;
  /** When the lock was acquired */
  acquiredAt: string;
  /** When the lock expires (for auto-cleanup) */
  expiresAt: string;
  /** Project path */
  projectPath: string;
}

/**
 * Result of a conflict check
 */
export interface ConflictCheckResult {
  /** Whether there are any conflicts */
  hasConflicts: boolean;
  /** List of conflicting files with details */
  conflicts: FileConflict[];
  /** Files that are available (no conflicts) */
  availableFiles: string[];
}

/**
 * Details about a file conflict
 */
export interface FileConflict {
  /** Path to the conflicting file */
  filePath: string;
  /** Feature ID that holds the lock */
  lockedByFeatureId: string;
  /** Feature description/title */
  lockedByFeatureTitle?: string;
  /** User ID who holds the lock */
  lockedByUserId: string;
  /** Username who holds the lock */
  lockedByUsername: string;
  /** When the lock was acquired */
  lockedAt: string;
  /** When the lock expires */
  expiresAt: string;
}

/**
 * Request to acquire locks
 */
export interface AcquireLocksRequest {
  /** Project path */
  projectPath: string;
  /** Feature ID requesting the locks */
  featureId: string;
  /** Files to lock */
  files: string[];
  /** Lock type (default: exclusive) */
  lockType?: LockType;
  /** Lock duration in minutes (default: 60) */
  durationMinutes?: number;
}

/**
 * Result of acquiring locks
 */
export interface AcquireLocksResult {
  /** Whether all locks were acquired */
  success: boolean;
  /** Locks that were acquired */
  acquiredLocks: FileLock[];
  /** Conflicts that prevented acquisition */
  conflicts: FileConflict[];
}

/**
 * File lock storage format
 */
export interface FileLocksStorage {
  version: 1;
  locks: FileLock[];
}

/**
 * Default lock duration in minutes
 */
export const DEFAULT_LOCK_DURATION_MINUTES = 60;

/**
 * Maximum lock duration in minutes
 */
export const MAX_LOCK_DURATION_MINUTES = 480; // 8 hours

/**
 * Default file locks storage
 */
export const DEFAULT_FILE_LOCKS_STORAGE: FileLocksStorage = {
  version: 1,
  locks: [],
};

export const FILE_LOCKS_VERSION = 1;
