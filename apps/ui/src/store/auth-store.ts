import { create } from 'zustand';
import type { UserRole, Permission, SafeUser } from '@automaker/types';
import { ROLE_PERMISSIONS, hasPermission } from '@automaker/types';
import { getServerUrlSync } from '@/lib/http-api-client';

interface AuthState {
  /** Whether we've attempted to determine auth status for this page load */
  authChecked: boolean;
  /** Whether the user is currently authenticated (web mode: valid session cookie) */
  isAuthenticated: boolean;
  /** Whether settings have been loaded and hydrated from server */
  settingsLoaded: boolean;
  /** AECORD: Current authenticated user info */
  user: SafeUser | null;
  /** AECORD: JWT token for API requests */
  token: string | null;
}

interface AuthActions {
  setAuthState: (state: Partial<AuthState>) => void;
  resetAuth: () => void;
  /** AECORD: Set the authenticated user */
  setUser: (user: SafeUser | null, token?: string | null) => void;
  /** AECORD: Check if user has a specific permission */
  checkPermission: (permission: Permission) => boolean;
  /** AECORD: Check if user has admin role */
  isAdmin: () => boolean;
  /** AECORD: Check if user can approve tasks */
  canApproveTasks: () => boolean;
  /** AECORD: Check if user can view a task (own service area or admin) */
  canViewTask: (taskServiceArea?: string) => boolean;
  /** AECORD: Login with credentials */
  login: (username: string, password: string) => Promise<boolean>;
  /** AECORD: Logout */
  logout: () => void;
  /** AECORD: Refresh current user from token */
  refreshUser: () => Promise<void>;
}

const initialState: AuthState = {
  authChecked: false,
  isAuthenticated: false,
  settingsLoaded: false,
  user: null,
  token: null,
};

// Storage key for token persistence
const TOKEN_STORAGE_KEY = 'aecord_auth_token';

/**
 * Web authentication state.
 *
 * Extended for AECORD multi-developer team with role-based access control.
 * Token is persisted to localStorage for session continuity.
 */
export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,
  setAuthState: (state) => {
    set({ ...state });
  },
  resetAuth: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set(initialState);
  },

  setUser: (user, token = null) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    set({
      user,
      token: token ?? get().token,
      isAuthenticated: !!user,
      authChecked: true,
    });
  },

  checkPermission: (permission: Permission) => {
    const { user } = get();
    if (!user) return false;
    return hasPermission(user.role, permission);
  },

  isAdmin: () => {
    const { user } = get();
    return user?.role === 'admin';
  },

  canApproveTasks: () => {
    return get().checkPermission('approve_tasks');
  },

  canViewTask: (taskServiceArea?: string) => {
    const { user } = get();
    if (!user) return false;
    // Admin can view all tasks
    if (user.role === 'admin') return true;
    // Developers can view tasks in their service area or unassigned tasks
    if (!taskServiceArea) return true;
    return user.serviceAreas?.includes(taskServiceArea) ?? false;
  },

  login: async (username: string, password: string) => {
    try {
      const serverUrl = getServerUrlSync();
      const response = await fetch(`${serverUrl}/api/user-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.token && data.user) {
        get().setUser(data.user, data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  refreshUser: async () => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      set({ authChecked: true });
      return;
    }

    try {
      const serverUrl = getServerUrlSync();
      const response = await fetch(`${serverUrl}/api/user-auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.user,
          token: storedToken,
          isAuthenticated: true,
          authChecked: true,
        });
      } else {
        // Token invalid or expired
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authChecked: true,
        });
      }
    } catch {
      set({ authChecked: true });
    }
  },
}));

/**
 * Hook to get current user's role
 */
export function useUserRole(): UserRole | null {
  return useAuthStore((state) => state.user?.role ?? null);
}

/**
 * Hook to check if current user has a permission
 */
export function useHasPermission(permission: Permission): boolean {
  const user = useAuthStore((state) => state.user);
  if (!user) return false;
  return hasPermission(user.role, permission);
}

/**
 * Hook to check if current user is admin
 */
export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.user?.role === 'admin');
}

/**
 * Hook to get user's service areas
 */
export function useServiceAreas(): string[] {
  return useAuthStore((state) => state.user?.serviceAreas ?? []);
}
