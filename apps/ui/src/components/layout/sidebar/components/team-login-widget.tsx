/**
 * AECORD Team Login Widget
 *
 * Shows login form when not authenticated, user info when logged in.
 * Placed in the sidebar footer for easy access.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import {
  Users,
  LogIn,
  LogOut,
  Shield,
  Code,
  Palette,
  Server,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Key,
  ArrowLeft,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getServerUrlSync } from '@/lib/http-api-client';

interface TeamLoginWidgetProps {
  sidebarOpen: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-amber-500' },
  'backend-dev': { label: 'Backend', icon: Server, color: 'text-blue-500' },
  'frontend-dev': { label: 'Frontend', icon: Palette, color: 'text-purple-500' },
  devops: { label: 'DevOps', icon: Code, color: 'text-green-500' },
};

// Password requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function validatePassword(password: string): { valid: boolean; checks: Record<string, boolean> } {
  const checks = {
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: new RegExp(
      `[${PASSWORD_REQUIREMENTS.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
    ).test(password),
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
  };
}

export function TeamLoginWidget({ sidebarOpen }: TeamLoginWidgetProps) {
  const { user, token, login, logout, refreshUser, authChecked } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Try to restore session on mount
  useEffect(() => {
    if (!authChecked) {
      refreshUser();
    }
  }, [authChecked, refreshUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const success = await login(username, password);

    if (success) {
      setUsername('');
      setPassword('');
      setIsExpanded(false);
    } else {
      setError('Invalid credentials');
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    logout();
    setIsExpanded(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError('New password does not meet requirements');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${getServerUrlSync()}/api/user-auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setPasswordChangeSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Auto-close after 2 seconds
        setTimeout(() => {
          setShowPasswordChange(false);
          setPasswordChangeSuccess(false);
        }, 2000);
      } else {
        setError(data.errors?.join(', ') || data.error || 'Failed to change password');
      }
    } catch {
      setError('Failed to change password');
    }

    setIsLoading(false);
  };

  const resetPasswordChangeForm = () => {
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setPasswordChangeSuccess(false);
  };

  const newPasswordValidation = validatePassword(newPassword);

  const roleConfig = user?.role ? ROLE_CONFIG[user.role] : null;
  const RoleIcon = roleConfig?.icon || User;

  // Collapsed state - just show icon
  if (!sidebarOpen) {
    return (
      <div className="p-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'group flex items-center justify-center w-full px-3 py-2.5 rounded-xl relative overflow-hidden',
            'transition-all duration-200 ease-out',
            user
              ? [
                  'bg-gradient-to-r from-brand-500/20 via-brand-500/15 to-brand-600/10',
                  'text-foreground',
                  'border border-brand-500/30',
                ]
              : [
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-accent/50',
                  'border border-transparent hover:border-border/40',
                ],
            'hover:scale-[1.02] active:scale-[0.97]'
          )}
          title={user ? `${user.username} (${roleConfig?.label})` : 'Team Login'}
        >
          {user ? (
            <RoleIcon className={cn('w-[18px] h-[18px]', roleConfig?.color)} />
          ) : (
            <Users className="w-[18px] h-[18px]" />
          )}
          {/* Tooltip */}
          <span
            className={cn(
              'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
              'bg-popover text-popover-foreground text-xs font-medium',
              'border border-border shadow-lg',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-200 whitespace-nowrap z-50',
              'translate-x-1 group-hover:translate-x-0'
            )}
          >
            {user ? `${user.username} (${roleConfig?.label})` : 'Team Login'}
          </span>
        </button>
      </div>
    );
  }

  // Expanded sidebar - full widget
  return (
    <div className="p-2">
      <div
        className={cn(
          'rounded-xl border transition-all duration-200',
          user
            ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent border-brand-500/20'
            : 'bg-muted/30 border-border/40'
        )}
      >
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center w-full px-3 py-2.5 rounded-xl',
            'transition-all duration-200',
            'hover:bg-accent/30'
          )}
        >
          {user ? (
            <>
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg',
                  'bg-gradient-to-br from-brand-500/20 to-brand-600/20',
                  'border border-brand-500/30'
                )}
              >
                <RoleIcon className={cn('w-4 h-4', roleConfig?.color)} />
              </div>
              <div className="ml-3 flex-1 text-left">
                <div className="text-sm font-medium truncate">{user.username}</div>
                <div className={cn('text-xs', roleConfig?.color)}>
                  {roleConfig?.label || user.role}
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg',
                  'bg-muted border border-border/50'
                )}
              >
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="ml-3 flex-1 text-left">
                <div className="text-sm font-medium text-muted-foreground">Team Login</div>
                <div className="text-xs text-muted-foreground/70">Sign in to collaborate</div>
              </div>
            </>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
            {user ? (
              // Logged in - show info, password change, and logout
              <div className="space-y-3">
                {showPasswordChange ? (
                  // Password change form
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={resetPasswordChangeForm}
                        className="p-1 rounded hover:bg-accent/50 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium">Change Password</span>
                    </div>

                    {error && (
                      <div className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md">
                        {error}
                      </div>
                    )}

                    {passwordChangeSuccess && (
                      <div className="text-xs text-green-500 bg-green-500/10 px-2 py-1.5 rounded-md flex items-center gap-2">
                        <Check className="w-3 h-3" />
                        Password changed successfully!
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 pr-10 rounded-lg text-sm',
                          'bg-background border border-border',
                          'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                          'placeholder:text-muted-foreground/50'
                        )}
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 pr-10 rounded-lg text-sm',
                          'bg-background border border-border',
                          'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                          'placeholder:text-muted-foreground/50'
                        )}
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Password requirements checklist */}
                    {newPassword && (
                      <div className="text-xs space-y-1 p-2 rounded-lg bg-muted/30">
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            newPasswordValidation.checks.minLength
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {newPasswordValidation.checks.minLength ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          At least 8 characters
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            newPasswordValidation.checks.hasUppercase
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {newPasswordValidation.checks.hasUppercase ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          One uppercase letter
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            newPasswordValidation.checks.hasLowercase
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {newPasswordValidation.checks.hasLowercase ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          One lowercase letter
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            newPasswordValidation.checks.hasNumber
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {newPasswordValidation.checks.hasNumber ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          One number
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            newPasswordValidation.checks.hasSpecial
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {newPasswordValidation.checks.hasSpecial ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          One special character
                        </div>
                      </div>
                    )}

                    <div>
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg text-sm',
                          'bg-background border border-border',
                          'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                          'placeholder:text-muted-foreground/50',
                          confirmPassword && newPassword !== confirmPassword && 'border-destructive'
                        )}
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isLoading ||
                        !newPasswordValidation.valid ||
                        newPassword !== confirmPassword ||
                        !currentPassword
                      }
                      className={cn(
                        'flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg',
                        'bg-brand-500 text-white',
                        'hover:bg-brand-600 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'text-sm font-medium'
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      {isLoading ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                ) : (
                  // Normal logged-in view
                  <>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-muted-foreground/70">Email:</span>
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.serviceAreas && user.serviceAreas.length > 0 && (
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-muted-foreground/70">Areas:</span>
                          <span className="truncate">{user.serviceAreas.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowPasswordChange(true)}
                      className={cn(
                        'flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg',
                        'bg-muted/50 text-foreground',
                        'border border-border',
                        'hover:bg-accent transition-colors',
                        'text-sm font-medium'
                      )}
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </button>
                    <button
                      onClick={handleLogout}
                      className={cn(
                        'flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg',
                        'bg-destructive/10 text-destructive',
                        'border border-destructive/20',
                        'hover:bg-destructive/20 transition-colors',
                        'text-sm font-medium'
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            ) : (
              // Not logged in - show login form
              <form onSubmit={handleLogin} className="space-y-3">
                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md">
                    {error}
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-background border border-border',
                      'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                      'placeholder:text-muted-foreground/50'
                    )}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-background border border-border',
                      'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                      'placeholder:text-muted-foreground/50'
                    )}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className={cn(
                    'flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg',
                    'bg-brand-500 text-white',
                    'hover:bg-brand-600 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'text-sm font-medium'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
