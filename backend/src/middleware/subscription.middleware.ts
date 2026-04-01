import { Request, Response, NextFunction } from 'express';
import subscriptionService from '../services/subscription.service';

/**
 * Middleware to check if user can use AI features
 */
export const checkSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    const canUse = await subscriptionService.canUseAI(userId as string);

    if (!canUse) {
      res.status(403).json({
        success: false,
        message: 'Subscription expired. Please upgrade to continue using AI features.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status'
    });
  }
};