import { Request, Response, NextFunction } from 'express';
import subscriptionService from '../services/subscription.service';


// ─────────────────────────────────────────────────────────────────
// checkSubscription
// Existing middleware — now delegates to checkReplyLimit internally
// Backward compatible — no changes needed in routes that use it
// ─────────────────────────────────────────────────────────────────
export const checkSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const canUse = await subscriptionService.canUseAI(userId as string);

    if (!canUse) {
      res.status(403).json({
        success: false,
        message: 'Your trial has ended. Please upgrade to continue using AI features.',
        code:    'SUBSCRIPTION_EXPIRED',
        upgrade: true,
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to check subscription status' });
  }
};


// ─────────────────────────────────────────────────────────────────
// checkContactLimit
// Add to POST /contacts route — before the contact is created
// ─────────────────────────────────────────────────────────────────
export const checkContactLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const result = await subscriptionService.checkContactLimit(userId as string);

    if (!result.allowed) {

      // Pending user — hasn't activated trial yet
      if (result.code === 'SUBSCRIPTION_REQUIRED') {
        res.status(403).json({
          success: false,
          message: 'Activate your free trial to add contacts.',
          code:    'TRIAL_NOT_ACTIVATED',
          upgrade: false,
        });
        return;
      }

      // Contact limit reached
      res.status(403).json({
        success: false,
        message: `You've reached the ${result.limit} contact limit on your ${result.plan} plan. Upgrade to add more.`,
        code:    'CONTACT_LIMIT_REACHED',
        current: result.current,
        limit:   result.limit,
        plan:    result.plan,
        upgrade: true,
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to check contact limit' });
  }
};


// ─────────────────────────────────────────────────────────────────
// checkReplyLimit
// Add to any route that triggers an AI reply generation
// ─────────────────────────────────────────────────────────────────
export const checkReplyLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const result = await subscriptionService.checkReplyLimit(userId as string);

    if (!result.allowed) {

      // Trial expired
      if (result.code === 'TRIAL_EXPIRED') {
        res.status(403).json({
          success: false,
          message: 'Your 7-day trial has ended. Upgrade to keep your AI running.',
          code:    'TRIAL_EXPIRED',
          upgrade: true,
        });
        return;
      }

      // Subscription required (pending)
      if (result.code === 'SUBSCRIPTION_REQUIRED') {
        res.status(403).json({
          success: false,
          message: 'Activate your free trial to use AI replies.',
          code:    'TRIAL_NOT_ACTIVATED',
          upgrade: false,
        });
        return;
      }

      // Daily limit hit
      res.status(429).json({
        success:  false,
        message:  `You've used all ${result.limit} AI replies for today. Resets at midnight. Upgrade for more.`,
        code:     'REPLY_LIMIT_REACHED',
        used:     result.current,
        limit:    result.limit,
        plan:     result.plan,
        upgrade:  true,
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to check reply limit' });
  }
};