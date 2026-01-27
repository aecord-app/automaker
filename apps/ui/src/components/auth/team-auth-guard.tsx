/**
 * AECORD Team Authentication Guard
 *
 * Requires team login before accessing the application.
 * Shows a full-page login screen when not authenticated.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { Users, LogIn, Loader2, Shield, Code, Palette, Server, AlertCircle } from 'lucide-react';

interface TeamAuthGuardProps {
  children: React.ReactNode;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  admin: {
    label: 'Administrator',
    icon: Shield,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  'backend-dev': {
    label: 'Backend Developer',
    icon: Server,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  'frontend-dev': {
    label: 'Frontend Developer',
    icon: Palette,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  devops: {
    label: 'DevOps Engineer',
    icon: Code,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
};

export function TeamAuthGuard({ children }: TeamAuthGuardProps) {
  const { user, login, refreshUser, authChecked } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Try to restore team session on mount
  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setIsInitializing(false);
    };
    init();
  }, [refreshUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const success = await login(username, password);

    if (success) {
      setUsername('');
      setPassword('');
    } else {
      setError('Invalid username or password');
    }
    setIsLoading(false);
  };

  // Show loading while initializing
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User is authenticated - show children
  if (user) {
    return <>{children}</>;
  }

  // Show full-page team login
  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 bg-gradient-to-br from-brand-500/10 via-brand-600/5 to-transparent border-r border-border/40">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Code className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            AECORD AutoMaker
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            AI-powered development platform for the AECORD team
          </p>

          {/* Team roles */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {Object.entries(ROLE_CONFIG).map(([role, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={role}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg',
                    config.bgColor,
                    'border border-border/30'
                  )}
                >
                  <Icon className={cn('w-4 h-4', config.color)} />
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Code className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">AECORD</span>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Team Login</h2>
            <p className="text-muted-foreground">Sign in with your AECORD team credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg text-sm',
                  'bg-background border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                  'placeholder:text-muted-foreground/50',
                  'transition-all duration-200'
                )}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg text-sm',
                  'bg-background border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
                  'placeholder:text-muted-foreground/50',
                  'transition-all duration-200'
                )}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className={cn(
                'flex items-center justify-center w-full gap-2 px-4 py-3 rounded-lg',
                'bg-brand-500 text-white font-medium',
                'hover:bg-brand-600 transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30',
                'hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Contact your administrator if you need access credentials
          </p>
        </div>
      </div>
    </div>
  );
}
