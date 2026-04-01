import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { User } from '../models';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

/**
 * Authentication middleware - verify JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Please login.'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token
    const decoded = verifyToken(token);

    // Check if user exists
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
      return;
    }

    // Attach user info to request
    req.userId = decoded.userId;
    req.user = user;

    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (user) {
        req.userId = decoded.userId;
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};