import { Router, Request, Response } from 'express';
import { User, StudentStatus } from '../models';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { authenticate } from '../middleware/auth.middleware';
import { registerValidation, loginValidation } from '../middleware/validation.middleware';
import { StudentMode, SubscriptionStatus } from '../types';
import bcrypt from 'bcryptjs';


const router = Router();


/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', registerValidation, async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;

    // ── Normalize phone — strip spaces, dashes, leading + ────────
    // Ensures "91 98765-43210" and "919876543210" are treated as same
    const normalizedPhone = phone.replace(/[\s\-\+]/g, '');

    // ── Check email uniqueness ────────────────────────────────────
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
      return;
    }

    // ── Check phone uniqueness ────────────────────────────────────
    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: 'This phone number is already registered. Please log in instead.'
      });
      return;
    }

    // ── Hash password ─────────────────────────────────────────────
    const passwordHash = await hashPassword(password);

    // ── Create user ───────────────────────────────────────────────
    // subscriptionStatus starts as PENDING — trial is activated
    // explicitly by the user later via activateTrial()
    const user = await User.create({
      name,
      email,
      passwordHash,
      phone: normalizedPhone,
      subscriptionStatus: SubscriptionStatus.PENDING,
    });

    // ── Create default student status ─────────────────────────────
    await StudentStatus.create({
      userId: user._id,
      mode: StudentMode.AVAILABLE,
      autoAwayEnabled: true,
      autoAwayMinutes: 30,
      lastActiveAt: new Date(),
    });

    // ── Generate token ────────────────────────────────────────────
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subscriptionStatus: user.subscriptionStatus,   // 'pending'
          plan: user.plan,                 // 'trial' (the plan tier, not status)
          trialActivatedAt: user.trialActivatedAt,     // null
          trialEndsAt: user.trialEndsAt,          // null
          repliesUsedToday: user.repliesUsedToday,     // 0
          referralCode: user.referralCode,         // 'X7KP2R'
          referredBy: user.referredBy,           // null
          bonusDays: user.bonusDays,            // 0
        },
        token,
      },
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});


/**
 * POST /api/v1/auth/login
 * User login
 */
router.post('/login', loginValidation, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const token = generateToken(user._id.toString());

    await StudentStatus.findOneAndUpdate(
      { userId: user._id },
      { lastActiveAt: new Date() },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subscriptionStatus: user.subscriptionStatus,   // 'pending'
          plan: user.plan,                 // 'trial' (the plan tier, not status)
          trialActivatedAt: user.trialActivatedAt,     // null
          trialEndsAt: user.trialEndsAt,          // null
          repliesUsedToday: user.repliesUsedToday,     // 0
          referralCode: user.referralCode,         // 'X7KP2R'
          referredBy: user.referredBy,           // null
          bonusDays: user.bonusDays,            // 0
        },
        token,
      },
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});


/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
});


/**
 * POST /api/v1/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', authenticate, async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});


/**
 * PATCH /api/v1/auth/change-password
 */
router.patch('/change-password', async (req: Request, res: Response) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'userId, currentPassword, and newPassword are required'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to change password'
    });
  }
});


export default router;