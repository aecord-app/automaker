/**
 * User types for AECORD multi-developer team authentication and authorization
 */

/** User roles for access control */
export type UserRole = 'admin' | 'backend-dev' | 'frontend-dev' | 'devops';

/** User account stored in data/users.json */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string; // bcrypt hash
  role: UserRole;
  serviceAreas?: string[]; // Which services this user can work on (e.g., ['aecord-api', 'aecord-web'])
  createdAt: string; // ISO timestamp
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

/** JWT payload structure */
export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  serviceAreas: string[];
  iat: number; // issued at
  exp: number; // expires at
}

/** User without sensitive fields (for API responses) */
export type SafeUser = Omit<User, 'passwordHash'>;

/** Input for creating a new user */
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  serviceAreas?: string[];
}

/** Input for updating a user */
export interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  serviceAreas?: string[];
  isActive?: boolean;
}

/** Users storage file structure */
export interface UsersStorage {
  version: number;
  users: User[];
}

/** Role-permission mapping */
export type Permission =
  | 'approve_tasks'
  | 'reject_tasks'
  | 'view_all_tasks'
  | 'edit_pipeline'
  | 'manage_users'
  | 'assign_tasks';

/** Role to permissions mapping */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'approve_tasks',
    'reject_tasks',
    'view_all_tasks',
    'edit_pipeline',
    'manage_users',
    'assign_tasks',
  ],
  'backend-dev': ['view_all_tasks'],
  'frontend-dev': ['view_all_tasks'],
  devops: ['view_all_tasks', 'edit_pipeline'],
};

/** Check if a role has a specific permission */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Default storage for users */
export const DEFAULT_USERS_STORAGE: UsersStorage = {
  version: 1,
  users: [],
};

/** Users storage version */
export const USERS_STORAGE_VERSION = 1;
