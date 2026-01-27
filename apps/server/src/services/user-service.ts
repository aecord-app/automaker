/**
 * UserService - Manages user accounts and authentication for AECORD multi-developer team
 *
 * Storage: data/users.json (atomic writes with backup)
 */

import path from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createLogger, atomicWriteJson, DEFAULT_BACKUP_COUNT } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';
import type {
  User,
  SafeUser,
  CreateUserInput,
  UpdateUserInput,
  UsersStorage,
  UserRole,
} from '@automaker/types';
import { DEFAULT_USERS_STORAGE, USERS_STORAGE_VERSION } from '@automaker/types';

const logger = createLogger('UserService');

const BCRYPT_ROUNDS = 12;

/**
 * Password validation rules (strict protocol)
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Validate password against strict requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial) {
    const specialRegex = new RegExp(
      `[${PASSWORD_REQUIREMENTS.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
    );
    if (!specialRegex.test(password)) {
      errors.push(
        'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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

/**
 * Remove sensitive fields from user object
 */
function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * UserService - Manages user accounts and authentication
 */
export class UserService {
  private dataDir: string;
  private usersPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.usersPath = path.join(dataDir, 'users.json');
  }

  /**
   * Initialize the service and create default admin user if needed
   */
  async initialize(): Promise<void> {
    const storage = await this.getStorage();

    // Create default admin user if no users exist
    if (storage.users.length === 0) {
      logger.info('No users found, creating default admin user...');

      // Generate a random password for security
      const defaultPassword = crypto.randomBytes(16).toString('hex');

      await this.create({
        username: 'admin',
        email: 'admin@aecord.com',
        password: defaultPassword,
        role: 'admin',
        serviceAreas: ['*'], // Admin has access to all service areas
      });

      // Log the password so admin can use it (only shown once)
      const BOX_CONTENT_WIDTH = 67;
      const header = 'Default Admin User Created'.padEnd(BOX_CONTENT_WIDTH);
      const line1 = 'Username: admin'.padEnd(BOX_CONTENT_WIDTH);
      const line2 = `Password: ${defaultPassword}`.padEnd(BOX_CONTENT_WIDTH);
      const line3 = ''.padEnd(BOX_CONTENT_WIDTH);
      const line4 = 'IMPORTANT: Save this password! It will not be shown again.'.padEnd(
        BOX_CONTENT_WIDTH
      );
      const line5 = 'You can change it later via the admin interface.'.padEnd(BOX_CONTENT_WIDTH);

      logger.info(`
╔═════════════════════════════════════════════════════════════════════╗
║  ${header}║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ${line1}║
║  ${line2}║
║  ${line3}║
║  ${line4}║
║  ${line5}║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
`);
    }
  }

  /**
   * Get the users storage
   */
  private async getStorage(): Promise<UsersStorage> {
    return readJsonFile<UsersStorage>(this.usersPath, DEFAULT_USERS_STORAGE);
  }

  /**
   * Save the users storage
   */
  private async saveStorage(storage: UsersStorage): Promise<void> {
    // Ensure data directory exists
    await secureFs.mkdir(path.dirname(this.usersPath), { recursive: true });
    await writeJsonFile(this.usersPath, storage);
  }

  /**
   * Get all users (without sensitive data)
   */
  async getAll(): Promise<SafeUser[]> {
    const storage = await this.getStorage();
    return storage.users.map(toSafeUser);
  }

  /**
   * Get user by ID (with password hash for internal use)
   */
  async getById(userId: string): Promise<User | null> {
    const storage = await this.getStorage();
    return storage.users.find((u) => u.id === userId) || null;
  }

  /**
   * Get user by ID (without sensitive data)
   */
  async getSafeById(userId: string): Promise<SafeUser | null> {
    const user = await this.getById(userId);
    return user ? toSafeUser(user) : null;
  }

  /**
   * Get user by username (with password hash for internal use)
   */
  async getByUsername(username: string): Promise<User | null> {
    const storage = await this.getStorage();
    return storage.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  /**
   * Get user by email (with password hash for internal use)
   */
  async getByEmail(email: string): Promise<User | null> {
    const storage = await this.getStorage();
    return storage.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<SafeUser> {
    const storage = await this.getStorage();

    // Check for duplicate username
    if (storage.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
      throw new Error(`Username "${input.username}" already exists`);
    }

    // Check for duplicate email
    if (storage.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`Email "${input.email}" already exists`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const now = new Date().toISOString();
    const user: User = {
      id: generateUserId(),
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role,
      serviceAreas: input.serviceAreas || [],
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    storage.users.push(user);
    storage.version = USERS_STORAGE_VERSION;
    await this.saveStorage(storage);

    logger.info(`User created: ${user.username} (${user.role})`);
    return toSafeUser(user);
  }

  /**
   * Update an existing user
   */
  async update(userId: string, updates: UpdateUserInput): Promise<SafeUser> {
    const storage = await this.getStorage();
    const userIndex = storage.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error(`User not found: ${userId}`);
    }

    const user = storage.users[userIndex];

    // Check for duplicate username if updating
    if (
      updates.username &&
      updates.username.toLowerCase() !== user.username.toLowerCase() &&
      storage.users.some((u) => u.username.toLowerCase() === updates.username!.toLowerCase())
    ) {
      throw new Error(`Username "${updates.username}" already exists`);
    }

    // Check for duplicate email if updating
    if (
      updates.email &&
      updates.email.toLowerCase() !== user.email.toLowerCase() &&
      storage.users.some((u) => u.email.toLowerCase() === updates.email!.toLowerCase())
    ) {
      throw new Error(`Email "${updates.email}" already exists`);
    }

    // Update fields
    if (updates.username) user.username = updates.username;
    if (updates.email) user.email = updates.email;
    if (updates.role) user.role = updates.role;
    if (updates.serviceAreas !== undefined) user.serviceAreas = updates.serviceAreas;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    // Update password if provided
    if (updates.password) {
      user.passwordHash = await bcrypt.hash(updates.password, BCRYPT_ROUNDS);
    }

    user.updatedAt = new Date().toISOString();

    storage.users[userIndex] = user;
    await this.saveStorage(storage);

    logger.info(`User updated: ${user.username}`);
    return toSafeUser(user);
  }

  /**
   * Delete a user
   */
  async delete(userId: string): Promise<boolean> {
    const storage = await this.getStorage();
    const userIndex = storage.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return false;
    }

    const user = storage.users[userIndex];

    // Prevent deleting the last admin
    const adminCount = storage.users.filter((u) => u.role === 'admin' && u.isActive).length;
    if (user.role === 'admin' && adminCount <= 1) {
      throw new Error('Cannot delete the last active admin user');
    }

    storage.users.splice(userIndex, 1);
    await this.saveStorage(storage);

    logger.info(`User deleted: ${user.username}`);
    return true;
  }

  /**
   * Validate user credentials and return user if valid
   */
  async validateCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.getByUsername(username);

    if (!user) {
      // Still hash something to prevent timing attacks
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const storage = await this.getStorage();
    const user = storage.users.find((u) => u.id === userId);

    if (user) {
      user.lastLoginAt = new Date().toISOString();
      await this.saveStorage(storage);
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<SafeUser[]> {
    const storage = await this.getStorage();
    return storage.users.filter((u) => u.role === role && u.isActive).map(toSafeUser);
  }

  /**
   * Check if user can access a feature based on their service areas
   */
  canAccessServiceArea(user: SafeUser, serviceArea: string): boolean {
    // Admin or users with wildcard access can access everything
    if (user.role === 'admin' || user.serviceAreas?.includes('*')) {
      return true;
    }

    // Check if user has access to the specific service area
    return user.serviceAreas?.includes(serviceArea) ?? false;
  }

  /**
   * Change user password with validation
   * Requires current password verification
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    const user = await this.getById(userId);

    if (!user) {
      return { success: false, errors: ['User not found'] };
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return { success: false, errors: ['Current password is incorrect'] };
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Check new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return { success: false, errors: ['New password must be different from current password'] };
    }

    // Update password
    const storage = await this.getStorage();
    const userIndex = storage.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return { success: false, errors: ['User not found'] };
    }

    storage.users[userIndex].passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    storage.users[userIndex].updatedAt = new Date().toISOString();
    await this.saveStorage(storage);

    logger.info(`Password changed for user: ${user.username}`);
    return { success: true };
  }

  /**
   * Admin reset password (no current password required)
   */
  async adminResetPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    const user = await this.getById(userId);

    if (!user) {
      return { success: false, errors: ['User not found'] };
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Update password
    const storage = await this.getStorage();
    const userIndex = storage.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return { success: false, errors: ['User not found'] };
    }

    storage.users[userIndex].passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    storage.users[userIndex].updatedAt = new Date().toISOString();
    await this.saveStorage(storage);

    logger.info(`Password reset by admin for user: ${user.username}`);
    return { success: true };
  }
}
