/**
 * JWT Authentication Middleware for AECORD multi-developer team
 *
 * Extracts and validates JWT tokens from the Authorization header.
 * Falls back to existing session-based auth for backward compatibility.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@automaker/utils';
import type { JWTPayload } from '@automaker/types';
import type { JWTService } from '../services/jwt-service.js';

const logger = createLogger('JWTAuthMiddleware');

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Create JWT authentication middleware
 *
 * If a valid JWT token is found in the Authorization header, it sets req.user.
 * If no token is provided or token is invalid, it passes through to allow
 * fallback to existing auth methods (API key, session cookie).
 */
export function createJWTAuthMiddleware(jwtService: JWTService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    // No Authorization header, let other auth methods handle it
    if (!authHeader) {
      next();
      return;
    }

    // Check for Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      // Not a JWT token, let other auth methods handle it
      next();
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token
    const payload = jwtService.verifyToken(token);

    if (!payload) {
      // Invalid token - don't pass through, return error
      // This prevents using an invalid token as a "fallback"
      logger.debug('Invalid JWT token received');
      next();
      return;
    }

    // Attach user info to request
    req.user = payload;
    logger.debug(`JWT authenticated user: ${payload.username} (${payload.role})`);

    next();
  };
}

/**
 * Middleware that requires JWT authentication (no fallback to other auth)
 *
 * Use this for endpoints that MUST have a JWT token.
 */
export function createRequireJWTMiddleware(jwtService: JWTService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Missing Authorization header',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Invalid Authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Please log in again to get a new token',
      });
      return;
    }

    req.user = payload;
    next();
  };
}

/**
 * Extract JWT payload from request (if available)
 */
export function getJWTUser(req: Request): JWTPayload | undefined {
  return req.user;
}

/**
 * Check if request has a valid JWT user
 */
export function isJWTAuthenticated(req: Request): boolean {
  return !!req.user;
}
