import { Request, Response, NextFunction } from 'express';
import { SessionUser } from '../services/auth';

// Extend Express Session type
declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
}

/**
 * Middleware to require instructor or admin role
 */
export function requireInstructor(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.session.user.role !== 'instructor' && req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Instructor access required'
    });
  }

  next();
}

/**
 * Get current user from session
 */
export function getCurrentUser(req: Request): SessionUser | null {
  return req.session.user || null;
}
