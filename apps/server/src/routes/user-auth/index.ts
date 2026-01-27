/**
 * User Auth Routes - JWT-based authentication for AECORD multi-developer team
 *
 * Provides endpoints for:
 * - Login with username/password -> JWT token
 * - Get current user info
 * - Refresh token
 * - Logout (optional, for audit purposes)
 *
 * Mounted at /api/user-auth in the main server (BEFORE auth middleware).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@automaker/utils';
import type { UserService } from '../../services/user-service.js';
import type { JWTService } from '../../services/jwt-service.js';
import { createJWTAuthMiddleware, createRequireJWTMiddleware } from '../../middleware/jwt-auth.js';

const logger = createLogger('UserAuthRoutes');

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 attempts per window

// Check if we're in test mode - disable rate limiting for E2E tests
const isTestMode = process.env.AUTOMAKER_MOCK_AGENT === 'true';

// In-memory rate limit tracking (resets on server restart)
const loginAttempts = new Map<string, { count: number; windowStart: number }>();

// Clean up old rate limit entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    loginAttempts.forEach((data, ip) => {
      if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        loginAttempts.delete(ip);
      }
    });
  },
  5 * 60 * 1000
);

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return forwardedIp.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Check if an IP is rate limited
 */
function checkRateLimit(ip: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt) {
    return { limited: false };
  }

  if (now - attempt.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { limited: false };
  }

  if (attempt.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - attempt.windowStart)) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

/**
 * Record a login attempt for rate limiting
 */
function recordLoginAttempt(ip: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now - attempt.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    attempt.count++;
  }
}

/**
 * Create user auth routes
 *
 * @param userService - User service for user management
 * @param jwtService - JWT service for token operations
 * @returns Express Router with user auth endpoints
 */
export function createUserAuthRoutes(userService: UserService, jwtService: JWTService): Router {
  const router = Router();

  // JWT middleware for protected routes
  const jwtAuth = createJWTAuthMiddleware(jwtService);
  const requireJWT = createRequireJWTMiddleware(jwtService);

  /**
   * POST /api/user-auth/login
   *
   * Authenticates user with username/password and returns JWT token.
   * Body: { username: string, password: string }
   *
   * Rate limited to 5 attempts per minute per IP.
   */
  router.post('/login', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

    // Skip rate limiting in test mode
    if (!isTestMode) {
      const rateLimit = checkRateLimit(clientIp);
      if (rateLimit.limited) {
        res.status(429).json({
          success: false,
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        });
        return;
      }
    }

    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
      return;
    }

    // Record this attempt (skip in test mode)
    if (!isTestMode) {
      recordLoginAttempt(clientIp);
    }

    try {
      const user = await userService.validateCredentials(username, password);

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password.',
        });
        return;
      }

      // Update last login timestamp
      await userService.updateLastLogin(user.id);

      // Generate JWT token
      const token = jwtService.generateToken(user);
      const expiresIn = jwtService.getExpiresInSeconds();

      // Return safe user data (without password hash)
      const { passwordHash, ...safeUser } = user;

      logger.info(`User logged in: ${user.username} (${user.role})`);

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        expiresIn,
        user: safeUser,
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred during login.',
      });
    }
  });

  /**
   * GET /api/user-auth/me
   *
   * Returns current user information.
   * Requires valid JWT token.
   */
  router.get('/me', requireJWT, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
        return;
      }

      const user = await userService.getSafeById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found.',
        });
        return;
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred.',
      });
    }
  });

  /**
   * POST /api/user-auth/refresh
   *
   * Refreshes the JWT token if the current one is still valid.
   * Requires valid JWT token.
   */
  router.post('/refresh', requireJWT, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Token required.',
        });
        return;
      }

      const oldToken = authHeader.substring(7);
      const newToken = jwtService.refreshToken(oldToken);

      if (!newToken) {
        res.status(401).json({
          success: false,
          error: 'Unable to refresh token.',
        });
        return;
      }

      const expiresIn = jwtService.getExpiresInSeconds();

      logger.debug(`Token refreshed for user: ${req.user?.username}`);

      res.json({
        success: true,
        message: 'Token refreshed.',
        token: newToken,
        expiresIn,
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred.',
      });
    }
  });

  /**
   * POST /api/user-auth/logout
   *
   * Logs out the user (for audit purposes).
   * Token invalidation is client-side (remove from storage).
   */
  router.post('/logout', jwtAuth, async (req: Request, res: Response) => {
    if (req.user) {
      logger.info(`User logged out: ${req.user.username}`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully. Please remove the token from your client.',
    });
  });

  /**
   * GET /api/user-auth/status
   *
   * Returns authentication status.
   * Similar to /api/auth/status but for JWT auth.
   */
  router.get('/status', jwtAuth, (req: Request, res: Response) => {
    res.json({
      success: true,
      authenticated: !!req.user,
      user: req.user
        ? {
            userId: req.user.userId,
            username: req.user.username,
            role: req.user.role,
          }
        : null,
    });
  });

  /**
   * POST /api/user-auth/change-password
   *
   * Change current user's password.
   * Requires current password verification.
   * Body: { currentPassword: string, newPassword: string }
   */
  router.post('/change-password', requireJWT, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required.',
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
        return;
      }

      const result = await userService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Password change failed.',
          errors: result.errors,
        });
        return;
      }

      logger.info(`Password changed for user: ${req.user.username}`);

      res.json({
        success: true,
        message: 'Password changed successfully.',
      });
    } catch (error) {
      logger.error('Password change error:', error);
      res.status(500).json({
        success: false,
        error: 'An error occurred while changing password.',
      });
    }
  });

  /**
   * GET /api/user-auth/password-requirements
   *
   * Returns password requirements for client-side validation.
   */
  router.get('/password-requirements', (req: Request, res: Response) => {
    res.json({
      success: true,
      requirements: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true,
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      },
    });
  });

  return router;
}
