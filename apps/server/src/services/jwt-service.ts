/**
 * JWTService - Handles JWT token generation and validation for AECORD team auth
 */

import jwt, { SignOptions, Secret, Algorithm } from 'jsonwebtoken';
import { createLogger } from '@automaker/utils';
import type { User, JWTPayload } from '@automaker/types';

const logger = createLogger('JWTService');

const DEFAULT_EXPIRES_IN_SECONDS = 8 * 60 * 60; // 8 hours in seconds

/**
 * JWTService - Manages JWT token lifecycle
 */
export class JWTService {
  private secretKey: string;
  private expiresInSeconds: number;

  constructor(secretKey: string, expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    this.secretKey = secretKey;
    this.expiresInSeconds = expiresInSeconds;
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(user: User): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      serviceAreas: user.serviceAreas || [],
    };

    const options: SignOptions = {
      expiresIn: this.expiresInSeconds,
    };

    const token = jwt.sign(payload, this.secretKey as Secret, options);

    logger.debug(`Token generated for user: ${user.username}`);
    return token;
  }

  /**
   * Verify a JWT token and return the payload
   * Returns null if token is invalid or expired
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.secretKey) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid token:', error.message);
      } else {
        logger.error('Token verification error:', error);
      }
      return null;
    }
  }

  /**
   * Decode a JWT token without verification (useful for debugging)
   * Returns null if token cannot be decoded
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload | null;
      return decoded;
    } catch (error) {
      logger.error('Token decode error:', error);
      return null;
    }
  }

  /**
   * Refresh a JWT token if it's still valid
   * Returns null if the original token is invalid
   */
  refreshToken(token: string): string | null {
    const payload = this.verifyToken(token);
    if (!payload) {
      return null;
    }

    // Create new token with same payload but fresh timestamps
    const newPayload = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      serviceAreas: payload.serviceAreas,
    };

    const options: SignOptions = {
      expiresIn: this.expiresInSeconds,
    };

    const newToken = jwt.sign(newPayload, this.secretKey as Secret, options);

    logger.debug(`Token refreshed for user: ${payload.username}`);
    return newToken;
  }

  /**
   * Get token expiration time in seconds
   */
  getExpiresInSeconds(): number {
    return this.expiresInSeconds;
  }
}

/**
 * Create JWT service with secret from environment
 */
export function createJWTService(): JWTService {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Generate a warning but use a fallback for development
    const fallbackSecret = 'development-secret-change-in-production-' + Date.now();
    logger.warn('JWT_SECRET not set! Using generated fallback (NOT SAFE FOR PRODUCTION)');
    return new JWTService(fallbackSecret);
  }

  return new JWTService(secret);
}
